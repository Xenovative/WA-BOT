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
      
      let responseText = response.choices[0].message.content.trim();
      
      // Filter out thinking content
      responseText = this.filterThinkingContent(responseText);
      
      return responseText;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * Analyze an image using OpenAI Vision API
   * @param {Buffer} imageBuffer - Image data as buffer
   * @param {string} mimetype - Image mimetype (e.g., 'image/jpeg')
   * @param {string} prompt - Question or instruction about the image
   * @returns {Promise<string>} - The analysis result
   */
  async analyzeImage(imageBuffer, mimetype, prompt = 'What is in this image?') {
    try {
      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');
      
      // Determine the image format from mimetype
      const imageFormat = mimetype.split('/')[1] || 'jpeg';
      
      // Use GPT-4 Vision model
      const visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4-vision-preview';
      
      console.log(`[OpenAI-Vision] Analyzing image with model: ${visionModel}`);
      
      const response = await this.client.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimetype};base64,${base64Image}`,
                  detail: process.env.OPENAI_VISION_DETAIL || 'auto' // 'low', 'high', or 'auto'
                }
              }
            ]
          }
        ],
        max_tokens: parseInt(process.env.OPENAI_VISION_MAX_TOKENS || '300')
      });

      const analysisText = response.choices[0].message.content.trim();
      console.log(`[OpenAI-Vision] Analysis complete: ${analysisText.substring(0, 100)}...`);
      
      return analysisText;
    } catch (error) {
      console.error('[OpenAI-Vision] Error analyzing image:', error);
      throw new Error(`OpenAI Vision API error: ${error.message}`);
    }
  }
}

module.exports = OpenAIClient;
