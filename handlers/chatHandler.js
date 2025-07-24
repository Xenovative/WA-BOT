/**
 * Manages conversation history for chats using native chat IDs
 */
const fs = require('fs');
const path = require('path');

class ChatHandler {
  constructor() {
    // Map to store conversation history by native chat ID
    this.conversations = new Map();
    // Set to store blocked chat IDs (where AI responses are disabled)
    this.blockedChats = new Set();
    // Directory to store chat history
    this.chatHistoryDir = path.join(__dirname, '../chat_history');
    this.storageFile = path.join(this.chatHistoryDir, 'chats.json');
    this.blockedChatsFile = path.join(this.chatHistoryDir, 'blocked_chats.json');
    
    // Ensure chat history directory exists
    if (!fs.existsSync(this.chatHistoryDir)) {
      fs.mkdirSync(this.chatHistoryDir, { recursive: true });
    }
    
    // Load conversations and blocked chats from disk
    this.loadConversations();
    this.loadBlockedChats();
    console.log('[ChatHandler] Conversations loaded from disk');
  }

  /**
   * Sanitize a chat ID for safe filesystem storage while preserving native format
   * @param {string} chatId - Native chat ID (e.g., '1234567890@c.us', '1234567890')
   * @returns {string} Safe filename based on chat ID
   */
  sanitizeForFilename(chatId) {
    // Replace unsafe filesystem characters but keep the structure recognizable
    return chatId
      .replace(/[@]/g, '_at_')     // @ becomes _at_
      .replace(/[.]/g, '_dot_')    // . becomes _dot_
      .replace(/[/\\:*?"<>|]/g, '_'); // Other unsafe chars become _
  }

  /**
   * Reverse the filename sanitization to get back the original chat ID
   * @param {string} filename - Sanitized filename
   * @returns {string} Original chat ID
   */
  unsanitizeFromFilename(filename) {
    return filename
      .replace(/_at_/g, '@')       // _at_ becomes @
      .replace(/_dot_/g, '.')      // _dot_ becomes .
      .replace(/\.json$/, '');     // Remove .json extension
  }

  /**
   * Add a message to the conversation history
   * @param {string} chatId - Native chat identifier (e.g., '1234567890@c.us', '1234567890')
   * @param {string|object} roleOrMessage - 'user' or 'assistant' role, or message object
   * @param {string} [content] - Message content (if roleOrMessage is a string)
   * @param {string} [platform] - Platform identifier (optional, for logging only)
   */
  addMessage(chatId, roleOrMessage, content, platform) {
    // Validate input parameters
    if (!chatId || chatId.trim() === '' || chatId === 'undefined' || chatId === 'null') {
      console.log('[ChatHandler] Invalid chat ID provided, skipping message:', chatId);
      return;
    }
    
    // Use native chat ID directly
    const nativeChatId = String(chatId).trim();
    
    let message;
    
    // Handle both old format (role, content, platform) and new format (message object)
    if (typeof roleOrMessage === 'object') {
      // New format: second parameter is a message object
      message = {
        role: roleOrMessage.role,
        content: roleOrMessage.content,
        timestamp: roleOrMessage.timestamp || new Date().toISOString(),
        isManual: roleOrMessage.isManual || false
      };
    } else {
      // Old format: separate parameters
      message = {
        role: roleOrMessage,
        content,
        timestamp: new Date().toISOString()
      };
    }
    
    console.log(`[ChatHandler] Adding ${message.role} message to chat ${nativeChatId}`);
    
    // Check if we have this conversation in memory
    if (!this.conversations.has(nativeChatId)) {
      console.log(`[ChatHandler] Creating new conversation for chat ${nativeChatId}`);
      this.conversations.set(nativeChatId, []);
    }
    
    const conversation = this.conversations.get(nativeChatId);
    conversation.push(message);
    console.log(`[ChatHandler] Added message to chat ${nativeChatId}, total messages: ${conversation.length}`);
    
    // Persist to disk immediately
    try {
      this.saveConversations();
    } catch (error) {
      console.error(`[ChatHandler] Failed to save conversations after adding message:`, error);
    }
  }

  /**
   * Load all conversations from disk into memory
   */
  loadConversations() {
    console.log('[ChatHandler] Loading all conversations from disk');
    
    try {
      // Ensure chat history directory exists
      if (!fs.existsSync(this.chatHistoryDir)) {
        fs.mkdirSync(this.chatHistoryDir, { recursive: true });
        console.log('[ChatHandler] Created chat history directory');
        return;
      }
      
      // Clear existing conversations to avoid duplicates
      this.conversations.clear();
      
      // Load all existing chat files directly
      const chatFiles = fs.readdirSync(this.chatHistoryDir).filter(
        file => file.endsWith('.json') && file !== 'chats.json' && file !== 'blocked_chats.json'
      );
      
      console.log(`[ChatHandler] Found ${chatFiles.length} chat files to load`);
      
      // Load each chat file and populate conversations map
      chatFiles.forEach(file => {
        try {
          // Get the original chat ID from the filename
          const nativeChatId = this.unsanitizeFromFilename(file);
          const filePath = path.join(this.chatHistoryDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          try {
            const messages = JSON.parse(fileContent);
            if (Array.isArray(messages) && messages.length > 0) {
              // Store messages in memory using the native chat ID
              this.conversations.set(nativeChatId, messages);
              console.log(`[ChatHandler] Loaded ${messages.length} messages for chat ${nativeChatId}`);
            } else {
              console.warn(`[ChatHandler] Empty or invalid format in ${file}, initializing empty array`);
              this.conversations.set(nativeChatId, []);
            }
          } catch (parseError) {
            console.error(`[ChatHandler] Error parsing ${file}:`, parseError);
            this.conversations.set(nativeChatId, []);
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

  /**
   * Save conversations to disk using native chat IDs
   */
  saveConversations() {
    console.log(`[ChatHandler] Saving ${this.conversations.size} conversations to disk`);
    
    // Ensure chat history directory exists
    if (!fs.existsSync(this.chatHistoryDir)) {
      fs.mkdirSync(this.chatHistoryDir, { recursive: true });
    }
    
    // Save each chat to its own file using sanitized filename
    this.conversations.forEach((messages, nativeChatId) => {
      try {
        // Create safe filename based on native chat ID
        const safeFilename = this.sanitizeForFilename(nativeChatId);
        const chatFile = path.join(this.chatHistoryDir, `${safeFilename}.json`);
        
        console.log(`[ChatHandler] Saving chat ${nativeChatId} to file ${safeFilename}.json`);
        
        // Save the messages directly (no complex merging for now)
        const jsonContent = JSON.stringify(messages, null, 2);
        fs.writeFileSync(chatFile, jsonContent, 'utf8');
        
        console.log(`[ChatHandler] Saved ${messages.length} messages for chat ${nativeChatId}`);
      } catch (error) {
        console.error(`[ChatHandler] Error saving chat history for ${nativeChatId}:`, error);
      }
    });
    
    // Also maintain the main index file
    this.updateChatIndex();
  }

  /**
   * Update the main chat index file
   */
  updateChatIndex() {
    const chats = [];
    
    // Create index from in-memory conversations
    this.conversations.forEach((messages, nativeChatId) => {
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      const preview = lastMessage?.content?.substring(0, 100) || '';
      
      chats.push({
        id: nativeChatId,
        preview: preview,
        timestamp: lastMessage?.timestamp || new Date().toISOString(),
        messageCount: messages.length
      });
    });
    
    // Sort by timestamp, newest first
    chats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Save the index
    try {
      fs.writeFileSync(this.storageFile, JSON.stringify(chats, null, 2));
      console.log(`[ChatHandler] Saved chat index with ${chats.length} entries`);
    } catch (error) {
      console.error('[ChatHandler] Error saving chat index:', error);
    }
  }

  /**
   * Get conversation history for a chat
   * @param {string} chatId - Native chat ID
   * @param {string} [platform] - Platform identifier (optional, for compatibility)
   * @returns {Array} Array of message objects
   */
  getConversation(chatId, platform) {
    if (!chatId) {
      console.log('[ChatHandler] No chat ID provided, returning empty array');
      return [];
    }
    
    const nativeChatId = String(chatId).trim();
    console.log(`[ChatHandler] Getting conversation for chat ${nativeChatId}`);
    
    // Return conversation if it exists, otherwise empty array
    return this.conversations.get(nativeChatId) || [];
  }

  /**
   * Get all chats with metadata
   * @returns {Array} Array of chat objects with id, preview, timestamp, messageCount
   */
  getAllChats() {
    console.log('[ChatHandler] Getting all chats');
    
    const chats = [];
    this.conversations.forEach((messages, nativeChatId) => {
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      const preview = lastMessage?.content?.substring(0, 100) || '';
      
      chats.push({
        id: nativeChatId,
        preview: preview,
        timestamp: lastMessage?.timestamp || new Date().toISOString(),
        messageCount: messages.length
      });
    });
    
    // Sort by timestamp, newest first
    return chats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Get recent chats with metadata (limited)
   * @param {number} limit - Maximum number of chats to return
   * @returns {Array} Array of recent chat objects with id, preview, timestamp, messageCount
   */
  getRecentChats(limit = 5) {
    console.log(`[ChatHandler] Getting ${limit} most recent chats`);
    
    const allChats = this.getAllChats();
    return allChats.slice(0, limit);
  }

  /**
   * Delete a chat completely
   * @param {string} chatId - Native chat ID
   */
  deleteChat(chatId) {
    try {
      const nativeChatId = String(chatId).trim();
      const safeFilename = this.sanitizeForFilename(nativeChatId);
      const chatFile = path.join(this.chatHistoryDir, `${safeFilename}.json`);
      
      if (fs.existsSync(chatFile)) {
        fs.unlinkSync(chatFile);
        console.log(`[ChatHandler] Deleted chat file for ${nativeChatId}`);
      }
      
      this.conversations.delete(nativeChatId);
      this.updateChatIndex();
      
      console.log(`[ChatHandler] Successfully deleted chat ${nativeChatId}`);
    } catch (error) {
      console.error(`Error deleting chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Clear conversation history for a chat
   * @param {string} chatId - Native chat ID
   */
  clearConversation(chatId) {
    try {
      const nativeChatId = String(chatId).trim();
      console.log(`[ChatHandler] Clearing conversation for chat ${nativeChatId}`);
      
      // Clear from memory
      this.conversations.set(nativeChatId, []);
      
      // Save to disk
      this.saveConversations();
      
      console.log(`[ChatHandler] Successfully cleared conversation for chat ${nativeChatId}`);
    } catch (error) {
      console.error(`Error clearing conversation for ${chatId}:`, error);
      throw error;
    }
  }

  // --- Blocked Chats Functionality ---

  /**
   * Load blocked chats from disk
   */
  loadBlockedChats() {
    try {
      if (fs.existsSync(this.blockedChatsFile)) {
        const data = JSON.parse(fs.readFileSync(this.blockedChatsFile, 'utf8'));
        this.blockedChats = new Set(data.blockedChats || []);
        console.log(`[ChatHandler] Loaded ${this.blockedChats.size} blocked chats`);
      } else {
        console.log('[ChatHandler] No blocked chats file found, starting with empty list');
      }
    } catch (error) {
      console.error('[ChatHandler] Error loading blocked chats:', error);
      this.blockedChats = new Set();
    }
  }

  /**
   * Save blocked chats to disk
   */
  saveBlockedChats() {
    try {
      const data = {
        blockedChats: Array.from(this.blockedChats),
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(this.blockedChatsFile, JSON.stringify(data, null, 2));
      console.log(`[ChatHandler] Saved ${this.blockedChats.size} blocked chats to disk`);
    } catch (error) {
      console.error('[ChatHandler] Error saving blocked chats:', error);
    }
  }

  /**
   * Check if a chat is blocked from AI responses
   * @param {string} chatId - Native chat ID
   * @returns {boolean} True if chat is blocked
   */
  isChatBlocked(chatId) {
    const nativeChatId = String(chatId).trim();
    return this.blockedChats.has(nativeChatId);
  }

  /**
   * Block a chat from AI responses
   * @param {string} chatId - Native chat ID
   */
  blockChat(chatId) {
    const nativeChatId = String(chatId).trim();
    this.blockedChats.add(nativeChatId);
    this.saveBlockedChats();
    console.log(`[ChatHandler] Blocked chat ${nativeChatId} from AI responses`);
  }

  /**
   * Unblock a chat to allow AI responses
   * @param {string} chatId - Native chat ID
   */
  unblockChat(chatId) {
    const nativeChatId = String(chatId).trim();
    const wasBlocked = this.blockedChats.delete(nativeChatId);
    if (wasBlocked) {
      this.saveBlockedChats();
      console.log(`[ChatHandler] Unblocked chat ${nativeChatId} for AI responses`);
    }
    return wasBlocked;
  }

  /**
   * Get all blocked chat IDs
   * @returns {Array} Array of blocked chat IDs
   */
  getBlockedChats() {
    return Array.from(this.blockedChats);
  }
}

module.exports = ChatHandler;
