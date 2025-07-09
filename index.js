require('dotenv').config();
const { Client, LocalAuth, MessageMedia, ClientState } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const LLMFactory = require('./llm/llmFactory');
const chatHandler = require('./handlers/chatHandler');
const commandHandler = require('./handlers/commandHandler');
const kbManager = require('./kb/kbManager');
const blocklist = require('./utils/blocklist');
const fileHandler = require('./kb/fileHandler');
const ragProcessor = require('./kb/ragProcessor');
const fileWatcher = require('./kb/fileWatcher');
const voiceHandler = require('./utils/voiceHandler');
const { handleTimeDateQuery } = require('./utils/timeUtils');

// Import bots
const TelegramBotService = require('./services/telegramBot');

// Import GUI server
const guiServer = require('./guiServer');

// Import workflow manager
const WorkflowManager = require('./workflow/workflowManager');
const workflowManager = new WorkflowManager();

// Initialize Telegram bot if token is provided
let telegramBot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  try {
    telegramBot = new TelegramBotService(process.env.TELEGRAM_BOT_TOKEN);
    telegramBot.start();
  } catch (error) {
    console.error('Failed to start Telegram bot:', error);
  }
}

// Make chatHandler globally available for workflow messages
global.chatHandler = chatHandler;

// Flag to track if shutdown is in progress
let isShuttingDown = false;

/**
 * Handle graceful shutdown of the application
 */
async function handleGracefulShutdown() {
  if (isShuttingDown) {
    console.log('Shutdown already in progress...');
    return;
  }
  
  isShuttingDown = true;
  console.log('\nGraceful shutdown initiated...');
  
  // Clear any pending reconnection attempts
  clearTimeout(reconnectTimeout);
  
  try {
    // Shutdown workflow system
    if (workflowManager) {
      console.log('Shutting down workflow system...');
      await workflowManager.shutdown();
    }
    
    // Shutdown Telegram bot if running
    if (telegramBot) {
      console.log('Shutting down Telegram bot...');
      telegramBot.stop();
    }
    
    // Close WhatsApp client
    if (client) {
      console.log('Closing WhatsApp client...');
      await client.destroy();
      console.log('WhatsApp client closed');
    }
    
    console.log('Shutdown complete. Exiting...');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Initialize WhatsApp client with error handling
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.resolve(process.cwd(), '.wwebjs_auth'),
    clientId: 'wa-bot-client'
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
  },
  restartOnAuthFail: process.env.WA_RESTART_ON_AUTH_FAILURE === 'true',
});

// Environment variables
const WA_RESTART_ON_AUTH_FAILURE = process.env.WA_RESTART_ON_AUTH_FAILURE === 'true';
const GUI_PORT = process.env.GUI_PORT || 3000;
const CLEAR_WORKFLOWS_ON_STARTUP = process.env.CLEAR_WORKFLOWS_ON_STARTUP === 'true';

// Track active LLM client
let currentLLMClient = null;

// Update the LLM client based on command handler settings
function updateLLMClient() {
  const settings = commandHandler.getCurrentSettings();
  
  // Create LLM client with appropriate options
  const options = {
    mcpResourceUri: settings.mcpResourceUri
  };
  
  // Create new LLM client instance
  currentLLMClient = LLMFactory.createLLMClient(settings.provider, options);
  
  // Update the model and other settings based on provider
  if (['openai', 'openrouter', 'ollama'].includes(settings.provider)) {
    currentLLMClient.model = settings.model;
    
    // Set base URL for Ollama if not already set
    if (settings.provider === 'ollama') {
      currentLLMClient.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    }
  }
  
  // Update system prompt and parameters
  if (currentLLMClient.setSystemPrompt) {
    currentLLMClient.setSystemPrompt(settings.systemPrompt);
  }
  
  if (currentLLMClient.setParameters) {
    currentLLMClient.setParameters(settings.parameters || {});
  }
  
  // Update Telegram bot's LLM client if it exists
  if (global.telegramBot) {
    try {
      global.telegramBot.llmClient = currentLLMClient;
      console.log('Updated Telegram bot LLM client with new provider:', settings.provider);
    } catch (error) {
      console.error('Failed to update Telegram bot LLM client:', error);
    }
  }
  
  console.log(`LLM client updated - Provider: ${settings.provider}, Model: ${settings.model}`);
  console.log(`System prompt: ${settings.systemPrompt.substring(0, 50)}${settings.systemPrompt.length > 50 ? '...' : ''}`);
  
  return currentLLMClient;
}

// Make updateLLMClient globally available
global.updateLLMClient = updateLLMClient;

// Make client globally available for QR code generation
global.client = client;

// Initialize the LLM client
updateLLMClient();

// Store original sendMessage
const originalSendMessage = client.sendMessage.bind(client);

