/**
 * Manages conversation history for chats
 */
const fs = require('fs');
const path = require('path');

class ChatHandler {
  constructor() {
    // Map to store conversation history by chat ID
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
    
    // Migrate any existing chat files to the new format
    this.migrateChatFiles();
    
    // Load conversations and blocked chats from disk
    this.loadConversations();
    this.loadBlockedChats();
    console.log('[ChatHandler] Conversations loaded from disk');
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
    
    // Check if chatId already has a chat_ prefix
    if (chatId.startsWith('chat_')) {
      // Extract the actual ID part after chat_
      const idPart = chatId.substring(5); // Remove 'chat_'
      
      // Check if the remaining part already has a platform prefix
      if (idPart.match(/^(whatsapp|telegram)[:_]/i)) {
        // Already has platform prefix after chat_, return as is
        return idPart;
      } else {
        // Has chat_ prefix but no platform prefix, add platform
        return `${platform.toLowerCase()}_${idPart}`;
      }
    }
    
    // Check if chatId already has a platform prefix without chat_
    if (chatId.match(/^(whatsapp|telegram)[:_]/i)) {
      // Already has a platform prefix, normalize it
      const parts = chatId.split(/[:_]/);
      if (parts.length >= 2) {
        return `${platform.toLowerCase()}_${parts[1]}`;
      }
    }
    
    // Remove any existing platform prefix to avoid duplication
    const cleanId = chatId.replace(/^(whatsapp|telegram)[:_]?/i, '');
    
    // Remove WhatsApp/Telegram suffixes
    const normalizedId = cleanId
      .replace(/[@].*$/, '')           // Remove everything after @ (like @c.us)
      .replace(/[^a-z0-9]/gi, '_');    // Replace special chars with underscore
    
    // Return in the format: whatsapp_12345678
    return `${platform.toLowerCase()}_${normalizedId}`;
  }

  /**
   * Add a message to the conversation history
   * @param {string} chatId - Unique identifier for the chat
   * @param {string|object} roleOrMessage - 'user' or 'assistant' role, or message object
   * @param {string} [content] - Message content (if roleOrMessage is a string)
   * @param {string} [platform] - Platform identifier ('telegram', 'whatsapp', etc.)
   */
  addMessage(chatId, roleOrMessage, content, platform) {
    // Validate input parameters
    if (!chatId || chatId.trim() === '' || chatId === 'undefined' || chatId === 'null') {
      console.log('[ChatHandler] Invalid chat ID provided, skipping message:', chatId);
      return;
    }
    
    // Ensure chatId is a string
    chatId = String(chatId).trim();
    
    let message;
    let formattedChatId;
    
    // Handle both old format (role, content, platform) and new format (message object)
    if (typeof roleOrMessage === 'object') {
      // New format: second parameter is a message object
      message = {
        role: roleOrMessage.role,
        content: roleOrMessage.content,
        timestamp: roleOrMessage.timestamp || new Date().toISOString(),
        isManual: roleOrMessage.isManual || false
      };
      formattedChatId = chatId; // Use chatId as-is for new format
    } else {
      // Old format: separate parameters
      const role = roleOrMessage;
      
      // Format the chat ID for storage consistently
      if (chatId.startsWith('chat_')) {
        formattedChatId = chatId.substring(5); // Remove 'chat_'
      } else if (chatId.match(/^(whatsapp|telegram)_/i)) {
        formattedChatId = chatId;
      } else if (platform) {
        const cleanId = chatId
          .replace(/[@].*$/, '')           // Remove everything after @ (like @c.us)
          .replace(/[^a-z0-9]/gi, '_')     // Replace special chars with underscore
          .toLowerCase();
        formattedChatId = `${platform.toLowerCase()}_${cleanId}`;
      } else {
        const cleanId = chatId
          .replace(/[@].*$/, '')
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase();
        
        if (cleanId === '' || cleanId === 'chat' || cleanId === '_') {
          formattedChatId = `unknown_${Date.now()}`;
          console.warn(`[ChatHandler] Problematic chat ID "${chatId}" normalized to ${formattedChatId}`);
        } else {
          formattedChatId = cleanId;
        }
      }
      
      message = {
        role,
        content,
        timestamp: new Date().toISOString()
      };
    }
    
    console.log(`[ChatHandler] Adding ${message.role} message to chat ${formattedChatId}`);
    
    // Check if we have this conversation in memory
    if (!this.conversations.has(formattedChatId)) {
      console.log(`[ChatHandler] Creating new conversation for chat ${formattedChatId}`);
      this.conversations.set(formattedChatId, []);
    }
    
    const conversation = this.conversations.get(formattedChatId);
    conversation.push(message);
    console.log(`[ChatHandler] Added message to chat ${formattedChatId}, total messages: ${conversation.length}`);
    
    // Persist to disk immediately
    try {
      this.saveConversations();
    } catch (error) {
      console.error(`[ChatHandler] Failed to save conversations after adding message:`, error);
    }
  }

