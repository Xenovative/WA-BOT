/**
 * Utility functions for checking AI response permissions
 */

const blocklist = require('./blocklist');

/**
 * Check if AI should respond to a message from a specific chat
 * @param {string} chatId - The chat ID to check
 * @param {string} [platform] - Platform identifier ('telegram', 'whatsapp', etc.)
 * @returns {boolean} True if AI should respond, false otherwise
 */
function shouldAIRespond(chatId, platform = 'whatsapp') {
  try {
    // Format chat ID for checking (ensure consistency)
    const formattedChatId = platform === 'telegram' ? `telegram:${chatId.replace('telegram:', '')}` : chatId;
    
    // Check if chat is blocked via the existing blocklist system
    const isBlocked = blocklist.isBlocked(chatId) || blocklist.isBlocked(formattedChatId);
    if (isBlocked) {
      console.log(`[AI Check] Chat ${formattedChatId} is blocked via blocklist`);
      return false;
    }
    
    // Check if there's a temporary block
    const isTempBlocked = blocklist.tempBlocks?.has?.(chatId) || blocklist.tempBlocks?.has?.(formattedChatId);
    if (isTempBlocked) {
      console.log(`[AI Check] Chat ${formattedChatId} is temporarily blocked`);
      return false;
    }
    
    // Check the AI toggle state from the UI
    const aiStates = global.chatAIStates || new Map();
    const aiEnabled = aiStates.get(formattedChatId);
    
    // If AI state is explicitly set to false, don't respond
    if (aiEnabled === false) {
      console.log(`[AI Check] AI disabled via toggle for chat ${formattedChatId}`);
      return false;
    }
    
    // Check if there's a temporary manual message AI enable state
    const manualStates = global.manualMessageAIStates || new Map();
    const manualState = manualStates.get(formattedChatId);
    if (manualState && manualState.enabled) {
      console.log(`[AI Check] AI temporarily enabled via manual message for chat ${formattedChatId}`);
      return true;
    }
    
    // Default behavior: AI enabled unless explicitly disabled
    // This means if aiEnabled is undefined or true, AI should respond
    const shouldRespond = aiEnabled !== false;
    console.log(`[AI Check] AI ${shouldRespond ? 'enabled' : 'disabled'} for chat ${formattedChatId}`);
    
    return shouldRespond;
    
  } catch (error) {
    console.error('[AI Check] Error checking AI response permission:', error);
    // Default to enabled on error to maintain current behavior
    return true;
  }
}

/**
 * Set AI state for a specific chat
 * @param {string} chatId - The chat ID
 * @param {boolean} enabled - Whether AI should be enabled
 * @param {string} [platform] - Platform identifier
 */
function setAIState(chatId, enabled, platform = 'whatsapp') {
  try {
    const formattedChatId = platform === 'telegram' ? `telegram:${chatId.replace('telegram:', '')}` : chatId;
    
    if (!global.chatAIStates) {
      global.chatAIStates = new Map();
    }
    
    global.chatAIStates.set(formattedChatId, enabled);
    console.log(`[AI State] ${enabled ? 'Enabled' : 'Disabled'} AI for chat ${formattedChatId}`);
  } catch (error) {
    console.error('[AI State] Error setting AI state:', error);
  }
}

/**
 * Get AI state for a specific chat
 * @param {string} chatId - The chat ID
 * @param {string} [platform] - Platform identifier
 * @returns {boolean} AI state (defaults to true if not set)
 */
function getAIState(chatId, platform = 'whatsapp') {
  try {
    const formattedChatId = platform === 'telegram' ? `telegram:${chatId.replace('telegram:', '')}` : chatId;
    const aiStates = global.chatAIStates || new Map();
    return aiStates.get(formattedChatId) !== false; // Default to enabled
  } catch (error) {
    console.error('[AI State] Error getting AI state:', error);
    return true; // Default to enabled
  }
}

module.exports = {
  shouldAIRespond,
  setAIState,
  getAIState
};
