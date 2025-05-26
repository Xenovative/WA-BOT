/**
 * Manages conversation history for chats
 */
class ChatHandler {
  constructor() {
    // Map to store conversation history by chat ID
    this.conversations = new Map();
    // Maximum number of messages to keep in history
    this.maxHistoryLength = 10;
  }

  /**
   * Add a message to the conversation history
   * @param {string} chatId - Unique identifier for the chat
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   */
  addMessage(chatId, role, content) {
    if (!this.conversations.has(chatId)) {
      this.conversations.set(chatId, []);
    }
    
    const conversation = this.conversations.get(chatId);
    conversation.push({ role, content });
    
    // Trim history if exceeds max length
    if (conversation.length > this.maxHistoryLength) {
      conversation.shift();
    }
  }

  /**
   * Get conversation history for a chat
   * @param {string} chatId - Unique identifier for the chat
   * @returns {Array} Array of message objects with role and content
   */
  getConversation(chatId) {
    return this.conversations.get(chatId) || [];
  }

  /**
   * Clear conversation history for a chat
   * @param {string} chatId - Unique identifier for the chat
   */
  clearConversation(chatId) {
    this.conversations.delete(chatId);
  }
}

module.exports = new ChatHandler();
