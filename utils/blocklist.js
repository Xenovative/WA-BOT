const fs = require('fs');
const path = require('path');

class BlocklistManager {
  constructor() {
    this.blocklistFile = path.join(__dirname, '../data/blocklist.json');
    this.blockedNumbers = new Set();
    this.blockedTelegramIds = new Set();
    this.tempBlocks = new Map(); // userId -> { until: timestamp, reason: string }
    this.loadBlocklist();
    
    // Clean up expired temp blocks every 5 minutes
    setInterval(() => this.cleanupTempBlocks(), 5 * 60 * 1000);
  }

  loadBlocklist() {
    try {
      if (fs.existsSync(this.blocklistFile)) {
        const data = JSON.parse(fs.readFileSync(this.blocklistFile, 'utf8'));
        this.blockedNumbers = new Set(data.numbers || []);
        this.blockedTelegramIds = new Set(data.telegramIds || []);
        console.log(`[Blocklist] Loaded ${this.blockedNumbers.size} blocked numbers and ${this.blockedTelegramIds.size} blocked Telegram IDs`);
      } else {
        console.log('[Blocklist] No existing blocklist file found, starting with empty blocklist');
        // Create directory if it doesn't exist
        const dir = path.dirname(this.blocklistFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`[Blocklist] Created directory: ${dir}`);
        }
        // Save empty blocklist to create the file
        this.saveBlocklist();
      }
    } catch (error) {
      console.error('Error loading blocklist:', error);
      // Try to create a fresh blocklist file if loading fails
      try {
        const dir = path.dirname(this.blocklistFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        this.saveBlocklist();
        console.log('[Blocklist] Created new blocklist file after error');
      } catch (e) {
        console.error('Failed to create new blocklist file:', e);
      }
    }
  }

