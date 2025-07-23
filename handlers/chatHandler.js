/**
 * Manages conversation history for chats
 */
const fs = require('fs');
const path = require('path');

class ChatHandler {
  constructor() {
    // Map to store conversation history by chat ID
    this.conversations = new Map();
    // Directory to store chat history
    this.chatHistoryDir = path.join(__dirname, '../chat_history');
    this.storageFile = path.join(this.chatHistoryDir, 'chats.json');
    
    // Ensure chat history directory exists
    if (!fs.existsSync(this.chatHistoryDir)) {
      fs.mkdirSync(this.chatHistoryDir, { recursive: true });
    }
    
    // Load conversations from disk
    this.loadConversations();
  }

  /**
   * Get platform-prefixed chat ID
   * @param {string} platform - Platform identifier ('telegram', 'whatsapp', etc.)
   * @param {string} chatId - Original chat ID
   * @returns {string} Platform-prefixed chat ID
   */
  getPlatformChatId(platform, chatId) {
    if (!platform || !chatId) return chatId;
    
    // Remove any existing platform prefix
    const cleanId = chatId.replace(/^(whatsapp|telegram)[:_]?/i, '');
    
    // Return in the format: whatsapp_12345678
    return `${platform.toLowerCase()}_${cleanId}`;
  }

  /**
   * Add a message to the conversation history
   * @param {string} chatId - Unique identifier for the chat
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   * @param {string} [platform] - Platform identifier ('telegram', 'whatsapp', etc.)
   */
  addMessage(chatId, role, content, platform) {
    const platformChatId = platform ? this.getPlatformChatId(platform, chatId) : chatId;
    
    console.log(`[ChatHandler] Adding ${role} message to chat ${platformChatId}`);
    
    if (!this.conversations.has(platformChatId)) {
      console.log(`[ChatHandler] Creating new conversation for chat ${platformChatId}`);
      this.conversations.set(platformChatId, []);
    }
    
    const conversation = this.conversations.get(platformChatId);
    const timestamp = new Date().toISOString();
    
    const message = { 
      role, 
      content, 
      timestamp 
    };
    
    conversation.push(message);
    console.log(`[ChatHandler] Added message to chat ${platformChatId}, total messages: ${conversation.length}`);
    
    // Persist to disk immediately
    try {
      this.saveConversations();
    } catch (error) {
      console.error(`[ChatHandler] Failed to save conversations after adding message:`, error);
    }
  }

  /**
   * Get conversation history for a chat
   * @param {string} chatId - The chat ID to get conversation for
   * @param {string} [platform] - Platform identifier ('telegram', 'whatsapp', etc.)
   * @returns {Array} Array of message objects
   */
  getConversation(chatId, platform) {
    const platformChatId = platform ? this.getPlatformChatId(platform, chatId) : chatId;
    console.log(`[ChatHandler] Getting conversation for chat ID: ${chatId}`);
    if (!chatId) {
      console.log('[ChatHandler] No chat ID provided, returning empty array');
      return [];
    }
    
    // Always load from disk to ensure we have the most up-to-date messages
    const messages = this.loadChat(platformChatId);
    console.log(`[ChatHandler] Loaded ${messages.length} messages for chat ${chatId} from disk`);
    
    // Return the loaded messages (or empty array if none found)
    return messages;
  }

  /**
   * Clear conversation history for a chat
   * @param {string} chatId - Unique identifier for the chat
   */
  clearConversation(chatId) {
    try {
      const chatFile = this.getChatFilePath(chatId);
      if (fs.existsSync(chatFile)) {
        fs.unlinkSync(chatFile);
      }
      this.conversations.delete(chatId);
      this.updateChatIndex();
    } catch (error) {
      console.error(`Error clearing conversation for ${chatId}:`, error);
    }
  }
  
