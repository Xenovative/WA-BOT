/**
 * WhatsApp Bot Process File Node
 * Processes files for the knowledge base or other purposes
 */
module.exports = function(RED) {
  function ProcessFileNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    
    // Get configuration
    this.name = config.name || 'Process File';
    this.action = config.action || 'add_to_kb'; // add_to_kb, delete_from_kb
    this.filename = config.filename || '';
    
    // Process messages
    node.on('input', async function(msg) {
      try {
        // Get file info from incoming message or config
        const filename = msg.filename || this.filename;
        const action = msg.action || this.action;
        
        if (!filename) {
          node.error('No filename specified');
          node.status({fill: 'red', shape: 'ring', text: 'No filename'});
          return;
        }
        
        // Get knowledge base manager from global context
        const kbManager = node.context.global.get('kbManager');
        
        if (!kbManager) {
          node.error('Knowledge base manager not available');
          node.status({fill: 'red', shape: 'ring', text: 'KB unavailable'});
          return;
        }
        
        let result;
        
        // Process file based on action
        node.status({fill: 'yellow', shape: 'dot', text: 'Processing...'});
        
        switch (action) {
          case 'add_to_kb':
            // If we have file data in the message
            if (msg.payload && msg.payload.buffer) {
              const fileData = {
                data: msg.payload.buffer,
                mimetype: msg.payload.mimetype || 'application/octet-stream',
                filename: filename
              };
              result = await kbManager.processFile(fileData, filename);
            } else {
              // Otherwise assume the file is already in the uploads directory
              result = await kbManager.processExistingFile(filename);
            }
            break;
            
          case 'delete_from_kb':
            result = await kbManager.deleteDocument(filename);
            break;
            
          default:
            throw new Error(`Unknown action: ${action}`);
        }
        
        // Update status
        node.status({fill: 'green', shape: 'dot', text: 'Processed'});
        
        // Pass result along
        msg.result = {
          success: true,
          action: action,
          filename: filename,
          result: result
        };
        node.send(msg);
        
        // Reset status after a delay
        setTimeout(() => {
          node.status({fill: 'blue', shape: 'dot', text: 'Ready'});
        }, 3000);
      } catch (error) {
        node.error('Error processing file', error);
        node.status({fill: 'red', shape: 'ring', text: 'Error: ' + error.message});
        
        // Pass error along
        msg.error = error;
        node.send(msg);
      }
    });
    
    // Set initial status
    node.status({fill: 'blue', shape: 'dot', text: 'Ready'});
  }
  
  RED.nodes.registerType('wa-bot-process-file', ProcessFileNode);
};
