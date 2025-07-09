const fs = require('fs');
const path = require('path');

class RateLimiter {
  constructor() {
    this.usageFile = path.join(__dirname, '../data/usage.json');
    this.usageData = {};
    this.enabled = process.env.ENABLE_RATE_LIMIT === 'true';
    this.limit = parseInt(process.env.RATE_LIMIT_COUNT || '20');
    this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW || '86400000'); // 24h default
    this.adminNumbers = process.env.ADMIN_PHONE_NUMBERS 
      ? process.env.ADMIN_PHONE_NUMBERS.split(',').map(n => n.trim())
      : [];
    
    this.loadUsageData();
    setInterval(() => this.cleanupExpired(), this.windowMs / 2);
  }

  loadUsageData() {
    try {
      if (fs.existsSync(this.usageFile)) {
        this.usageData = JSON.parse(fs.readFileSync(this.usageFile, 'utf8'));
        console.log(`[RateLimiter] Loaded usage data for ${Object.keys(this.usageData).length} users`);
      }
    } catch (error) {
      console.error('Error loading usage data:', error);
      this.usageData = {};
    }
  }

  saveUsageData() {
    try {
      const dir = path.dirname(this.usageFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tempFile = `${this.usageFile}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.usageData, null, 2));
      fs.renameSync(tempFile, this.usageFile);
    } catch (error) {
      console.error('Error saving usage data:', error);
    }
  }

  isAdmin(userId) {
    if (!userId) return false;
    
    // Check if it's a Telegram user ID (format: 'telegram:123456789')
    if (userId.startsWith('telegram:')) {
      const telegramId = userId.replace('telegram:', '');
      return this.adminNumbers.includes(`telegram:${telegramId}`);
    }
    
    // Handle regular phone numbers
    const cleanNumber = userId.replace(/\D/g, '');
    return this.adminNumbers.includes(cleanNumber) || 
           this.adminNumbers.includes(`telegram:${cleanNumber}`);
  }

  checkLimit(userId) {
    if (!this.enabled || !userId) return { allowed: true };
    if (this.isAdmin(userId)) return { allowed: true };

    const now = Date.now();
    const userData = this.usageData[userId] || { count: 0, firstRequest: now };
    
    // Reset if window has passed
    if (now - userData.firstRequest > this.windowMs) {
      userData.count = 0;
      userData.firstRequest = now;
    }

    userData.count += 1;
    userData.lastRequest = now;
    this.usageData[userId] = userData;
    this.saveUsageData();

    const remaining = Math.max(0, this.limit - userData.count);
    const resetTime = userData.firstRequest + this.windowMs;
    
    return {
      allowed: userData.count <= this.limit,
      remaining,
      limit: this.limit,
      reset: resetTime,
      resetIn: Math.ceil((resetTime - now) / 1000) // seconds until reset
    };
  }

  getUsage(userId) {
    if (!userId) return null;
    const userData = this.usageData[userId];
    if (!userData) return null;
    
    const now = Date.now();
    const isExpired = now - userData.firstRequest > this.windowMs;
    
    return {
      count: isExpired ? 0 : userData.count,
      remaining: isExpired ? this.limit : Math.max(0, this.limit - userData.count),
      limit: this.limit,
      reset: userData.firstRequest + this.windowMs,
      resetIn: Math.ceil(((userData.firstRequest + this.windowMs) - now) / 1000)
    };
  }

  cleanupExpired() {
    const now = Date.now();
    let count = 0;
    
    for (const [userId, data] of Object.entries(this.usageData)) {
      if (now - data.lastRequest > this.windowMs * 2) {
        delete this.usageData[userId];
        count++;
      }
    }
    
    if (count > 0) {
      console.log(`[RateLimiter] Cleaned up ${count} expired entries`);
      this.saveUsageData();
    }
  }
  
  /**
   * Reset rate limit for a specific user
   * @param {string} userId - User ID to reset
   * @returns {boolean} True if user was found and reset, false otherwise
   */
  resetUser(userId) {
    if (!userId || !this.usageData[userId]) {
      return false;
    }
    
    console.log(`[RateLimiter] Resetting rate limit for user: ${userId}`);
    this.usageData[userId] = {
      count: 0,
      firstRequest: Date.now(),
      lastRequest: Date.now()
    };
    
    this.saveUsageData();
    return true;
  }
}

module.exports = new RateLimiter();
