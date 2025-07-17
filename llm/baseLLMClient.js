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

  /**
   * Filter out thinking content from LLM responses
   * @param {string} text - The LLM response text
   * @returns {string} - Filtered text without thinking content
   */
  filterThinkingContent(text) {
    if (!text) return text;
    
    // Filter out content between <thinking> and </thinking> tags
    text = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
    
    // Filter out content between <Thinking> and </Thinking> tags (case insensitive)
    text = text.replace(/<[Tt]hinking>[\s\S]*?<\/[Tt]hinking>/g, '');
    
    // Filter out lines starting with "thinking:" or "Thinking:"
    text = text.replace(/^[Tt]hinking:.*$/gm, '');
    
    // Filter out content between [thinking] and [/thinking] tags
    text = text.replace(/\[thinking\][\s\S]*?\[\/thinking\]/g, '');
    
    // Filter out content between (thinking) and (/thinking) tags
    text = text.replace(/\(thinking\)[\s\S]*?\(\/thinking\)/g, '');
    
    // Clean up any multiple consecutive line breaks that might result from removing content
    text = text.replace(/\n{3,}/g, '\n\n');
    
    return text.trim();
  }
}

module.exports = BaseLLMClient;
