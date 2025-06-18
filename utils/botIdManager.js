const fs = require('fs').promises;
const path = require('path');

const BOT_IDS_FILE = path.join(__dirname, '../config/bot-ids.json');

class BotIdManager {
  constructor() {
    this.knownBotIds = new Set();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const data = await fs.readFile(BOT_IDS_FILE, 'utf8');
      const { knownBotIds } = JSON.parse(data);
      this.knownBotIds = new Set(knownBotIds);
      console.log(`[BotIdManager] Loaded ${this.knownBotIds.size} known bot IDs`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[BotIdManager] No existing bot IDs file found, starting fresh');
        await this.saveIds();
      } else {
        console.error('[BotIdManager] Error loading bot IDs:', error);
      }
    }
    
    this.initialized = true;
  }

  async addBotId(id) {
    if (!id || typeof id !== 'string') return false;
    
    const wasAdded = !this.knownBotIds.has(id);
    this.knownBotIds.add(id);
    
    if (wasAdded) {
      console.log(`[BotIdManager] Added new bot ID: ${id}`);
      await this.saveIds();
    }
    
    return wasAdded;
  }

  hasBotId(id) {
    if (!id) return false;
    return this.knownBotIds.has(id);
  }

  async addMentionedIds(mentionedIds = []) {
    if (!Array.isArray(mentionedIds)) return [];
    
    const newIds = [];
    for (const id of mentionedIds) {
      if (await this.addBotId(id)) {
        newIds.push(id);
      }
    }
    
    return newIds;
  }

  async saveIds() {
    try {
      const data = JSON.stringify({
        knownBotIds: Array.from(this.knownBotIds)
      }, null, 2);
      
      await fs.mkdir(path.dirname(BOT_IDS_FILE), { recursive: true });
      await fs.writeFile(BOT_IDS_FILE, data, 'utf8');
      console.log(`[BotIdManager] Saved ${this.knownBotIds.size} bot IDs to file`);
      return true;
    } catch (error) {
      console.error('[BotIdManager] Error saving bot IDs:', error);
      return false;
    }
  }

  getKnownBotIds() {
    return Array.from(this.knownBotIds);
  }
}

// Create a singleton instance
const botIdManager = new BotIdManager();

// Initialize on require
botIdManager.initialize().catch(console.error);

module.exports = botIdManager;