  /**
   * Load all conversations from disk into memory
   * This is called during initialization and ensures all chat files are loaded
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
        file => file.endsWith('.json') && file !== 'chats.json'
      );
      
      console.log(`[ChatHandler] Found ${chatFiles.length} chat files to load`);
      
      // Track chat IDs to detect duplicates
      const processedIds = new Set();
      
      // Load each chat file and populate conversations map
      chatFiles.forEach(file => {
        try {
          // Get the original chat ID from the filename without modifications
          const chatId = path.basename(file, '.json');
          
          // Skip if we've already processed this chat ID or a variant of it
          for (const processedId of processedIds) {
            if (this.isSameChatId(chatId, processedId)) {
              console.log(`[ChatHandler] Skipping duplicate chat file ${file} (matches ${processedId})`);
              return; // Skip this file
            }
          }
          
          const filePath = path.join(this.chatHistoryDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          try {
            const messages = JSON.parse(fileContent);
            if (Array.isArray(messages) && messages.length > 0) {
              // Store messages in memory using the exact chat ID from the filename
              this.conversations.set(chatId, messages);
              processedIds.add(chatId); // Mark this ID as processed
              console.log(`[ChatHandler] Loaded ${messages.length} messages for chat ${chatId}`);
            } else {
              console.warn(`[ChatHandler] Empty or invalid format in ${file}, initializing empty array`);
              this.conversations.set(chatId, []);
              processedIds.add(chatId); // Mark this ID as processed
            }
          } catch (parseError) {
            console.error(`[ChatHandler] Error parsing ${file}:`, parseError);
            this.conversations.set(chatId, []);
            processedIds.add(chatId); // Mark this ID as processed
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
   * Load a specific chat from disk
   * @param {string} chatId - The chat ID to load
   * @returns {Array} Array of message objects
   */
  loadChat(chatId) {
    if (!chatId) {
      console.log('[ChatHandler] No chat ID provided for loadChat');
      return [];
    }
    
    console.log(`[ChatHandler] Loading chat ${chatId} from disk`);
    
    try {
      // Format the chat ID consistently (remove chat_ prefix)
      let formattedChatId;
      
      if (chatId.startsWith('chat_')) {
        formattedChatId = chatId.substring(5);
      } else if (chatId.match(/^(whatsapp|telegram)_/i)) {
        formattedChatId = chatId;
      } else {
        formattedChatId = chatId;
      }
      
      // Get the file path for this chat
      const chatFile = path.join(this.chatHistoryDir, `${formattedChatId}.json`);
      
      // Check if the file exists
      if (fs.existsSync(chatFile)) {
        const fileContent = fs.readFileSync(chatFile, 'utf8');
        let messages = [];
        
        try {
          messages = JSON.parse(fileContent);
          if (!Array.isArray(messages)) {
            console.error(`[ChatHandler] Chat file ${chatFile} does not contain an array`);
            messages = [];
          }
        } catch (parseError) {
          console.error(`[ChatHandler] Error parsing JSON for chat file ${chatFile}:`, parseError);
        }
        
        // Store in memory
        this.conversations.set(formattedChatId, messages);
        console.log(`[ChatHandler] Loaded ${messages.length} messages for chat ${formattedChatId} from disk`);
        return messages;
      } else {
        console.log(`[ChatHandler] No chat file found for ${formattedChatId}`);
        // Create an empty conversation
        this.conversations.set(formattedChatId, []);
        return [];
      }
    } catch (error) {
      console.error(`[ChatHandler] Error loading chat ${chatId}:`, error);
      return [];
    }
  }

