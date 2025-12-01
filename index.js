require('dotenv').config();
const { Client, LocalAuth, MessageMedia, ClientState } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const mqtt = require('mqtt');
const MQTT_URL = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883';
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const mqttClient = mqtt.connect(MQTT_URL, { username: MQTT_USER, password: MQTT_PASS });
mqttClient.on('connect', () => console.log('[MQTT] connected', MQTT_URL));
mqttClient.on('error', err => console.error('[MQTT] error', err));
const LLMFactory = require('./llm/llmFactory');
const chatHandler = require('./handlers/chatHandler');
const commandHandler = require('./handlers/commandHandler');
const kbManager = require('./kb/kbManager');
const blocklist = require('./utils/blocklist');
const fileHandler = require('./kb/fileHandler');
const ragProcessor = require('./kb/ragProcessor');
const fileWatcher = require('./kb/fileWatcher');
const voiceHandler = require('./utils/voiceHandler');
const visionHandler = require('./utils/visionHandler');
const { handleTimeDateQuery } = require('./utils/timeUtils');
const alertNotifier = require('./utils/alertNotifier');

// Import bots
const TelegramBotService = require('./services/telegramBot');
const FacebookMessengerService = require('./services/facebookMessenger');
const FacebookChatService = require('./services/facebookChatService');
const InstagramService = require('./services/instagramService');
const InstagramPrivateService = require('./services/instagramPrivateService');
const InstagramWebService = require('./services/instagramWebService');

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
    console.log('Telegram bot started successfully');
  } catch (error) {
    console.error('Failed to start Telegram bot:', error);
  }
}

// Initialize Facebook Messenger if credentials are provided
let facebookMessenger = null;
console.log('🚑 FACEBOOK INITIALIZATION CHECK:');
console.log('   • FACEBOOK_PAGE_ACCESS_TOKEN:', !!process.env.FACEBOOK_PAGE_ACCESS_TOKEN);
console.log('   • FACEBOOK_VERIFY_TOKEN:', !!process.env.FACEBOOK_VERIFY_TOKEN);
console.log('   • FACEBOOK_EMAIL:', !!process.env.FACEBOOK_EMAIL);
console.log('   • FACEBOOK_PASSWORD:', !!process.env.FACEBOOK_PASSWORD);
console.log('   • FACEBOOK_APP_STATE:', !!process.env.FACEBOOK_APP_STATE);

if (process.env.FACEBOOK_PAGE_ACCESS_TOKEN && process.env.FACEBOOK_VERIFY_TOKEN) {
  try {
    facebookMessenger = new FacebookMessengerService(
      process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
      process.env.FACEBOOK_VERIFY_TOKEN,
      process.env.FACEBOOK_APP_SECRET
    );
    
    // Initialize the official Facebook Messenger service
    facebookMessenger.initialize().then(result => {
      if (result.success) {
        console.log('✅ Facebook Messenger service (official API) started successfully');
        global.facebookMessenger = facebookMessenger;
      } else {
        console.log('No Facebook credentials provided');
        
        // FORCE TEST: Try to initialize Facebook anyway if app state exists
        if (process.env.FACEBOOK_APP_STATE) {
          console.log('🚑 FORCE INITIALIZING FACEBOOK WITH APP STATE...');
          try {
            const FacebookChatService = require('./services/facebookChatService');
            facebookMessenger = new FacebookChatService(null, null, process.env.FACEBOOK_APP_STATE);
            console.log('🚑 FORCE FACEBOOK SERVICE CREATED!');
            
            facebookMessenger.initialize().then(success => {
              if (success) {
                console.log('🚑 FORCE Facebook Chat service started successfully');
                global.facebookMessenger = facebookMessenger;
              } else {
                console.error('🚑 FORCE Failed to login to Facebook Chat');
              }
            }).catch(error => {
              console.error('🚑 FORCE Facebook Chat initialization error:', error);
            });
          } catch (error) {
            console.error('🚑 FORCE Facebook initialization failed:', error);
          }
        }
      }
    }).catch(error => {
      console.error('❌ Facebook Messenger initialization error:', error.message);
    });
  } catch (error) {
    console.error('Failed to initialize Facebook Messenger:', error);
  }
} else if (process.env.FACEBOOK_EMAIL && process.env.FACEBOOK_PASSWORD || process.env.FACEBOOK_APP_STATE) {
  console.log('🚑 UNOFFICIAL FACEBOOK CONDITION MET!');
  try {
    console.log('🚑 CREATING FACEBOOK CHAT SERVICE...');
    facebookMessenger = new FacebookChatService(
      process.env.FACEBOOK_EMAIL,
      process.env.FACEBOOK_PASSWORD,
      process.env.FACEBOOK_APP_STATE
    );
    console.log('🚑 FACEBOOK CHAT SERVICE CREATED!');
    
    // Initialize in background
    facebookMessenger.initialize().then(success => {
      if (success) {
        console.log('Facebook Chat service (unofficial) started successfully');
        
        // Set up Facebook message handler
        facebookMessenger.onMessage(async (err, message) => {
          if (err) {
            console.error('Facebook message error:', err);
            return;
          }
          
          try {
            console.log('📱 Processing Facebook message:', message.body);
            
            // Create a mock WhatsApp-like message object for compatibility
            const mockMessage = {
              body: message.body,
              from: `facebook_${message.senderID}`,
              fromMe: false,
              type: 'chat',
              timestamp: message.timestamp || Date.now(),
              author: message.senderID,
              to: 'facebook_bot',
              hasMedia: false,
              _data: {
                id: {
                  fromMe: false,
                  remote: `facebook_${message.threadID}`,
                  id: message.messageID
                },
                body: message.body,
                type: 'chat',
                timestamp: message.timestamp || Date.now(),
                notifyName: message.conversationName || message.senderID
              },
              // Add reply method for Facebook
              reply: async (text) => {
                try {
                  await facebookMessenger.sendMessage(text, message.threadID);
                  console.log('✅ Facebook reply sent:', text);
                } catch (error) {
                  console.error('❌ Facebook reply failed:', error.message);
                }
              }
            };
            
            // Process through WA-BOT's main chat handler
            await chatHandler.handleMessage(mockMessage);
            
          } catch (error) {
            console.error('❌ Error processing Facebook message:', error.message);
          }
        });
        
        // Store globally for access from other parts of the app
        global.facebookMessenger = facebookMessenger;
        
      } else {
        console.error('Failed to login to Facebook Chat');
      }
    }).catch(error => {
      console.error('Facebook Chat initialization error:', error);
    });
  } catch (error) {
    console.error('Failed to initialize Facebook Chat:', error);
  }
} else {
  console.log('No Facebook credentials provided');
  
  // FORCE TEST: Try to initialize Facebook anyway if app state exists
  if (process.env.FACEBOOK_APP_STATE) {
    console.log('🚑 FORCE INITIALIZING FACEBOOK WITH APP STATE...');
    try {
      const FacebookChatService = require('./services/facebookChatService');
      facebookMessenger = new FacebookChatService(null, null, process.env.FACEBOOK_APP_STATE);
      console.log('🚑 FORCE FACEBOOK SERVICE CREATED!');
      
      facebookMessenger.initialize().then(success => {
        if (success) {
          console.log('🚑 FORCE Facebook Chat service started successfully');
          
          // Set up Facebook message handler for FORCE initialization
          facebookMessenger.onMessage(async (err, message) => {
            if (err) {
              console.error('Facebook message error:', err);
              return;
            }
            
            try {
              console.log('📱 Processing Facebook message (FORCE):', message.body);
              
              // Create a mock WhatsApp-like message object for compatibility
              const mockMessage = {
                body: message.body,
                from: `facebook_${message.senderID}`,
                fromMe: false,
                type: 'chat',
                timestamp: message.timestamp || Date.now(),
                author: message.senderID,
                to: 'facebook_bot',
                hasMedia: false,
                _data: {
                  id: {
                    fromMe: false,
                    remote: `facebook_${message.threadID}`,
                    id: message.messageID
                  },
                  body: message.body,
                  type: 'chat',
                  timestamp: message.timestamp || Date.now(),
                  notifyName: message.conversationName || message.senderID
                },
                // Add reply method for Facebook
                reply: async (text) => {
                  try {
                    await facebookMessenger.sendMessage(text, message.threadID);
                    console.log('✅ Facebook reply sent (FORCE):', text);
                  } catch (error) {
                    console.error('❌ Facebook reply failed (FORCE):', error.message);
                  }
                }
              };
              
              // Process through WA-BOT's main chat handler
              await chatHandler.handleMessage(mockMessage);
              
            } catch (error) {
              console.error('❌ Error processing Facebook message (FORCE):', error.message);
            }
          });
          
          global.facebookMessenger = facebookMessenger;
        } else {
          console.error('🚑 FORCE Failed to login to Facebook Chat');
        }
      }).catch(error => {
        console.error('🚑 FORCE Facebook Chat initialization error:', error);
      });
    } catch (error) {
      console.error('🚑 FORCE Facebook initialization failed:', error);
    }
  }
}

