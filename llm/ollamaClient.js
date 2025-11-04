const BaseLLMClient = require('./baseLLMClient');
const fetch = require('node-fetch');

class OllamaClient extends BaseLLMClient {
  constructor() {
    super();
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama2';
    // Keep the model loaded between requests to reduce cold-start latency
    // Accepts duration string (e.g., '1h', '30m'), boolean, or number (seconds)
    this.keepAlive = process.env.OLLAMA_KEEP_ALIVE || '1h';
    // Default stop sequences to prevent the model from auto-continuing into the next turn
    // Covers common chat templates that switch back to 'User:'/'Human:' or repeat 'Assistant:'
    this.stopSequences = [
      '\nUser:', '\nuser:', 'User:', 'user:',
      '\nHuman:', '\nhuman:', 'Human:', 'human:',
      '\nAssistant:', '\nassistant:', 'Assistant:', 'assistant:'
    ];
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
        stream: false,
        // Keep the model hot per Ollama API
        keep_alive: this.keepAlive,
        // Prevent auto-prompt by stopping when the model tries to start a new turn
        stop: this.stopSequences
      };
      
      // Map our parameters to Ollama parameters
      if (parameters.temperature !== undefined) requestBody.temperature = parameters.temperature;
      if (parameters.top_p !== undefined) requestBody.top_p = parameters.top_p;
      // Note: Ollama might not support all parameters like frequency_penalty and presence_penalty
      // Add additional Ollama-specific parameters
      if (parameters.max_tokens !== undefined) requestBody.num_predict = parameters.max_tokens;
      // Allow per-call override for keep_alive
      if (parameters.keep_alive !== undefined) requestBody.keep_alive = parameters.keep_alive;
      // Allow per-call override for stop sequences
      if (parameters.stop !== undefined) requestBody.stop = Array.isArray(parameters.stop) ? parameters.stop : [parameters.stop];
      
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

      // Post-process to prevent auto-prompt leakage
      // 1) Remove a leading Assistant: label if present
      responseText = responseText.replace(/^\s*Assistant:\s*/i, '');
      // 2) If the model started a new turn like "User:" or "Human:", cut it off
      const boundaryIdx = responseText.search(/(?:^|\n)(User:|Human:)/i);
      if (boundaryIdx !== -1) {
        responseText = responseText.slice(0, boundaryIdx).trimEnd();
      }
      
      // Filter out thinking content
      responseText = this.filterThinkingContent(responseText);
      
      return responseText;
    } catch (error) {
      console.error('Ollama API error:', error);
      throw new Error(`Ollama API error: ${error.message}`);
    }
  }

  // Using filterThinkingContent from BaseLLMClient

  /**
   * Analyze an image using Ollama vision models (e.g., llava, bakllava)
   * @param {Buffer} imageBuffer - Image data as buffer
   * @param {string} mimetype - Image mimetype (e.g., 'image/jpeg')
   * @param {string} prompt - Question or instruction about the image
   * @returns {Promise<string>} - The analysis result
   */
  async analyzeImage(imageBuffer, mimetype, prompt = 'What is in this image?') {
    try {
      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');
      
      // Use vision model (llava by default)
      const visionModel = process.env.OLLAMA_VISION_MODEL || 'llava';
      
      console.log(`[Ollama-Vision] Analyzing image with model: ${visionModel}`);
      
      const apiUrl = `${this.baseUrl}/api/generate`;
      
      const requestBody = {
        model: visionModel,
        prompt: prompt,
        images: [base64Image],
        stream: false,
        keep_alive: this.keepAlive
      };
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama Vision API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const analysisText = data.response.trim();
      
      console.log(`[Ollama-Vision] Analysis complete: ${analysisText.substring(0, 100)}...`);
      
      return analysisText;
    } catch (error) {
      console.error('[Ollama-Vision] Error analyzing image:', error);
      throw new Error(`Ollama Vision API error: ${error.message}`);
    }
  }
}

module.exports = OllamaClient;
