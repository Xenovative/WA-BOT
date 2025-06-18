/**
 * WhatsApp Bot Send Message Node
 * Sends a message to a WhatsApp contact
 */
module.exports = function(RED) {
  function SendMessageNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    
    // Get configuration
    this.name = config.name || 'Send Message';
    this.message = config.message || '';
    this.chatId = config.chatId || '';
    
    // Process messages
    node.on('input', async function(msg) {
      try {
        // Get message content and chat ID from config or incoming message
        const messageContent = msg.payload || this.message;
        
        // Try to get chatId from various possible locations
        let chatId = msg.chatId || msg.recipient || this.chatId;
        
        // If we still don't have a chatId, check if it's in the original message
        if (!chatId && msg.message && msg.message.chatId) {
          chatId = msg.message.chatId;
        }
        
        // If we still don't have a chatId, check if it's in the original message's from field
        if (!chatId && msg.message && msg.message.from) {
          chatId = msg.message.from;
        }
        
        // If we still don't have a chatId, check if it's in the payload
        if (!chatId && msg.payload && typeof msg.payload === 'object') {
          if (msg.payload.chatId) {
            chatId = msg.payload.chatId;
          } else if (msg.payload.recipient) {
            chatId = msg.payload.recipient;
          }
        }
        
        // Debug log to see what we're working with
        node.warn({
          availableData: {
            msgChatId: msg.chatId,
            configChatId: this.chatId,
            msgPayload: typeof msg.payload === 'object' ? JSON.stringify(msg.payload) : msg.payload,
            msgKeys: Object.keys(msg)
          }
        });
        
        if (!chatId) {
          node.error('No chat ID specified');
          node.status({fill: 'red', shape: 'ring', text: 'No chat ID'});
          return;
        }
        
        if (!messageContent) {
          node.error('No message content specified');
          node.status({fill: 'red', shape: 'ring', text: 'No message'});
          return;
        }
        
        // Use the HTTP API endpoint to send the message
        const http = require('http');
        
        // Prepare the request data
        const postData = JSON.stringify({
          chatId: chatId,
          recipient: chatId,  // Include recipient for compatibility
          message: messageContent,
          text: messageContent,  // Add text as fallback
          payload: messageContent  // Add payload as fallback
        });
        
        // Debug what we're sending
        node.warn({
          sendingData: {
            chatId,
            messageContent,
            postDataLength: Buffer.byteLength(postData)
          }
        });
        
        // Set up the request options
        const options = {
          hostname: 'localhost',
          port: 3000,
          path: '/api/workflow/send-message',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        // Send the request
        node.status({fill: 'yellow', shape: 'dot', text: 'Sending...'});
        
        // Create a promise to handle the HTTP request
        await new Promise((resolve, reject) => {
          const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
              data += chunk;
            });
            
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve();
              } else {
                node.error(`HTTP error: ${res.statusCode} - ${data}`);
                reject(new Error(`HTTP error: ${res.statusCode}`));
              }
            });
          });
          
          req.on('error', (error) => {
            node.error(`Request error: ${error.message}`);
            reject(error);
          });
          
          req.write(postData);
          req.end();
        });
        
        // Update status
        node.status({fill: 'green', shape: 'dot', text: 'Sent'});
        
        // Pass message along
        msg.result = {
          success: true,
          chatId: chatId,
          message: messageContent
        };
        node.send(msg);
        
        // Reset status after a delay
        setTimeout(() => {
          node.status({fill: 'blue', shape: 'dot', text: 'Ready'});
        }, 3000);
      } catch (error) {
        node.error('Error sending message', error);
        node.status({fill: 'red', shape: 'ring', text: 'Error: ' + error.message});
        
        // Pass error along
        msg.error = error;
        node.send(msg);
      }
    });
    
    // Set initial status
    node.status({fill: 'blue', shape: 'dot', text: 'Ready'});
  }
  
  RED.nodes.registerType('wa-bot-send-message', SendMessageNode);
};
