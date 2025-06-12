// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const multer = require('multer');

const app = express();
const port = process.env.GUI_PORT || 3000;

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      // Preserve original filename but make it safe
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, safeName);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Create uploads directory if it doesn't exist
fs.mkdirSync('uploads', { recursive: true });

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'gui/public')));
app.use(express.json());

// API endpoints for the GUI
app.get('/api/status', (req, res) => {
  try {
    const commandHandler = require('./handlers/commandHandler');
    const settings = commandHandler.getCurrentSettings();
    
    res.json({
      status: 'online',
      model: settings.model || '-',
      ragEnabled: settings.ragEnabled || false,
      provider: settings.provider || '-'
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', (req, res) => {
  try {
    const commandHandler = require('./handlers/commandHandler');
    const settings = commandHandler.getCurrentSettings();
    
    // Mask API keys for security
    if (settings.apiKeys && settings.apiKeys.openai) {
      settings.apiKeys.openai = '********';
    }
    if (settings.apiKeys && settings.apiKeys.openrouter) {
      settings.apiKeys.openrouter = '********';
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const commandHandler = require('./handlers/commandHandler');
    const newSettings = req.body;
    
    // Update settings
    commandHandler.updateSettings(newSettings);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chats', (req, res) => {
  try {
    const chatHandler = require('./handlers/chatHandler');
    const { limit = 20, offset = 0, sort = 'desc' } = req.query;
    
    // Check if getAllChats method exists
    if (typeof chatHandler.getAllChats !== 'function') {
      console.warn('getAllChats method not found in chatHandler');
      return res.json([]);
    }
    
    // Get all chats (already sorted and paginated by the handler)
    let chats = chatHandler.getAllChats();
    
    // Ensure chats is an array
    if (!Array.isArray(chats)) {
      console.warn('getAllChats did not return an array');
      chats = [];
    }
    
    // Sort chats by timestamp if not already sorted
    chats.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0);
      const timeB = new Date(b.timestamp || 0);
      return sort === 'asc' ? timeA - timeB : timeB - timeA;
    });
    
    // Apply pagination
    const startIdx = parseInt(offset);
    const endIdx = startIdx + parseInt(limit);
    const paginatedChats = chats.slice(startIdx, endIdx);
    
    // Format response to match what the frontend expects
    const response = {
      success: true,
      data: paginatedChats,
      total: chats.length,
      limit: parseInt(limit),
      offset: startIdx,
      hasMore: endIdx < chats.length
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting chats:', error);
    res.status(500).json({ 
      error: 'Failed to load chat history',
      details: error.message 
    });
  }
});

app.get('/api/chats/:chatId', (req, res) => {
  try {
    console.log(`[DEBUG] Received request for chat ID: ${req.params.chatId}`);
    const chatHandler = require('./handlers/chatHandler');
    const chatId = req.params.chatId;
    
    if (!chatId) {
      console.log('[DEBUG] No chat ID provided');
      return res.status(400).json({ error: 'Chat ID is required' });
    }
    
    console.log(`[DEBUG] Getting conversation for chat ID: ${chatId}`);
    const messages = chatHandler.getConversation(chatId);
    console.log(`[DEBUG] Retrieved ${messages ? messages.length : 0} messages for chat ID: ${chatId}`);
    console.log('[DEBUG] First few messages:', messages.slice(0, 2));
    
    // Get chat metadata
    console.log(`[DEBUG] Getting chat metadata for ID: ${chatId}`);
    const allChats = chatHandler.getAllChats();
    console.log(`[DEBUG] Found ${allChats.length} total chats`);
    
    const chatInfo = allChats.find(chat => chat.id === chatId) || {
      id: chatId,
      messageCount: messages.length,
      timestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : new Date().toISOString()
    };
    console.log('[DEBUG] Chat info:', chatInfo);
    
    const response = {
      success: true,
      id: chatId,
      ...chatInfo,
      conversation: messages
    };
    console.log('[DEBUG] Sending response with conversation length:', messages.length);
    
    res.json(response);
  } catch (error) {
    console.error(`Error getting chat ${req.params.chatId}:`, error);
    res.status(500).json({ 
      error: `Failed to load chat ${req.params.chatId}`,
      details: error.message 
    });
  }
});

app.delete('/api/chats/:chatId', (req, res) => {
  try {
    const chatHandler = require('./handlers/chatHandler');
    const chatId = req.params.chatId;
    
    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID is required' });
    }
    
    // Check if chat exists
    const chatExists = chatHandler.getAllChats().some(chat => chat.id === chatId);
    if (!chatExists) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Delete the chat
    chatHandler.deleteChat(chatId);
    
    res.json({ 
      success: true,
      message: `Chat ${chatId} deleted successfully`
    });
  } catch (error) {
    console.error(`Error deleting chat ${req.params.chatId}:`, error);
    res.status(500).json({ 
      error: `Failed to delete chat ${req.params.chatId}`,
      details: error.message 
    });
  }
});

app.get('/api/kb', async (req, res) => {
  try {
    const kbManager = require('./kb/kbManager');
    const documents = await kbManager.listDocuments();
    
    res.json(documents);
  } catch (error) {
    console.error('Error getting KB documents:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/kb/:filename', async (req, res) => {
  try {
    const kbManager = require('./kb/kbManager');
    const filename = req.params.filename;
    const result = await kbManager.deleteDocument(filename);
    
    res.json(result);
  } catch (error) {
    console.error('Error deleting KB document:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/commands', (req, res) => {
  try {
    const commandHandler = require('./handlers/commandHandler');
    // Make sure the method exists
    if (typeof commandHandler.getCommandHistory !== 'function') {
      return res.json({data: [], total: 0, limit: 50, offset: 0});
    }
    
    const { limit = 50, offset = 0, sort = 'desc' } = req.query;
    let history = commandHandler.getCommandHistory() || [];
    
    // Sort by timestamp
    history.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0);
      const timeB = new Date(b.timestamp || 0);
      return sort === 'asc' ? timeA - timeB : timeB - timeA;
    });
    
    // Apply pagination
    const startIdx = parseInt(offset);
    const endIdx = startIdx + parseInt(limit);
    const paginatedHistory = history.slice(startIdx, endIdx);
    
    res.json({
      data: paginatedHistory,
      total: history.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error getting command history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Knowledge base endpoints
// List all documents in the knowledge base
app.get('/api/kb/documents', async (req, res) => {
  console.log('[API] GET /api/kb/documents request received');
  try {
    // Make sure we return a valid JSON response even if something goes wrong
    res.setHeader('Content-Type', 'application/json');
    
    const kbManager = require('./kb/kbManager');
    console.log('[API] KB manager loaded, calling listDocuments()');
    
    // Check if KB is enabled
    if (!kbManager.enabled) {
      console.log('[API] KB is disabled');
      return res.json({
        success: false,
        error: 'Knowledge base is disabled',
        documents: []
      });
    }
    
    // Initialize KB if needed
    if (!kbManager.vectorStore) {
      console.log('[API] Initializing KB manager');
      await kbManager.initialize();
    }
    
    const documents = await kbManager.listDocuments();
    console.log(`[API] Found ${documents.length} documents in KB`);
    
    // Debug log the actual document data
    console.log('[API] Document data:', JSON.stringify(documents, null, 2));
    
    const response = {
      success: true,
      documents: documents
    };
    
    console.log('[API] Sending KB documents response');
    return res.json(response);
  } catch (error) {
    console.error('[API] Error listing KB documents:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to list knowledge base documents',
      details: error.message,
      documents: []
    });
  }
});

// Handle KB document uploads directly instead of redirecting
app.post('/api/kb/upload', upload.single('document'), async (req, res) => {
  console.log('[API] Document upload request received at /api/kb/upload');
  // Set content type to JSON to prevent HTML responses
  res.setHeader('Content-Type', 'application/json');
  
  try {
    if (!req.file) {
      console.log('[API] No file uploaded');
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }
    
    console.log(`[API] File uploaded: ${req.file.originalname}, size: ${req.file.size} bytes`);
    
    const kbManager = require('./kb/kbManager');
    console.log('[API] Adding document to KB manager');
    // Use the original filename for the document in the knowledge base
    const result = await kbManager.addDocument(req.file.path, req.file.originalname);
    
    // Keep the file for rebuilding the vector store later
    console.log(`[API] Keeping uploaded file at ${req.file.path} for future vector rebuilds`);
    
    console.log('[API] Document upload result:', result);
    
    return res.json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('[API] Error uploading document:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to upload document',
      details: error.message 
    });
  }
});

// Upload a document to the knowledge base
app.post('/api/kb/documents', upload.single('document'), async (req, res) => {
  console.log('[API] Document upload request received');
  // Set content type to JSON to prevent HTML responses
  res.setHeader('Content-Type', 'application/json');
  
  try {
    if (!req.file) {
      console.log('[API] No file uploaded');
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }
    
    console.log(`[API] File uploaded: ${req.file.originalname}, size: ${req.file.size} bytes`);
    
    const kbManager = require('./kb/kbManager');
    console.log('[API] Adding document to KB manager');
    // Use the original filename for the document in the knowledge base
    const result = await kbManager.addDocument(req.file.path, req.file.originalname);
    
    // Keep the file for rebuilding the vector store later
    console.log(`[API] Keeping uploaded file at ${req.file.path} for future vector rebuilds`);
    
    console.log('[API] Document upload result:', result);
    
    return res.json({
      success: result.success,
      message: result.message,
      document: result.success ? {
        name: req.file.originalname,
        size: req.file.size,
        dateAdded: new Date().toISOString()
      } : null
    });
  } catch (error) {
    console.error('[API] Error uploading KB document:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to upload document',
      details: error.message,
      document: null
    });
  }
});

// Delete a document from the knowledge base
app.delete('/api/kb/documents/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    if (!filename) {
      return res.status(400).json({ 
        success: false,
        error: 'Filename is required' 
      });
    }
    
    const kbManager = require('./kb/kbManager');
    const result = await kbManager.deleteDocument(filename);
    
    res.json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('Error deleting KB document:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete document',
      details: error.message 
    });
  }
});

// API key endpoint to get real API keys
app.get('/api/key/:provider', (req, res) => {
  try {
    const provider = req.params.provider;
    let key = '';
    
    // Get the real API key from environment variables
    if (provider === 'openai') {
      key = process.env.OPENAI_API_KEY || '';
    } else if (provider === 'openrouter') {
      key = process.env.OPENROUTER_API_KEY || '';
    }
    
    res.json({ key });
  } catch (error) {
    console.error('Error getting command history:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/key/:provider', (req, res) => {
  try {
    const provider = req.params.provider;
    let key = '';
    
    // Get the real API key from environment variables
    if (provider === 'openai') {
      key = process.env.OPENAI_API_KEY || '';
    } else if (provider === 'openrouter') {
      key = process.env.OPENROUTER_API_KEY || '';
    }
    
    res.json({ key });
  } catch (error) {
    console.error('Error getting API key:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const os = require('os');
    
    // Calculate CPU usage
    const cpuUsage = process.cpuUsage();
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    
    // Get system info
    const uptime = process.uptime();
    const nodeVersion = process.version;
    const platform = `${os.platform()} ${os.release()} (${os.arch()})`;
    const cpuModel = os.cpus().length > 0 ? os.cpus()[0].model : 'Unknown CPU';
    
    // Try to get GPU info from system
    let gpuInfo = null;
    
    try {
      // On Windows, we can try to get GPU info from Windows Management Instrumentation
      if (os.platform() === 'win32') {
        const { execSync } = require('child_process');
        
        // First try to get the GPU name
        try {
          const gpuNameData = execSync('wmic path win32_VideoController get name /value', { encoding: 'utf8' });
          const nameMatch = gpuNameData.match(/Name=(.+?)(?:\r|\n)/i);
          
          if (nameMatch) {
            const gpuName = nameMatch[1].trim();
            
            // Determine vendor
            let vendor = 'Unknown';
            if (gpuName.includes('NVIDIA')) vendor = 'NVIDIA';
            else if (gpuName.includes('AMD') || gpuName.includes('Radeon')) vendor = 'AMD';
            else if (gpuName.includes('Intel')) vendor = 'Intel';
            
            // Get driver version
            let driverVersion = 'Unknown';
            try {
              const driverData = execSync('wmic path win32_VideoController get DriverVersion /value', { encoding: 'utf8' });
              const driverMatch = driverData.match(/DriverVersion=(.+?)(?:\r|\n)/i);
              if (driverMatch) driverVersion = driverMatch[1].trim();
            } catch (e) {}
            
            // Estimate VRAM based on GPU model
            let estimatedVRAM = 0;
            
            // NVIDIA GPUs
            if (gpuName.includes('RTX 4090')) estimatedVRAM = 24 * 1024;
            else if (gpuName.includes('RTX 4080')) estimatedVRAM = 16 * 1024;
            else if (gpuName.includes('RTX 4070')) estimatedVRAM = 12 * 1024;
            else if (gpuName.includes('RTX 4060')) estimatedVRAM = 8 * 1024;
            else if (gpuName.includes('RTX 3090')) estimatedVRAM = 24 * 1024;
            else if (gpuName.includes('RTX 3080')) estimatedVRAM = 10 * 1024;
            else if (gpuName.includes('RTX 3070')) estimatedVRAM = 8 * 1024;
            else if (gpuName.includes('RTX 3060')) estimatedVRAM = 12 * 1024;
            else if (gpuName.includes('RTX 2080')) estimatedVRAM = 8 * 1024;
            else if (gpuName.includes('RTX 2070')) estimatedVRAM = 8 * 1024;
            else if (gpuName.includes('RTX 2060')) estimatedVRAM = 6 * 1024;
            else if (gpuName.includes('GTX 1080')) estimatedVRAM = 8 * 1024;
            else if (gpuName.includes('GTX 1070')) estimatedVRAM = 8 * 1024;
            else if (gpuName.includes('GTX 1060')) estimatedVRAM = 6 * 1024;
            else if (gpuName.includes('GTX 1050')) estimatedVRAM = 4 * 1024;
            
            // AMD GPUs
            else if (gpuName.includes('RX 7900')) estimatedVRAM = 24 * 1024;
            else if (gpuName.includes('RX 7800')) estimatedVRAM = 16 * 1024;
            else if (gpuName.includes('RX 7700')) estimatedVRAM = 12 * 1024;
            else if (gpuName.includes('RX 7600')) estimatedVRAM = 8 * 1024;
            else if (gpuName.includes('RX 6900')) estimatedVRAM = 16 * 1024;
            else if (gpuName.includes('RX 6800')) estimatedVRAM = 16 * 1024;
            else if (gpuName.includes('RX 6700')) estimatedVRAM = 12 * 1024;
            else if (gpuName.includes('RX 6600')) estimatedVRAM = 8 * 1024;
            else if (gpuName.includes('RX 5700')) estimatedVRAM = 8 * 1024;
            else if (gpuName.includes('RX 5600')) estimatedVRAM = 6 * 1024;
            else if (gpuName.includes('RX 5500')) estimatedVRAM = 4 * 1024;
            
            // Intel GPUs
            else if (gpuName.includes('Arc A770')) estimatedVRAM = 16 * 1024;
            else if (gpuName.includes('Arc A750')) estimatedVRAM = 8 * 1024;
            else if (gpuName.includes('Arc A580')) estimatedVRAM = 8 * 1024;
            else if (gpuName.includes('Arc A380')) estimatedVRAM = 6 * 1024;
            else if (gpuName.includes('Iris')) estimatedVRAM = 2 * 1024;
            else if (gpuName.includes('UHD')) estimatedVRAM = 1 * 1024;
            
            // Default estimate based on vendor for unknown models
            else if (vendor === 'NVIDIA') estimatedVRAM = 4 * 1024;
            else if (vendor === 'AMD') estimatedVRAM = 4 * 1024;
            else if (vendor === 'Intel') estimatedVRAM = 1 * 1024;
            else estimatedVRAM = 2 * 1024; // Generic fallback
            
            gpuInfo = {
              model: gpuName,
              vendor: vendor,
              vram: estimatedVRAM,
              driver: driverVersion,
              usage: null // Can't easily get GPU usage without additional tools
            };
          }
        } catch (e) {
          console.error('Error getting GPU name:', e);
        }
      }
    } catch (gpuError) {
      console.error('Error getting GPU info:', gpuError);
    }
    
    // Fallback if GPU detection failed
    if (!gpuInfo) {
      gpuInfo = {
        model: 'GPU detection failed or unsupported platform',
        vendor: 'Unknown',
        vram: 0,
        driver: 'Unknown',
        usage: null
      };
    }
    
    res.json({
      uptime,
      cpu: cpuUsage,
      cpuModel,
      memory: memoryUsage,
      nodeVersion,
      platform,
      gpu: gpuInfo
    });
  } catch (error) {
    console.error('Error getting system stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restart server endpoint
app.post('/api/restart', (req, res) => {
  res.json({ success: true, message: 'Server restart initiated' });
  
  // Give time for the response to be sent
  setTimeout(() => {
    console.log('Restarting server...');
    process.exit(0); // Process should be restarted by a process manager like PM2
  }, 1000);
});

// For any non-API routes, serve the index.html file
app.get('*', (req, res) => {
  // Don't intercept API requests
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  
  res.sendFile(path.join(__dirname, 'gui/public/index.html'));
});

// Create HTTP server
const server = http.createServer(app);

// Start server
server.listen(port, () => {
  console.log(`GUI server running on port ${port}`);
});

// Handle errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Export server for potential use in other modules
module.exports = server;
