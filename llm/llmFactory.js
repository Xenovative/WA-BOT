const OpenAIClient = require('./openaiClient');
const OpenRouterClient = require('./openRouterClient');
const OllamaClient = require('./ollamaClient');
const MCPClient = require('./mcpClient');

class LLMFactory {
  /**
   * Creates an LLM client based on the provider specified
   * @param {string} provider - 'openai', 'openrouter', 'ollama', or 'mcp'
   * @param {Object} options - Additional options for the client
   * @returns {object} LLM client instance
   */
  static createLLMClient(provider, options = {}) {
    let client;
    
    switch (provider.toLowerCase()) {
      case 'openai':
        client = new OpenAIClient();
        break;
      case 'openrouter':
        client = new OpenRouterClient();
        break;
      case 'ollama':
        client = new OllamaClient();
        break;
      case 'mcp':
        client = new MCPClient();
        // Set resource URI if provided
        if (options.mcpResourceUri) {
          client.setResourceUri(options.mcpResourceUri);
        }
        break;
      default:
        console.warn(`Unknown provider: ${provider}, defaulting to OpenAI`);
        client = new OpenAIClient();
    }
    
    return client;
  }
}

module.exports = LLMFactory;
