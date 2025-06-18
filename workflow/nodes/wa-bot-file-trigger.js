/**
 * WhatsApp Bot File Trigger Node
 * Triggers a flow when file events occur (upload, delete, etc)
 */
module.exports = function(RED) {
  function FileTriggerNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    
    // Get configuration
    this.name = config.name || 'File Trigger';
    this.eventType = config.eventType || 'all'; // upload, delete, all
    this.filePattern = config.filePattern || ''; // File pattern to match (e.g. *.pdf)
    
    // Get workflow manager
    const workflowManager = require('../workflowManager');
    
    // Helper function to check if file matches pattern
    function matchesPattern(filename, pattern) {
      if (!pattern) return true;
      
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(filename);
    }
    
    // Listen for file events
    const fileHandler = (data) => {
      try {
        if (!data || !data.event || !data.file) return;
        
        // Check if event type matches
        if (this.eventType !== 'all' && data.event !== this.eventType) return;
        
        // Check if file matches pattern
        if (this.filePattern && !matchesPattern(data.file.name, this.filePattern)) return;
        
        // Event matches criteria, trigger flow
        node.status({fill: 'green', shape: 'dot', text: `File ${data.event}: ${data.file.name}`});
        
        // Send file data to flow
        node.send({
          payload: data.file,
          event: data.event,
          filename: data.file.name,
          path: data.file.path,
          mimetype: data.file.mimetype,
          size: data.file.size,
          topic: 'file_event'
        });
      } catch (error) {
        node.error('Error processing file event', error);
        node.status({fill: 'red', shape: 'ring', text: 'Error'});
      }
    };
    
    // Register file handler
    workflowManager.on('file', fileHandler);
    
    // Set initial status
    node.status({fill: 'blue', shape: 'dot', text: 'Ready'});
    
    // Cleanup on close
    node.on('close', function() {
      workflowManager.removeListener('file', fileHandler);
      node.status({});
    });
  }
  
  RED.nodes.registerType('wa-bot-file-trigger', FileTriggerNode);
};
