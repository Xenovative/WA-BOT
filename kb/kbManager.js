const fs = require('fs-extra');
const path = require('path');
const { Document } = require('langchain/document');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { HNSWLib } = require('langchain/vectorstores/hnswlib');
const { HuggingFaceTransformersEmbeddings } = require('langchain/embeddings/hf_transformers');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const xml2js = require('xml2js');

class KnowledgeBaseManager {
  constructor() {
    this.enabled = process.env.KB_ENABLED === 'true';
    this.storagePath = process.env.KB_STORAGE_PATH || './kb_data';
    this.vectorStorePath = path.resolve(process.cwd(), this.storagePath, 'vector_store');
    this.indexPath = path.join(this.vectorStorePath, 'index.bin');
    this.docStorePath = path.join(this.vectorStorePath, 'docstore.json');
    
    this.embeddingModel = process.env.KB_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
    this.chunkSize = parseInt(process.env.KB_CHUNK_SIZE || '500');
    this.chunkOverlap = parseInt(process.env.KB_CHUNK_OVERLAP || '50');
    this.topK = parseInt(process.env.KB_TOP_K || '3');
    
    // Create embeddings instance
    this.embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: this.embeddingModel,
    });
    
    // Initialize vector store
    this.vectorStore = null;
    this.documents = new Map(); // Track documents by filename
    
    // Create storage directory if it doesn't exist
    fs.ensureDirSync(this.vectorStorePath);
    console.log(`KB storage path: ${this.vectorStorePath}`);
  }
  
  /**
   * Initialize the knowledge base
   */
  async initialize() {
    if (!this.enabled) {
      console.log('Knowledge base is disabled');
      return;
    }
    
    try {
      // Check if we have existing vector store files
      const indexExists = await fs.pathExists(this.indexPath);
      const docStoreExists = await fs.pathExists(this.docStorePath);
      const mapExists = await fs.pathExists(path.join(this.vectorStorePath, 'document_map.json'));
      
      console.log(`Vector store files check: index=${indexExists}, docstore=${docStoreExists}, map=${mapExists}`);
      
      if (indexExists && docStoreExists) {
        console.log('Loading existing knowledge base');
        try {
          this.vectorStore = await HNSWLib.load(
            this.vectorStorePath,
            this.embeddings
          );
          console.log('Knowledge base loaded successfully');
          
          // Populate documents map from existing vector store
          await this.loadDocumentMap();
          
          // Verify vector store has documents
          const docCount = await this.vectorStore.docstore.count();
          console.log(`Vector store contains ${docCount} documents`);
          
          if (docCount === 0 && this.documents.size > 0) {
            console.warn('Vector store is empty but document map has entries, rebuilding vector store');
            await this.rebuildVectorStore();
          }
          
        } catch (loadError) {
          console.error('Error loading existing knowledge base:', loadError);
          console.log('Creating new knowledge base');
          await this.createNewVectorStore();
        }
      } else {
        console.log('Creating new knowledge base');
        await this.createNewVectorStore();
      }
    } catch (error) {
      console.error('Knowledge base initialization error:', error);
      // Don't throw, just log
    }
  }
  
  /**
   * Create a new vector store
   */
  async createNewVectorStore() {
    try {
      // Initialize with an empty array
      this.vectorStore = await HNSWLib.fromDocuments(
        [new Document({ pageContent: 'Knowledge Base Initialization', metadata: { source: 'init' } })],
        this.embeddings
      );
      
      // Save the empty vector store
      await this.vectorStore.save(this.vectorStorePath);
      
      // Initialize the document map
      this.documents = new Map();
      this.documents.set('init', { chunks: 1, timestamp: Date.now() });
      await this.saveDocumentMap();
      
      console.log('New knowledge base created and saved to disk');
    } catch (error) {
      console.error('Error creating new vector store:', error);
      throw error; // Propagate error to caller
    }
  }
  
  /**
   * Load the document map from storage
   */
  async loadDocumentMap() {
    try {
      const mapPath = path.join(this.vectorStorePath, 'document_map.json');
      if (await fs.pathExists(mapPath)) {
        const data = await fs.readJson(mapPath);
        if (data && typeof data === 'object') {
          this.documents = new Map(Object.entries(data));
          console.log(`Loaded ${this.documents.size} documents in map`);
        } else {
          console.warn('Document map file exists but contains invalid data, creating new map');
          this.documents = new Map();
          await this.saveDocumentMap();
        }
      } else {
        console.log('No document map file found, creating new one');
        this.documents = new Map();
        await this.saveDocumentMap();
      }
    } catch (error) {
      console.error('Error loading document map:', error);
      this.documents = new Map();
    }
  }
  
  /**
   * Save the document map to storage
   */
  async saveDocumentMap() {
    try {
      const mapPath = path.join(this.vectorStorePath, 'document_map.json');
      const data = Object.fromEntries(this.documents);
      await fs.writeJson(mapPath, data, { spaces: 2 });
      console.log(`Saved document map with ${this.documents.size} entries to ${mapPath}`);
    } catch (error) {
      console.error('Error saving document map:', error);
      throw error; // Propagate error to caller for better error handling
    }
  }
  
  /**
   * Rebuild the vector store from document files
   * This is used when the vector store is corrupted or empty but document map exists
   */
  async rebuildVectorStore() {
    try {
      console.log('Rebuilding vector store from document files...');
      
      // Create a new empty vector store
      this.vectorStore = await HNSWLib.fromDocuments(
        [new Document({ pageContent: 'Knowledge Base Initialization', metadata: { source: 'init' } })],
        this.embeddings
      );
      
      // Get list of documents from map (excluding 'init')
      const documentNames = Array.from(this.documents.keys()).filter(name => name !== 'init');
      console.log(`Found ${documentNames.length} documents to rebuild`);
      
      // Process each document
      for (const fileName of documentNames) {
        // Check if file exists in uploads directory
        const filePath = path.join(process.cwd(), 'uploads', fileName);
        if (await fs.pathExists(filePath)) {
          console.log(`Reprocessing document: ${fileName}`);
          
          try {
            // Extract text from file
            const fileContent = await fs.readFile(filePath);
            const mimeType = this._getMimeType(fileName);
            let text = await this._extractText(fileContent, fileName, mimeType);
            
            // Split text into chunks
            const textSplitter = new RecursiveCharacterTextSplitter({
              chunkSize: this.chunkSize,
              chunkOverlap: this.chunkOverlap,
            });
            
            const docs = await textSplitter.createDocuments(
              [text],
              [{ source: fileName }]
            );
            
            // Add documents to vector store
            await this.vectorStore.addDocuments(docs);
            console.log(`Added ${docs.length} chunks from ${fileName} to vector store`);
          } catch (error) {
            console.error(`Error reprocessing document ${fileName}:`, error);
          }
        } else {
          console.warn(`Document file not found for ${fileName}, removing from document map`);
          this.documents.delete(fileName);
        }
      }
      
      // Save the rebuilt vector store
      await this.vectorStore.save(this.vectorStorePath);
      await this.saveDocumentMap();
      
      console.log('Vector store rebuild completed');
    } catch (error) {
      console.error('Error rebuilding vector store:', error);
      throw error;
    }
  }
  
  /**
   * Add a document to the knowledge base
   * @param {string} filePath - Path to the document file
   * @param {string} fileName - Name of the file (for metadata)
   * @returns {Promise<Object>} - Result of the operation
   */
  async addDocument(filePath, fileName) {
    if (!this.enabled) {
      return { success: false, message: 'Knowledge base is not enabled' };
    }
    
    try {
      // Initialize if needed
      if (!this.vectorStore) {
        await this.initialize();
      }
      
      if (!this.vectorStore) {
        return { success: false, message: 'Failed to initialize knowledge base' };
      }
      
      // Extract content based on file type
      const fileExt = path.extname(filePath).toLowerCase();
      let content;
      
      if (fileExt === '.pdf') {
        const pdfData = await fs.readFile(filePath);
        const pdfContent = await pdfParse(pdfData);
        content = pdfContent.text;
      } else if (fileExt === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        content = result.value;
      } else if (fileExt === '.txt') {
        content = await fs.readFile(filePath, 'utf-8');
      } else if (fileExt === '.html' || fileExt === '.htm') {
        const htmlContent = await fs.readFile(filePath, 'utf-8');
        const $ = cheerio.load(htmlContent);
        content = $('body').text();
      } else if (fileExt === '.json') {
        // Process JSON files
        const jsonContent = await fs.readFile(filePath, 'utf-8');
        try {
          const jsonData = JSON.parse(jsonContent);
          // Pretty print JSON for better text extraction
          content = JSON.stringify(jsonData, null, 2);
        } catch (error) {
          return { success: false, message: `Invalid JSON file: ${error.message}` };
        }
      } else if (fileExt === '.xml') {
        // Process XML files
        const xmlContent = await fs.readFile(filePath, 'utf-8');
        try {
          const parser = new xml2js.Parser({ explicitArray: false });
          const result = await parser.parseStringPromise(xmlContent);
          // Convert to JSON and pretty print for better text extraction
          content = JSON.stringify(result, null, 2);
        } catch (error) {
          return { success: false, message: `Invalid XML file: ${error.message}` };
        }
      } else {
        return { success: false, message: `Unsupported file type: ${fileExt}` };
      }
      
      // Split content into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: this.chunkSize,
        chunkOverlap: this.chunkOverlap,
      });
      
      const docs = await textSplitter.createDocuments(
        [content], 
        [{ source: fileName }]
      );
      
      // Add to vector store
      await this.vectorStore.addDocuments(docs);
      
      // Save vector store
      await this.vectorStore.save(this.vectorStorePath);
      
      // Update document map
      this.documents.set(fileName, {
        chunks: docs.length,
        added: new Date().toISOString()
      });
      await this.saveDocumentMap();
      
      return { 
        success: true, 
        message: `Document "${fileName}" added successfully with ${docs.length} chunks` 
      };
    } catch (error) {
      console.error('Error adding document:', error);
      return { success: false, message: `Error adding document: ${error.message}` };
    }
  }
  
  /**
   * Query the knowledge base for relevant documents
   * @param {string} query - The search query
   * @returns {Promise<Array>} - Array of relevant document chunks
   */
  async query(query) {
    if (!this.enabled) {
      return [];
    }
    
    try {
      // Initialize if needed
      if (!this.vectorStore) {
        await this.initialize();
      }
      
      if (!this.vectorStore) {
        console.log('Knowledge base not initialized, returning empty results');
        return [];
      }
      
      // If vector store is empty, return empty results
      if (this.documents.size === 0 || this.documents.size === 1 && this.documents.has('init')) {
        console.log('Knowledge base is empty, returning empty results');
        return [];
      }

      const results = await this.vectorStore.similaritySearch(query, this.topK);
      return results;
    } catch (error) {
      console.error('Error querying knowledge base:', error);
      return [];
    }
  }
  
  /**
   * Delete a document from the knowledge base
   * @param {string} fileName - Name of the file to delete
   * @returns {Promise<Object>} - Result of the operation
   */
  async deleteDocument(fileName) {
    if (!this.enabled) {
      return { success: false, message: 'Knowledge base is not enabled' };
    }
    
    try {
      // Initialize if needed
      if (!this.vectorStore) {
        await this.initialize();
      }
      
      if (!this.vectorStore) {
        return { success: false, message: 'Failed to initialize knowledge base' };
      }
      
      // Check if document exists in our map
      if (!this.documents.has(fileName)) {
        return { success: false, message: `Document "${fileName}" not found in knowledge base` };
      }
      
      // Since HNSWLib doesn't support deletion directly, we need to recreate the vector store
      // We'll get all documents, filter out the ones from the target file, and recreate
      const currentDocs = await this.vectorStore.docstore.search({});
      const filteredDocs = currentDocs.filter(doc => 
        doc.metadata?.source !== fileName && doc.metadata?.source !== 'init'
      );
      
      // Create a new vector store with the filtered documents
      if (filteredDocs.length > 0) {
        const newVectorStore = await HNSWLib.fromDocuments(
          filteredDocs,
          this.embeddings
        );
        
        // Replace the current vector store
        this.vectorStore = newVectorStore;
        
        // Save the updated vector store
        await this.vectorStore.save(this.vectorStorePath);
      } else {
        // If no documents left, reinitialize
        await this.createNewVectorStore();
      }
      
      // Update document map
      this.documents.delete(fileName);
      await this.saveDocumentMap();
      
      return { success: true, message: `Document "${fileName}" deleted successfully` };
    } catch (error) {
      console.error('Error deleting document:', error);
      return { success: false, message: `Error deleting document: ${error.message}` };
    }
  }
  
  /**
   * List all documents in the knowledge base
   * @returns {Promise<Array>} - Array of document names
   */
  async listDocuments() {
    if (!this.enabled) {
      return [];
    }
    
    try {
      // Initialize if needed
      if (!this.vectorStore) {
        await this.initialize();
      }
      
      if (!this.vectorStore) {
        console.error('Knowledge base not initialized');
        return [];
      }
      
      // Filter out initialization document
      return Array.from(this.documents.keys())
        .filter(key => key !== 'init');
    } catch (error) {
      console.error('Error listing documents:', error);
      return [];
    }
  }
  
  /**
   * Get MIME type based on file extension
   * @private
   * @param {string} fileName - Name of the file
   * @returns {string} - MIME type
   */
  _getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.txt':
        return 'text/plain';
      case '.html':
      case '.htm':
        return 'text/html';
      case '.xml':
        return 'application/xml';
      default:
        return 'application/octet-stream';
    }
  }
  
  /**
   * Extract text from a document based on its MIME type
   * @private
   * @param {Buffer} fileContent - File content buffer
   * @param {string} fileName - Name of the file
   * @param {string} mimeType - MIME type of the file
   * @returns {Promise<string>} - Extracted text
   */
  async _extractText(fileContent, fileName, mimeType) {
    try {
      if (mimeType === 'application/pdf') {
        // Extract text from PDF
        const pdfData = await pdfParse(fileContent);
        return pdfData.text;
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Extract text from DOCX
        const result = await mammoth.extractRawText({ buffer: fileContent });
        return result.value;
      } else if (mimeType === 'text/html' || mimeType === 'text/htm') {
        // Extract text from HTML
        const html = fileContent.toString('utf8');
        const $ = cheerio.load(html);
        // Remove script and style elements
        $('script, style').remove();
        return $('body').text();
      } else if (mimeType === 'application/xml') {
        // Extract text from XML
        const xml = fileContent.toString('utf8');
        const result = await xml2js.parseStringPromise(xml);
        // Convert XML object to string representation
        return JSON.stringify(result, null, 2);
      } else {
        // Default to plain text
        return fileContent.toString('utf8');
      }
    } catch (error) {
      console.error(`Error extracting text from ${fileName}:`, error);
      return `Error extracting text from ${fileName}: ${error.message}`;
    }
  }
}

// Create and export singleton instance
const kbManager = new KnowledgeBaseManager();
module.exports = kbManager;