// Initialize Instagram service if credentials are provided
let instagramService = null;
if (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_VERIFY_TOKEN) {
  try {
    instagramService = new InstagramService(
      process.env.INSTAGRAM_ACCESS_TOKEN,
      process.env.INSTAGRAM_VERIFY_TOKEN,
      process.env.INSTAGRAM_APP_SECRET
    );
    console.log('Instagram service (official API) initialized');
  } catch (error) {
    console.error('Failed to initialize Instagram service:', error);
  }
}

// Initialize Instagram Private API as fallback if credentials are provided
let instagramPrivateService = null;
let instagramWebService = null;

if ((process.env.INSTAGRAM_USERNAME && process.env.INSTAGRAM_PASSWORD) || process.env.INSTAGRAM_SESSION_ID) {
  // Try Instagram Private API first
  try {
    instagramPrivateService = new InstagramPrivateService();
    
    // Initialize in background
    instagramPrivateService.initialize().then(success => {
      if (success) {
        console.log('Instagram Private API service started successfully');
      } else {
        console.error('Instagram Private API failed, trying web automation...');
        // If Private API fails, try web automation
        initializeInstagramWeb();
      }
    }).catch(error => {
      console.error('Instagram Private API initialization error:', error);
      // If Private API fails, try web automation
      initializeInstagramWeb();
    });
  } catch (error) {
    console.error('Failed to initialize Instagram Private API:', error);
    // If Private API fails, try web automation
    initializeInstagramWeb();
  }
}

// Function to initialize Instagram Web Service as fallback
function initializeInstagramWeb() {
  console.log('Instagram Web Service fallback disabled - Private API should be used instead');
  console.log('If you need Instagram Web automation, enable it manually in the code');
  return;
  
  try {
    instagramWebService = new InstagramWebService(
      process.env.INSTAGRAM_USERNAME,
      process.env.INSTAGRAM_PASSWORD
    );
    
    instagramWebService.initialize().then(success => {
      if (success) {
        console.log('Instagram Web service started successfully');
      } else {
        console.error('Failed to initialize Instagram Web service');
      }
    }).catch(error => {
      console.error('Instagram Web initialization error:', error);
    });
  } catch (error) {
    console.error('Failed to initialize Instagram Web service:', error);
  }
}

// Make services globally available
global.chatHandler = chatHandler;
global.workflowManager = workflowManager;
global.telegramBot = telegramBot;
global.facebookMessenger = facebookMessenger;
global.instagramService = instagramService;
global.instagramPrivateService = instagramPrivateService;
global.instagramWebService = instagramWebService;

// Flag to track if shutdown is in progress
let isShuttingDown = false;

// WhatsApp connection state tracking - MUST be declared before client initialization
const whatsappConnectionState = {
  status: 'initializing', // initializing, loading, qr_pending, authenticating, authenticated, disconnected, error, timeout
  lastStateChange: Date.now(),
  qrCodeGenerated: null,
  qrCodeExpiry: null,
  reconnectAttempts: 0,
  lastError: null,
  isReady: false,
  phoneNumber: null,
  pushname: null,
  clientInfo: null,
  loadingStartTime: null,
  authStartTime: null,
  lastAlertSentAt: 0
};

// Make state globally available
global.whatsappConnectionState = whatsappConnectionState;

// QR code expiry timeout (WhatsApp QR codes expire after ~60 seconds)
const QR_CODE_TIMEOUT = 60000; // 60 seconds
let qrExpiryTimeout = null;
let lastQrCodeTime = 0;
const QR_CODE_DEBOUNCE = 5000; // Don't log QR codes more than once per 5 seconds

// Auto-reconnect configuration
const RECONNECT_INTERVAL = 10000; // 10 seconds
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectTimeout;
let readyStateAlertLogged = false;
const initialAlertCooldown = alertNotifier.getCooldown();

if (alertNotifier.isConfigured()) {
  const recipients = alertNotifier.getRecipients();
  console.log(`[Alerts] SMS alerts enabled. Recipients: ${recipients.join(', ')} | Cooldown: ${initialAlertCooldown / 1000}s`);
} else {
  console.log('[Alerts] SMS alerts disabled. Configure ALERT_PHONE_NUMBER and Twilio credentials to enable.');
}

