const TelegramBot = require('node-telegram-bot-api');
const LLMFactory = require('../llm/llmFactory');
const chatHandler = require('../handlers/chatHandler');
const commandHandler = require('../handlers/commandHandler');
const ragProcessor = require('../kb/ragProcessor');
const blocklist = require('../utils/blocklist');
const rateLimiter = require('../utils/rateLimiter');

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
      try {
        // Skip non-text messages for now
        if (!msg.text) return;
        
        console.log(`[Telegram] Message from ${msg.from.id} (${msg.from.username || 'no username'}): ${msg.text}`);
        await this.processMessage(msg.chat.id, msg.text, msg.from);
      } catch (error) {
        console.error('Error processing Telegram message:', error);
      }
    });
  }

  async processMessage(chatId, messageText, from) {
    try {
      const senderId = from.id.toString();
      const cleanMessageText = messageText.trim();
      const userId = `telegram:${senderId}`;
      
      // Check if user is blocked
      if (blocklist.isBlocked(senderId, 'telegram')) {
        console.log(`[Telegram] Ignoring message from blocked user: ${senderId}`);
        return;
      }
      
      // Check rate limit for non-admin users
      if (!commandHandler.isAdmin(userId)) {
        const limitCheck = rateLimiter.checkLimit(userId);
        if (!limitCheck.allowed) {
          const resetTime = new Date(limitCheck.reset).toLocaleString();
          return await this.sendMessage(chatId, 
            `⚠️ Rate limit exceeded. You've used ${limitCheck.limit} messages.\n` +
            `Limit will reset at ${resetTime}.`
          );
        }
      }
      
      // Check for commands first
      if (messageText.startsWith('/')) {
        return this.handleCommand(chatId, cleanMessageText, from);
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

  async handleCommand(chatId, command, from) {
    try {
      const [cmd, ...args] = command.split(' ');
      const isAdmin = commandHandler.isAdmin(`telegram:${from.id}`);
      
      // Block/Unblock commands handling
      if (cmd.toLowerCase() === '/block' && isAdmin) {
        const targetId = args[0];
        if (!targetId) return this.sendMessage(chatId, 'Please provide a user ID to block');
        
        const success = blocklist.addToBlocklist(targetId, 'telegram');
        return this.sendMessage(chatId, success ? 
          `✅ User ${targetId} has been blocked` : 
          '❌ Failed to block user');
      }
      
      if (cmd.toLowerCase() === '/unblock' && isAdmin) {
        const targetId = args[0];
        if (!targetId) return this.sendMessage(chatId, 'Please provide a user ID to unblock');
        
        const success = blocklist.removeFromBlocklist(targetId, 'telegram');
        return this.sendMessage(chatId, success ? 
          `✅ User ${targetId} has been unblocked` : 
          '❌ User not found in blocklist or failed to unblock');
      }
      
      if ((cmd.toLowerCase() === '/blocklist' || cmd.toLowerCase() === '/blocked') && isAdmin) {
        const blockedUsers = blocklist.getBlockedNumbers('telegram');
        return this.sendMessage(chatId, blockedUsers.length > 0 ?
          `🚫 *Blocked Users*:\n${blockedUsers.map(id => `- ${id}`).join('\n')}` :
          'No users are currently blocked.');
      }
      
      // Handle other commands
      const response = await commandHandler.handleCommand({
        from: `telegram:${from.id}`,
        body: command,
        getChat: async () => ({
          isGroup: false,
          name: from.username ? `@${from.username}` : `User ${from.id}`
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