// Patch the sendMessage function to handle message types
client.sendMessage = async function(chatId, content, options = {}) {
  console.log('[Message-Debug] sendMessage called with:', {
    chatId,
    content: typeof content === 'string' ? content.substring(0, 50) + '...' : content,
    options: {
      ...options,
      // Don't log the entire message content to avoid cluttering logs
      quotedMsg: options.quotedMsg ? '[Message]' : undefined
    }
  });

  // Skip if it's a group message
  if (chatId.includes('@g.us')) {
    console.log('[Message-Debug] Skipping group message');
    return originalSendMessage(chatId, content, options);
  }
  
  // Skip if it's an automated message, bot response, or forwarded message
  if (options.isAutomated || options.isBotResponse || options.isResponseToUser) {
    console.log('[Message-Debug] Skipping automated/bot message');
    return originalSendMessage(chatId, content, options);
  }
  
  // Get the bot's phone number (without @c.us)
  const botNumber = client.info?.wid?.user;
  console.log('[Message-Debug] Bot number:', botNumber);
  
  if (!botNumber) {
    console.error('[Manual-Block] Could not determine bot number');
    return originalSendMessage(chatId, content, options);
  }
  
  // Bot's full ID with @c.us suffix
  const botId = `${botNumber}@c.us`;
  
  // Check if message is from the bot in any possible format
  const isFromBot = 
    // Direct fromMe flag
    options.fromMe === true || 
    options.fromMe === 'true' ||
    // Check author/from fields with @c.us suffix
    (options.author && options.author.endsWith(botId)) ||
    (options.from && options.from.endsWith(botId)) ||
    // Check author/from fields without @c.us suffix
    (options.author && options.author === botNumber) ||
    (options.from && options.from === botNumber) ||
    // Check if message is from the bot's number in any format
    (options.author && options.author.includes(botNumber)) ||
    (options.from && options.from.includes(botNumber));
  
  // Get the message sender's ID in a clean format
  const senderId = (options.author || options.from || '').toString().trim();
  const cleanSenderId = senderId.endsWith('@c.us') ? 
    senderId : 
    senderId.includes('@') ? 
      senderId : // Keep as is if it has some other domain
      `${senderId}@c.us`; // Add @c.us if no domain
  
  // Log detailed debug info
  console.log('[Message-Debug] Message details:', {
    isFromBot,
    fromMe: options.fromMe,
    from: options.from,
    author: options.author,
    cleanSenderId,
    botId,
    botNumber,
    isDirectMatch: cleanSenderId === botId || cleanSenderId === botNumber,
    // Log all options except large objects
    options: Object.entries(options)
      .filter(([key]) => !['quotedMsg', 'quotedMessage', 'media'].includes(key))
      .reduce((obj, [key, value]) => ({
        ...obj,
        [key]: typeof value === 'object' ? 
          (Array.isArray(value) ? `[Array(${value.length})]` : '[Object]') : 
          value
      }), {})
  });
  
  // Only process manual messages from bot
  if (!isFromBot) {
    console.log('[Message-Debug] Not from bot, skipping block');
    return originalSendMessage(chatId, content, options);
  }
  
  // Log the manual message from bot
  console.log(`[Manual-Block] Manual message from bot ${botNumber} to ${chatId}`);
  
  try {
    // Only process direct messages
    if (!isGroup) {
      const cleanChatId = chatId.split('@')[0];
      
      console.log(`[Manual-Block] Adding temp block for manual message to ${cleanChatId}`);
      
      // Add a 5-minute temporary block for manual messages
      const blockDuration = 5 * 60 * 1000; // 5 minutes
      const success = blocklist.addTempBlock(
        cleanChatId, 
        blockDuration, 
        'manual - admin message sent',
        true  // Mark as manual block
      );
      
      if (success) {
        console.log(`[Manual-Block] Temporarily blocked ${cleanChatId} for ${blockDuration/1000} seconds`);
      }
    } else {
      console.log(`[Message-Type] Non-blocking message:`, {
        isGroup,
        isAutomated,
        isCommandResponse,
        isReplyToBot,
        hasBotResponseFlag: options.isBotResponse === true
      });
    }
  } catch (error) {
    console.error('[Manual-Block] Error in sendMessage interceptor:', error);
    // Don't fail the message send if our block logic fails
  }
  
  // Call the original sendMessage
  return originalSendMessage(chatId, content, options);
};

// QR code handling - store for web interface
client.on('qr', (qr) => {
  console.log('QR Code generated for web interface');
  // Store the QR code data for the web interface
  global.qrCodeData = qr;
  
  // If there's a pending QR code request, respond to it
  if (global.pendingQrResolve) {
    global.pendingQrResolve({ qr });
    global.pendingQrResolve = null;
  }
});

// Authentication handling
client.on('authenticated', () => {
  console.log('Client is authenticated!');
  // Reset reconnect attempts on successful authentication
  reconnectAttempts = 0;
  clearTimeout(reconnectTimeout);
});

client.on('auth_failure', (msg) => {
  console.error('Authentication failure:', msg);
  if (!isShuttingDown) {
    console.log('Will attempt to reconnect...');
    scheduleReconnect();
  }
});