async function maybeSendAlert(status, reason) {
  if (!alertNotifier.isConfigured()) {
    if (!readyStateAlertLogged) {
      console.log('[Alerts] SMS alert system not fully configured. Skipping alerts.');
      readyStateAlertLogged = true;
    }
    return;
  }

  const cooldown = alertNotifier.getCooldown();
  const now = Date.now();
  if (now - whatsappConnectionState.lastAlertSentAt < cooldown) {
    console.log('[Alerts] Cooldown active, skipping SMS alert.');
    return;
  }

  whatsappConnectionState.lastAlertSentAt = now;
  const message = `[WA-BOT] WhatsApp connection alert: ${status.toUpperCase()} - ${reason || 'No reason provided'}`;

  try {
    const result = await alertNotifier.sendConnectionAlert(message);
    if (result.success) {
      console.log('[Alerts] SMS alert sent successfully.');
    } else {
      console.warn('[Alerts] SMS alert failed to send.', result);
    }
  } catch (error) {
    console.error('[Alerts] Error sending SMS alert:', error.message);
  }
}

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
    timeout: 0, // Disable timeout
  },
  webVersion: '2.3000.0', // Force specific version to skip detection
  webVersionCache: {
    type: 'none', // Disable version caching
  },
  authTimeoutMs: 0, // Disable auth timeout
  qrMaxRetries: 5,
  takeoverOnConflict: true, // Take over existing sessions
  takeoverTimeoutMs: 0, // Disable takeover timeout
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
  
  // Make the current LLM client globally available
  global.currentLLMClient = currentLLMClient;
  
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

// === MQTT helpers for WhatsApp events ===
function looksLikeMediaRequest(text) {
  const s = String(text || '');
  return /(photo|image|picture|pic|screenshot|video|audio|voice|document|file|media|attachment|upload|send|receipt|proof)/i.test(s)
      || /相片|照片|圖片|截圖|影片|語音|錄音|文件|檔案|媒體|收據|單據|凭证|憑證|上傳|上載|發送|发送|傳送/.test(s);
}

function publishBotOutgoing(chatId, content) {
  if (!chatId) return;
  const payload = {
    platform: 'whatsapp',
    to: chatId,
    chatId: chatId,
    text: typeof content === 'string' ? content : '',
    requireMedia: looksLikeMediaRequest(content)
  };
  try {
    mqttClient.publish('bot/outgoing', JSON.stringify({ payload }), { qos: 1 });
  } catch (e) {
    console.error('[MQTT] publish bot/outgoing failed', e);
  }
}

function publishInboundWhatsApp(message) {
  try {
    // Cache inbound message by id for later forwarding (e.g., proofs)
    try {
      const mid = (message && message.id && (message.id._serialized || message.id.id || message.id)) || null;
      if (mid) {
        if (!global.whatsappMessageCache) global.whatsappMessageCache = new Map();
        global.whatsappMessageCache.set(mid, message);
      }
    } catch(_) {}

    const payload = {
      platform: 'whatsapp',
      chatId: message.from,
      messageId: (message && message.id && (message.id._serialized || message.id.id || message.id)) || null,
      author: message.author || null,
      isGroup: !!(message.from && message.from.includes('@g.us')),
      text: message.body,
      hasMedia: !!message.hasMedia,
      type: message.type
    };
    mqttClient.publish('whatsapp/messages', JSON.stringify({ payload }), { qos: 1 });
  } catch (e) {
    console.error('[MQTT] publish whatsapp/messages failed', e);
  }
}

// Store original sendMessage
const originalSendMessage = client.sendMessage.bind(client);

// Patch the sendMessage function to handle message types
client.sendMessage = async function(chatId, content, options = {}) {
  const timestamp = new Date().toISOString();
  const debugId = Math.random().toString(36).substring(2, 8);
  
  console.log(`[${timestamp}] [${debugId}] [SendMessage] Called with:`, {
    chatId,
    content: typeof content === 'string' ? content.substring(0, 100) : '[Non-string content]',
    options: {
      ...options,
      // Don't log large objects
      quotedMsg: options.quotedMsg ? '[Message]' : undefined,
      media: options.media ? '[Media]' : undefined
    },
    stack: new Error().stack.split('\n').slice(1, 4).join('\n') // Show call stack
  });
  console.log(`[${timestamp}] [${debugId}] [Message-Debug] sendMessage details:`, {
    chatId,
    content: typeof content === 'string' ? content.substring(0, 50) + '...' : content,
    options: {
      ...options,
      // Don't log the entire message content to avoid cluttering logs
      quotedMsg: options.quotedMsg ? '[Message]' : undefined
    }
  });

  // If it's a group message, still publish to MQTT so workflows can react, then send.
  if (chatId.includes('@g.us')) {
    try { publishBotOutgoing(chatId, typeof content === 'string' ? content : ''); } catch (e) { console.error('[MQTT] publish bot/outgoing failed', e); }
    console.log(`[${timestamp}] [${debugId}] [Message-Debug] Skipping bot logic for group message after MQTT publish`);
    return originalSendMessage(chatId, content, options);
  }
  
  // Publish outgoing to MQTT for reminders
  try { publishBotOutgoing(chatId, typeof content === 'string' ? content : ''); } catch (e) { console.error('[MQTT] publish bot/outgoing failed', e); }
  
  // Skip if it's an automated message, bot response, or forwarded message
  if (options.isAutomated || options.isBotResponse || options.isResponseToUser) {
    console.log(`[${timestamp}] [${debugId}] [Message-Debug] Skipping automated/bot message`, {
      isAutomated: options.isAutomated,
      isBotResponse: options.isBotResponse,
      isResponseToUser: options.isResponseToUser
    });
    return originalSendMessage(chatId, content, options);
  }
  
  // Get the bot's phone number (without @c.us)
  const botNumber = client.info?.wid?.user;
  console.log(`[${timestamp}] [${debugId}] [Message-Debug] Bot info:`, {
    botNumber,
    clientInfo: client.info ? 'Available' : 'Missing',
    wid: client.info?.wid ? 'Available' : 'Missing'
  });
  
  if (!botNumber) {
    console.error(`[${timestamp}] [${debugId}] [Manual-Block] Could not determine bot number`);
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
  // Ignore QR code events if already authenticated or ready
  if (whatsappConnectionState.isReady || 
      whatsappConnectionState.status === 'authenticated' || 
      whatsappConnectionState.status === 'authenticating' ||
      whatsappConnectionState.status === 'loading') {
    console.log(`[QR] Ignoring QR code event - current status: ${whatsappConnectionState.status}, isReady: ${whatsappConnectionState.isReady}`);
    return;
  }
  
  const now = Date.now();
  
  // Debounce QR code logging to prevent spam during initialization
  const timeSinceLastQr = now - lastQrCodeTime;
  if (timeSinceLastQr < QR_CODE_DEBOUNCE && lastQrCodeTime > 0) {
    console.log(`[QR] QR code regenerated (${(timeSinceLastQr/1000).toFixed(1)}s since last) - updating silently`);
  } else {
    console.log(`[QR] QR Code generated for web interface (status: ${whatsappConnectionState.status})`);
  }
  
  lastQrCodeTime = now;
  
  // Update connection state
  whatsappConnectionState.status = 'qr_pending';
  whatsappConnectionState.qrCodeGenerated = now;
  whatsappConnectionState.qrCodeExpiry = now + QR_CODE_TIMEOUT;
  whatsappConnectionState.lastStateChange = now;
  whatsappConnectionState.lastError = null;
  
  // Store the QR code data for the web interface
  global.qrCodeData = qr;
  
  // Clear any existing QR expiry timeout
  if (qrExpiryTimeout) {
    clearTimeout(qrExpiryTimeout);
  }
  
  // Set timeout to detect QR code expiry
  qrExpiryTimeout = setTimeout(() => {
    if (whatsappConnectionState.status === 'qr_pending') {
      console.warn('⚠️ QR Code expired without being scanned');
      whatsappConnectionState.status = 'timeout';
      whatsappConnectionState.lastError = 'QR code expired without being scanned';
      whatsappConnectionState.lastStateChange = Date.now();
      
      // QR should regenerate automatically, but if not, we track this state
      console.log('ℹ️ A new QR code should be generated automatically');
      maybeSendAlert('timeout', 'QR code expired without being scanned');
    }
  }, QR_CODE_TIMEOUT);
  
  // If there's a pending QR code request, respond to it
  if (global.pendingQrResolve) {
    global.pendingQrResolve({ qr });
    global.pendingQrResolve = null;
  }
});

