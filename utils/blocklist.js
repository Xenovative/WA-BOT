const fs = require('fs');
const path = require('path');

class BlocklistManager {
  constructor() {
    this.blocklistFile = path.join(__dirname, '../data/blocklist.json');
    this.blockedNumbers = new Set();
    this.blockedTelegramIds = new Set();
    this.loadBlocklist();
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

  isBlocked(identifier, type = 'whatsapp') {
    if (!identifier) return false;
    
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

  getBlockedNumbers(type = 'whatsapp') {
    try {
      if (type === 'telegram') {
        return Array.from(this.blockedTelegramIds).sort();
      }
      return Array.from(this.blockedNumbers).sort();
    } catch (error) {
      console.error('Error getting blocked numbers:', error);
      return [];
    }
  }
}

module.exports = new BlocklistManager();
