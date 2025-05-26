const BaseLLMClient = require('./baseLLMClient');
const fetch = require('node-fetch');

class OpenRouterClient extends BaseLLMClient {
  constructor() {
    super();
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  }

  /**
   * Generate a response using OpenRouter
   * @param {string} prompt - User message to get a response for
   * @param {Array} messages - Optional conversation history in the format [{role: 'user'|'system'|'assistant', content: string}]
   * @param {Object} parameters - Optional generation parameters
   * @returns {Promise<string>} - The LLM's response text
   */
  async generateResponse(prompt, messages = null, parameters = {}) {
    try {
      // Prepare messages for the API
      let apiMessages;
      
      if (messages) {
        // Use provided conversation history
        apiMessages = messages;
      } else {
        // Use simple prompt without history
        apiMessages = [
          { role: 'system', content: 'You are a helpful assistant on WhatsApp.' },
          { role: 'user', content: prompt }
        ];
      }
      
      // Prepare request body
      const requestBody = {
        model: this.model,
        messages: apiMessages,
        max_tokens: parameters.max_tokens || 500
      };
      
      // Add optional parameters if provided
      if (parameters.temperature !== undefined) requestBody.temperature = parameters.temperature;
      if (parameters.top_p !== undefined) requestBody.top_p = parameters.top_p;
      if (parameters.frequency_penalty !== undefined) requestBody.frequency_penalty = parameters.frequency_penalty;
      if (parameters.presence_penalty !== undefined) requestBody.presence_penalty = parameters.presence_penalty;
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/wa-llm-bot',
          'X-Title': 'WA-LLM-Bot'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenRouter API error:', error);
      throw new Error(`OpenRouter API error: ${error.message}`);
    }
  }
}

module.exports = OpenRouterClient;