// Loading state detection
client.on('loading_screen', (percent, message) => {
  console.log(`Loading: ${percent}% - ${message}`);
  
  if (!whatsappConnectionState.loadingStartTime) {
    whatsappConnectionState.loadingStartTime = Date.now();
  }
  
  whatsappConnectionState.status = 'loading';
  whatsappConnectionState.lastStateChange = Date.now();
});

// Authentication handling
client.on('authenticated', (session) => {
  console.log('✅ Client is authenticated!');
  console.log(`[Auth] Session loaded from: ${path.resolve(process.cwd(), '.wwebjs_auth/wa-bot-client')}`);
  
  // Clear QR expiry timeout
  if (qrExpiryTimeout) {
    clearTimeout(qrExpiryTimeout);
    qrExpiryTimeout = null;
  }
  
  // Update connection state
  whatsappConnectionState.status = 'authenticating';
  whatsappConnectionState.authStartTime = Date.now();
  whatsappConnectionState.lastStateChange = Date.now();
  whatsappConnectionState.lastError = null;
  whatsappConnectionState.qrCodeGenerated = null;
  whatsappConnectionState.qrCodeExpiry = null;
  
  // Clear QR code data
  delete global.qrCodeData;
  
  // Reset reconnect attempts on successful authentication
  reconnectAttempts = 0;
  whatsappConnectionState.reconnectAttempts = 0;
  clearTimeout(reconnectTimeout);
});

client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failure:', msg);
  
  // Update connection state
  whatsappConnectionState.status = 'error';
  whatsappConnectionState.lastError = `Authentication failure: ${msg}`;
  whatsappConnectionState.lastStateChange = Date.now();
  whatsappConnectionState.isReady = false;
  
  // Clear QR code data
  delete global.qrCodeData;
  
  maybeSendAlert('error', `Authentication failure: ${msg}`);

  if (!isShuttingDown) {
    console.log('Will attempt to reconnect...');
    scheduleReconnect();
  }
});

// Handle disconnection events
client.on('disconnected', (reason) => {
  console.log('⚠️ Client was disconnected:', reason);
  
  // Update connection state
  whatsappConnectionState.status = 'disconnected';
  whatsappConnectionState.lastError = `Disconnected: ${reason}`;
  whatsappConnectionState.lastStateChange = Date.now();
  whatsappConnectionState.isReady = false;
  whatsappConnectionState.phoneNumber = null;
  whatsappConnectionState.pushname = null;
  whatsappConnectionState.clientInfo = null;

  maybeSendAlert('disconnected', reason);

  if (!isShuttingDown) {
    console.log('Attempting to reconnect...');
    scheduleReconnect();
  }
});

// Handle connection state changes
client.on('change_state', (state) => {
  console.log('🔄 Client state changed:', state);
  
  // Map whatsapp-web.js states to our state tracking
  if (state === 'CONNECTED') {
    whatsappConnectionState.status = 'authenticating';
  } else if (state === 'OPENING') {
    whatsappConnectionState.status = 'loading';
  } else if (state === 'TIMEOUT') {
    whatsappConnectionState.status = 'timeout';
    whatsappConnectionState.lastError = 'Connection timeout';
    maybeSendAlert('timeout', 'Connection timeout');
  } else if (state === 'CONFLICT') {
    whatsappConnectionState.status = 'error';
    whatsappConnectionState.lastError = 'Session conflict detected';
    maybeSendAlert('conflict', 'Session conflict detected');
  } else if (state === 'UNPAIRED') {
    whatsappConnectionState.status = 'disconnected';
    whatsappConnectionState.lastError = 'Device unpaired';
    maybeSendAlert('unpaired', 'Device unpaired');
  }
  
  whatsappConnectionState.lastStateChange = Date.now();
  
  if (state === 'TIMEOUT' || state === 'CONFLICT' || state === 'UNPAIRED') {
    console.log('⚠️ Connection issue detected, attempting to reconnect...');
    scheduleReconnect();
  }
});

