const kbManager = require('./kbManager');

class RAGProcessor {
  constructor() {
    this.enabled = process.env.KB_ENABLED === 'true';
  }

  /**
   * Process a query using RAG (Retrieval Augmented Generation)
   * @param {string} query - User query
   * @param {Array} messages - Existing conversation messages
   * @returns {Promise<Object>} - Enhanced messages and context
   */
  async processQuery(query, messages) {
    if (!this.enabled || !kbManager.vectorStore) {
      return { messages, context: null };
    }
    
    try {
      // Search for relevant documents
      const relevantDocs = await kbManager.query(query);
      
      if (relevantDocs.length === 0) {
        return { messages, context: null };
      }
      
      // Format documents into context
      const context = this.formatContext(relevantDocs);
      
      // Create a new system message with the context
      const systemMessage = messages.find(m => m.role === 'system');
      const enhancedSystemPrompt = this.createEnhancedSystemPrompt(systemMessage?.content, context);
      
      // Replace the system message in the messages array
      const enhancedMessages = messages.map(m => {
        if (m.role === 'system') {
          return { role: 'system', content: enhancedSystemPrompt };
        }
        return m;
      });
      
      return {
        messages: enhancedMessages,
        context
      };
    } catch (error) {
      console.error('Error in RAG processing:', error);
      return { messages, context: null };
    }
  }
  
  /**
   * Format retrieved documents into a unified context
   * @param {Array} docs - Retrieved documents
   * @returns {string} - Formatted context
   */
  formatContext(docs) {
    if (!docs || docs.length === 0) {
      return '';
    }
    
    let context = '### Retrieved Information:\n\n';
    
    docs.forEach((doc, i) => {
      context += `Document ${i+1} (Source: ${doc.metadata.source || 'unknown'}):\n${doc.pageContent}\n\n`;
    });
    
    return context;
  }
  
  /**
   * Create an enhanced system prompt with context
   * @param {string} originalPrompt - Original system prompt
   * @param {string} context - Context from retrieved documents
   * @returns {string} - Enhanced system prompt
   */
  createEnhancedSystemPrompt(originalPrompt, context) {
    const defaultPrompt = 'You are a helpful WhatsApp assistant. Be concise in your responses.';
    const basePrompt = originalPrompt || defaultPrompt;
    
    return `${basePrompt}\n\nUse the following information to help answer the user's question. If the information doesn't contain relevant details, just rely on your general knowledge.\n\n${context}`;
  }
}

module.exports = new RAGProcessor();
