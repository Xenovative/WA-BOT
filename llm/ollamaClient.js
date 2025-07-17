const BaseLLMClient = require('./baseLLMClient');
const fetch = require('node-fetch');

class OllamaClient extends BaseLLMClient {
  constructor() {
    super();
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama2';
  }

  /**
   * Generate a response using Ollama
   * @param {string} prompt - User message to get a response for
   * @param {Array} messages - Optional conversation history in the format [{role: 'user'|'system'|'assistant', content: string}]
   * @param {Object} parameters - Optional generation parameters
   * @returns {Promise<string>} - The LLM's response text
   */
  async generateResponse(prompt, messages = null, parameters = {}) {
    const apiUrl = `${this.baseUrl}/api/generate`;
    
    try {
      let formattedPrompt;
      
      if (messages) {
        // Format conversation history for Ollama
        // Extract system message from the messages array
        const systemMessage = messages.find(msg => msg.role === 'system');
        formattedPrompt = systemMessage ? `${systemMessage.content}\n\n` : 'You are a helpful assistant on WhatsApp. Be concise in your responses.\n\n';
        
        // Add conversation history (skip system messages as we've handled them)
        for (const msg of messages) {
          if (msg.role === 'user') {
            formattedPrompt += `User: ${msg.content}\n\n`;
          } else if (msg.role === 'assistant') {
            formattedPrompt += `Assistant: ${msg.content}\n\n`;
          }
        }
        
        // If the last message isn't from the user, add the current prompt
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role !== 'user') {
          formattedPrompt += `User: ${prompt}\n\n`;
        }
        
        formattedPrompt += 'Assistant:';
      } else {
        // Simple prompt without history
        formattedPrompt = `You are a helpful assistant on WhatsApp.\n\nUser: ${prompt}\n\nAssistant:`;
      }
      
      // Prepare request body
      const requestBody = {
        model: this.model,
        prompt: formattedPrompt,
        stream: false
      };
      
      // Map our parameters to Ollama parameters
      if (parameters.temperature !== undefined) requestBody.temperature = parameters.temperature;
      if (parameters.top_p !== undefined) requestBody.top_p = parameters.top_p;
      // Note: Ollama might not support all parameters like frequency_penalty and presence_penalty
      // Add additional Ollama-specific parameters
      if (parameters.max_tokens !== undefined) requestBody.num_predict = parameters.max_tokens;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      let responseText = data.response.trim();
      
      // Filter out thinking content (text between <thinking> tags)
      responseText = this.filterThinkingContent(responseText);
      
      return responseText;
    } catch (error) {
      console.error('Ollama API error:', error);
      throw new Error(`Ollama API error: ${error.message}`);
    }
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

module.exports = OllamaClient;