// Ready event
client.on('ready', async () => {
  console.log('✅ WhatsApp client is ready!');
  
  // Update connection state with full details
  whatsappConnectionState.status = 'authenticated';
  whatsappConnectionState.isReady = true;
  whatsappConnectionState.lastStateChange = Date.now();
  whatsappConnectionState.lastError = null;
  whatsappConnectionState.phoneNumber = client.info?.wid?.user;
  whatsappConnectionState.pushname = client.info?.pushname;
  whatsappConnectionState.clientInfo = {
    platform: client.info?.platform,
    phone: client.info?.phone
  };
  whatsappConnectionState.reconnectAttempts = 0;
  whatsappConnectionState.loadingStartTime = null;
  whatsappConnectionState.authStartTime = null;
  whatsappConnectionState.lastAlertSentAt = 0;
  
  // Calculate connection time if we have timestamps
  if (whatsappConnectionState.qrCodeGenerated) {
    const connectionTime = Date.now() - whatsappConnectionState.qrCodeGenerated;
    console.log(`⏱️ Connection established in ${(connectionTime/1000).toFixed(1)} seconds`);
  }
  
  // Clear QR code data
  delete global.qrCodeData;
  whatsappConnectionState.qrCodeGenerated = null;
  whatsappConnectionState.qrCodeExpiry = null;
  
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
  console.log('[Message-Event] New message received:', {
    from: message.from,
    to: message.to,
    fromMe: message.fromMe,
    hasMedia: message.hasMedia,
    type: message.type,
    body: message.body?.substring(0, 100),
    timestamp: new Date(message.timestamp * 1000).toISOString(),
    mimetype: message._data?.mimetype,
    mediaKey: message._data?.mediaKey ? 'present' : 'absent'
  });

  // Skip messages from self
  if (message.fromMe) {
    console.log('[Message-Event] Skipping message from self');
    return;
  }
  
  // Publish inbound WhatsApp message to MQTT
  try { publishInboundWhatsApp(message); } catch (e) { console.error('[MQTT] publish inbound error', e); }

  // Initialize message type flags if not set
  message.isCommand = message.isCommand || false;
  message.isReplyToBot = message.isReplyToBot || false;
  
  // Handle voice messages
  if (message.hasMedia && message.type === 'ptt') {
    // Skip if this is a pseudo-message (already processed voice message)
    if (message._data?.isVoiceMessage) {
      console.log('[Voice] Skipping already processed voice message');
      return;
    }
    
    // Check if this is a group message
    if (message.from.endsWith('@g.us')) {
      console.log('[Voice] Voice message in group - will be handled by group message logic');
      // Don't process voice messages in groups here
      // They will be handled by the group message handler only if the bot is mentioned
      return;
    }
    
    try {
      // Only try to get chat and send recording state if the original message has getChat method
      if (typeof message.getChat === 'function') {
        try {
          const chat = await message.getChat();
          await chat.sendStateRecording();
        } catch (chatError) {
          console.log(`[Voice] Could not set recording state: ${chatError.message}`);
          // Continue processing even if we can't set the recording state
        }
      }
      
      // Check if downloadMedia method exists
      if (typeof message.downloadMedia !== 'function') {
        console.error('[Voice] Cannot process voice message: downloadMedia method not available');
        return;
      }
      
      console.log(`[Voice] Processing voice message from ${message.from}`);
      const result = await voiceHandler.processVoiceMessage(
        { seconds: message.duration || 0 },
        message
      );
      
      if (result.error) {
        console.error(`[Voice] Error: ${result.error}`);
        return; // Don't send error message to user for voice processing failures
      }
      
      if (result.text) {
        // Process the transcribed text as a regular message
        console.log(`[Voice] Transcribed: ${result.text}`);
        
        // Check if message is from a group
        if (message.from.endsWith('@g.us')) {
          console.log('[Voice] Transcribed voice message from group - will be processed by group handler');
          // Create a pseudo-message but don't emit an event
          // Instead, let the group message handler deal with it
          return { text: result.text, error: null };
        }
        
        // Check if this is already a pseudo-message to prevent infinite loops
        if (message._data?.isVoiceMessage) {
          console.log('[Voice] Already processed this voice message, skipping re-processing');
          return;
        }
        
        // Create a simplified pseudo-message with just the text
        // Don't copy all properties from the original message to avoid method issues
        const pseudoMsg = {
          from: message.from,
          to: message.to,
          body: result.text,
          fromMe: message.fromMe,
          author: message.author,
          hasMedia: false, // Important: set to false to avoid voice processing loop
          type: 'chat', // Change type from 'ptt' to 'chat'
          hasQuotedMsg: false,
          isForwarded: false,
          _data: {
            notifyName: message._data?.notifyName,
            body: result.text,
            isVoiceMessage: true, // Mark as processed voice message
            from: message.from,
            to: message.to,
            self: message._data?.self
          },
          // Add essential methods
          reply: async (text) => {
            return typeof message.reply === 'function' ? 
              message.reply(`🎤 *You said*: ${result.text}\n\n${text}`) :
              client.sendMessage(message.from, `🎤 *You said*: ${result.text}\n\n${text}`);
          },
          getChat: () => { throw new Error('getChat not available on pseudo-message'); },
          downloadMedia: () => { throw new Error('downloadMedia not available on pseudo-message'); },
          delete: () => { throw new Error('delete not available on pseudo-message'); },
          // Add timestamp
          timestamp: message.timestamp || Date.now()/1000
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
  
  // Handle image messages with vision
  // Note: Sometimes hasMedia is false initially, so also check message type
  const isImageByType = message.type === 'image' || message.type === 'sticker';
  const isImageByMimetype = message._data?.mimetype && message._data.mimetype.startsWith('image/');
  const hasImageMedia = message.hasMedia && visionHandler.isImageMessage(message);
  
  // Also check if message has mediaKey (indicates media is present even if hasMedia is false initially)
  const hasMediaKey = message._data?.mediaKey !== undefined && message._data?.mediaKey !== null;
  
  // Log all image-related properties for debugging
  if (message.hasMedia || isImageByType || isImageByMimetype || hasMediaKey) {
    console.log('[Vision Debug] Potential image message:', {
      hasMedia: message.hasMedia,
      type: message.type,
      mimetype: message._data?.mimetype,
      hasMediaKey,
      isImageByType,
      isImageByMimetype,
      hasImageMedia,
      willProcess: hasImageMedia || isImageByType || isImageByMimetype || (hasMediaKey && (isImageByType || isImageByMimetype))
    });
  }
  
  if (hasImageMedia || isImageByType || isImageByMimetype || (hasMediaKey && (isImageByType || isImageByMimetype))) {
    console.log('[Vision] Image message detected!', {
      hasMedia: message.hasMedia,
      type: message.type,
      mimetype: message._data?.mimetype,
      body: message.body,
      from: message.from
    });
    
    // Skip if this is a pseudo-message (already processed image message)
    if (message._data?.isImageMessage) {
      console.log('[Vision] Skipping already processed image message');
      return;
    }
    
    // Check if this is a group message
    if (message.from.endsWith('@g.us')) {
      console.log('[Vision] Image message in group - will be handled by group message logic');
      // Don't process image messages in groups here
      // They will be handled by the group message handler only if the bot is mentioned
      return;
    }
    
    try {
      // Set typing state
      if (typeof message.getChat === 'function') {
        try {
          const chat = await message.getChat();
          await chat.sendStateTyping();
        } catch (chatError) {
          console.log(`[Vision] Could not set typing state: ${chatError.message}`);
        }
      }
      
      console.log(`[Vision] Processing image message from ${message.from}`);
      console.log(`[Vision] Message caption: "${message.body || '(no caption)'}"`);
      
      // Extract custom prompt from message caption
      const customPrompt = visionHandler.extractCustomPrompt(message.body);
      console.log(`[Vision] Custom prompt extracted: ${customPrompt ? `"${customPrompt.substring(0, 50)}..."` : 'none'}`);
      
      const result = await visionHandler.processImageMessage(message, customPrompt);
      console.log(`[Vision] Processing result:`, { hasText: !!result.text, error: result.error });
      
      if (result.error) {
        console.error(`[Vision] Error: ${result.error}`);
        try {
          await message.reply(`❌ ${result.error}`);
          console.log('[Vision] Error message sent to user');
        } catch (replyError) {
          console.error('[Vision] Failed to send error reply:', replyError);
        }
        return;
      }
      
      if (result.text) {
        console.log(`[Vision] Image analyzed: ${result.text.substring(0, 100)}...`);
        
        // Create a pseudo-message with the image description for AI processing
        // The AI will internalize the image content and respond naturally
        let aiPrompt;
        if (customPrompt) {
          // User asked a specific question about the image
          aiPrompt = `${customPrompt}\n\n[Context: The image shows ${result.text}]`;
        } else if (message.body) {
          // User sent caption with image
          aiPrompt = `${message.body}\n\n[Context: The image shows ${result.text}]`;
        } else {
          // No caption - respond to the image content
          aiPrompt = `[The user sent an image showing: ${result.text}]`;
        }
        
        console.log('[Vision] Creating AI message with image context...');
        const pseudoMsg = {
          from: message.from,
          to: message.to,
          body: aiPrompt,
          fromMe: message.fromMe,
          author: message.author,
          hasMedia: false,
          type: 'chat',
          hasQuotedMsg: false,
          isForwarded: false,
          _data: {
            notifyName: message._data?.notifyName,
            body: aiPrompt,
            isImageMessage: true,
            from: message.from,
            to: message.to,
            self: message._data?.self
          },
          reply: async (text) => {
            return typeof message.reply === 'function' ? 
              message.reply(text) :
              client.sendMessage(message.from, text);
          },
          getChat: () => { throw new Error('getChat not available on pseudo-message'); },
          downloadMedia: () => { throw new Error('downloadMedia not available on pseudo-message'); },
          delete: () => { throw new Error('delete not available on pseudo-message'); },
          timestamp: message.timestamp || Date.now()/1000
        };
        
        // Always process with AI to get a natural response
        client.emit('message', pseudoMsg);
      } else {
        console.warn('[Vision] No text in result and no error - this should not happen');
      }
      return;
    } catch (error) {
      console.error('[Vision] Error handling image message:', error);
      console.error('[Vision] Error stack:', error.stack);
      try {
        await message.reply(`❌ Error processing image: ${error.message}`);
        console.log('[Vision] Error message sent to user');
      } catch (replyError) {
        console.error('[Vision] Failed to send error reply:', replyError);
      }
      return;
    }
  }
  
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
  
  // CRITICAL: Check if this is a media message that wasn't caught by vision handler
  // This is a safety net to prevent media messages from being processed as text
  if (message.hasMedia && !message._data?.isImageMessage && !message._data?.isVoiceMessage) {
    console.log('[Media Safety Net] Unhandled media message detected:', {
      type: message.type,
      hasMedia: message.hasMedia,
      mimetype: message._data?.mimetype,
      body: message.body
    });
    
    // If it's an image type that wasn't caught, try to process it now
    if (message.type === 'image' || message.type === 'sticker' || 
        (message._data?.mimetype && message._data.mimetype.startsWith('image/'))) {
      console.log('[Media Safety Net] This appears to be an image - processing with vision handler');
      
      try {
        const customPrompt = visionHandler.extractCustomPrompt(message.body);
        const result = await visionHandler.processImageMessage(message, customPrompt);
        
        if (result.error) {
          await message.reply(`❌ ${result.error}`);
          return;
        }
        
        if (result.text) {
          // Create AI prompt with image context
          let aiPrompt;
          if (customPrompt) {
            aiPrompt = `${customPrompt}\n\n[Context: The image shows ${result.text}]`;
          } else if (message.body) {
            aiPrompt = `${message.body}\n\n[Context: The image shows ${result.text}]`;
          } else {
            aiPrompt = `[The user sent an image showing: ${result.text}]`;
          }
          
          // Create pseudo-message and re-emit
          const pseudoMsg = {
            from: message.from,
            to: message.to,
            body: aiPrompt,
            fromMe: message.fromMe,
            author: message.author,
            hasMedia: false,
            type: 'chat',
            hasQuotedMsg: false,
            isForwarded: false,
            _data: {
              notifyName: message._data?.notifyName,
              body: aiPrompt,
              isImageMessage: true,
              from: message.from,
              to: message.to,
              self: message._data?.self
            },
            reply: async (text) => {
              return typeof message.reply === 'function' ? 
                message.reply(text) :
                client.sendMessage(message.from, text);
            },
            getChat: () => { throw new Error('getChat not available on pseudo-message'); },
            downloadMedia: () => { throw new Error('downloadMedia not available on pseudo-message'); },
            delete: () => { throw new Error('delete not available on pseudo-message'); },
            timestamp: message.timestamp || Date.now()/1000
          };
          
          client.emit('message', pseudoMsg);
        }
        return;
      } catch (error) {
        console.error('[Media Safety Net] Error processing image:', error);
        await message.reply(`❌ Error processing image: ${error.message}`);
        return;
      }
    }
    
    // For other media types, just skip
    console.log('[Media Safety Net] Non-image media type - skipping');
    return;
  }
  
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
    
    // Check if message has mentions
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
      
      // If the bot is not specifically mentioned, don't process other mentions
      if (!isBotMentioned) {
        console.log(`[Group] Message has mentions but not for this bot - ignoring`);
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
    
    // Check if this is an image message in the group
    if (message.hasMedia && visionHandler.isImageMessage(message)) {
      console.log('[Group Vision] Image message detected in group!', {
        hasMedia: message.hasMedia,
        type: message.type,
        mimetype: message._data?.mimetype,
        body: message.body
      });
      
      try {
        // Set typing state
        if (typeof message.getChat === 'function') {
          try {
            const chat = await message.getChat();
            await chat.sendStateTyping();
          } catch (chatError) {
            console.log(`[Group Vision] Could not set typing state: ${chatError.message}`);
          }
        }
        
        console.log(`[Group Vision] Processing image message from ${message.author || message.from}`);
        console.log(`[Group Vision] Message caption: "${message.body || '(no caption)'}"`);
        
        // Extract custom prompt from message caption
        const customPrompt = visionHandler.extractCustomPrompt(message.body);
        console.log(`[Group Vision] Custom prompt extracted: ${customPrompt ? `"${customPrompt.substring(0, 50)}..."` : 'none'}`);
        
        const result = await visionHandler.processImageMessage(message, customPrompt);
        console.log(`[Group Vision] Processing result:`, { hasText: !!result.text, error: result.error });
        
        if (result.error) {
          console.error(`[Group Vision] Error: ${result.error}`);
          try {
            await message.reply(`❌ ${result.error}`);
            console.log('[Group Vision] Error message sent to group');
          } catch (replyError) {
            console.error('[Group Vision] Failed to send error reply:', replyError);
          }
          return;
        }
        
        if (result.text) {
          console.log(`[Group Vision] Image analyzed: ${result.text.substring(0, 100)}...`);
          
          // Create AI prompt with image context
          let aiPrompt;
          if (customPrompt) {
            // User asked a specific question about the image
            aiPrompt = `${customPrompt}\n\n[Context: The image shows ${result.text}]`;
          } else if (message.body) {
            // User sent caption with image
            aiPrompt = `${message.body}\n\n[Context: The image shows ${result.text}]`;
          } else {
            // No caption - respond to the image content
            aiPrompt = `[The user sent an image showing: ${result.text}]`;
          }
          
          console.log('[Group Vision] Creating AI message with image context...');
          
          // Process with AI using the image context
          const chatId = message.from;
          const formattedChatId = `chat_whatsapp_${chatId.split('@')[0]}_g.us`;
          
          // Save user message (image description) to chat history
          chatHandler.addMessage(chatId, 'user', aiPrompt, 'whatsapp');
          
          // Check if chat is blocked
          const isChatBlocked = workflowManager.isChatBlocked(formattedChatId);
          if (isChatBlocked) {
            console.log(`[Group Vision] Skipping AI response for blocked chat: ${formattedChatId}`);
            return;
          }
          
          // Get conversation history and settings
          const conversation = chatHandler.getConversation(chatId, 'whatsapp');
          const settings = commandHandler.getCurrentSettings();
          
          // Filter out contaminated "can't view images" responses from history
          const cleanConversation = conversation.filter(msg => {
            if (msg.role === 'assistant') {
              const content = msg.content.toLowerCase();
              const isContaminated = 
                content.includes('無法查看') || 
                content.includes('无法查看') ||
                content.includes('我無法查看或分析圖片內容') ||
                content.includes('我无法查看或分析图片内容') ||
                (content.includes("can't view") && content.includes('image')) ||
                (content.includes("cannot view") && content.includes('image')) ||
                (content.includes("can't see") && content.includes('image'));
              
              if (isContaminated) {
                console.log('[Group Vision] Filtering out contaminated response from history:', msg.content.substring(0, 50));
                return false;
              }
            }
            return true;
          });
          
          // Convert conversation to format expected by LLM
          let messages = [
            { role: 'system', content: settings.systemPrompt },
            ...cleanConversation.map(msg => ({ role: msg.role, content: msg.content }))
          ];
          
          // Apply RAG if enabled
          let context = null;
          if (settings.ragEnabled) {
            const ragResult = await ragProcessor.processQuery(aiPrompt, messages);
            messages = ragResult.messages;
            context = ragResult.context;
            
            if (context) {
              console.log('[Group Vision] RAG context applied to query');
            }
          }
          
          // Generate AI response
          const response = await currentLLMClient.generateResponse(aiPrompt, messages, settings.parameters);
          
          // Add assistant response to chat history
          chatHandler.addMessage(chatId, 'assistant', response, 'whatsapp');
          
          // Add citations if RAG was used and citations are enabled
          let finalResponse = response;
          const showCitations = process.env.KB_SHOW_CITATIONS === 'true';
          if (context && showCitations) {
            const sources = extractSourcesFromContext(context);
            if (sources.length > 0) {
              finalResponse += '\n\n*Sources:* ' + sources.join(', ');
            }
          }
          
          // Send response
          await sendAutomatedMessage(message.from, finalResponse, {
            isBotResponse: true,
            isAutomated: true,
            isResponseToUser: true,
            chatId: formattedChatId
          });
          
          console.log('[Group Vision] Response sent successfully');
        }
        
        return; // Exit after processing image
      } catch (error) {
        console.error('[Group Vision] Error handling image message:', error);
        console.error('[Group Vision] Error stack:', error.stack);
        try {
          await message.reply(`❌ Error processing image: ${error.message}`);
          console.log('[Group Vision] Error message sent to group');
        } catch (replyError) {
          console.error('[Group Vision] Failed to send error reply:', replyError);
        }
        return;
      }
    }
    
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
      await workflowManager.publishMessage('whatsapp', {
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
      
      // Format the chat ID to match the expected format in workflowManager
      const cleanChatId = chatId.includes('@g.us') ? chatId.split('@')[0] : chatId;
      const formattedChatId = `chat_whatsapp_${cleanChatId}_g.us`;
      
      // Always save user message to chat history, even if AI is blocked
      chatHandler.addMessage(chatId, 'user', cleanMessageText, 'whatsapp');
      
      // Auto-tag as LEAD if user replies to bot message
      chatHandler.checkAndMarkAsLead(chatId, 'whatsapp');
      
      // Check if this chat is blocked from AI responses
      const isChatBlocked = workflowManager.isChatBlocked(formattedChatId);
      console.log(`[Group Chat] Chat ${formattedChatId} blocked status: ${isChatBlocked}`);
      
      // Check if message is a command
      if (commandHandler.isCommand(cleanMessageText)) {
        response = await commandHandler.processCommand(cleanMessageText, chatId, message.author || message.from);
        updateLLMClient(); // Update LLM client if provider/model changed
      } else if (isChatBlocked) {
        console.log(`[Group Chat] Skipping AI response for blocked chat: ${formattedChatId}`);
        return; // Skip AI response generation for blocked chats
      } else {
        // Get conversation history with platform identifier
        const conversation = chatHandler.getConversation(chatId, 'whatsapp');
        
        // Get current settings
        const settings = commandHandler.getCurrentSettings();
        
        // Filter out contaminated "can't view images" responses from history
        const cleanConversation = conversation.filter(msg => {
          if (msg.role === 'assistant') {
            const content = msg.content.toLowerCase();
            const isContaminated = 
              content.includes('無法查看') || 
              content.includes('无法查看') ||
              content.includes('我無法查看或分析圖片內容') ||
              content.includes('我无法查看或分析图片内容') ||
              (content.includes("can't view") && content.includes('image')) ||
              (content.includes("cannot view") && content.includes('image')) ||
              (content.includes("can't see") && content.includes('image'));
            
            if (isContaminated) {
              console.log('[Group Chat] Filtering out contaminated response from history:', msg.content.substring(0, 50));
              return false;
            }
          }
          return true;
        });
        
        // Convert conversation to format expected by LLM
        let messages = [
          { role: 'system', content: settings.systemPrompt },
          ...cleanConversation.map(msg => ({ role: msg.role, content: msg.content }))
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
      
      // Format the chat ID to match the expected format in chatHandler
      // Already defined above
      
      // Send response back as automated message with appropriate flags
      await sendAutomatedMessage(message.from, response, {
        isCommandResponse: message.isCommand,
        isReplyToBot: message.isReplyToBot,
        isBotResponse: true,    // Explicitly mark as bot response
        isAutomated: true,      // Mark as automated
        isResponseToUser: true, // Mark as response to user
        chatId: formattedChatId // Include formatted chat ID in options
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
    await workflowManager.publishMessage('whatsapp', {
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
    // Send typing indicator - only if getChat is available
    if (typeof message.getChat === 'function') {
      try {
        const chat = await message.getChat();
        chat.sendStateTyping();
      } catch (chatError) {
        console.log(`[Chat] Could not set typing state: ${chatError.message}`);
        // Continue processing even if we can't set the typing state
      }
    }
    
    let response;
    
    // Format the chat ID to match the expected format in workflowManager
    const cleanChatId = chatId.includes('@c.us') ? chatId.split('@')[0] : chatId;
    const formattedChatId = `chat_whatsapp_${cleanChatId}_c.us`;
    
    // CRITICAL: Check if this is actually an empty message that should have been caught as media
    // This prevents contaminating conversation history with "I can't view images" responses
    if (!messageText && !message._data?.isImageMessage && !message._data?.isVoiceMessage) {
      console.log('[Direct] Empty message detected - likely media that failed detection. Skipping to prevent contamination.');
      return;
    }
    
    // Always save user message to chat history, even if AI is blocked
    chatHandler.addMessage(chatId, 'user', messageText, 'whatsapp');
    
    // Auto-tag as LEAD if user replies to bot message
    chatHandler.checkAndMarkAsLead(chatId, 'whatsapp');
    
    // Check if this chat is blocked from AI responses
    const isChatBlocked = workflowManager.isChatBlocked(formattedChatId);
    console.log(`[Direct] Chat ${formattedChatId} blocked status: ${isChatBlocked}`);
    
    // Check if message is a command
    if (commandHandler.isCommand(messageText)) {
      response = await commandHandler.processCommand(messageText, chatId, message.from);
      updateLLMClient(); // Update LLM client if provider/model changed
    } else if (isChatBlocked) {
      console.log(`[Direct] Skipping AI response for blocked chat: ${formattedChatId}`);
      return; // Skip AI response generation for blocked chats
    } else {
      // Get conversation history with platform identifier
      const conversation = chatHandler.getConversation(chatId, 'whatsapp');
      
      // Get current settings
      const settings = commandHandler.getCurrentSettings();
      
      // Filter out contaminated "can't view images" responses from history
      // These are artifacts from previous failed image detection attempts
      const cleanConversation = conversation.filter(msg => {
        if (msg.role === 'assistant') {
          const content = msg.content.toLowerCase();
          // Filter out Chinese and English variations of "can't view images" responses
          const isContaminated = 
            content.includes('無法查看') || 
            content.includes('无法查看') ||
            content.includes('我無法查看或分析圖片內容') ||
            content.includes('我无法查看或分析图片内容') ||
            (content.includes("can't view") && content.includes('image')) ||
            (content.includes("cannot view") && content.includes('image')) ||
            (content.includes("can't see") && content.includes('image'));
          
          if (isContaminated) {
            console.log('[Direct] Filtering out contaminated response from history:', msg.content.substring(0, 50));
            return false;
          }
        }
        return true;
      });
      
      // Convert conversation to format expected by LLM
      let messages = [
        { role: 'system', content: settings.systemPrompt },
        ...cleanConversation.map(msg => ({ role: msg.role, content: msg.content }))
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
      
      // Format the chat ID to match the expected format in chatHandler
      // Already defined above
      
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
    
    // Send response with proper chat ID format
    if (message && typeof message.reply === 'function') {
      // Use reply with the original message to maintain thread context
      await message.reply(response);
    } else if (message) {
      // Fallback to sendMessage if reply is not available
      await sendAutomatedMessage(chatId, response, {
        isBotResponse: true,
        isAutomated: true,
        isResponseToUser: true,
        chatId: formattedChatId
      });
    } else {
      console.error('Invalid message object, cannot send reply');
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
  whatsappConnectionState.reconnectAttempts = reconnectAttempts;
  
  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    console.error(' Max reconnection attempts reached. Please check your internet connection and restart the bot.');
    whatsappConnectionState.status = 'error';
    whatsappConnectionState.lastError = `Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`;
    whatsappConnectionState.lastStateChange = Date.now();
    maybeSendAlert('error', `Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
    return;
  }

  const delay = Math.min(RECONNECT_INTERVAL * Math.pow(2, reconnectAttempts - 1), 300000); // Max 5 minutes
  console.log(` Attempting to reconnect in ${delay/1000} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
  
  whatsappConnectionState.status = 'reconnecting';
  whatsappConnectionState.lastStateChange = Date.now();
  
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
    if (client && workflowManager.botComponents) {
      workflowManager.botComponents.whatsappClient = client;
      console.log('Updated WhatsApp client reference in workflow manager');
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
  // Suppress known WhatsApp Web.js execution context errors during initialization
  if (reason && reason.message && reason.message.includes('Execution context was destroyed')) {
    console.log('[WhatsApp] Suppressing known initialization error: Execution context destroyed (non-fatal)');
    return;
  }
  
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