  saveBlocklist() {
    try {
      const dir = path.dirname(this.blocklistFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[Blocklist] Created directory: ${dir}`);
      }
      
      const data = {
        numbers: [...this.blockedNumbers].sort(),
        telegramIds: [...this.blockedTelegramIds].sort(),
        lastUpdated: new Date().toISOString()
      };
      
      const tempFile = `${this.blocklistFile}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
      
      // Atomic write
      fs.renameSync(tempFile, this.blocklistFile);
      
      console.log(`[Blocklist] Saved ${data.numbers.length} numbers and ${data.telegramIds.length} Telegram IDs`);
      return true;
    } catch (error) {
      console.error('Error saving blocklist:', error);
      try {
        // Try to clean up temp file if it exists
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (e) {
        console.error('Error cleaning up temp file:', e);
      }
      return false;
    }
  }

  addToBlocklist(identifier, type = 'whatsapp') {
    if (type === 'whatsapp') {
      // Remove any non-digit characters and @c.us suffix if present
      const cleanNumber = identifier.replace(/[^0-9]/g, '').replace(/^0+/, '');
      if (!cleanNumber) return false;
      
      this.blockedNumbers.add(cleanNumber);
    } else if (type === 'telegram') {
      // For Telegram, we'll store the numeric user ID
      const cleanId = String(identifier).trim();
      if (!cleanId) return false;
      
      this.blockedTelegramIds.add(cleanId);
    } else {
      return false;
    }
    
    return this.saveBlocklist();
  }

  removeFromBlocklist(identifier, type = 'whatsapp') {
    let result = false;
    
    if (type === 'whatsapp') {
      const cleanNumber = identifier.replace(/[^0-9]/g, '').replace(/^0+/, '');
      if (!cleanNumber) return false;
      
      result = this.blockedNumbers.delete(cleanNumber);
    } else if (type === 'telegram') {
      const cleanId = String(identifier).trim();
      if (!cleanId) return false;
      
      result = this.blockedTelegramIds.delete(cleanId);
    }
    
    if (result) {
      return this.saveBlocklist();
    }
    return false;
  }

  isBlocked(identifier, type = 'whatsapp', checkManualOnly = false) {
    if (!identifier) return false;
    
    // Check temporary blocks first (manual intervention)
    if (this.tempBlocks.has(identifier)) {
      const block = this.tempBlocks.get(identifier);
      if (Date.now() < block.until) {
        // If we're only checking for manual blocks, or if this is a manual block
        if (!checkManualOnly || block.reason.includes('manual')) {
          console.log(`[Blocklist] ${checkManualOnly ? 'Manual' : 'Temporary'} block active for ${identifier}`);
          return true;
        }
      } else {
        // Clean up expired block
        this.tempBlocks.delete(identifier);
      }
    }
    
    // Skip permanent block check if we're only looking for manual blocks
    if (checkManualOnly) return false;
    
    if (type === 'whatsapp') {
      // Check both the full number and just the digits
      const cleanNumber = String(identifier).replace(/[^0-9]/g, '').replace(/^0+/, '');
      return this.blockedNumbers.has(cleanNumber) || 
             this.blockedNumbers.has(identifier);
    } else if (type === 'telegram') {
      // For Telegram, we check the numeric user ID
      const cleanId = String(identifier).trim();
      return this.blockedTelegramIds.has(cleanId);
    }
    
    return false;
  }
  
  /**
   * Add a temporary block
   * @param {string} identifier - User ID or number to block
   * @param {number} durationMs - Duration in milliseconds
   * @param {string} reason - Reason for the block
   * @returns {boolean} True if block was added
   */
  /**
   * Add a temporary block
   * @param {string} identifier - User ID or number to block
   * @param {number} durationMs - Duration in milliseconds
   * @param {string} reason - Reason for the block
   * @param {boolean} isManual - Whether this is a manual block (vs automatic)
   * @returns {boolean} True if block was added
   */
  addTempBlock(identifier, durationMs = 3600000, reason = 'manual intervention', isManual = true) {
    if (!identifier) return false;
    
    const until = Date.now() + durationMs;
    this.tempBlocks.set(identifier, { until, reason, isManual });
    console.log(`[Blocklist] Added ${isManual ? 'manual' : 'auto'} temporary block for ${identifier} until ${new Date(until).toISOString()}`);
    
    // Auto-remove after duration using global setTimeout
    const timeout = global.setTimeout(() => {
      try {
        if (this.tempBlocks.get(identifier)?.until === until) {
          this.tempBlocks.delete(identifier);
          console.log(`[Blocklist] Temporary block expired for ${identifier}`);
        }
      } catch (error) {
        console.error(`[Blocklist] Error in block expiration for ${identifier}:`, error);
      }
    }, durationMs);
    
    // Store timeout for potential cleanup
    this.timeouts = this.timeouts || new Map();
    this.timeouts.set(identifier, { timeout, until });
    
    return true;
  }
  
  /**
   * Remove a temporary block
   * @param {string} identifier - User ID or number to unblock
   * @returns {boolean} True if block was removed
   */
  removeTempBlock(identifier) {
    const existed = this.tempBlocks.has(identifier);
    if (existed) {
      // Clear the timeout if it exists
      if (this.timeouts?.has(identifier)) {
        const { timeout } = this.timeouts.get(identifier);
        clearTimeout(timeout);
        this.timeouts.delete(identifier);
      }
      
      this.tempBlocks.delete(identifier);
      console.log(`[Blocklist] Removed temporary block for ${identifier}`);
    }
    return existed;
  }
  
  /**
   * Clean up expired temporary blocks and their timeouts
   */
  cleanupTempBlocks() {
    const now = Date.now();
    let removed = 0;
    
    // Initialize timeouts map if it doesn't exist
    this.timeouts = this.timeouts || new Map();
    
    // Clean up expired temporary blocks
    for (const [id, block] of this.tempBlocks.entries()) {
      if (block.until <= now) {
        // Clear the timeout if it exists
        if (this.timeouts.has(id)) {
          clearTimeout(this.timeouts.get(id).timeout);
          this.timeouts.delete(id);
        }
        
        this.tempBlocks.delete(id);
        removed++;
      }
    }
    
    // Clean up any orphaned timeouts
    for (const [id, { until }] of this.timeouts.entries()) {
      if (until <= now) {
        clearTimeout(this.timeouts.get(id).timeout);
        this.timeouts.delete(id);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`[Blocklist] Cleaned up ${removed} expired temporary blocks`);
    }
  }

  /**
   * Get blocked numbers for a specific type
   * @param {string} type - 'whatsapp' or 'telegram'
   * @returns {Array} Sorted array of blocked numbers/IDs
   */
  getBlockedNumbers(type = 'whatsapp') {
    try {
      return type === 'telegram' 
        ? Array.from(this.blockedTelegramIds).sort()
        : Array.from(this.blockedNumbers).sort();
    } catch (error) {
      console.error('Error getting blocked numbers:', error);
      return [];
    }
  }
}

module.exports = new BlocklistManager();
