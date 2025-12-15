/**
 * LID (Linked ID) Resolver Utility
 * 
 * WhatsApp's multi-device system uses LIDs (Linked Device IDs) instead of phone numbers
 * for some contacts. The same contact can appear as both:
 * - Phone number format: 85290897701@c.us
 * - LID format: 123456789@lid
 * 
 * This utility maintains a mapping between LIDs and phone numbers to ensure
 * consistent chat history storage.
 */

const fs = require('fs');
const path = require('path');

class LidResolver {
  constructor() {
    this.mappingFile = path.join(__dirname, '..', 'data', 'lid_mapping.json');
    this.lidToPhone = new Map();
    this.phoneToLid = new Map();
    this.client = null;
    this.loadMapping();
  }

  /**
   * Set the WhatsApp client for resolving LIDs
   * @param {Client} client - WhatsApp Web.js client
   */
  setClient(client) {
    this.client = client;
  }

  /**
   * Load existing LID mappings from disk
   */
  loadMapping() {
    try {
      if (fs.existsSync(this.mappingFile)) {
        const data = JSON.parse(fs.readFileSync(this.mappingFile, 'utf8'));
        if (data.mappings) {
          for (const [lid, phone] of Object.entries(data.mappings)) {
            this.lidToPhone.set(lid, phone);
            this.phoneToLid.set(phone, lid);
          }
          console.log(`[LidResolver] Loaded ${this.lidToPhone.size} LID mappings`);
        }
      }
    } catch (error) {
      console.error('[LidResolver] Error loading mapping:', error.message);
    }
  }

  /**
   * Remove a bad mapping (e.g., if LID was incorrectly mapped to bot's number)
   * @param {string} lid - LID to remove mapping for
   */
  removeMapping(lid) {
    const normalizedLid = lid.includes('@') ? lid : `${lid}@lid`;
    const phone = this.lidToPhone.get(normalizedLid);
    
    if (phone) {
      this.lidToPhone.delete(normalizedLid);
      this.phoneToLid.delete(phone);
      console.log(`[LidResolver] Removed mapping: ${normalizedLid} <-> ${phone}`);
      this.saveMapping();
    }
  }

  /**
   * Validate and clean mappings - remove any that map to the bot's number
   * Call this after the client is ready
   */
  validateMappings() {
    if (!this.client || !this.client.info || !this.client.info.wid) {
      console.log(`[LidResolver] Cannot validate mappings - client not ready`);
      return;
    }
    
    const botNumber = this.client.info.wid._serialized;
    const badMappings = [];
    
    for (const [lid, phone] of this.lidToPhone.entries()) {
      if (phone === botNumber) {
        badMappings.push(lid);
      }
    }
    
    if (badMappings.length > 0) {
      console.log(`[LidResolver] Found ${badMappings.length} bad mappings to bot's number, removing...`);
      for (const lid of badMappings) {
        this.removeMapping(lid);
      }
    }
  }