  /**
   * Get conversation history for a chat
   * @param {string} chatId - The chat ID to get conversation for
   * @param {string} [platform] - Platform identifier ('telegram', 'whatsapp', etc.')
   * @param {boolean} [forceReload=false] - Whether to force reload from disk
   * @returns {Array} Array of message objects
   */
  getConversation(chatId, platform, forceReload = false) {
    if (!chatId) {
      console.log('[ChatHandler] No chat ID provided, returning empty array');
      return [];
    }
    
    // Format the chat ID consistently for lookup
    let formattedChatId;
    
    // First, check if this is a chat ID with chat_ prefix and remove it
    if (chatId.startsWith('chat_')) {
      formattedChatId = chatId.substring(5);
      console.log(`[ChatHandler] Removed chat_ prefix: ${chatId} -> ${formattedChatId}`);
    } 
    // Check if it's a platform-prefixed ID without chat_ prefix (like 'whatsapp_123')
    else if (chatId.match(/^(whatsapp|telegram)_/i)) {
      formattedChatId = chatId;
      console.log(`[ChatHandler] Using platform ID as-is: ${formattedChatId}`);
    }
    // Handle other formats with platform info
    else if (platform) {
      // Clean the chat ID and add platform prefix
      const cleanId = chatId
        .replace(/[@].*$/, '')           // Remove everything after @ (like @c.us)
        .replace(/[^a-z0-9]/gi, '_')     // Replace special chars with underscore
        .toLowerCase();
      formattedChatId = `${platform.toLowerCase()}_${cleanId}`;
      console.log(`[ChatHandler] Normalized chat ID with platform: ${formattedChatId}`);
    }
    // No platform info available
    else {
      const cleanId = chatId
        .replace(/[@].*$/, '')
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
      
      // Prevent problematic file names
      if (cleanId === '' || cleanId === 'chat' || cleanId === '_') {
        formattedChatId = `unknown_${Date.now()}`;
        console.warn(`[ChatHandler] Problematic chat ID "${chatId}" normalized to ${formattedChatId}`);
      } else {
        formattedChatId = cleanId;
      }
      console.log(`[ChatHandler] Using generic ID: ${formattedChatId}`);
    }
    
    // Log the mapping for debugging
    console.log(`[ChatHandler] Chat ID mapping: ${chatId} -> ${formattedChatId}`);
    
    // First check if we have this conversation in memory with the formatted ID
    if (!forceReload && this.conversations.has(formattedChatId)) {
      const cachedMessages = this.conversations.get(formattedChatId);
      console.log(`[ChatHandler] Using cached conversation with ${cachedMessages.length} messages for ${formattedChatId}`);
      return cachedMessages;
    }
    
    // Also check if we have it with the original ID (for backward compatibility)
    if (!forceReload && this.conversations.has(chatId)) {
      const cachedMessages = this.conversations.get(chatId);
      console.log(`[ChatHandler] Using cached conversation with original ID: ${chatId} (${cachedMessages.length} messages)`);
      
      // Move the conversation to the formatted ID for future consistency
      this.conversations.set(formattedChatId, cachedMessages);
      this.conversations.delete(chatId);
      console.log(`[ChatHandler] Moved conversation from ${chatId} to ${formattedChatId}`);
      
      return cachedMessages;
    }
    
    // If not in memory or force reload requested, load from disk
    try {
      const messages = this.loadChat(formattedChatId);
      console.log(`[ChatHandler] Loaded ${messages.length} messages for chat ${formattedChatId} from disk`);
      return messages;
    } catch (error) {
      console.error(`[ChatHandler] Error loading conversation for ${formattedChatId}:`, error);
      return [];
    }
  }

