/**
 * Helper functions for interacting with MCP servers
 */

const fetch = require('node-fetch');

/**
 * List resources available from an MCP server
 * @param {Object} options - Options object
 * @param {string} options.ServerName - Name of the server to list resources from
 * @param {string} options.Cursor - Pagination cursor (optional)
 * @returns {Promise<Object>} - Response with resources array and optional next cursor
 */
async function list_resources({ ServerName, Cursor = "" }) {
  try {
    const url = `http://${ServerName}/api/resources${Cursor ? `?cursor=${encodeURIComponent(Cursor)}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP server error: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error listing MCP resources:', error);
    throw error;
  }
}

/**
 * Read a resource from an MCP server
 * @param {Object} options - Options object
 * @param {string} options.ServerName - Name of the server to read from
 * @param {string} options.Uri - Unique identifier for the resource
 * @param {string} options.Input - Input text to send to the resource
 * @param {Object} options.Parameters - Optional parameters for the resource
 * @returns {Promise<Object>} - Response from the resource
 */
async function read_resource({ ServerName, Uri, Input = "", Parameters = {} }) {
  try {
    const url = `http://${ServerName}/api/resources/${encodeURIComponent(Uri)}`;
    
    const requestBody = {
      input: Input
    };
    
    // Add any parameters if provided
    if (Object.keys(Parameters).length > 0) {
      requestBody.parameters = Parameters;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP server error: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error reading MCP resource:', error);
    throw error;
  }
}

module.exports = {
  list_resources,
  read_resource
};