// Handle disconnection events
client.on('disconnected', (reason) => {
  console.log('Client was disconnected:', reason);
  if (!isShuttingDown) {
    console.log('Attempting to reconnect...');
    scheduleReconnect();
  }
});

// Handle connection state changes
client.on('change_state', (state) => {
  console.log('Client state changed:', state);
  
  if (state === 'TIMEOUT' || state === 'CONFLICT' || state === 'UNPAIRED') {
    console.log('Connection issue detected, attempting to reconnect...');
    scheduleReconnect();
  }
});

// Ready event
client.on('ready', async () => {
  console.log('WhatsApp client is ready!');
  updateLLMClient();
  
  // Make WhatsApp client globally available
  global.whatsappClient = {
    client: client
  };
  console.log('WhatsApp client made globally available');
  
  // Initialize all services independently
  initializeServices().catch(console.error);
});

// Handle file uploads for knowledge base
client.on('message_create', async (message) => {
  // Only process messages from others, not from yourself
  if (message.fromMe) return;
  
  // Check if the message has media and a filename caption starting with 'kb:'
  if (message.hasMedia && message.body.startsWith('kb:')) {
    const chatId = message.from;
    
    try {
      // Extract filename from the caption
      const filename = message.body.substring(3).trim();
      if (!filename) {
        await message.reply('Please provide a filename after "kb:" to add this document to the knowledge base.');
        return;
      }
      
      // Download media
      const media = await message.downloadMedia();
      if (!media) {
        await message.reply('Could not download the file.');
        return;
      }
      
      await message.reply('Processing document for knowledge base...');
      
      // Process the file and add to knowledge base
      const result = await fileHandler.saveAndProcessFile(media, filename);
      
      // Send result message
      await message.reply(result.message);
    } catch (error) {
      console.error('Error processing document:', error);
      await message.reply(`Error processing document: ${error.message}`);
    }
  }
});

// Helper function to send an automated message (won't trigger manual blocks)
function sendAutomatedMessage(chatId, content, options = {}) {
  // Always mark as bot response and automated
  const botOptions = {
    ...options,
    isAutomated: true,
    isBotResponse: true,
    isCommandResponse: options.isCommandResponse || false,
    isReplyToBot: options.isReplyToBot || false,
    // Add a flag to indicate this is a response to a user message
    isResponseToUser: true
  };
  
  console.log('[Automated-Message] Sending bot response with options:', botOptions);
  return client.sendMessage(chatId, content, botOptions);
}

// Make it available globally
global.sendMessage = sendAutomatedMessage;

