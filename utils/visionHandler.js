const fs = require('fs');
const path = require('path');

/**
 * Vision Handler - Processes images and generates descriptions using LLM vision capabilities
 */
class VisionHandler {
  constructor() {
    this.enabled = process.env.ENABLE_VISION === 'true';
    this.maxImageSize = parseInt(process.env.MAX_IMAGE_SIZE_MB || '10') * 1024 * 1024; // Convert MB to bytes
    this.tempDir = path.join(__dirname, '..', 'temp');
    this.visionPrompt = process.env.VISION_PROMPT || 'Analyze this image in detail. Describe what you see including: people (who they are, their appearance, expressions, actions), objects, text, setting, context, and any notable details. Be specific and thorough.';
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    console.log('[Vision] Vision handler initialized:', {
      enabled: this.enabled,
      maxImageSize: `${this.maxImageSize / 1024 / 1024}MB`,
      visionPrompt: this.visionPrompt.substring(0, 100) + '...'
    });
  }

  /**
   * Process an image message and generate a description
   * @param {Object} message - Message object with downloadMedia method
   * @param {string} customPrompt - Optional custom prompt for image analysis
   * @returns {Promise<{text: string, error: string|null}>}
   */
  async processImageMessage(message, customPrompt = null) {
    if (!this.enabled) {
      console.log('[Vision] Vision processing is disabled');
      return { text: null, error: 'Vision processing is disabled' };
    }

    try {
      console.log(`[Vision] Processing image message from ${message.from}`);
      
      // Check if downloadMedia method exists
      if (typeof message.downloadMedia !== 'function') {
        throw new Error('message.downloadMedia is not a function');
      }
      
      // Download the image
      const media = await message.downloadMedia();
      if (!media) {
        throw new Error('Failed to download image');
      }

      // Check file size
      const imageBuffer = Buffer.from(media.data, 'base64');
      if (imageBuffer.length > this.maxImageSize) {
        return {
          text: null,
          error: `Image too large. Maximum size is ${this.maxImageSize / 1024 / 1024}MB.`
        };
      }

      // Validate image mimetype
      if (!media.mimetype || !media.mimetype.startsWith('image/')) {
        return {
          text: null,
          error: 'Invalid image format. Please send a valid image file.'
        };
      }

      console.log(`[Vision] Image downloaded: ${media.mimetype}, size: ${imageBuffer.length} bytes`);

      // Get LLM client
      const llmClient = global.llmClient;
      if (!llmClient) {
        throw new Error('LLM client not initialized');
      }

      // Check if LLM client supports vision
      if (typeof llmClient.analyzeImage !== 'function') {
        throw new Error('Current LLM provider does not support vision. Please use OpenAI GPT-4 Vision or Ollama with a vision model (e.g., llava)');
      }

      // Use custom prompt if provided, otherwise use default
      const prompt = customPrompt || this.visionPrompt;

      // Analyze the image
      console.log(`[Vision] Analyzing image with prompt: ${prompt}`);
      const description = await llmClient.analyzeImage(imageBuffer, media.mimetype, prompt);

      console.log(`[Vision] Image analysis complete: ${description.substring(0, 100)}...`);
      return { text: description, error: null };
      
    } catch (error) {
      console.error('[Vision] Error processing image:', error);
      return { text: null, error: error.message };
    }
  }

  /**
   * Check if a message contains an image
   * @param {Object} message - Message object
   * @returns {boolean}
   */
  isImageMessage(message) {
    if (!message.hasMedia) return false;
    
    // Check message type
    if (message.type === 'image') return true;
    
    // Check mimetype if available
    if (message._data?.mimetype && message._data.mimetype.startsWith('image/')) return true;
    
    return false;
  }

  /**
   * Extract custom prompt from message caption/text
   * @param {string} messageText - Message text/caption
   * @returns {string|null} - Custom prompt or null if none found
   */
  extractCustomPrompt(messageText) {
    if (!messageText) return null;
    
    // Check for custom prompt patterns like "analyze:", "describe:", "what is:"
    const patterns = [
      /^analyze:\s*(.+)/i,
      /^describe:\s*(.+)/i,
      /^what\s+is:\s*(.+)/i,
      /^what's:\s*(.+)/i,
      /^tell\s+me\s+about:\s*(.+)/i
    ];
    
    for (const pattern of patterns) {
      const match = messageText.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    // If message has text, use it as custom prompt with enhanced context
    if (messageText.trim().length > 0) {
      const userPrompt = messageText.trim();
      // Enhance the prompt with more specific instructions for better results
      return `${userPrompt}\n\nPlease analyze this image in detail and answer the question. If the question asks about people, describe who they are, what they're doing, their appearance, expressions, and any visible text or context in the image. Be specific and thorough.`;
    }
    
    return null;
  }
}

module.exports = new VisionHandler();
