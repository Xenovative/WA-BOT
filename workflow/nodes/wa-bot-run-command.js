/**
 * WhatsApp Bot Run Command Node
 * Runs a bot command as if it was sent by a user
 */
module.exports = function(RED) {
  function RunCommandNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    
    // Get configuration
    this.name = config.name || 'Run Command';
    this.command = config.command || '';
    this.chatId = config.chatId || '';
    
    // Process messages
    node.on('input', async function(msg) {
      try {
        // Get command and chat ID from config or incoming message
        const commandText = msg.payload || this.command;
        const chatId = msg.chatId || this.chatId;
        
        if (!chatId) {
          node.error('No chat ID specified');
          node.status({fill: 'red', shape: 'ring', text: 'No chat ID'});
          return;
        }
        
        if (!commandText) {
          node.error('No command specified');
          node.status({fill: 'red', shape: 'ring', text: 'No command'});
          return;
        }
        
        // Ensure command starts with !
        const formattedCommand = commandText.startsWith('!') ? commandText : `!${commandText}`;
        
        // Get command handler from global context
        const commandHandler = node.context.global.get('commandHandler');
        
        if (!commandHandler) {
          node.error('Command handler not available');
          node.status({fill: 'red', shape: 'ring', text: 'Handler unavailable'});
          return;
        }
        
        // Run command
        node.status({fill: 'yellow', shape: 'dot', text: 'Running...'});
        const response = await commandHandler.processCommand(formattedCommand, chatId, 'workflow-system');
        
        // Update status
        node.status({fill: 'green', shape: 'dot', text: 'Command executed'});
        
        // Pass response along
        msg.result = {
          success: true,
          chatId: chatId,
          command: formattedCommand,
          response: response
        };
        node.send(msg);
        
        // Reset status after a delay
        setTimeout(() => {
          node.status({fill: 'blue', shape: 'dot', text: 'Ready'});
        }, 3000);
      } catch (error) {
        node.error('Error running command', error);
        node.status({fill: 'red', shape: 'ring', text: 'Error: ' + error.message});
        
        // Pass error along
        msg.error = error;
        node.send(msg);
      }
    });
    
    // Set initial status
    node.status({fill: 'blue', shape: 'dot', text: 'Ready'});
  }
  
  RED.nodes.registerType('wa-bot-run-command', RunCommandNode);
};