  /**
   * Get all chats with their last message
   * @returns {Array} Array of chat objects with id and preview
   */
  getAllChats() {
    try {
      console.log(`Looking for chat index at: ${this.storageFile}`);
      console.log(`Chat history directory exists: ${fs.existsSync(this.chatHistoryDir) ? 'Yes' : 'No'}`);
      
      if (fs.existsSync(this.storageFile)) {
        console.log('Chat index file found, reading...');
        const fileContent = fs.readFileSync(this.storageFile, 'utf8');
        console.log(`File content length: ${fileContent.length} characters`);
        
        const data = JSON.parse(fileContent);
        if (Array.isArray(data)) {
          console.log(`Successfully parsed ${data.length} chat entries from index`);
          return data;
        } else {
          console.warn('Chat index file does not contain an array');
        }
      } else {
        console.log('No chat index file found, will use in-memory data');
        // Try to generate index from chat files
        this.updateChatIndex();
        if (fs.existsSync(this.storageFile)) {
          console.log('Generated chat index file, retrying load');
          const fileContent = fs.readFileSync(this.storageFile, 'utf8');
          const data = JSON.parse(fileContent);
          if (Array.isArray(data)) {
            return data;
          }
        }
      }
    } catch (error) {
      console.error('Error in getAllChats:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
    }
    
    // Fallback to in-memory data if index file is missing
    const chats = [];
    this.conversations.forEach((messages, chatId) => {
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      const preview = lastMessage?.content?.substring(0, 100) || '';
      chats.push({
        id: chatId,
        preview: preview,
        timestamp: lastMessage?.timestamp || new Date().toISOString(),
        messageCount: messages.length
      });
    });
    
    // Sort by timestamp, newest first
    return chats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  
  /**
   * Delete a chat completely
   * @param {string} chatId - Unique identifier for the chat to delete
   */
  deleteChat(chatId) {
    try {
      const chatFile = this.getChatFilePath(chatId);
      if (fs.existsSync(chatFile)) {
        fs.unlinkSync(chatFile);
      }
      this.conversations.delete(chatId);
      this.updateChatIndex();
    } catch (error) {
      console.error(`Error deleting chat ${chatId}:`, error);
      throw error; // Re-throw to be handled by the API
    }
  }
  
  /**
   * Get the path for a chat's history file
   * @param {string} chatId - The chat ID
   * @returns {string} Path to the chat's history file
   */
  getChatFilePath(chatId) {
    if (!chatId) {
      console.error('[ChatHandler] Attempted to get file path for null or undefined chatId');
      return path.join(this.chatHistoryDir, 'invalid_chat.json');
    }
    
    // Try different formats of the chat ID
    const originalPath = path.join(this.chatHistoryDir, `${chatId}.json`);
    if (fs.existsSync(originalPath)) {
      return originalPath;
    }
    
    // Sanitize chat ID to create a valid filename
    const safeChatId = chatId.toString().replace(/[^a-z0-9-_.]/gi, '_').toLowerCase();
    return path.join(this.chatHistoryDir, `${safeChatId}.json`);
  }

  // Save conversations to disk
  saveConversations() {
    console.log(`[ChatHandler] Saving ${this.conversations.size} conversations to disk`);
    
    // Ensure chat history directory exists
    if (!fs.existsSync(this.chatHistoryDir)) {
      fs.mkdirSync(this.chatHistoryDir, { recursive: true });
    }
    
    // Save each chat to its own file
    this.conversations.forEach((messages, chatId) => {
      try {
        const chatFile = this.getChatFilePath(chatId);
        const jsonContent = JSON.stringify(messages, null, 2);
        
        // Write to file with error handling
        fs.writeFileSync(chatFile, jsonContent, 'utf8');
        console.log(`[ChatHandler] Saved ${messages.length} messages for chat ${chatId}`);
      } catch (error) {
        console.error(`[ChatHandler] Error saving chat history for ${chatId}:`, error);
      }
    });
    
    // Also maintain the main index file
    this.updateChatIndex();
  }
  
  // Update the main chat index file
  updateChatIndex() {
    const chats = [];
    
    // Read all chat files
    if (fs.existsSync(this.chatHistoryDir)) {
      const files = fs.readdirSync(this.chatHistoryDir).filter(
        file => file.endsWith('.json') && file !== 'chats.json'
      );
      
      console.log(`[ChatHandler] Found ${files.length} chat files to index`);
      
      files.forEach(file => {
        try {
          const filePath = path.join(this.chatHistoryDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          try {
            const messages = JSON.parse(fileContent);
            
            if (Array.isArray(messages)) {
              const chatId = path.basename(file, '.json');
              
              // Even if there are no messages, we still want to track the chat
              const lastMessage = messages.length > 0 ? messages[messages.length - 1] : { content: '', timestamp: new Date().toISOString() };
              
              chats.push({
                id: chatId,
                preview: lastMessage.content?.substring(0, 100) || '',
                timestamp: lastMessage.timestamp || new Date().toISOString(),
                messageCount: messages.length
              });
            }
          } catch (parseError) {
            console.error(`Error parsing JSON for chat file ${file}:`, parseError);
          }
        } catch (error) {
          console.error(`Error reading chat file ${file}:`, error);
        }
      });
      
      console.log(`[ChatHandler] Successfully indexed ${chats.length} chats`);
      
      // Sort by timestamp, newest first
      chats.sort((a, b) => {
        const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
        const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
        return timeB - timeA;
      });
      
      // Save the index
      fs.writeFileSync(this.storageFile, JSON.stringify(chats, null, 2));
      console.log(`[ChatHandler] Saved chat index with ${chats.length} entries`);
    }
  }
  
  // Load a single chat's messages
  loadChat(chatId) {
    console.log(`[ChatHandler] Loading chat ${chatId} from disk`);
    try {
      const chatFile = this.getChatFilePath(chatId);
      console.log(`[ChatHandler] Chat file path: ${chatFile}`);
      
      if (fs.existsSync(chatFile)) {
        console.log(`[ChatHandler] Chat file exists for ${chatId}`);
        const fileContent = fs.readFileSync(chatFile, 'utf8');
        console.log(`[ChatHandler] Read ${fileContent.length} bytes from chat file`);
        
        try {
          const messages = JSON.parse(fileContent);
          console.log(`[ChatHandler] Successfully parsed JSON for chat ${chatId}`);
          
          if (Array.isArray(messages)) {
            console.log(`[ChatHandler] Found ${messages.length} messages for chat ${chatId}`);
            
            // Convert timestamp to ISO string if it's a number
            const processedMessages = messages.map(msg => ({
              ...msg,
              timestamp: typeof msg.timestamp === 'number' 
                ? new Date(msg.timestamp).toISOString() 
                : msg.timestamp
            }));
            
            // Store the complete message history in memory
            this.conversations.set(chatId, processedMessages);
            return processedMessages;
          } else {
            console.error(`[ChatHandler] Messages for chat ${chatId} is not an array:`, typeof messages);
          }
        } catch (parseError) {
          console.error(`[ChatHandler] Error parsing JSON for chat ${chatId}:`, parseError);
          console.error(`[ChatHandler] File content sample: ${fileContent.substring(0, 100)}...`);
        }
      } else {
        console.log(`[ChatHandler] Chat file does not exist for ${chatId}, creating new chat`);
        this.conversations.set(chatId, []);
        return [];
      }
    } catch (error) {
      console.error(`[ChatHandler] Error loading chat ${chatId}:`, error);
    }
    
    // If we get here, ensure we have at least an empty array for this chat
    if (!this.conversations.has(chatId)) {
      this.conversations.set(chatId, []);
    }
    
    return this.conversations.get(chatId);
  }
  
  // Load conversations from disk
  /**
   * Get all chats with their metadata
   * @returns {Array} Array of chat objects with id, preview, timestamp, and messageCount
   */
  getAllChats() {
    try {
      // Ensure the index is up to date
      this.updateChatIndex();
      
      // Read the index file
      if (fs.existsSync(this.storageFile)) {
        const fileContent = fs.readFileSync(this.storageFile, 'utf8');
        try {
          const chats = JSON.parse(fileContent);
          return Array.isArray(chats) ? chats : [];
        } catch (error) {
          console.error('[ChatHandler] Error parsing chat index:', error);
          return [];
        }
      }
      return [];
    } catch (error) {
      console.error('[ChatHandler] Error getting all chats:', error);
      return [];
    }
  }
  
  /**
   * Get the most recent chats with all required fields
   * @param {number} limit - Maximum number of chats to return
   * @returns {Array} Array of most recent chat objects with all required fields
   */
  getRecentChats(limit = 5) {
    try {
      const allChats = this.getAllChats();
      
      // Sort by timestamp in descending order (newest first)
      const sortedChats = [...allChats].sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });
      
      // Get the most recent chats and ensure they have all required fields
      return sortedChats.slice(0, limit).map(chat => ({
        id: chat.id,
        name: chat.id,  // Using ID as name if not available
        lastMessage: chat.preview || 'No messages',
        timestamp: chat.timestamp || new Date().toISOString(),
        // Include any other fields that might be needed
        messageCount: chat.messageCount || 0,
        preview: chat.preview || '',
        // Include the actual messages if available
        messages: this.conversations.get(chat.id) || []
      }));
    } catch (error) {
      console.error('[ChatHandler] Error getting recent chats:', error);
      return [];
    }
  }

  loadConversations() {
    try {
      // Ensure chat history directory exists
      if (!fs.existsSync(this.chatHistoryDir)) {
        fs.mkdirSync(this.chatHistoryDir, { recursive: true });
        console.log('[ChatHandler] Created chat history directory');
        return; // No existing chats to load
      }
      
      // Load all existing chat files directly
      const chatFiles = fs.readdirSync(this.chatHistoryDir).filter(
        file => file.endsWith('.json') && file !== 'chats.json'
      );
      
      console.log(`[ChatHandler] Found ${chatFiles.length} chat files to load`);
      
      // Load each chat file and populate conversations map
      chatFiles.forEach(file => {
        try {
          const chatId = path.basename(file, '.json');
          const filePath = path.join(this.chatHistoryDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          try {
            const messages = JSON.parse(fileContent);
            if (Array.isArray(messages)) {
              // Store messages in memory
              this.conversations.set(chatId, messages);
              console.log(`[ChatHandler] Loaded ${messages.length} messages for chat ${chatId}`);
            } else {
              console.warn(`[ChatHandler] Invalid format in ${file}, initializing empty array`);
              this.conversations.set(chatId, []);
            }
          } catch (parseError) {
            console.error(`[ChatHandler] Error parsing ${file}:`, parseError);
            this.conversations.set(chatId, []);
          }
        } catch (err) {
          console.error(`[ChatHandler] Error processing chat file ${file}:`, err);
        }
      });
      
      // Update the index file to reflect current state
      this.updateChatIndex();
      
      console.log(`[ChatHandler] Successfully loaded ${this.conversations.size} conversations from disk`);
    } catch (error) {
      console.error('[ChatHandler] Error loading conversations:', error);
    }
  }
}

// Create and export the chat handler instance
const chatHandler = new ChatHandler();

// Initialize sample chat only if no chats exist and this is not a restart
setImmediate(() => {
  try {
    const existingChats = chatHandler.getAllChats();
    if (existingChats.length === 0) {
      console.log('[ChatHandler] No existing chats found, creating a sample chat');
      const chatId = 'sample-chat-' + Date.now();
      chatHandler.addMessage(chatId, 'user', 'Hello, this is a test message');
      chatHandler.addMessage(chatId, 'assistant', 'Hi there! This is a sample response to your test message.');
      console.log(`[ChatHandler] Created sample chat with ID: ${chatId}`);
    } else {
      console.log(`[ChatHandler] Found ${existingChats.length} existing chats, skipping sample creation`);
    }
  } catch (error) {
    console.error('[ChatHandler] Error during initialization:', error);
  }
});

module.exports = chatHandler;
