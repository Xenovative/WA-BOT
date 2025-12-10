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
    this.tagsFile = path.join(__dirname, '../data/chat_tags.json');
    
    // Ensure chat history directory exists
    if (!fs.existsSync(this.chatHistoryDir)) {
      fs.mkdirSync(this.chatHistoryDir, { recursive: true });
    }
    
    // Ensure data directory exists for tags
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Load tags from disk
    this.tags = this.loadTags();
    
    // Load conversations from disk
    this.loadConversations();
  }
  
  /**
   * Load tags from disk
   * @returns {Object} Tags object mapping chatId to array of tags
   */
  loadTags() {
    try {
      if (fs.existsSync(this.tagsFile)) {
        const content = fs.readFileSync(this.tagsFile, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('[ChatHandler] Error loading tags:', error);
    }
    return {};
  }
  
  /**
   * Save tags to disk
   */
  saveTags() {
    try {
      fs.writeFileSync(this.tagsFile, JSON.stringify(this.tags, null, 2), 'utf8');
    } catch (error) {
      console.error('[ChatHandler] Error saving tags:', error);
    }
  }
  
  /**
   * Add a tag to a chat
   * @param {string} chatId - Chat ID
   * @param {string} tag - Tag to add
   * @returns {boolean} Success status
   */
  addTag(chatId, tag) {
    try {
      if (!this.tags[chatId]) {
        this.tags[chatId] = [];
      }
      
      // Normalize tag
      const normalizedTag = tag.toUpperCase().trim();
      
      // Don't add duplicate tags
      if (!this.tags[chatId].includes(normalizedTag)) {
        this.tags[chatId].push(normalizedTag);
        this.saveTags();
        console.log(`[ChatHandler] Added tag "${normalizedTag}" to chat ${chatId}`);
        
        // Broadcast tag update
        if (global.broadcastUpdate) {
          global.broadcastUpdate('chat_tag', {
            chatId: chatId,
            tags: this.tags[chatId],
            action: 'add',
            tag: normalizedTag
          });
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('[ChatHandler] Error adding tag:', error);
      return false;
    }
  }
  
  /**
   * Remove a tag from a chat
   * @param {string} chatId - Chat ID
   * @param {string} tag - Tag to remove
   * @returns {boolean} Success status
   */
  removeTag(chatId, tag) {
    try {
      if (!this.tags[chatId]) {
        return false;
      }
      
      const normalizedTag = tag.toUpperCase().trim();
      const index = this.tags[chatId].indexOf(normalizedTag);
      
      if (index > -1) {
        this.tags[chatId].splice(index, 1);
        this.saveTags();
        console.log(`[ChatHandler] Removed tag "${normalizedTag}" from chat ${chatId}`);
        
        // Broadcast tag update
        if (global.broadcastUpdate) {
          global.broadcastUpdate('chat_tag', {
            chatId: chatId,
            tags: this.tags[chatId],
            action: 'remove',
            tag: normalizedTag
          });
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('[ChatHandler] Error removing tag:', error);
      return false;
    }
  }
  
  /**
   * Get all tags for a chat
   * @param {string} chatId - Chat ID
   * @returns {Array} Array of tags
   */
  getTags(chatId) {
    return this.tags[chatId] || [];
  }
  
  /**
   * Get all chats with a specific tag
   * @param {string} tag - Tag to filter by
   * @returns {Array} Array of chat IDs
   */
  getChatsByTag(tag) {
    const normalizedTag = tag.toUpperCase().trim();
    const result = [];
    
    for (const [chatId, tags] of Object.entries(this.tags)) {
      if (tags.includes(normalizedTag)) {
        result.push(chatId);
      }
    }
    
    return result;
  }
  
  /**
   * Check if a chat should be marked as LEAD based on conversation pattern
   * Lead identifiers:
   * 1. User says keywords like "有興趣", "想知多D", "想了解", etc.
   * 2. User has replied 2-3+ times in the conversation (engaged)
   * @param {string} chatId - Chat ID
   * @param {string} platform - Platform identifier
   * @returns {boolean} Whether the chat was marked as LEAD
   */
  checkAndMarkAsLead(chatId, platform) {
    try {
      const platformChatId = platform ? this.getPlatformChatId(platform, chatId) : chatId;
      const conversation = this.getConversation(chatId, platform);
      
      console.log(`[ChatHandler] checkAndMarkAsLead called for ${platformChatId}`);
      console.log(`[ChatHandler] Conversation length: ${conversation.length}`);
      
      // Already tagged as LEAD, skip
      if (this.getTags(platformChatId).includes('LEAD')) {
        console.log(`[ChatHandler] Already tagged as LEAD, skipping`);
        return false;
      }
      
      // Need at least 2 messages (bot message + user reply)
      if (conversation.length < 2) {
        console.log(`[ChatHandler] Not enough messages (${conversation.length}), need at least 2`);
        return false;
      }
      
      // Lead detection keywords (case-insensitive)
      const leadKeywords = [
        '有興趣', '有兴趣',
        '想知多', '想知多d', '想知多D',
        '想了解', '想瞭解',
        '有interest', 'interested',
        '可以', '好呀', '好啊', '得呀', '得啊',
        '幾點', '幾時', '邊個時間', '什麼時間', '甚麼時間',
        '明天', '今日', '聽日', '下午', '上午',
        '打電話', '打俾我', 'call我', 'call 我',
        '想約', '約個時間', '預約',
        '幫我', '幫到我',
        '多少錢', '幾錢', '價錢', '收費',
        'ok', 'OK', 'Ok', '好的', '無問題', '冇問題'
      ];
      
      // Count user messages after first assistant message
      let hasAssistantMessage = false;
      let userReplyCount = 0;
      let hasLeadKeyword = false;
      
      // Debug: show all messages
      console.log(`[ChatHandler] Messages in conversation:`);
      conversation.forEach((m, idx) => {
        console.log(`  [${idx}] ${m.role}: ${m.content?.substring(0, 50)}...`);
      });
      
      for (let i = 0; i < conversation.length; i++) {
        const msg = conversation[i];
        
        if (msg.role === 'assistant') {
          hasAssistantMessage = true;
          console.log(`[ChatHandler] Found assistant message at index ${i}`);
        } else if (msg.role === 'user' && hasAssistantMessage) {
          userReplyCount++;
          console.log(`[ChatHandler] User reply #${userReplyCount} at index ${i}: "${msg.content?.substring(0, 30)}"`);
          
          // Check for lead keywords in user message
          const content = msg.content.toLowerCase();
          for (const keyword of leadKeywords) {
            if (content.includes(keyword.toLowerCase())) {
              hasLeadKeyword = true;
              console.log(`[ChatHandler] Lead keyword detected: "${keyword}" in chat ${platformChatId}`);
              break;
            }
          }
        }
      }
      
      // Mark as LEAD if:
      // 1. User used a lead keyword, OR
      // 2. User has replied 2+ times (engaged conversation)
      const isLead = hasLeadKeyword || userReplyCount >= 2;
      
      if (isLead) {
        this.addTag(platformChatId, 'LEAD');
        const reason = hasLeadKeyword ? 'keyword detected' : `${userReplyCount} replies`;
        console.log(`[ChatHandler] Auto-tagged chat ${platformChatId} as LEAD (${reason})`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[ChatHandler] Error in checkAndMarkAsLead:', error);
      return false;
    }
  }

  /**
   * Get platform-prefixed chat ID
   * @param {string} platform - Platform identifier ('telegram', 'whatsapp', etc.)
   * @param {string} chatId - Original chat ID
   * @returns {string} Platform-prefixed chat ID
   */
  getPlatformChatId(platform, chatId) {
    if (!platform || !chatId) return chatId;
    return `${platform}:${chatId}`;
  }

  /**
   * Add a message to the conversation history
   * @param {string} chatId - Unique identifier for the chat
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   * @param {string} [platform] - Platform identifier ('telegram', 'whatsapp', etc.)
   * @param {Date|string} [customTimestamp] - Custom timestamp for imported messages
   */
  addMessage(chatId, role, content, platform, customTimestamp) {
    try {
      const platformChatId = platform ? this.getPlatformChatId(platform, chatId) : chatId;
      
      console.log(`[ChatHandler] Adding ${role} message to chat ${platformChatId}`);
      
      // Always load existing messages from disk first to ensure we have the latest
      const existingMessages = this.loadChat(platformChatId);
      
      // Update in-memory conversation
      this.conversations.set(platformChatId, existingMessages);
      
      const conversation = this.conversations.get(platformChatId);
      
      // Use custom timestamp if provided, otherwise use current time
      let timestamp;
      if (customTimestamp) {
        timestamp = customTimestamp instanceof Date ? customTimestamp.toISOString() : customTimestamp;
      } else {
        timestamp = new Date().toISOString();
      }
      
      const message = { 
        role, 
        content, 
        timestamp 
      };
      
      // Add new message
      conversation.push(message);
      
      console.log(`[ChatHandler] Added message to chat ${platformChatId}, total messages: ${conversation.length}`);
      
      // Save this chat immediately
      try {
        const chatFile = this.getChatFilePath(platformChatId);
        const jsonContent = JSON.stringify(conversation, null, 2);
        fs.writeFileSync(chatFile, jsonContent, 'utf8');
        console.log(`[ChatHandler] Saved ${conversation.length} messages to ${chatFile}`);
        
        // Update the index as well
        this.updateChatIndex();
        
        // Broadcast real-time update to connected clients
        if (global.broadcastUpdate) {
          global.broadcastUpdate('chat_message', {
            chatId: platformChatId,
            message: message,
            totalMessages: conversation.length
          });
        }
      } catch (error) {
        console.error(`[ChatHandler] Failed to save chat ${platformChatId}:`, error);
      }
      
      return true;
    } catch (error) {
      console.error(`[ChatHandler] Error in addMessage:`, error);
      return false;
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
   * Export chat index to CSV format
   * @returns {string} CSV formatted string of all chats
   */
  exportChatIndexToCSV() {
    try {
      const chats = this.getAllChats();
      
      if (!chats || chats.length === 0) {
        return 'Chat ID,Platform,Last Message,Message Count,Last Active,Created Date\n';
      }

      // CSV headers
      const headers = [
        'Chat ID',
        'Platform', 
        'Last Message',
        'Message Count',
        'Last Active',
        'Created Date'
      ];

      // Helper function to escape CSV values with proper UTF-8 handling
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        let str = String(value);
        
        // Normalize Unicode characters to ensure consistent encoding
        str = str.normalize('NFC');
        
        // Replace problematic characters that might cause issues
        str = str.replace(/[\r\n\t]/g, ' '); // Replace line breaks and tabs with spaces
        str = str.replace(/\s+/g, ' '); // Collapse multiple spaces
        str = str.trim();
        
        // Always wrap in quotes for CSV safety with UTF-8 content
        // This ensures proper handling of international characters, emojis, etc.
        return '"' + str.replace(/"/g, '""') + '"';
      };

      // Helper function to extract platform from chat ID
      const extractPlatform = (chatId) => {
        if (chatId.startsWith('whatsapp:')) return 'WhatsApp';
        if (chatId.startsWith('telegram:')) return 'Telegram';
        if (chatId.startsWith('facebook:')) return 'Facebook';
        if (chatId.startsWith('instagram:')) return 'Instagram';
        return 'Unknown';
      };

      // Helper function to format date
      const formatDate = (timestamp) => {
        if (!timestamp) return '';
        try {
          return new Date(timestamp).toISOString().split('T')[0]; // YYYY-MM-DD format
        } catch (error) {
          return '';
        }
      };

      // Helper function to truncate message preview
      const truncateMessage = (message, maxLength = 100) => {
        if (!message) return '';
        const cleaned = message.replace(/\n/g, ' ').replace(/\r/g, ' ').trim();
        return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
      };

      // Build CSV rows
      const csvRows = [headers.join(',')];
      
      chats.forEach(chat => {
        const row = [
          escapeCSV(chat.id || ''),
          escapeCSV(extractPlatform(chat.id || '')),
          escapeCSV(truncateMessage(chat.preview)),
          escapeCSV(chat.messageCount || 0),
          escapeCSV(formatDate(chat.timestamp)),
          escapeCSV(formatDate(chat.createdAt || chat.timestamp))
        ];
        csvRows.push(row.join(','));
      });

      console.log(`[ChatHandler] Exported ${chats.length} chats to CSV format`);
      return csvRows.join('\n');
      
    } catch (error) {
      console.error('Error exporting chat index to CSV:', error);
      throw error;
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
              
              // Convert filename format to platform:chatId format for tag lookup
              // e.g., whatsapp_85290897701_c.us -> whatsapp:85290897701@c.us
              let tagKey = chatId;
              if (chatId.startsWith('whatsapp_')) {
                // whatsapp_85290897701_c.us -> whatsapp:85290897701@c.us
                tagKey = chatId.replace('whatsapp_', 'whatsapp:').replace(/_c\.us$/, '@c.us').replace(/_g\.us$/, '@g.us');
              } else if (chatId.startsWith('telegram_')) {
                tagKey = chatId.replace('telegram_', 'telegram:');
              }
              
              chats.push({
                id: chatId,
                preview: lastMessage.content?.substring(0, 100) || '',
                timestamp: lastMessage.timestamp || new Date().toISOString(),
                messageCount: messages.length,
                tags: this.tags[tagKey] || this.tags[chatId] || []
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

  /**
   * Clear all chat history
   */
  clearAllChats() {
    try {
      console.log('[ChatHandler] Clearing all chat history...');
      
      // Clear in-memory conversations
      this.conversations.clear();
      
      // Remove all chat files from disk
      const chatFiles = fs.readdirSync(this.chatHistoryDir)
        .filter(file => file.endsWith('.json') && file !== 'chats.json');
      
      chatFiles.forEach(file => {
        const filePath = path.join(this.chatHistoryDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`[ChatHandler] Deleted chat file: ${file}`);
        } catch (error) {
          console.error(`[ChatHandler] Error deleting ${file}:`, error);
        }
      });
      
      // Reset the index file
      const emptyIndex = {
        totalChats: 0,
        lastUpdated: new Date().toISOString(),
        chats: {}
      };
      
      fs.writeFileSync(this.storageFile, JSON.stringify(emptyIndex, null, 2));
      console.log('[ChatHandler] All chat history cleared successfully');
      
    } catch (error) {
      console.error('[ChatHandler] Error clearing all chats:', error);
      throw error;
    }
  }

  /**
   * Merge chat histories from LID format to phone number format
   * This handles the WhatsApp multi-device LID issue where the same contact
   * can have messages split between @lid and @c.us formats
   * @param {string} lidChatId - The LID format chat ID (e.g., whatsapp:123456789@lid)
   * @param {string} phoneChatId - The phone number format chat ID (e.g., whatsapp:85290897701@c.us)
   * @returns {boolean} True if merge was successful
   */
  mergeLidToPhone(lidChatId, phoneChatId) {
    try {
      console.log(`[ChatHandler] Merging LID chat ${lidChatId} into phone chat ${phoneChatId}`);
      
      // Load both conversations
      const lidMessages = this.loadChat(lidChatId);
      const phoneMessages = this.loadChat(phoneChatId);
      
      if (lidMessages.length === 0) {
        console.log(`[ChatHandler] No messages in LID chat ${lidChatId}, nothing to merge`);
        return false;
      }
      
      console.log(`[ChatHandler] Found ${lidMessages.length} messages in LID chat, ${phoneMessages.length} in phone chat`);
      
      // Merge messages, sorted by timestamp
      const allMessages = [...phoneMessages, ...lidMessages];
      allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Remove duplicates based on timestamp and content
      const uniqueMessages = allMessages.filter((msg, index, self) =>
        index === self.findIndex(m => 
          m.timestamp === msg.timestamp && 
          m.content === msg.content && 
          m.role === msg.role
        )
      );
      
      console.log(`[ChatHandler] Merged to ${uniqueMessages.length} unique messages`);
      
      // Save merged conversation to phone format
      this.conversations.set(phoneChatId, uniqueMessages);
      const chatFile = this.getChatFilePath(phoneChatId);
      fs.writeFileSync(chatFile, JSON.stringify(uniqueMessages, null, 2), 'utf8');
      
      // Delete the LID chat file
      const lidChatFile = this.getChatFilePath(lidChatId);
      if (fs.existsSync(lidChatFile)) {
        fs.unlinkSync(lidChatFile);
        console.log(`[ChatHandler] Deleted LID chat file: ${lidChatFile}`);
      }
      
      // Remove from in-memory map
      this.conversations.delete(lidChatId);
      
      // Update index
      this.updateChatIndex();
      
      console.log(`[ChatHandler] Successfully merged LID chat into phone chat`);
      return true;
    } catch (error) {
      console.error(`[ChatHandler] Error merging LID to phone:`, error);
      return false;
    }
  }

  /**
   * Find and merge all detached LID/phone chat pairs
   * @param {Map} lidToPhoneMap - Map of LID to phone number mappings
   * @returns {number} Number of chats merged
   */
  mergeAllDetachedHistories(lidToPhoneMap) {
    let mergedCount = 0;
    
    for (const [lid, phone] of lidToPhoneMap.entries()) {
      // Construct the platform-prefixed chat IDs
      const lidChatId = `whatsapp:${lid}`;
      const phoneChatId = `whatsapp:${phone}`;
      
      if (this.mergeLidToPhone(lidChatId, phoneChatId)) {
        mergedCount++;
      }
    }
    
    console.log(`[ChatHandler] Merged ${mergedCount} detached chat histories`);
    return mergedCount;
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
