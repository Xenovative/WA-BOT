const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const kbManager = require('./kbManager');

class FileWatcher {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.watcher = null;
    this.processing = new Set(); // Track files being processed
    
    // Create uploads directory if it doesn't exist
    fs.ensureDirSync(this.uploadDir);
  }
  
  /**
   * Start watching the uploads directory
   */
  startWatching() {
    console.log(`Watching for files in: ${this.uploadDir}`);
    
    this.watcher = chokidar.watch(this.uploadDir, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });
    
    this.watcher.on('add', (filePath) => this.processFile(filePath));
    
    this.watcher.on('error', (error) => {
      console.error(`File watcher error: ${error}`);
    });
  }
  
  /**
   * Stop watching the uploads directory
   */
  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('File watcher stopped');
    }
  }
  
  /**
   * Process a file that was added to the uploads directory
   * @param {string} filePath - Path to the file
   */
  async processFile(filePath) {
    const fileName = path.basename(filePath);
    
    // Skip if already processing
    if (this.processing.has(fileName)) {
      return;
    }
    
    // Skip .tmp files and other temporary files
    if (fileName.startsWith('.') || fileName.endsWith('.tmp') || fileName.includes('~$')) {
      return;
    }
    
    console.log(`Processing file: ${fileName}`);
    this.processing.add(fileName);
    
    try {
      // Process the file with the knowledge base manager
      const result = await kbManager.addDocument(filePath, fileName);
      
      console.log(result.message);
      
      // Keep the file for future vector store rebuilds
      console.log(`File preserved at ${filePath} for future vector store rebuilds`);
    } catch (error) {
      console.error(`Error processing ${fileName}: ${error.message}`);
    } finally {
      this.processing.delete(fileName);
    }
  }
}

// Create singleton instance
const fileWatcher = new FileWatcher();
module.exports = fileWatcher;