// Message processing
// Handle voice messages
client.on('message', async (message) => {
  // Skip messages from self
  if (message.fromMe) return;
  
  // Initialize message type flags if not set
  message.isCommand = message.isCommand || false;
  message.isReplyToBot = message.isReplyToBot || false;
  
  // Handle voice messages
  if (message.hasMedia && message.type === 'ptt') {
    try {
      const chat = await message.getChat();
      await chat.sendStateRecording();
      
      console.log(`[Voice] Processing voice message from ${message.from}`);
      const result = await voiceHandler.processVoiceMessage(
        { seconds: message.duration },
        message
      );
      
      if (result.error) {
        console.error(`[Voice] Error: ${result.error}`);
        return; // Don't send error message to user for voice processing failures
      }
      
      if (result.text) {
        // Process the transcribed text as a regular message
        console.log(`[Voice] Transcribed: ${result.text}`);
        
        // Create a pseudo-message with the transcribed text
        const pseudoMsg = {
          ...message,
          body: result.text,
          hasQuotedMsg: false,
          _data: {
            ...message._data,
            body: result.text,
            isVoiceMessage: true
          },
          // Add a reply method to the pseudo-message
          reply: async (text) => {
            return message.reply(`🎤 *You said*: ${result.text}\n\n${text}`);
          }
        };
        
        // Emit a new message event with the transcribed text
        client.emit('message', pseudoMsg);
      }
      return;
    } catch (error) {
      console.error('[Voice] Error handling voice message:', error);
      return;
    }
  }
  
  // Skip media uploads handled by other handler
  if (message.hasMedia && message.body && message.body.startsWith('kb:')) return;
  
  // Check if sender is blocked (only check for manual blocks)
  const senderNumber = message.from.split('@')[0]; // Remove @c.us suffix if present
  if (blocklist.isBlocked(senderNumber, 'whatsapp', true)) {
    console.log(`[Block] Ignoring message from manually blocked number: ${senderNumber}`);
    return;
  }
  
  // Handle replies to bot messages
  if (message.hasQuotedMsg) {
    const quotedMsg = await message.getQuotedMessage();
    if (quotedMsg.fromMe) {
      console.log('Processing reply to bot message');
      // Mark as reply to bot in the message options
      message.isReplyToBot = true;
      // Continue processing but mark as reply in the options
      options = { ...options, isReplyToBot: true };
    }  
  }
  
  const chatId = message.from;
  const messageText = (message.body || '').trim();
  
  // Skip empty messages
  if (!messageText) return;
  
  // Debug message properties to understand what we're receiving
  console.log('Message object keys:', Object.keys(message));
  console.log('Is group?', message.isGroupMsg, message.fromMe);
  console.log('Chat type:', message._data?.chat?.isGroup);
  
  // Log detailed message data to help debug mentions
  console.log('Message data:', {
    mentionedIds: message.mentionedIds,
    _data: message._data ? {
      mentionedJidList: message._data.mentionedJidList,
      id: message._data.id,
      from: message._data.from,
      to: message._data.to,
      self: message._data.self,
      participant: message._data.participant
    } : 'No _data'
  });
  
  // SIMPLE GROUP DETECTION: Standard WhatsApp group IDs end with @g.us
  const isGroup = chatId.endsWith('@g.us');
  
  // Handle group messages differently
  if (isGroup) {
    // FORCE ENABLE GROUP REQUIREMENT - Group messages must explicitly enable the bot
    const GROUP_CHAT_REQUIRE_MENTION = true;  // Hard-coded safety switch
    
    console.log(`[Group Chat] Message received in group: ${chatId}`);
    console.log(`[Group Chat] From: ${message.author || 'unknown'}`);
    console.log(`[Group Chat] Message: ${messageText}`);
    
    // Initialize BotIdManager if not already done
    if (!global.botIdManager) {
      const BotIdManager = require('./utils/botIdManager');
      global.botIdManager = BotIdManager;
      await global.botIdManager.initialize();
    }
    
    // Get the bot's number from client.info
    const botNumber = client.info ? client.info.wid._serialized : '';
    console.log(`[Group Chat] Bot number: ${botNumber}`);
    
    // Get the bot's phone number (without the @c.us part)
    const botPhoneNumber = botNumber ? botNumber.split('@')[0] : null;
    
    // Check if message specifically mentions the bot
    let isBotMentioned = false;
    
    // 1. Check if the message has mentions
    if (message.mentionedIds && message.mentionedIds.length > 0) {
      console.log(`[Group] Message has ${message.mentionedIds.length} mentions:`, message.mentionedIds);
      
      // 2. Add any new mentioned IDs to our known bot IDs
      const newIds = await global.botIdManager.addMentionedIds(message.mentionedIds);
      if (newIds.length > 0) {
        console.log(`[Group] Learned ${newIds.length} new bot IDs:`, newIds);
      }
      
      // 3. Check if any of the mentioned IDs match our known bot IDs
      for (const mentionedId of message.mentionedIds) {
        if (global.botIdManager.hasBotId(mentionedId)) {
          isBotMentioned = true;
          console.log(`[Group] Bot mentioned via ID match: ${mentionedId}`);
          break;
        }
        
        // Also check if the ID contains the bot's phone number
        if (botPhoneNumber && mentionedId.includes(botPhoneNumber)) {
          await global.botIdManager.addBotId(mentionedId);
          isBotMentioned = true;
          console.log(`[Group] Bot mentioned via phone number match: ${mentionedId}`);
          break;
        }
      }
      
      // 4. If no match found, log for debugging
      if (!isBotMentioned) {
        console.log(`[Group] No mention match found. Known bot IDs:`, global.botIdManager.getKnownBotIds());
      }
    }
    
    // Method 2: Fallback to text-based mention detection
    if (!isBotMentioned && botPhoneNumber) {
      // Extract all @mentions from the message text
      const mentionRegex = /@([0-9]+)/g;
      const mentions = [];
      let match;
      
      while ((match = mentionRegex.exec(messageText)) !== null) {
        mentions.push(match[1]);
      }
      
      console.log(`[Group] Detected text mentions in message:`, mentions);
      
      // Check if any text mention matches the bot's number
      if (mentions.length > 0) {
        for (const mention of mentions) {
          // Try exact match first
          if (mention === botPhoneNumber) {
            isBotMentioned = true;
            console.log(`[Group] Bot explicitly mentioned by exact number in text: @${mention}`);
            break;
          }
          
          // If direct match fails, try matching the last 8+ digits
          const minLength = Math.min(mention.length, botPhoneNumber.length);
          if (minLength >= 8) {
            const mentionSuffix = mention.slice(-minLength);
            const botSuffix = botPhoneNumber.slice(-minLength);
            
            if (mentionSuffix === botSuffix) {
              isBotMentioned = true;
              console.log(`[Group] Bot mentioned by partial number match in text: @${mention} matches suffix of ${botPhoneNumber}`);
              break;
            }
          }
        }
      }
    }
    
    // Check for standard trigger words from config file
    let botTriggers = ['bot', 'xeno', 'whatsxeno']; // Default fallback
    
    try {
      // Try to load triggers from config file
      const triggersPath = path.join(__dirname, 'config/triggers.json');
      if (fs.existsSync(triggersPath)) {
        const triggersData = JSON.parse(fs.readFileSync(triggersPath, 'utf8'));
        if (triggersData && Array.isArray(triggersData.groupTriggers)) {
          botTriggers = triggersData.groupTriggers;
          console.log(`[Group] Loaded ${botTriggers.length} triggers from config`);
        }
      }
    } catch (error) {
      console.error('[Group] Error loading triggers from config:', error.message);
      // Fall back to default triggers + env var if available
      if (process.env.GROUP_CHAT_TRIGGER) {
        botTriggers.push(process.env.GROUP_CHAT_TRIGGER);
      }
    }
    
    // Convert all triggers to lowercase
    botTriggers = botTriggers.map(t => t.toLowerCase());
    
    // Normalize message text for comparison
    // 1. Convert to lowercase
    // 2. Remove any special formatting that might be applied to mentions
    let lowerMessage = messageText.toLowerCase();
    
    // Create a normalized version of the message that strips special characters
    // This helps with matching @mentions which might have different formatting on different devices
    const normalizedMessage = lowerMessage.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F]/g, '');
    
    console.log(`[Group] Original message: '${messageText}'`);
    console.log(`[Group] Normalized message: '${normalizedMessage}'`);
    
    // Check for ANY trigger word in the message (not just at start)
    let hasTriggerWord = false;
    for (const trigger of botTriggers) {
      // Try matching against both the original lowercase message and the normalized version
      if (lowerMessage.includes(trigger) || normalizedMessage.includes(trigger)) {
        hasTriggerWord = true;
        console.log(`[Group] Trigger word found: '${trigger}'`);
        break;
      }
      
      // Special handling for @ mentions
      if (trigger.startsWith('@')) {
        // Try matching without the @ symbol in case it's formatted differently
        const triggerWithoutAt = trigger.substring(1);
        if (lowerMessage.includes(triggerWithoutAt) || normalizedMessage.includes(triggerWithoutAt)) {
          hasTriggerWord = true;
          console.log(`[Group] Trigger word found (without @): '${triggerWithoutAt}'`);
          break;
        }
      }
    }
    
    // Check if this message is a reply to one of the bot's messages
    let isReplyToBot = false;
    let quotedMessage = null;
    
    try {
      // Get the quoted message if it exists
      quotedMessage = message._data?.quotedMsg;
      
      if (quotedMessage) {
        console.log('[Group] Quoted message details:', {
          fromMe: quotedMessage.fromMe,
          participant: quotedMessage.participant,
          sender: quotedMessage.sender,
          botNumber: botNumber,
          id: quotedMessage.id,
          raw: JSON.stringify(quotedMessage, null, 2)
        });
        
        // Normalize bot number for comparison (remove @c.us if present)
        const normalizedBotNumber = botNumber.split('@')[0];
        
        // Check 1: Direct fromMe flag
        if (quotedMessage.fromMe === true) {
          isReplyToBot = true;
          console.log(`[Group] Reply detected (fromMe: true)`);
        }
        
        // Check 2: Participant match (group chat)
        if (!isReplyToBot && quotedMessage.participant) {
          const quotedParticipant = quotedMessage.participant.split('@')[0];
          if (quotedParticipant === normalizedBotNumber) {
            isReplyToBot = true;
            console.log(`[Group] Reply detected (participant match: ${quotedParticipant})`);
          }
        }
        
        // Check 3: Sender ID match (alternative format)
        if (!isReplyToBot && quotedMessage.sender) {
          let senderId = quotedMessage.sender;
          
          // Handle different sender ID formats
          if (typeof senderId === 'string') {
            if (senderId.includes('@')) {
              senderId = senderId.split('@')[0];
            }
            if (senderId === normalizedBotNumber) {
              isReplyToBot = true;
              console.log(`[Group] Reply detected (sender.id string match: ${senderId})`);
            }
          } else if (senderId._serialized) {
            const serializedId = senderId._serialized.split('@')[0];
            if (serializedId === normalizedBotNumber) {
              isReplyToBot = true;
              console.log(`[Group] Reply detected (sender._serialized match: ${serializedId})`);
            }
          }
        }
        
        // Check 4: Try to get the quoted message explicitly
        if (!isReplyToBot) {
          try {
            const quotedMsgObj = await message.getQuotedMessage();
            if (quotedMsgObj && quotedMsgObj.fromMe) {
              isReplyToBot = true;
              console.log(`[Group] Reply confirmed via getQuotedMessage()`);
            }
          } catch (err) {
            console.log(`[Group] Error in getQuotedMessage:`, err.message);
          }
        }
      }
    } catch (error) {
      console.error(`[Group] Error checking for reply to bot:`, error);
    }

    // Determine if bot should respond based on specific rules
    const shouldRespond = isBotMentioned || hasTriggerWord || isReplyToBot;
    console.log(`[Group] Should bot respond? ${shouldRespond} (mention: ${isBotMentioned}, trigger: ${hasTriggerWord}, reply: ${isReplyToBot})`);
    
    if (!shouldRespond && GROUP_CHAT_REQUIRE_MENTION) {
      console.log(`[Group Chat] IGNORING - Bot not explicitly mentioned or triggered`);
      return;  // CRITICAL: Don't process this message
    }
    
    // Log that we're proceeding with this group message
    console.log(`[Group Chat] PROCESSING GROUP MESSAGE - Bot was called!`);
    
    // Process message based on whether it's a reply to the bot or not
    let timeDateResponse = null;
    let cleanMessageText = messageText.trim();
    
    // If this is a reply to the bot, handle it specially
    if (isReplyToBot) {
      console.log('[Group] Processing reply to bot message');
      
      // First try with the original message
      timeDateResponse = handleTimeDateQuery(cleanMessageText);
      
      // If no match, try cleaning common reply prefixes
      if (!timeDateResponse) {
        const cleanedReply = cleanMessageText.replace(/^[\s\S]*?[:：]\s*/, '').trim();
        if (cleanedReply !== cleanMessageText) {
          console.log(`[Group] Trying cleaned reply text: "${cleanedReply}"`);
          timeDateResponse = handleTimeDateQuery(cleanedReply);
        }
      }
      
      // If we still don't have a response, treat the full message as the query
      if (!timeDateResponse) {
        timeDateResponse = handleTimeDateQuery(cleanMessageText);
      }
      
      // If we have a time/date response, send it and return
      if (timeDateResponse) {
        console.log('[Group Chat] Handling time/date query in reply');
        try {
          await message.reply(timeDateResponse);
          return;
        } catch (error) {
          console.error('Error sending time/date response to reply:', error);
        }
      }
    } 
    // Not a reply to bot, process normally
    else {
      // Check for time/date queries in the original message
      timeDateResponse = handleTimeDateQuery(cleanMessageText);
      
      // If we have a time/date response, send it and return
      if (timeDateResponse) {
        console.log('[Group Chat] Handling time/date query');
        try {
          await message.reply(timeDateResponse);
          return;
        } catch (error) {
          console.error('Error sending time/date response in group:', error);
        }
      }
      
      // Clean message text - remove mentions or trigger words
      if (hasTriggerWord) {
        for (const trigger of botTriggers) {
          if (lowerMessage.startsWith(trigger)) {
            // Remove trigger from start of message
            cleanMessageText = messageText.substring(trigger.length).trim();
            console.log(`[Group] Removed trigger '${trigger}', message now: ${cleanMessageText}`);
            break;
          }
        }
      }
      
      // If there's an @ symbol, try to remove the first @mention pattern
      if (isBotMentioned && cleanMessageText.includes('@')) {
        // Remove the bot's mention from the message
        cleanMessageText = cleanMessageText.replace(new RegExp(`@${botPhoneNumber}\\s*`), '').trim();
        console.log(`[Group] Cleaned @ mention, message now: ${cleanMessageText}`);
      }
      
      // Check again with the cleaned message
      if (!timeDateResponse) {
        const cleanedTimeDateResponse = handleTimeDateQuery(cleanMessageText);
        if (cleanedTimeDateResponse) {
          console.log('[Group Chat] Handling time/date query (after cleaning)');
          try {
            await message.reply(cleanedTimeDateResponse);
            return;
          } catch (error) {
            console.error('Error sending cleaned time/date response in group:', error);
          }
        }
      }
    }
    
    // Final check for time/date queries with the cleaned message
    if (!timeDateResponse) {
      const cleanedTimeDateResponse = handleTimeDateQuery(cleanMessageText);
      if (cleanedTimeDateResponse) {
        console.log('[Group Chat] Handling time/date query (after cleaning)');
        try {
          await message.reply(cleanedTimeDateResponse);
          return;
        } catch (error) {
          console.error('Error sending cleaned time/date response in group:', error);
        }
      }
    }
    
    // Forward the cleaned message to workflow system
    try {
      await workflowManager.publishWhatsAppMessage({
        chatId,
        body: cleanMessageText,
        from: message.from,
        sender: message.author || message.from,
        isGroup: true,
        groupName: message.chat?.name || 'Group',
        timestamp: message.timestamp,
        type: message.type
      });
      console.log('[Group Chat] Message published to workflow system');
    } catch (error) {
      console.error('[Group Chat] Error publishing message to workflow:', error);
    }
    
    // CRITICAL FIX: Generate and send a response for group chats too!
    try {
      // Send typing indicator
      const chat = await message.getChat();
      chat.sendStateTyping();
      console.log('[Group Chat] Sent typing indicator');
      
      let response;
      
      // Check if message is a command
      if (commandHandler.isCommand(cleanMessageText)) {
        response = await commandHandler.processCommand(cleanMessageText, chatId, message.author || message.from);
        updateLLMClient(); // Update LLM client if provider/model changed
      } else {
        // Add user message to chat history with platform identifier
        chatHandler.addMessage(chatId, 'user', cleanMessageText, 'whatsapp');
        
        // Get conversation history with platform identifier
        const conversation = chatHandler.getConversation(chatId, 'whatsapp');
        
        // Get current settings
        const settings = commandHandler.getCurrentSettings();
        
        // Convert conversation to format expected by LLM
        let messages = [
          { role: 'system', content: settings.systemPrompt },
          ...conversation.map(msg => ({ role: msg.role, content: msg.content }))
        ];
        
        // Apply RAG if enabled
        let context = null;
        if (settings.ragEnabled) {
          const ragResult = await ragProcessor.processQuery(cleanMessageText, messages);
          messages = ragResult.messages;
          context = ragResult.context;
          
          if (context) {
            console.log('[Group Chat] RAG context applied to query');
          }
        }
        
        // Process message with current LLM and parameters
        if (settings.provider === 'mcp') {
          // For MCP, we pass parameters directly
          response = await currentLLMClient.generateResponse(cleanMessageText, messages, settings.parameters);
        } else {
          // For other providers, we pass parameters in the standard way
          response = await currentLLMClient.generateResponse(cleanMessageText, messages, settings.parameters);
        }
        
        // Add assistant response to chat history with platform identifier
        chatHandler.addMessage(chatId, 'assistant', response, 'whatsapp');
        
        // Add citations if RAG was used and citations are enabled
        const showCitations = process.env.KB_SHOW_CITATIONS === 'true';
        if (context && showCitations) {
          const sources = extractSourcesFromContext(context);
          if (sources.length > 0) {
            response += '\n\n*Sources:* ' + sources.join(', ');
          }
        }
      }
      
      // Send response back as automated message with appropriate flags
      await sendAutomatedMessage(message.from, response, {
        isCommandResponse: message.isCommand,
        isReplyToBot: message.isReplyToBot,
        isBotResponse: true,    // Explicitly mark as bot response
        isAutomated: true,      // Mark as automated
        isResponseToUser: true  // Mark as response to user
      });
      console.log('[Group Chat] Response sent successfully');
    } catch (error) {
      console.error('[Group Chat] Error processing message:', error);
      await message.reply(`Sorry, I encountered an error: ${error.message}`);
    }
    
    // Skip the direct message handling
    return;
  }
  
  // Additional verification - if any group chat identifiers are found, don't proceed
  // This is a failsafe in case the group chat detection above fails
  if (chatId.includes('@g.us') || (message.author && message.author !== message.from)) {
    console.log(`[Safety] Message appears to be from a group but wasn't caught earlier - ignoring`);
    return;
  }

  // Handle direct messages (non-group)
  console.log(`[Direct] Message from ${chatId}: ${messageText}`);
  
  // Check for time/date queries in direct messages
  const timeDateResponse = handleTimeDateQuery(messageText);
  if (timeDateResponse) {
    console.log('[Direct] Handling time/date query');
    try {
      await message.reply(timeDateResponse);
      return;
    } catch (error) {
      console.error('Error sending time/date response in direct message:', error);
    }
  }
  
  // Forward message to workflow system for keyword triggers
  try {
    // Publish message to MQTT for workflow triggers
    await workflowManager.publishWhatsAppMessage({
      chatId,
      body: messageText,
      from: message.from,
      timestamp: message.timestamp,
      type: message.type
    });
    console.log('[Direct] Message published to workflow system');
  } catch (error) {
    console.error('[Direct] Error publishing message to workflow:', error);
  }
  
  try {
    // Send typing indicator
    const chat = await message.getChat();
    chat.sendStateTyping();
    
    let response;
    
    // Check if message is a command
    if (commandHandler.isCommand(messageText)) {
      response = await commandHandler.processCommand(messageText, chatId, message.from);
      updateLLMClient(); // Update LLM client if provider/model changed
    } else {
      // Add user message to chat history
      chatHandler.addMessage(chatId, 'user', messageText);
      
      // Get conversation history
      const conversation = chatHandler.getConversation(chatId);
      
      // Get current settings
      const settings = commandHandler.getCurrentSettings();
      
      // Convert conversation to format expected by LLM
      let messages = [
        { role: 'system', content: settings.systemPrompt },
        ...conversation.map(msg => ({ role: msg.role, content: msg.content }))
      ];
      
      // Apply RAG if enabled
      let context = null;
      if (settings.ragEnabled) {
        const ragResult = await ragProcessor.processQuery(messageText, messages);
        messages = ragResult.messages;
        context = ragResult.context;
        
        if (context) {
          console.log('RAG context applied to query');
        }
      }
      
      // Process message with current LLM and parameters
      if (settings.provider === 'mcp') {
        // For MCP, we pass parameters directly
        response = await currentLLMClient.generateResponse(messageText, messages, settings.parameters);
      } else {
        // For other providers, we pass parameters in the standard way
        response = await currentLLMClient.generateResponse(messageText, messages, settings.parameters);
      }
      
      // Add assistant response to chat history
      chatHandler.addMessage(chatId, 'assistant', response);
      
      // Add citations if RAG was used and citations are enabled
      const showCitations = process.env.KB_SHOW_CITATIONS === 'true';
      if (context && showCitations) {
        const sources = extractSourcesFromContext(context);
        if (sources.length > 0) {
          response += '\n\n*Sources:* ' + sources.join(', ');
        }
      }
    }
    
    // Send response
    if (message && typeof message.reply === 'function') {
      await message.reply(response);
    } else {
      console.error('Invalid message object, cannot send reply:', message);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    // Don't send error message to user to avoid the 'serialize' error
    // Just log it to the console for debugging
    console.error('Error details:', {
      error: error.message,
      stack: error.stack,
      messageId: message?.id?._serialized || 'no message id',
      chatId: message?.from || 'unknown chat'
    });
  }
});

