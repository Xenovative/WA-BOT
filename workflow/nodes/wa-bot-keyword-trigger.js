/**
 * WhatsApp Bot Keyword Trigger Node
 * Triggers a flow when specific keywords are detected in messages
 */
module.exports = function(RED) {
  function KeywordTriggerNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    
    // Get configuration
    this.name = config.name || 'Keyword Trigger';
    this.keywords = config.keywords || [];
    this.matchType = config.matchType || 'contains'; // contains, exact, regex
    this.caseSensitive = config.caseSensitive || false;
    
    // Convert keywords to array if string
    if (typeof this.keywords === 'string') {
      this.keywords = this.keywords.split(',').map(k => k.trim());
    }
    
    // Get workflow manager
    const workflowManager = require('../workflowManager');
    
    // Listen for messages
    const messageHandler = (data) => {
      try {
        if (!data || !data.text) return;
        
        const text = this.caseSensitive ? data.text : data.text.toLowerCase();
        let matched = false;
        let matchedKeyword = '';
        
        // Check each keyword
        for (const keyword of this.keywords) {
          const kw = this.caseSensitive ? keyword : keyword.toLowerCase();
          
          switch (this.matchType) {
            case 'contains':
              if (text.includes(kw)) {
                matched = true;
                matchedKeyword = keyword;
              }
              break;
            case 'exact':
              if (text === kw) {
                matched = true;
                matchedKeyword = keyword;
              }
              break;
            case 'regex':
              try {
                const regex = new RegExp(kw, this.caseSensitive ? '' : 'i');
                if (regex.test(text)) {
                  matched = true;
                  matchedKeyword = keyword;
                }
              } catch (e) {
                node.error(`Invalid regex: ${kw}`, e);
              }
              break;
          }
          
          if (matched) break;
        }
        
        // If matched, send message data to output
        if (matched) {
          node.status({fill: 'green', shape: 'dot', text: `Matched: ${matchedKeyword}`});
          
          // Send message data to flow
          node.send({
            payload: data.text,
            chatId: data.chatId,
            message: data.message,
            matchedKeyword: matchedKeyword,
            topic: 'keyword_match'
          });
        }
      } catch (error) {
        node.error('Error processing message for keyword trigger', error);
        node.status({fill: 'red', shape: 'ring', text: 'Error'});
      }
    };
    
    // Register message handler
    workflowManager.on('message', messageHandler);
    
    // Set initial status
    node.status({fill: 'blue', shape: 'dot', text: 'Ready'});
    
    // Cleanup on close
    node.on('close', function() {
      workflowManager.removeListener('message', messageHandler);
      node.status({});
    });
  }
  
  RED.nodes.registerType('wa-bot-keyword-trigger', KeywordTriggerNode);
};
