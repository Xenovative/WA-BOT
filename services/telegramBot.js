const TelegramBot = require('node-telegram-bot-api');
const LLMFactory = require('../llm/llmFactory');
const chatHandler = require('../handlers/chatHandler');
const commandHandler = require('../handlers/commandHandler');
const ragProcessor = require('../kb/ragProcessor');

class TelegramBotService {
  constructor(token) {
    if (!token || !/^\d+:[-a-zA-Z0-9_]+$/.test(token)) {
      throw new Error('Invalid Telegram bot token format');
    }
    
    this.token = token;
    this.bot = null;
    this.commands = new Map();
    this.polling = false;
    this.llmClient = null;
    // Don't set up event handlers here - wait until start()
  }
  
  /**
   * Get the LLM client, using the global one if available
   * @returns {Object} The LLM client instance
   */
  getLLMClient() {
    // Use the global LLM client if available (will be updated by updateLLMClient)
    if (global.currentLLMClient) {
      this.llmClient = global.currentLLMClient;
      return this.llmClient;
    }
    
    // Fallback to creating a new client if global one isn't available
    if (!this.llmClient) {
      const settings = commandHandler.getCurrentSettings();
      const options = {
        mcpResourceUri: settings.mcpResourceUri
      };
      
      this.llmClient = LLMFactory.createLLMClient(settings.provider, options);
      
      // Update the model if needed
      if (['openai', 'openrouter', 'ollama'].includes(settings.provider)) {
        this.llmClient.model = settings.model;
        
        // Set base URL for Ollama if needed
        if (settings.provider === 'ollama') {
          this.llmClient.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        }
      }
      
      console.log(`[Telegram] Created new LLM client - Provider: ${settings.provider}, Model: ${settings.model}`);
    }
    
    return this.llmClient;
  }
  
  async start() {
    if (this.bot) {
      await this.stop();
    }
    
    try {
      this.bot = new TelegramBot(this.token, { 
        polling: true,
        request: {
          proxy: process.env.HTTP_PROXY || process.env.HTTPS_PROXY || null
        }
      });
      
      // Initialize LLM client
      this.getLLMClient();
      
      // Set up error handlers
      this.bot.on('polling_error', (error) => {
        console.error('Telegram polling error:', error.message);
        if (error.code === 'ETELEGRAM' && error.response?.statusCode === 404) {
          console.error('Invalid Telegram bot token. Please check your token and try again.');
        }
      });
      
      this.bot.on('webhook_error', (error) => {
        console.error('Telegram webhook error:', error.message);
      });
      
      // Set up event handlers after bot is initialized
      this.setupEventHandlers();
      
      // Verify bot is working
      const botInfo = await this.bot.getMe();
      console.log(`🤖 Telegram bot started: @${botInfo.username}`);
      
      this.polling = true;
      return true;
    } catch (error) {
      console.error('Failed to start Telegram bot:', error.message);
      if (error.code === 'ETELEGRAM' && error.response?.statusCode === 404) {
        throw new Error('Invalid Telegram bot token. Please check your token and try again.');
      }
      throw error;
    }
  }
  
  async stop() {
    if (this.bot) {
      try {
        await this.bot.stopPolling();
      } catch (error) {
        console.error('Error stopping Telegram bot:', error.message);
      }
      this.bot = null;
      this.polling = false;
    }
    return true;
  }

  setupEventHandlers() {
    // Handle /start command
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.sendMessage(chatId, '👋 Welcome to the bot! Type /help to see available commands.');
    });

    // Handle /help command
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const helpText = `
🤖 *Available Commands*:
- /start - Start the bot
- /help - Show this help message
- /status - Check bot status
- /clear - Clear conversation history
      `;
      this.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
    });

    // Handle all text messages
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const messageText = msg.text || '';
      
      // Skip non-text messages and commands (they're handled separately)
      if (!messageText || messageText.startsWith('/')) return;

      try {
        // Send typing action
        await this.bot.sendChatAction(chatId, 'typing');

        // Process the message
        await this.processMessage(chatId, messageText);
      } catch (error) {
        console.error('Error processing message:', error);
        this.sendMessage(chatId, '❌ An error occurred while processing your message.');
      }
    });
  }

  async processMessage(chatId, messageText) {
    try {
      const senderId = chatId.toString();
      const cleanMessageText = messageText.trim();
      
      // Check for commands first
      if (messageText.startsWith('/')) {
        return this.handleCommand(chatId, cleanMessageText);
      }
      
      // Check if message is a command (starts with !)
      if (commandHandler.isCommand(cleanMessageText)) {
        const response = await commandHandler.processCommand(cleanMessageText, chatId, senderId);
        if (response) {
          await this.sendMessage(chatId, response);
        }
        return;
      }

      // Send typing indicator
      await this.bot.sendChatAction(chatId, 'typing');
      
      // Add user message to chat history with platform identifier
      chatHandler.addMessage(chatId, 'user', cleanMessageText, 'telegram');
      
      // Get conversation history with platform identifier
      const conversation = chatHandler.getConversation(chatId, 'telegram');
      
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
          console.log(`[Telegram] RAG context applied to query in chat ${chatId}`);
        }
      }
      
      // Get the current LLM client
      const currentLLMClient = this.getLLMClient();
      if (!currentLLMClient) {
        throw new Error('LLM client not initialized');
      }
      
      // Process message with current LLM and parameters
      let response;
      if (settings.provider === 'mcp') {
        // For MCP, we pass parameters directly
        response = await currentLLMClient.generateResponse(cleanMessageText, messages, settings.parameters);
      } else {
        // For other providers, we pass parameters in the standard way
        response = await currentLLMClient.generateResponse(cleanMessageText, messages, settings.parameters);
      }
      
      // Add assistant response to chat history with platform identifier
      chatHandler.addMessage(chatId, 'assistant', response, 'telegram');
      
      // Send the response
      await this.sendMessage(chatId, response);
    } catch (error) {
      console.error('Error in processMessage:', error);
      throw error;
    }
  }

  async handleCommand(chatId, command) {
    try {
      const [cmd, ...args] = command.split(' ');
      const response = await commandHandler.handleCommand({
        from: chatId.toString(),
        body: command,
        getChat: async () => ({
          isGroup: false,
          name: 'Telegram User'
        })
      });

      if (response) {
        await this.sendMessage(chatId, response);
      }
    } catch (error) {
      console.error('Error handling command:', error);
      await this.sendMessage(chatId, '❌ Error executing command.');
    }
  }

  async sendMessage(chatId, text, options = {}) {
    try {
      return await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        ...options
      });
    } catch (error) {
      console.error('Error sending message:', error);
      // Fallback to plain text if markdown parsing fails
      if (error.response?.description?.includes('can\'t parse entities')) {
        return this.bot.sendMessage(chatId, text, {
          ...options,
          parse_mode: undefined
        });
      }
      throw error;
    }
  }

  // Stop the bot
  async stop() {
    if (this.bot) {
      try {
        await this.bot.stopPolling();
        console.log('🤖 Telegram bot stopped');
      } catch (error) {
        console.error('Error stopping Telegram bot:', error);
      }
      this.bot = null;
      this.polling = false;
    }
    return true;
  }
}

module.exports = TelegramBotService;
