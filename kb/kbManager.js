const fs = require('fs-extra');
const path = require('path');
const { Document } = require('langchain/document');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { HNSWLib } = require('@langchain/community/vectorstores/hnswlib');
const { HuggingFaceTransformersEmbeddings } = require('@langchain/community/embeddings/hf_transformers');
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
    
    // Create storage directories if they don't exist
    fs.ensureDirSync(path.resolve(process.cwd(), this.storagePath));
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
      
      console.log(`[KB] Vector store files check: index=${indexExists}, docstore=${docStoreExists}, map=${mapExists}`);
      
      // Always load document map first if it exists
      if (mapExists) {
        console.log('[KB] Loading document map');
        await this.loadDocumentMap();
        console.log(`[KB] Loaded ${this.documents.size} documents from map`);
      }
      
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
      console.log(`[KB] Saved document map with ${this.documents.size} entries to ${mapPath}`);
      
      // Also save a list of document names for easy reference
      const docListPath = path.join(this.vectorStorePath, 'document_list.json');
      const docList = Array.from(this.documents.entries())
        .filter(([key]) => key !== 'init')
        .map(([key, value]) => ({
          name: key,
          chunks: value.chunks || 0,
          timestamp: value.timestamp || Date.now(),
          filePath: value.filePath || '',
          fileSize: value.fileSize || 0,
          fileType: value.fileType || ''
        }));
      await fs.writeJson(docListPath, docList, { spaces: 2 });
      console.log(`[KB] Saved document list with ${docList.length} entries`);
      
      // Also save the vector store explicitly
      if (this.vectorStore) {
        await this.vectorStore.save(this.vectorStorePath);
        console.log(`[KB] Saved vector store to ${this.vectorStorePath}`);
      }
    } catch (error) {
      console.error('[KB] Error saving document map:', error);
      throw error; // Propagate error to caller for better error handling
    }
  }
  
  /**
   * Rebuild the vector store from document map
   */
  async rebuildVectorStore() {
    try {
      console.log('[KB] Rebuilding vector store from document map');
      
      // Create new vector store
      await this.createNewVectorStore();
      
      // Get all documents except init
      const documents = Array.from(this.documents.entries())
        .filter(([key]) => key !== 'init');
      
      console.log(`[KB] Found ${documents.length} documents to rebuild`);
      
      // Process each document
      for (const [docName, metadata] of documents) {
        try {
          const filePath = metadata.filePath;
          
          if (!filePath || !await fs.pathExists(filePath)) {
            console.warn(`[KB] File not found for document ${docName}, skipping`);
            continue;
          }
          
          console.log(`[KB] Re-adding document ${docName} from ${filePath}`);
          
          // Extract text from the file
          const text = await this.extractTextFromFile(filePath, docName);
          if (!text) {
            console.warn(`[KB] Failed to extract text from ${docName}, skipping`);
            continue;
          }
          
          // Split text into chunks
          const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: this.chunkSize,
            chunkOverlap: this.chunkOverlap
          });
          
          const chunks = await textSplitter.createDocuments(
            [text],
            [{ source: docName, filePath: filePath }]
          );
          
          console.log(`[KB] Created ${chunks.length} chunks from ${docName}`);
          
          // Add chunks to vector store
          await this.vectorStore.addDocuments(chunks);
          
          // Save the vector store after each document
          // Get file stats for metadata
          const stats = await fs.stat(filePath);
          const fileExt = path.extname(filePath).toLowerCase();
          
          // Update document map with rich metadata
          this.documents.set(docName, {
            chunks: chunks.length,
            timestamp: new Date().toISOString(),
            name: docName,
            originalName: docName,
            filePath: filePath,
            fileSize: stats.size,
            fileType: fileExt ? fileExt.substring(1) : 'unknown'
          });
          
          console.log(`[KB] Successfully re-added document ${docName}`);
        } catch (error) {
          console.error(`[KB] Error re-adding document ${docName}:`, error);
        }
      }
      
      console.log('[KB] Vector store rebuild complete');
      await this.saveDocumentMap();
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
    try {
      console.log(`[KB] Adding document: ${fileName} from ${filePath}`);
      
      if (!this.enabled) {
        console.log('[KB] Knowledge base is disabled');
        return { success: false, message: 'Knowledge base is disabled' };
      }
      
      // Initialize if not already initialized
      if (!this.vectorStore) {
        console.log('[KB] Initializing vector store');
        try {
          await this.initialize();
        } catch (initError) {
          console.error('[KB] Failed to initialize vector store:', initError);
          return { success: false, message: `Failed to initialize knowledge base: ${initError.message}` };
        }
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`[KB] File not found: ${filePath}`);
        return { success: false, message: `File not found: ${fileName}` };
      }
      
      // Extract text from the document
      console.log(`[KB] Extracting text from ${fileName}`);
      
      // Get file extension and original name
      const fileExt = path.extname(filePath).toLowerCase();
      const originalName = fileName.toLowerCase();
      console.log(`[KB] File extension detected: ${fileExt}, original filename: ${originalName}`);
      let content;
      
      // Check if it's a JSON file either by extension or by filename containing 'json'
      const isJsonFile = fileExt === '.json' || originalName.includes('json');
      
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
      } else if (isJsonFile) {
        // Process JSON files
        console.log('[KB] Processing JSON file');
        try {
          const jsonContent = await fs.readFile(filePath, 'utf-8');
          console.log('[KB] JSON file read successfully, size:', jsonContent.length);
          const jsonData = JSON.parse(jsonContent);
          console.log('[KB] JSON parsed successfully');
          // Pretty print JSON for better text extraction
          content = JSON.stringify(jsonData, null, 2);
        } catch (error) {
          console.error('[KB] Error processing JSON file:', error);
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
        // Try to read as text for unknown file types
        try {
          console.log('[KB] Trying to read unknown file type as text');
          content = await fs.readFile(filePath, 'utf-8');
          console.log('[KB] Successfully read file as text');
        } catch (error) {
          console.error('[KB] Failed to read file as text:', error);
          return { success: false, message: `Unsupported file type: ${fileExt || 'unknown'}` };
        }
      }
      
      // Split content into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: this.chunkSize,
        chunkOverlap: this.chunkOverlap,
      });
      
      const docs = await textSplitter.createDocuments(
        [content], 
        [{ 
          source: fileName,
          filename: fileName,
          originalName: fileName,
          dateAdded: new Date().toISOString()
        }]
      );
      
      // Add to vector store
      await this.vectorStore.addDocuments(docs);
      
      // Save vector store
      await this.vectorStore.save(this.vectorStorePath);
      
      // Get actual file size from the file system
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      
      // Update document map with rich metadata including original file path
      this.documents.set(fileName, {
        chunks: docs.length,
        timestamp: new Date().toISOString(),
        name: fileName,
        originalName: originalName || fileName,
        fileSize: fileSize, // Use actual file size
        fileType: fileExt ? fileExt.substring(1) : 'unknown',
        filePath: filePath // Store the original file path for rebuilding
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

      // Retrieve more documents than we need so we can filter out disabled ones
      const allResults = await this.vectorStore.similaritySearch(query, this.topK * 2);
      
      // Filter out documents that have been disabled
      const filteredResults = allResults.filter(doc => {
        const fileName = doc.metadata?.fileName;
        if (!fileName) return true; // Keep documents without filename metadata
        
        const docInfo = this.documents.get(fileName);
        return docInfo ? docInfo.enabled !== false : true; // Default to enabled if not found
      }).slice(0, this.topK); // Limit to the requested number of results
      
      console.log(`[KB] Found ${filteredResults.length} relevant enabled documents out of ${allResults.length} matches`);
      return filteredResults;
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
   * @returns {Promise<Array>} - List of document objects
   */
  async listDocuments() {
    try {
      if (!this.enabled) {
        console.log('[KB] Knowledge base is disabled');
        return [];
      }
      
      // Always try to load the document map from disk first
      await this.loadDocumentMap();
      
      // Filter out the initialization document
      const documents = Array.from(this.documents.entries())
        .filter(([key]) => key !== 'init')
        .map(([key, value]) => ({
          name: key,
          chunks: value.chunks || 0,
          timestamp: value.timestamp || new Date().toISOString(),
          filePath: value.filePath || '',
          fileSize: value.fileSize || 0,
          fileType: value.fileType || '',
          enabled: value.enabled !== false // Default to enabled if property doesn't exist
        }));
      
      console.log(`[KB] Found ${documents.length} documents in knowledge base`);
      return documents;
    } catch (error) {
      console.error('[KB] Error listing documents:', error);
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
   * Extract text from a file
   * @param {string} filePath - Path to the file
   * @param {string} fileName - Name of the file
   * @returns {Promise<string>} - Extracted text
   */
  async extractTextFromFile(filePath, fileName) {
    try {
      const mimeType = this._getMimeType(fileName);
      const fileContent = await fs.readFile(filePath);
      return await this._extractText(fileContent, fileName, mimeType);
    } catch (error) {
      console.error(`Error extracting text from ${fileName}:`, error);
      throw error;
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
  
  /**
   * Toggle a document's enabled status for RAG operations
   * @param {string} fileName - Name of the document to toggle
   * @param {boolean} enabled - Whether the document should be enabled
   * @returns {Promise<Object>} - Result of the operation
   */
  async toggleDocumentEnabled(fileName, enabled) {
    try {
      if (!this.enabled) {
        return { success: false, message: 'Knowledge base is disabled' };
      }
      
      if (!fileName) {
        return { success: false, message: 'No document name provided' };
      }
      
      // Check if document exists
      if (!this.documents.has(fileName)) {
        return { success: false, message: `Document '${fileName}' not found` };
      }
      
      // Update the document's enabled status
      const docInfo = this.documents.get(fileName);
      docInfo.enabled = enabled;
      this.documents.set(fileName, docInfo);
      
      // Save the document map
      await this.saveDocumentMap();
      
      return { 
        success: true, 
        message: `Document '${fileName}' ${enabled ? 'enabled' : 'disabled'} for RAG operations`,
        document: {
          name: fileName,
          enabled: enabled
        }
      };
    } catch (error) {
      console.error(`Error toggling document '${fileName}' enabled status:`, error);
      return { success: false, message: `Error toggling document status: ${error.message}` };
    }
  }
}

// Create and export singleton instance
const kbManager = new KnowledgeBaseManager();
module.exports = kbManager;
