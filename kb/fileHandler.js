const fs = require('fs-extra');
const path = require('path');
const kbManager = require('./kbManager');

class FileHandler {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    fs.ensureDirSync(this.uploadDir);
  }
  
  /**
   * Save a file from WhatsApp to the uploads directory
   * @param {Object} media - Media object from WhatsApp
   * @param {string} filename - Desired filename
   * @returns {Promise<Object>} - Result with file path
   */
  async saveFile(media, filename) {
    try {
      const buffer = Buffer.from(media.data, 'base64');
      const filePath = path.join(this.uploadDir, filename);
      
      await fs.writeFile(filePath, buffer);
      
      return {
        success: true,
        filePath,
        message: `File saved as ${filename}`
      };
    } catch (error) {
      console.error('Error saving file:', error);
      return {
        success: false,
        message: `Error saving file: ${error.message}`
      };
    }
  }
  
  /**
   * Process a saved file and add it to the knowledge base
   * @param {string} filePath - Path to the saved file
   * @returns {Promise<Object>} - Result of the operation
   */
  async processFile(filePath) {
    try {
      const fileName = path.basename(filePath);
      const result = await kbManager.addDocument(filePath, fileName);
      
      // Clean up the uploaded file after processing
      await fs.remove(filePath);
      
      return result;
    } catch (error) {
      console.error('Error processing file:', error);
      return {
        success: false,
        message: `Error processing file: ${error.message}`
      };
    }
  }
  
  /**
   * Save and process a file in one step
   * @param {Object} media - Media object from WhatsApp
   * @param {string} filename - Desired filename
   * @returns {Promise<Object>} - Result of the operation
   */
  async saveAndProcessFile(media, filename) {
    const saveResult = await this.saveFile(media, filename);
    
    if (!saveResult.success) {
      return saveResult;
    }
    
    return await this.processFile(saveResult.filePath);
  }
}

module.exports = new FileHandler();
