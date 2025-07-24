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
    
    // Migrate any existing chat files to the new format
    this.migrateChatFiles();
    
    // Load conversations from disk
    this.loadConversations();
  }
  
  /**
   * Migrate existing chat files to the new naming convention and consolidate duplicates
   */
  migrateChatFiles() {
    if (!fs.existsSync(this.chatHistoryDir)) {
      return;
    }

    console.log('[ChatHandler] Starting chat files migration...');
    const files = fs.readdirSync(this.chatHistoryDir);
    const chatFiles = files.filter(file => file.endsWith('.json') && file !== 'chats.json');
    
    // Group files by normalized chat ID
    const chatGroups = new Map();
    
    chatFiles.forEach(file => {
      try {
        const chatId = path.basename(file, '.json');
        const filePath = path.join(this.chatHistoryDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Normalize the chat ID for grouping
        let normalizedId = chatId
          .replace(/^whatsapp[:._-]?/i, '')
          .replace(/^telegram[:._-]?/i, '')
          .replace(/[@_].*$/, '')
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase();
          
        if (!normalizedId) return;
        
        // Add to the appropriate group
        if (!chatGroups.has(normalizedId)) {
          chatGroups.set(normalizedId, []);
        }
        chatGroups.get(normalizedId).push({ file, path: filePath, content });
        
      } catch (error) {
        console.error(`[ChatHandler] Error processing file ${file} during migration:`, error);
      }
    });
    
    // Process each group of files
    let migratedCount = 0;
    chatGroups.forEach((files, normalizedId) => {
      if (files.length <= 1) return; // No need to migrate single files
      
      try {
        console.log(`[ChatHandler] Found ${files.length} files for chat ${normalizedId}`);
        
        // Merge all messages from all files
        const allMessages = [];
        files.forEach(fileInfo => {
          try {
            const messages = JSON.parse(fileInfo.content);
            if (Array.isArray(messages)) {
              allMessages.push(...messages);
            }
          } catch (e) {
            console.error(`[ChatHandler] Error parsing ${fileInfo.file}:`, e);
          }
        });
        
        if (allMessages.length === 0) return;
        
        // Deduplicate and sort messages
        const messageMap = new Map();
        allMessages.forEach(msg => {
          const key = `${msg.timestamp}_${msg.content}`;
          messageMap.set(key, msg);
        });
        
        const uniqueMessages = Array.from(messageMap.values())
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Save to new file
        const newFilename = `chat_${normalizedId}.json`;
        const newPath = path.join(this.chatHistoryDir, newFilename);
        fs.writeFileSync(newPath, JSON.stringify(uniqueMessages, null, 2));
        
        // Remove old files
        files.forEach(fileInfo => {
          if (fileInfo.path !== newPath) {
            try {
              fs.unlinkSync(fileInfo.path);
              console.log(`[ChatHandler] Removed old chat file: ${fileInfo.file}`);
            } catch (e) {
              console.error(`[ChatHandler] Error removing ${fileInfo.file}:`, e);
            }
          }
        });
        
        migratedCount++;
        console.log(`[ChatHandler] Migrated ${files.length} files to ${newFilename} with ${uniqueMessages.length} messages`);
        
      } catch (error) {
        console.error(`[ChatHandler] Error migrating chat ${normalizedId}:`, error);
      }
    });
    
    if (migratedCount > 0) {
      console.log(`[ChatHandler] Migration complete. Processed ${migratedCount} chat groups.`);
    } else {
      console.log('[ChatHandler] No chat files needed migration.');
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
   * @param {boolean} [forceReload=false] - Whether to force reload from disk
   * @returns {Array} Array of message objects
   */
  getConversation(chatId, platform, forceReload = false) {
    const platformChatId = platform ? this.getPlatformChatId(platform, chatId) : chatId;
    console.log(`[ChatHandler] Getting conversation for chat ID: ${platformChatId}`);
    
    if (!chatId) {
      console.log('[ChatHandler] No chat ID provided, returning empty array');
      return [];
    }
    
    // First check if we have this conversation in memory
    if (!forceReload && this.conversations.has(platformChatId)) {
      const cachedMessages = this.conversations.get(platformChatId);
      console.log(`[ChatHandler] Using cached conversation with ${cachedMessages.length} messages for ${platformChatId}`);
      return cachedMessages;
    }
    
    // If not in memory or force reload requested, load from disk
    try {
      const messages = this.loadChat(platformChatId);
      console.log(`[ChatHandler] Loaded ${messages.length} messages for chat ${platformChatId} from disk`);
      return messages;
    } catch (error) {
      console.error(`[ChatHandler] Error loading conversation for ${platformChatId}:`, error);
      return [];
    }
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
   * Get the path for a chat's history file with consistent naming
   * @param {string} chatId - The chat ID (can be in any format)
   * @returns {string} Path to the chat's history file
   */
  getChatFilePath(chatId) {
    if (!chatId) {
      console.error('[ChatHandler] Attempted to get file path for null or undefined chatId');
      return path.join(this.chatHistoryDir, 'invalid_chat.json');
    }
    
    // If chatId already starts with 'chat_', use it as is
    if (chatId.startsWith('chat_')) {
      const filePath = path.join(this.chatHistoryDir, `${chatId}.json`);
      
      // If file exists, return it
      if (fs.existsSync(filePath)) {
        return filePath;
      }
      
      // Otherwise, extract the ID part after 'chat_'
      const idPart = chatId.slice(5); // Remove 'chat_'
      if (idPart) {
        const altPath = path.join(this.chatHistoryDir, `chat_${idPart}.json`);
        if (fs.existsSync(altPath)) {
          return altPath;
        }
      }
      
      // If no existing file, return the original path
      return filePath;
    }
    
    // For non-chat_ prefixed IDs, normalize the ID
    let normalizedId = chatId.toString().trim();
    
    // Remove common WhatsApp/Telegram suffixes and prefixes
    normalizedId = normalizedId
      .replace(/^whatsapp[:._-]?/i, '')  // Remove whatsapp: or whatsapp_ prefix
      .replace(/^telegram[:._-]?/i, '')  // Remove telegram: or telegram_ prefix
      .replace(/[@_].*$/, '')           // Remove everything after @ or _ (like @c.us)
      .replace(/[^a-z0-9]/gi, '_')      // Replace special chars with underscore
      .toLowerCase();
    
    // Ensure we have a valid filename
    if (!normalizedId) {
      console.error(`[ChatHandler] Invalid chatId after normalization: ${chatId}`);
      return path.join(this.chatHistoryDir, 'invalid_chat.json');
    }
    
    // Always use the normalized ID for the filename
    const filename = `chat_${normalizedId}.json`;
    const filePath = path.join(this.chatHistoryDir, filename);
    
    // Check for any existing files that might be the same chat
    if (fs.existsSync(this.chatHistoryDir)) {
      const files = fs.readdirSync(this.chatHistoryDir);
      
      // Look for files that might be the same chat but with different formatting
      const possibleMatches = files.filter(file => {
        if (file === filename) return false; // Skip exact match
        
        // Extract base ID from filename (remove 'chat_' and '.json')
        const baseId = file.startsWith('chat_') && file.endsWith('.json')
          ? file.slice(5, -5)
          : '';
          
        // Check if this file might be the same chat
        return baseId && (
          baseId === normalizedId ||
          baseId.startsWith(normalizedId) ||
          normalizedId.startsWith(baseId)
        );
      });
      
      // If we found matching files, use the first one
      if (possibleMatches.length > 0) {
        console.log(`[ChatHandler] Found ${possibleMatches.length} possible matches for chat ${chatId}, using ${possibleMatches[0]}`);
        return path.join(this.chatHistoryDir, possibleMatches[0]);
      }
    }
    
    return filePath;
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
        
        // Load existing messages first to avoid overwriting
        let existingMessages = [];
        if (fs.existsSync(chatFile)) {
          try {
            const fileContent = fs.readFileSync(chatFile, 'utf8');
            existingMessages = JSON.parse(fileContent);
            if (!Array.isArray(existingMessages)) {
              console.warn(`[ChatHandler] Existing chat file for ${chatId} is not an array, initializing new array`);
              existingMessages = [];
            }
          } catch (error) {
            console.error(`[ChatHandler] Error reading existing chat file for ${chatId}:`, error);
            existingMessages = [];
          }
        }
        
        // Merge existing messages with new ones, removing duplicates by timestamp and content
        const messageMap = new Map();
        
        // Add existing messages first
        existingMessages.forEach(msg => {
          const key = `${msg.timestamp}_${msg.content}`;
          messageMap.set(key, msg);
        });
        
        // Add/update with new messages
        messages.forEach(msg => {
          const key = `${msg.timestamp}_${msg.content}`;
          messageMap.set(key, msg);
        });
        
        // Convert back to array and sort by timestamp
        const mergedMessages = Array.from(messageMap.values())
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Save the merged messages
        const jsonContent = JSON.stringify(mergedMessages, null, 2);
        fs.writeFileSync(chatFile, jsonContent, 'utf8');
        
        // Update in-memory cache with merged messages
        this.conversations.set(chatId, mergedMessages);
        
        console.log(`[ChatHandler] Saved ${mergedMessages.length} messages for chat ${chatId}`);
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
  
  /**
   * Load a single chat's messages with validation and deduplication
   * @param {string} chatId - The chat ID to load
   * @returns {Array} Array of validated and deduplicated messages
   */
  loadChat(chatId) {
    if (!chatId) {
      console.warn('[ChatHandler] Cannot load chat: No chat ID provided');
      return [];
    }

    // Check if we already have this chat in memory
    if (this.conversations.has(chatId)) {
      return this.conversations.get(chatId);
    }

    // If chatId doesn't start with 'chat_', try with and without the prefix
    const chatIdsToTry = chatId.startsWith('chat_') 
      ? [chatId] 
      : [chatId, `chat_${chatId}`];

    let lastError = null;
    
    for (const currentChatId of chatIdsToTry) {
      try {
        const chatFile = this.getChatFilePath(currentChatId);
        
        if (fs.existsSync(chatFile)) {
          const fileContent = fs.readFileSync(chatFile, 'utf8');
          
          try {
            let messages = [];
            try {
              const parsed = JSON.parse(fileContent);
              // Handle both array and object with messages property
              messages = Array.isArray(parsed) ? parsed : 
                       (Array.isArray(parsed?.messages) ? parsed.messages : []);
            } catch (e) {
              console.error(`[ChatHandler] Error parsing JSON for chat ${currentChatId}:`, e);
              continue; // Try next chat ID
            }
            
            // Process and validate messages (only log if there are issues)
            const validMessages = messages
              .filter(msg => {
                const isValid = msg && 
                              typeof msg === 'object' && 
                              typeof msg.role === 'string' && 
                              typeof msg.content === 'string' &&
                              msg.content.trim() !== '';
                
                if (!isValid && msg) {
                  console.warn(`[ChatHandler] Filtered invalid message in ${currentChatId}`);
                }
                
                return isValid;
              })
              .map(msg => ({
                role: msg.role,
                content: msg.content.trim(),
                timestamp: typeof msg.timestamp === 'number' 
                  ? new Date(msg.timestamp).toISOString() 
                  : (msg.timestamp || new Date().toISOString())
              }));
            
            // Only deduplicate if needed (performance optimization)
            let uniqueMessages = validMessages;
            if (validMessages.length !== messages.length) {
              // Deduplicate messages by timestamp and content
              const messageMap = new Map();
              validMessages.forEach(msg => {
                const key = `${msg.timestamp}_${msg.content}`;
                if (!messageMap.has(key)) {
                  messageMap.set(key, msg);
                }
              });
              
              uniqueMessages = Array.from(messageMap.values())
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
              
              // If we had to clean up the messages, save them back
              if (uniqueMessages.length !== messages.length) {
                console.log(`[ChatHandler] Cleaned up messages for ${currentChatId}: ${messages.length} -> ${uniqueMessages.length}`);
                // Schedule save for later to avoid blocking
                setTimeout(() => this.saveConversations(), 0);
              }
            }
            
            // Update in-memory cache with the original chatId
            this.conversations.set(chatId, uniqueMessages);
            
            return uniqueMessages;
            
          } catch (error) {
            lastError = error;
            console.error(`[ChatHandler] Error processing messages for ${currentChatId}:`, error);
            continue; // Try next chat ID
          }
        }
      } catch (error) {
        lastError = error;
        console.error(`[ChatHandler] Error loading chat ${currentChatId}:`, error);
        continue; // Try next chat ID
      }
    }
    
    // If we get here, no chat file was found
    console.log(`[ChatHandler] Chat file does not exist for any of: ${chatIdsToTry.join(', ')}, creating new chat`);
    this.conversations.set(chatId, []);
    return [];
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
