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
      }
    } catch (error) {
      console.error('Error loading blocklist:', error);
    }
  }

  saveBlocklist() {
    try {
      const dir = path.dirname(this.blocklistFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        numbers: [...this.blockedNumbers],
        telegramIds: [...this.blockedTelegramIds]
      };
      fs.writeFileSync(this.blocklistFile, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving blocklist:', error);
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
    if (type === 'telegram') {
      return [...this.blockedTelegramIds];
    }
    return [...this.blockedNumbers];
  }
}

module.exports = new BlocklistManager();