  /**
   * Clear conversation history for a chat
   * @param {string} chatId - Unique identifier for the chat
   */
  clearConversation(chatId) {
    try {
      // Format the chat ID consistently (remove chat_ prefix)
      let formattedChatId;
      
      if (chatId.startsWith('chat_')) {
        formattedChatId = chatId.substring(5);
      } else if (chatId.match(/^(whatsapp|telegram)_/i)) {
        formattedChatId = chatId;
      } else {
        const cleanId = chatId
          .replace(/[@].*$/, '')
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase();
        
        // Prevent problematic file names
        if (cleanId === '' || cleanId === 'chat' || cleanId === '_') {
          formattedChatId = `unknown_${Date.now()}`;
          console.warn(`[ChatHandler] Problematic chat ID "${chatId}" normalized to ${formattedChatId}`);
        } else {
          formattedChatId = cleanId;
        }
      }
      
      console.log(`[ChatHandler] Clearing conversation for ${chatId} (formatted: ${formattedChatId})`);
      
      // Delete the chat file
      const chatFile = path.join(this.chatHistoryDir, `${formattedChatId}.json`);
      if (fs.existsSync(chatFile)) {
        fs.unlinkSync(chatFile);
        console.log(`[ChatHandler] Deleted chat file: ${chatFile}`);
      }
      
      // Remove from memory with both IDs to be safe
      this.conversations.delete(formattedChatId);
      this.conversations.delete(chatId);
      
      // Update the index
      this.updateChatIndex();
      console.log(`[ChatHandler] Conversation cleared for ${formattedChatId}`);
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
    
    // Handle chat IDs with platform prefixes consistently
    let normalizedId;
    
    // First, check if this is a chat ID with chat_ prefix
    if (chatId.startsWith('chat_')) {
      // Extract the part after chat_
      const idPart = chatId.substring(5); // Remove 'chat_'
      
      // Check if the ID part already has a platform prefix
      if (idPart.match(/^(whatsapp|telegram)_/i)) {
        // Already has proper format (chat_whatsapp_123456)
        normalizedId = chatId;
      } else {
        // Has chat_ prefix but no platform, treat as raw ID
        normalizedId = chatId;
      }
    } 
    // Check if it's a platform-prefixed ID without chat_ prefix
    else if (chatId.match(/^(whatsapp|telegram)_/i)) {
      // Add chat_ prefix to the properly formatted platform ID
      normalizedId = `chat_${chatId}`;
    }
    // Handle other formats
    else {
      // Extract platform prefix if present (whatsapp, telegram, etc.)
      let platform = '';
      const platformMatch = chatId.match(/^(whatsapp|telegram)[:.-]?/i);
      if (platformMatch) {
        platform = platformMatch[1].toLowerCase();
        const idPart = chatId.replace(/^(whatsapp|telegram)[:.-]?/i, '');
        
        // Clean up the ID part
        const cleanId = idPart
          .replace(/[@].*$/, '')           // Remove everything after @ (like @c.us)
          .replace(/[^a-z0-9]/gi, '_')     // Replace special chars with underscore
          .toLowerCase();
        
        // Format with platform prefix
        normalizedId = `chat_${platform}_${cleanId}`;
      } else {
        // No platform info, use as generic ID
        const cleanId = chatId
          .replace(/[@].*$/, '')
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase();
        
        normalizedId = `chat_${cleanId}`;
      }
    }
    
    // Log the normalization for debugging
    console.log(`[ChatHandler] Normalized chat ID for file path: ${chatId} -> ${normalizedId}`);
    
    // Create the file path
    const filePath = path.join(this.chatHistoryDir, `${normalizedId}.json`);
    
    // If the exact file exists, return it
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    
    // Check for any existing files that might match this chat
    if (fs.existsSync(this.chatHistoryDir)) {
      const files = fs.readdirSync(this.chatHistoryDir)
        .filter(file => file.endsWith('.json') && file !== 'chats.json');
      
      // Try to find an existing file that might be the same chat
      for (const file of files) {
        const fileId = path.basename(file, '.json');
        
        // Check if this is the same chat with different formatting
        if (this.isSameChatId(fileId, normalizedId)) {
          const matchPath = path.join(this.chatHistoryDir, file);
          console.log(`[ChatHandler] Found matching chat file: ${file} for ${chatId}`);
          return matchPath;
        }
      }
    }
    
    // No existing file found, return the normalized path
    return filePath;
  }
  
  /**
   * Check if two chat IDs refer to the same chat
   * @param {string} id1 - First chat ID
   * @param {string} id2 - Second chat ID
   * @returns {boolean} - True if they refer to the same chat
   */
  isSameChatId(id1, id2) {
    if (id1 === id2) return true;
    
    // Remove chat_ prefix if present
    const base1 = id1.startsWith('chat_') ? id1.substring(5) : id1;
    const base2 = id2.startsWith('chat_') ? id2.substring(5) : id2;
    
    if (base1 === base2) return true;
    
    // Extract platform and ID parts
    const parts1 = base1.match(/^(whatsapp|telegram)_(.+)$/i);
    const parts2 = base2.match(/^(whatsapp|telegram)_(.+)$/i);
    
    // If both have platform prefixes
    if (parts1 && parts2) {
      // Check if platforms match
      if (parts1[1].toLowerCase() !== parts2[1].toLowerCase()) {
        return false; // Different platforms
      }
      
      // Compare the ID parts
      return parts1[2] === parts2[2];
    }
    
    // If only one has a platform prefix
    if (parts1 || parts2) {
      const withPrefix = parts1 ? parts1 : parts2;
      const withoutPrefix = parts1 ? base2 : base1;
      
      // Compare the ID part with the unprefixed ID
      return withPrefix[2] === withoutPrefix;
    }
    
    // Neither has a platform prefix, compare directly
    return base1 === base2;
  }

  // Save conversations to disk
  saveConversations() {
    console.log(`[ChatHandler] Saving ${this.conversations.size} conversations to disk`);
    
    // Ensure chat history directory exists
    if (!fs.existsSync(this.chatHistoryDir)) {
      fs.mkdirSync(this.chatHistoryDir, { recursive: true });
    }
    
    // Create a safe copy of the conversations to avoid modifying while iterating
    const conversationsToSave = new Map(this.conversations);
    const updatedConversations = new Map();
    
    // Save each chat to its own file
    conversationsToSave.forEach((messages, chatId) => {
      try {
        // Use chat ID as-is for file naming (no chat_ prefix)
        let formattedChatId = chatId;
        if (formattedChatId.startsWith('chat_')) {
          formattedChatId = formattedChatId.substring(5);
          console.log(`[ChatHandler] Removed chat_ prefix for saving: ${chatId} -> ${formattedChatId}`);
        }
        
        // Get the proper file path for this chat
        const chatFile = path.join(this.chatHistoryDir, `${formattedChatId}.json`);
        
        // Load existing messages first to avoid overwriting
        let existingMessages = [];
        if (fs.existsSync(chatFile)) {
          try {
            const fileContent = fs.readFileSync(chatFile, 'utf8');
            existingMessages = JSON.parse(fileContent);
            if (!Array.isArray(existingMessages)) {
              console.warn(`[ChatHandler] Existing chat file for ${formattedChatId} is not an array, initializing new array`);
              existingMessages = [];
            }
          } catch (error) {
            console.error(`[ChatHandler] Error reading existing chat file for ${formattedChatId}:`, error);
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
        
        // Store the updated conversation with the formatted ID
        updatedConversations.set(formattedChatId, mergedMessages);
        
        console.log(`[ChatHandler] Saved ${mergedMessages.length} messages for chat ${formattedChatId}`);
      } catch (error) {
        console.error(`[ChatHandler] Error saving chat history for ${chatId}:`, error);
        // Still add to updated conversations to avoid losing the data
        updatedConversations.set(chatId, messages);
      }
    });
    
    // Now safely update the in-memory conversations Map with all changes at once
    this.conversations.clear();
    updatedConversations.forEach((messages, chatId) => {
      this.conversations.set(chatId, messages);
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
      
      // Clear existing conversations to avoid duplicates
      this.conversations.clear();
      
      // Track chat IDs to detect duplicates
      const processedIds = new Set();
      
      // Load each chat file and populate conversations map
      chatFiles.forEach(file => {
        try {
          // Get the original chat ID from the filename without modifications
          const chatId = path.basename(file, '.json');
          
          // Skip if we've already processed this chat ID or a variant of it
          for (const processedId of processedIds) {
            if (this.isSameChatId(chatId, processedId)) {
              console.log(`[ChatHandler] Skipping duplicate chat file ${file} (matches ${processedId})`);
              return; // Skip this file
            }
          }
          
          const filePath = path.join(this.chatHistoryDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          try {
            const messages = JSON.parse(fileContent);
            if (Array.isArray(messages) && messages.length > 0) {
              // Store messages in memory using the exact chat ID from the filename
              this.conversations.set(chatId, messages);
              processedIds.add(chatId); // Mark this ID as processed
              console.log(`[ChatHandler] Loaded ${messages.length} messages for chat ${chatId}`);
            } else {
              console.warn(`[ChatHandler] Empty or invalid format in ${file}, initializing empty array`);
              this.conversations.set(chatId, []);
              processedIds.add(chatId); // Mark this ID as processed
            }
          } catch (parseError) {
            console.error(`[ChatHandler] Error parsing ${file}:`, parseError);
            this.conversations.set(chatId, []);
            processedIds.add(chatId); // Mark this ID as processed
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
   * Load blocked chats from disk
   */
  loadBlockedChats() {
    try {
      if (fs.existsSync(this.blockedChatsFile)) {
        const data = fs.readFileSync(this.blockedChatsFile, 'utf8');
        const blockedChatsArray = JSON.parse(data);
        this.blockedChats = new Set(blockedChatsArray);
        console.log(`[ChatHandler] Loaded ${this.blockedChats.size} blocked chats`);
      } else {
        console.log('[ChatHandler] No blocked chats file found, starting with empty set');
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
      const blockedChatsArray = Array.from(this.blockedChats);
      fs.writeFileSync(this.blockedChatsFile, JSON.stringify(blockedChatsArray, null, 2));
      console.log(`[ChatHandler] Saved ${blockedChatsArray.length} blocked chats to disk`);
    } catch (error) {
      console.error('[ChatHandler] Error saving blocked chats:', error);
    }
  }

  /**
   * Check if a chat is blocked (AI responses disabled)
   * @param {string} chatId - Chat ID to check
   * @returns {boolean} True if chat is blocked
   */
  isChatBlocked(chatId) {
    // Check direct match first
    if (this.blockedChats.has(chatId)) {
      return true;
    }
    
    // Handle format mismatch between message handlers and UI
    // Message handlers use: whatsapp_123456, telegram_123456
    // UI/Database uses: chat_whatsapp_123456, chat_telegram_123456
    
    let alternativeId;
    if (chatId.startsWith('chat_')) {
      // Remove chat_ prefix: chat_whatsapp_123456 -> whatsapp_123456
      alternativeId = chatId.substring(5);
    } else {
      // Add chat_ prefix: whatsapp_123456 -> chat_whatsapp_123456
      alternativeId = `chat_${chatId}`;
    }
    
    const isBlocked = this.blockedChats.has(alternativeId);
    if (isBlocked) {
      console.log(`[ChatHandler] Found blocked chat with alternative format: ${chatId} -> ${alternativeId}`);
    }
    
    return isBlocked;
  }

  /**
   * Block a chat (disable AI responses)
   * @param {string} chatId - Chat ID to block
   */
  blockChat(chatId) {
    this.blockedChats.add(chatId);
    this.saveBlockedChats();
    console.log(`[ChatHandler] Blocked chat: ${chatId}`);
  }

  /**
   * Unblock a chat (enable AI responses)
   * @param {string} chatId - Chat ID to unblock
   */
  unblockChat(chatId) {
    this.blockedChats.delete(chatId);
    this.saveBlockedChats();
    console.log(`[ChatHandler] Unblocked chat: ${chatId}`);
  }

  /**
   * Get list of blocked chats
   * @returns {Array<string>} Array of blocked chat IDs
   */
  getBlockedChats() {
    return Array.from(this.blockedChats);
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