  /**
   * Save LID mappings to disk
   */
  saveMapping() {
    try {
      const dataDir = path.dirname(this.mappingFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const mappings = {};
      for (const [lid, phone] of this.lidToPhone.entries()) {
        mappings[lid] = phone;
      }
      
      fs.writeFileSync(this.mappingFile, JSON.stringify({ 
        mappings,
        lastUpdated: new Date().toISOString()
      }, null, 2));
    } catch (error) {
      console.error('[LidResolver] Error saving mapping:', error.message);
    }
  }

  /**
   * Check if a chat ID is a LID format
   * @param {string} chatId - Chat ID to check
   * @returns {boolean}
   */
  isLid(chatId) {
    return chatId && chatId.endsWith('@lid');
  }

  /**
   * Check if a chat ID is a phone number format
   * @param {string} chatId - Chat ID to check
   * @returns {boolean}
   */
  isPhoneNumber(chatId) {
    return chatId && chatId.endsWith('@c.us');
  }

  /**
   * Add a mapping between LID and phone number
   * @param {string} lid - LID format ID (e.g., 123456789@lid)
   * @param {string} phone - Phone format ID (e.g., 85290897701@c.us)
   * @param {boolean} mergeChatHistory - Whether to merge existing chat histories
   */
  addMapping(lid, phone, mergeChatHistory = true) {
    if (!lid || !phone) return;
    
    // Normalize formats
    const normalizedLid = lid.includes('@') ? lid : `${lid}@lid`;
    const normalizedPhone = (phone.includes('@') ? phone : `${phone}@c.us`).replace('@s.whatsapp.net', '@c.us');
    
    // SAFETY CHECK: Never map a LID to the bot's own number!
    // This would cause the bot to think incoming messages are from itself
    if (this.client && this.client.info && this.client.info.wid) {
      const botNumber = this.client.info.wid._serialized;
      if (normalizedPhone === botNumber) {
        console.warn(`[LidResolver] BLOCKED: Attempted to map ${normalizedLid} to bot's own number ${botNumber}`);
        return;
      }
    }
    
    const existingPhone = this.lidToPhone.get(normalizedLid);
    if (existingPhone && existingPhone === normalizedPhone) {
      return;
    }

    if (existingPhone && existingPhone !== normalizedPhone) {
      this.phoneToLid.delete(existingPhone);
      console.log(`[LidResolver] Updating mapping: ${normalizedLid} <-> ${existingPhone} -> ${normalizedPhone}`);
    } else {
      console.log(`[LidResolver] Added mapping: ${normalizedLid} <-> ${normalizedPhone}`);
    }

    this.lidToPhone.set(normalizedLid, normalizedPhone);
    this.phoneToLid.set(normalizedPhone, normalizedLid);
    this.saveMapping();
    
    // Merge existing chat histories if requested
    if (mergeChatHistory) {
      try {
        const chatHandler = require('../handlers/chatHandler');
        const lidChatId = `whatsapp:${normalizedLid}`;
        const phoneChatId = `whatsapp:${normalizedPhone}`;
        chatHandler.mergeLidToPhone(lidChatId, phoneChatId);
      } catch (error) {
        console.log(`[LidResolver] Could not merge chat histories: ${error.message}`);
      }
    }
  }

  /**
   * Get the phone number for a LID
   * @param {string} lid - LID format ID
   * @returns {string|null} Phone number format ID or null
   */
  getPhoneFromLid(lid) {
    return this.lidToPhone.get(lid) || null;
  }

  /**
   * Get the LID for a phone number
   * @param {string} phone - Phone number format ID
   * @returns {string|null} LID format ID or null
   */
  getLidFromPhone(phone) {
    return this.phoneToLid.get(phone) || null;
  }

  /**
   * Resolve a chat ID to a consistent format (prefer phone number)
   * This is the main method to use for normalizing chat IDs
   * @param {string} chatId - Chat ID in any format
   * @param {object} message - Optional message object for additional resolution
   * @returns {Promise<string>} Normalized chat ID (phone number format preferred)
   */
  async resolve(chatId, message = null) {
    if (!chatId) return chatId;
    
    // If it's a group chat, return as-is
    if (chatId.endsWith('@g.us')) {
      return chatId;
    }

    // If it's already a phone number, return as-is
    if (this.isPhoneNumber(chatId)) {
      return chatId;
    }

    // If it's a LID, try to resolve to phone number
    if (this.isLid(chatId)) {
      // First check our cache
      const cachedPhone = this.getPhoneFromLid(chatId);
      if (cachedPhone) {
        console.log(`[LidResolver] Resolved ${chatId} -> ${cachedPhone} (cached)`);
        return cachedPhone;
      }

      // Try to resolve using the WhatsApp client
      if (this.client) {
        try {
          const resolved = await this.resolveFromClient(chatId);
          if (resolved && resolved !== chatId) {
            console.log(`[LidResolver] Resolved ${chatId} -> ${resolved} (client)`);
            return resolved;
          }
        } catch (error) {
          console.log(`[LidResolver] Client resolution failed for ${chatId}: ${error.message}`);
        }
      }

      // Try to extract from message data
      if (message) {
        const phoneFromMessage = this.extractPhoneFromMessage(message);
        if (phoneFromMessage) {
          this.addMapping(chatId, phoneFromMessage);
          console.log(`[LidResolver] Resolved ${chatId} -> ${phoneFromMessage} (message)`);
          return phoneFromMessage;
        }
      }

      // If we can't resolve, return the LID as-is but log a warning
      console.log(`[LidResolver] Could not resolve LID: ${chatId}`);
    }

    return chatId;
  }

  /**
   * Try to resolve LID using the WhatsApp client
   * @param {string} lid - LID to resolve
   * @returns {Promise<string|null>}
   */
  async resolveFromClient(lid) {
    if (!this.client) {
      console.log(`[LidResolver] No client available for resolution`);
      return null;
    }

    console.log(`[LidResolver] Attempting to resolve LID via client: ${lid}`);

    const normalizePhoneId = (pn) => {
      if (!pn || typeof pn !== 'string') return null;
      if (pn.endsWith('@c.us')) return pn;
      if (pn.endsWith('@s.whatsapp.net')) return pn.replace('@s.whatsapp.net', '@c.us');
      if (pn.includes('@')) return pn;
      return `${pn}@c.us`;
    };

    try {
      // Method 1: Try getContactById
      const contact = await this.client.getContactById(lid);
      console.log(`[LidResolver] getContactById result:`, {
        hasContact: !!contact,
        number: contact?.number,
        id: contact?.id?._serialized,
        name: contact?.name || contact?.pushname
      });
      
      if (contact) {
        // Check if contact has a number property
        if (contact.number) {
          const phone = `${contact.number}@c.us`;
          this.addMapping(lid, phone);
          return phone;
        }
        
        // Try getFormattedNumber if available
        if (typeof contact.getFormattedNumber === 'function') {
          try {
            const formattedNumber = await contact.getFormattedNumber();
            if (formattedNumber) {
              const phone = `${formattedNumber.replace(/\D/g, '')}@c.us`;
              console.log(`[LidResolver] Got formatted number: ${formattedNumber} -> ${phone}`);
              this.addMapping(lid, phone);
              return phone;
            }
          } catch (e) {
            console.log(`[LidResolver] getFormattedNumber failed: ${e.message}`);
          }
        }
        
        // Check id._serialized for phone format
        if (contact.id && contact.id._serialized && contact.id._serialized.endsWith('@c.us')) {
          this.addMapping(lid, contact.id._serialized);
          return contact.id._serialized;
        }
      }
    } catch (error) {
      console.log(`[LidResolver] getContactById failed: ${error.message}`);
    }

    try {
      // Method 2: Try to get chat and extract info
      const chat = await this.client.getChatById(lid);
      console.log(`[LidResolver] getChatById result:`, {
        hasChat: !!chat,
        id: chat?.id?._serialized,
        name: chat?.name
      });
      
      if (chat && chat.id && chat.id._serialized) {
        if (chat.id._serialized.endsWith('@c.us')) {
          this.addMapping(lid, chat.id._serialized);
          return chat.id._serialized;
        }
      }
    } catch (error) {
      console.log(`[LidResolver] getChatById failed: ${error.message}`);
    }

    try {
      // Method 3: Try getContactLidAndPhone if available (newer versions)
      if (typeof this.client.getContactLidAndPhone === 'function') {
        const result = await this.client.getContactLidAndPhone([lid]);
        console.log(`[LidResolver] getContactLidAndPhone result:`, result);

        if (Array.isArray(result) && result.length > 0) {
          const lidKey = String(lid).split('@')[0];
          const match = result.find(r => String(r?.lid || '').split('@')[0] === lidKey) || result[0];
          const phoneId = normalizePhoneId(match?.pn);
          if (phoneId) {
            this.addMapping(lid, phoneId);
            return phoneId;
          }
        }
      }
    } catch (error) {
      console.log(`[LidResolver] getContactLidAndPhone failed: ${error.message}`);
    }

    console.log(`[LidResolver] All client resolution methods failed for ${lid}`);
    return null;
  }

  /**
   * Extract phone number from message object
   * @param {object} message - WhatsApp message object
   * @returns {string|null}
   */
  extractPhoneFromMessage(message) {
    if (!message) return null;

    // IMPORTANT: Do NOT use message.to or message._data.to as sources!
    // When a user sends a message TO the bot:
    //   - message.from = user's LID (what we want to resolve)
    //   - message.to = bot's number (NOT what we want!)
    // Using message.to would incorrectly map the user's LID to the bot's number
    
    // Check various message properties that might contain the SENDER's phone number
    const possibleSources = [
      message._data?.from,  // Sender's ID from _data
      message._data?.author,  // Author in group messages
      message._data?.participant,  // Participant in group messages
      message.author  // Author field
      // NOTE: Intentionally NOT including message.to or message._data.to
    ];

    for (const source of possibleSources) {
      if (source && typeof source === 'string' && source.endsWith('@c.us')) {
        return source;
      }
      if (source && typeof source === 'object' && source._serialized) {
        if (source._serialized.endsWith('@c.us')) {
          return source._serialized;
        }
      }
    }

    return null;
  }

  /**
   * Get all possible IDs for a chat (both LID and phone if known)
   * Useful for searching/merging chat histories
   * @param {string} chatId - Any format chat ID
   * @returns {string[]} Array of all known IDs for this chat
   */
  getAllIds(chatId) {
    const ids = [chatId];
    
    if (this.isLid(chatId)) {
      const phone = this.getPhoneFromLid(chatId);
      if (phone) ids.push(phone);
    } else if (this.isPhoneNumber(chatId)) {
      const lid = this.getLidFromPhone(chatId);
      if (lid) ids.push(lid);
    }
    
    return ids;
  }

  /**
   * Merge chat histories for the same contact with different IDs
   * @param {ChatHandler} chatHandler - Chat handler instance
   * @returns {number} Number of chats merged
   */
  async mergeDetachedHistories(chatHandler) {
    let mergedCount = 0;
    
    for (const [lid, phone] of this.lidToPhone.entries()) {
      try {
        // Get both conversations
        const lidConversation = chatHandler.getConversation(lid.replace('@lid', ''), 'whatsapp');
        const phoneConversation = chatHandler.getConversation(phone.replace('@c.us', ''), 'whatsapp');
        
        if (lidConversation.length > 0 && phoneConversation.length > 0) {
          console.log(`[LidResolver] Found detached histories for ${lid} and ${phone}`);
          
          // Merge into phone number format (preferred)
          const merged = [...phoneConversation, ...lidConversation]
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          
          // Remove duplicates based on timestamp and content
          const unique = merged.filter((msg, index, self) =>
            index === self.findIndex(m => 
              m.timestamp === msg.timestamp && m.content === msg.content
            )
          );
          
          // Save merged conversation to phone format
          // Note: This would need chatHandler method to set full conversation
          console.log(`[LidResolver] Merged ${unique.length} messages for ${phone}`);
          mergedCount++;
        }
      } catch (error) {
        console.error(`[LidResolver] Error merging histories: ${error.message}`);
      }
    }
    
    return mergedCount;
  }
}

// Singleton instance
const lidResolver = new LidResolver();

module.exports = lidResolver;
