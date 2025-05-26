const BaseLLMClient = require('./baseLLMClient');
const OpenAI = require('openai');

class OpenAIClient extends BaseLLMClient {
  constructor() {
    super();
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
  }

  /**
   * Generate a response using OpenAI
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
      
      // Prepare request parameters
      const requestParams = {
        model: this.model,
        messages: apiMessages,
        max_tokens: parameters.max_tokens || 500
      };
      
      // Add optional parameters if provided
      if (parameters.temperature !== undefined) requestParams.temperature = parameters.temperature;
      if (parameters.top_p !== undefined) requestParams.top_p = parameters.top_p;
      if (parameters.frequency_penalty !== undefined) requestParams.frequency_penalty = parameters.frequency_penalty;
      if (parameters.presence_penalty !== undefined) requestParams.presence_penalty = parameters.presence_penalty;
      
      const response = await this.client.chat.completions.create(requestParams);
      
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
}

module.exports = OpenAIClient;
