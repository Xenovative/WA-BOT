/**
 * Base class for LLM clients
 * All LLM provider implementations should extend this class
 */
class BaseLLMClient {
  constructor() {
    if (this.constructor === BaseLLMClient) {
      throw new Error('BaseLLMClient is an abstract class and cannot be instantiated directly');
    }
  }

  /**
   * Generate a response from the LLM
   * @param {string} prompt - User message to get a response for
   * @param {Array} messages - Optional conversation history in the format [{role: 'user'|'system'|'assistant', content: string}]
   * @returns {Promise<string>} - The LLM's response text
   */
  async generateResponse(prompt, messages = null) {
    throw new Error('Method generateResponse() must be implemented by subclass');
  }
}

module.exports = BaseLLMClient;