// Auto-reconnect configuration
const RECONNECT_INTERVAL = 10000; // 10 seconds
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectTimeout;

/**
 * Initialize WhatsApp client with auto-reconnect
 */
function initializeClient() {
  console.log('Initializing WhatsApp client...');
  client.initialize().catch(err => {
    console.error('Failed to initialize client:', err);
    scheduleReconnect();
  });
}

/**
 * Handle reconnection logic
 */
function scheduleReconnect() {
  if (isShuttingDown) {
    console.log('Shutdown in progress, skipping reconnection');
    return;
  }

  reconnectAttempts++;
  
  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnection attempts reached. Please check your internet connection and restart the bot.');
    return;
  }

  const delay = Math.min(RECONNECT_INTERVAL * Math.pow(2, reconnectAttempts - 1), 300000); // Max 5 minutes
  console.log(`Attempting to reconnect in ${delay/1000} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
  
  clearTimeout(reconnectTimeout);
  reconnectTimeout = setTimeout(() => {
    initializeClient();
  }, delay);
}

// Initialize all services independently
async function initializeServices() {
  // Initialize workflow system
  try {
    await initializeWorkflowSystem();
  } catch (error) {
    console.error('Error initializing workflow system:', error);
  }
  
  // Initialize knowledge base
  try {
    await kbManager.initialize();
    console.log('Knowledge base initialized');
    
    // Start file watcher for the uploads directory
    fileWatcher.startWatching();
  } catch (error) {
    console.error('Error initializing knowledge base:', error);
  }
  
  // Initialize other services here as needed
}

// Initialize workflow system
async function initializeWorkflowSystem() {
  try {
    // Make bot components available to workflows
    const botComponents = {
      whatsappClient: client,  // This will be null until WhatsApp is connected
      chatHandler: chatHandler,
      commandHandler: commandHandler,
      kbManager: kbManager,
      fileHandler: fileHandler,
      ragProcessor: ragProcessor
    };
    
    // Initialize the workflow manager with bot components
    await workflowManager.initialize(botComponents);
    console.log('Workflow system initialized with MQTT broker');
    
    // Clear workflows on startup if configured
    if (CLEAR_WORKFLOWS_ON_STARTUP) {
      console.log('CLEAR_WORKFLOWS_ON_STARTUP is enabled, clearing all workflows...');
      await workflowManager.clearEnabledWorkflows();
    } else {
      console.log('CLEAR_WORKFLOWS_ON_STARTUP is disabled, workflows will maintain their previous state');
    }
    
    // Update the WhatsApp client reference when it becomes available
    if (client) {
      workflowManager.updateBotComponent('whatsappClient', client);
    }
  } catch (workflowError) {
    console.error('Error initializing workflow system:', workflowError);
  }
}

// Register shutdown handlers
process.on('SIGINT', handleGracefulShutdown);
process.on('SIGTERM', handleGracefulShutdown);
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  handleGracefulShutdown();
});

// Initialize all services
initializeServices().catch(console.error);

// Initialize WhatsApp client
initializeClient();

/**
 * Extract source information from context for citations
 * @param {string} context - RAG context string
 * @returns {Array} - Array of source names
 */
function extractSourcesFromContext(context) {
  if (!context) return [];
  
  const sources = new Set();
  const regex = /Source: ([^\)\n]+)/g;
  let match;
  
  while ((match = regex.exec(context)) !== null) {
    sources.add(match[1]);
  }
  
  return Array.from(sources);
}

// Add error handling for unexpected errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Clean shutdown
  shutdown(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Continue running but log the error
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await shutdown(0);
});

/**
 * Clean shutdown function
 * @param {number} exitCode - Exit code to use
 */
async function shutdown(exitCode = 0) {
  console.log('Performing clean shutdown...');
  
  // Stop file watcher
  try {
    fileWatcher.stopWatching();
    console.log('File watcher stopped');
  } catch (err) {
    console.error('Error stopping file watcher:', err);
  }
  
  // Shutdown workflow system
  try {
    await workflowManager.shutdown();
    console.log('Workflow system shut down');
  } catch (err) {
    console.error('Error shutting down workflow system:', err);
  }
  
  // Destroy WhatsApp client
  try {
    await client.destroy();
    console.log('WhatsApp client destroyed');
  } catch (err) {
    console.error('Error destroying WhatsApp client:', err);
  }
  
  // Exit with provided code
  process.exit(exitCode);
}
