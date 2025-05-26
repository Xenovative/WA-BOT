require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const LLMFactory = require('./llm/llmFactory');
const chatHandler = require('./handlers/chatHandler');
const commandHandler = require('./handlers/commandHandler');
const kbManager = require('./kb/kbManager');
const fileHandler = require('./kb/fileHandler');
const ragProcessor = require('./kb/ragProcessor');
const fileWatcher = require('./kb/fileWatcher');

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

// Track active LLM client
let currentLLMClient = null;

// Update the LLM client based on command handler settings
function updateLLMClient() {
  const settings = commandHandler.getCurrentSettings();
  
  // Create LLM client with appropriate options
  const options = {
    mcpResourceUri: settings.mcpResourceUri
  };
  
  currentLLMClient = LLMFactory.createLLMClient(settings.provider, options);
  
  // Update the model if needed
  if (settings.provider === 'openai' || settings.provider === 'openrouter' || settings.provider === 'ollama') {
    currentLLMClient.model = settings.model;
  }
  
  console.log(`Using LLM provider: ${settings.provider}, model: ${settings.model}`);
  console.log(`System prompt: ${settings.systemPrompt.substring(0, 50)}${settings.systemPrompt.length > 50 ? '...' : ''}`);
}

// QR code handling
client.on('qr', (qr) => {
  console.log('QR Code received. Scan with WhatsApp to authenticate:');
  qrcode.generate(qr, { small: true });
});

// Authentication handling
client.on('authenticated', () => {
  console.log('Authentication successful');
});

client.on('auth_failure', (msg) => {
  console.error('Authentication failed:', msg);
});

// Ready event
client.on('ready', async () => {
  console.log('WhatsApp client is ready!');
  updateLLMClient();
  
  // Initialize knowledge base
  try {
    await kbManager.initialize();
    console.log('Knowledge base initialized');
    
    // Start file watcher for the uploads directory
    fileWatcher.startWatching();
  } catch (error) {
    console.error('Error initializing knowledge base:', error);
  }
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

// Message processing
client.on('message', async (message) => {
  if (message.isGroupMsg) return; // Ignore group messages
  if (message.hasMedia && message.body.startsWith('kb:')) return; // Skip media uploads handled by other handler
  
  const chatId = message.from;
  const messageText = message.body.trim();
  
  console.log(`Message from ${chatId}: ${messageText}`);
  
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
    await message.reply(response);
  } catch (error) {
    console.error('Error processing message:', error);
    await message.reply(`Sorry, I encountered an error: ${error.message}`);
  }
});

// Initialize WhatsApp client
client.initialize();

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
