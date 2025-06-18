/**
 * Node-RED Custom Nodes Registration
 * This file registers all custom nodes for the WhatsApp Bot workflow system
 */
module.exports = function(RED) {
  // Register all custom nodes
  require('./wa-bot-keyword-trigger')(RED);
  require('./wa-bot-file-trigger')(RED);
  require('./wa-bot-send-message')(RED);
  require('./wa-bot-run-command')(RED);
  require('./wa-bot-process-file')(RED);
  
  console.log('[Workflow Nodes] Registered all custom WhatsApp Bot nodes');
};
