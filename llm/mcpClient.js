const BaseLLMClient = require('./baseLLMClient');
const { list_resources, read_resource } = require('./mcpHelpers');

class MCPClient extends BaseLLMClient {
  constructor() {
    super();
    this.serverName = process.env.MCP_SERVER_NAME || 'localhost:8080';
    this.model = 'mcp-default'; // Not really used for MCP
    this.resourceUri = null;
  }

  /**
   * Set the resource URI for this MCP client
   * @param {string} uri - Resource URI to use
   */
  setResourceUri(uri) {
    this.resourceUri = uri;
  }

  /**
   * List available resources from the MCP server
   * @returns {Promise<Array>} List of resources
   */
  async listResources() {
    try {
      const result = await list_resources({
        ServerName: this.serverName,
        Cursor: ""
      });
      
      return result.resources || [];
    } catch (error) {
      console.error('Error listing MCP resources:', error);
      throw new Error(`MCP error: ${error.message}`);
    }
  }

  /**
   * Generate a response using MCP
   * @param {string} prompt - User message to get a response for
   * @param {Array} messages - Optional conversation history
   * @param {Object} parameters - Optional generation parameters
   * @returns {Promise<string>} - The LLM's response text
   */
  async generateResponse(prompt, messages = null, parameters = {}) {
    if (!this.resourceUri) {
      throw new Error('MCP resource URI not set. Please set it with !mcp [uri] command first.');
    }

    try {
      // Format conversation into a single text prompt for MCP
      let formattedPrompt;
      
      if (messages) {
        formattedPrompt = '';
        for (const msg of messages) {
          if (msg.role === 'system') {
            formattedPrompt += `System: ${msg.content}\n\n`;
          } else if (msg.role === 'user') {
            formattedPrompt += `User: ${msg.content}\n\n`;
          } else if (msg.role === 'assistant') {
            formattedPrompt += `Assistant: ${msg.content}\n\n`;
          }
        }
      } else {
        formattedPrompt = prompt;
      }

      // Use the read_resource function to get content from MCP
      const result = await read_resource({
        ServerName: this.serverName,
        Uri: this.resourceUri,
        Input: formattedPrompt,
        Parameters: parameters || {}
      });

      return result.content || "No response from MCP server";
    } catch (error) {
      console.error('MCP error:', error);
      throw new Error(`MCP error: ${error.message}`);
    }
  }
}

module.exports = MCPClient;
