// Load environment variables from .env file
require('dotenv').config();

const { MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const multer = require('multer');
const WebSocket = require('ws');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const port = process.env.GUI_PORT || 3000;
const adminUtils = require('./utils/adminUtils');

// Serve static files from the public directory first
app.use(express.static(path.join(__dirname, 'gui/public')));

// Proxy Node-RED editor requests to the workflow manager
const workflowPort = process.env.WORKFLOW_PORT || 1880;
app.use('/red', createProxyMiddleware({
  target: `http://localhost:${workflowPort}`,
  changeOrigin: true,
  pathRewrite: {
    '^/red': '/red' // Keep the /red path
  },
  onError: (err, req, res) => {
    console.error('Node-RED proxy error:', err.message);
    res.status(503).json({ 
      error: 'Node-RED workflow editor is not available', 
      message: 'Please ensure the workflow system is running' 
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] Forwarding ${req.method} ${req.url} to Node-RED`);
  }
}));

// Admin mode middleware
function checkAdminMode(req, res, next) {
  // Skip admin check for static files and assets
  if (req.path.startsWith('/css/') || 
      req.path.startsWith('/js/') || 
      req.path.startsWith('/img/') ||
      req.path === '/favicon.ico' ||
      req.path === '/index.html') {
    return next();
  }

  // Allow login and public endpoints
  if (req.path === '/api/admin/login' || 
      req.path.startsWith('/api/whatsapp') ||
      req.path.startsWith('/public/')) {
    return next();
  }

  // Check if admin mode is required for this endpoint
  const adminOnlyEndpoints = [
    '/api/workflows',
    '/api/workflows/',
    '/api/kb',
    '/api/restart'
  ];

  // Allow read-only access to knowledge base, profiles, settings, and stats without admin mode
  if (req.path.startsWith('/api/profiles') || 
      req.path === '/api/config' ||
      req.path === '/api/settings' ||
      req.path === '/api/stats' ||
      (req.path.startsWith('/api/kb') && req.method === 'GET')) {
    return next();
  }

  const isAdminEndpoint = adminOnlyEndpoints.some(endpoint => 
    req.path.startsWith(endpoint)
  );

  if (isAdminEndpoint && !adminUtils.isAdminMode()) {
    return res.status(403).json({ 
      error: 'Admin mode required',
      requiresAdmin: true 
    });
  }

  next();
}

// Apply admin mode check to all routes
exceptStatic = (req, res, next) => {
  // Skip admin check for static files and assets
  if (req.path.startsWith('/css/') || 
      req.path.startsWith('/js/') || 
      req.path.startsWith('/img/') ||
      req.path === '/favicon.ico' ||
      req.path === '/index.html') {
    return next();
  }
  checkAdminMode(req, res, next);
};

app.use(exceptStatic);

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

// Get workflow manager instance
const WorkflowManager = require('./workflow/workflowManager');
const workflowManager = global.workflowManager || new WorkflowManager();

// Get Node-RED instance if available
let RED = null;
try {
  RED = global.RED;
} catch (err) {
  console.log('Node-RED not available in guiServer');
}

// API endpoints for the GUI

// Get WhatsApp QR code for authentication
app.get('/api/whatsapp/qr', (req, res) => {
    try {
        // Get the WhatsApp client instance
        const client = global.client;
        if (!client) {
            return res.status(503).json({ error: 'WhatsApp client not initialized' });
        }

        // If client is already authenticated, no need for QR code
        if (client.info) {
            return res.status(200).json({ authenticated: true });
        }

        // If we already have a QR code, return it
        if (global.qrCodeData) {
            return res.json({ qr: global.qrCodeData });
        }

        // Set up a promise to wait for the next QR code
        return new Promise((resolve) => {
            // Set a timeout to prevent hanging
            const timeout = setTimeout(() => {
                if (global.pendingQrResolve) {
                    global.pendingQrResolve = null;
                    resolve(res.status(408).json({ error: 'QR code generation timeout' }));
                }
            }, 10000); // 10 second timeout

            // Store the resolve function to be called when we get a QR code
            global.pendingQrResolve = (data) => {
                clearTimeout(timeout);
                global.pendingQrResolve = null;
                resolve(res.json(data));
            };
        });
    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({ error: 'Failed to generate QR code: ' + error.message });
    }
});

// Check WhatsApp authentication status
app.get('/api/whatsapp/status', (req, res) => {
    try {
        const client = global.client;
        if (!client) {
            return res.json({ 
                authenticated: false, 
                status: 'disconnected',
                message: 'WhatsApp client not initialized' 
            });
        }
        
        // Check client state
        const state = client.info ? 'authenticated' : 'disconnected';
        
        // If authenticated, clear any stored QR code
        if (state === 'authenticated' && global.qrCodeData) {
            delete global.qrCodeData;
        }
        
        res.json({ 
            authenticated: !!client.info,
            status: state,
            phoneNumber: client.info?.wid.user,
            pushname: client.info?.pushname
        });
    } catch (error) {
        console.error('Error checking auth status:', error);
        res.status(500).json({ 
            error: 'Failed to check auth status',
            details: error.message,
            status: 'error'
        });
    }
});

// Handle Telegram token update
app.post('/api/telegram/set-token', express.json(), async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        // Update .env file with new token
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';
        
        // Read existing .env file if it exists
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf-8');
        }
        
        // Update or add TELEGRAM_BOT_TOKEN
        if (envContent.includes('TELEGRAM_BOT_TOKEN=')) {
            envContent = envContent.replace(
                /TELEGRAM_BOT_TOKEN=.*/,
                `TELEGRAM_BOT_TOKEN=${token}`
            );
        } else {
            envContent += `\nTELEGRAM_BOT_TOKEN=${token}\n`;
        }
        
        // Save the updated .env file
        fs.writeFileSync(envPath, envContent);
        
        // Update environment variable
        process.env.TELEGRAM_BOT_TOKEN = token;
        
        // Restart the Telegram bot if it exists
        if (global.telegramBot) {
            try {
                await global.telegramBot.stop();
            } catch (e) {
                console.error('Error stopping Telegram bot:', e);
            }
        }
        
        // Start new Telegram bot instance
        try {
            const TelegramBotService = require('./services/telegramBot');
            global.telegramBot = new TelegramBotService(token);
            await global.telegramBot.start();
            console.log('Telegram bot restarted with new token');
            return res.json({ success: true, message: 'Telegram token updated and bot restarted' });
        } catch (e) {
            console.error('Error starting Telegram bot:', e);
            const errorMessage = e.message || 'Failed to start Telegram bot with new token';
            return res.status(400).json({ error: errorMessage });
        }
        
        res.json({ success: true, message: 'Telegram token updated and bot restarted' });
    } catch (error) {
        console.error('Error updating Telegram token:', error);
        res.status(500).json({ error: 'Failed to update Telegram token' });
    }
});

// API endpoint for workflows to send WhatsApp messages
app.post('/api/workflow/send-message', express.json(), async (req, res) => {
  try {
    console.log('Received send-message request:', req.body);
    
    // Support both chatId and recipient parameters for compatibility
    const chatId = req.body.chatId || req.body.recipient;
    // Support both message and text parameters for compatibility
    const messageContent = req.body.message || req.body.text || req.body.payload;
    const mediaUrl = req.body.media;
    const caption = req.body.caption || '';
    const mediaType = req.body.type || 'image'; // default to image if not specified
    
    if (!chatId || (!messageContent && !mediaUrl)) {
      console.log('Missing parameters:', { chatId, messageContent, mediaUrl, body: req.body });
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: chatId/recipient and either message or media is required' 
      });
    }
    
    // Get the WhatsApp client from global scope
    const whatsapp = global.whatsappClient;
    
    if (!whatsapp || !whatsapp.client) {
      return res.status(500).json({ success: false, error: 'WhatsApp client not available' });
    }
    
    try {
      // Get the workflow name or ID for the chat history
      const workflowName = req.body.workflowName || req.body.workflowId || 'workflow';
      
      // Add message to chat history before sending
      if (global.chatHandler) {
        const displayContent = messageContent || `[${mediaType.toUpperCase()}] ${caption || mediaUrl}`;
        global.chatHandler.addMessage(chatId, 'assistant', displayContent);
        console.log(`[Workflow: ${workflowName}] Added message to chat history for ${chatId}`);
      } else {
        console.warn('Chat handler not available, message not saved to history');
      }
      
      // Send media if URL is provided
      if (mediaUrl) {
        // Debug: Log WhatsApp client status
        console.log('WhatsApp client status:', {
          isClientAvailable: !!whatsapp?.client,
          isConnected: whatsapp?.client?.info ? 'connected' : 'disconnected'
        });

        // Debug: Check media URL
        try {
          const response = await fetch(mediaUrl, { method: 'HEAD' });
          console.log('Media URL status:', response.status, response.statusText);
        } catch (error) {
          console.error('Error checking media URL:', error.message);
        }

        try {
          // First, send the text message
          if (messageContent) {
            await whatsapp.client.sendMessage(chatId, messageContent);
            console.log('Text message sent to', chatId);
          }
          
          // Then send the media if URL is provided
          if (mediaUrl) {
            const media = await MessageMedia.fromUrl(mediaUrl, {
              unsafeMime: true,
              filename: `media.${mediaType === 'image' ? 'jpg' : 'pdf'}`
            });
            
            console.log('Sending media to WhatsApp client:', {
              type: mediaType,
              mimeType: media.mimetype,
              url: mediaUrl
            });
            
            const sendOptions = mediaType === 'document' ? { sendMediaAsDocument: true } : {};
            const message = await whatsapp.client.sendMessage(chatId, media, sendOptions);
            console.log('Media sent with ID:', message.id?._serialized || 'No ID returned');
          }
          console.log('Message sent with ID:', message.id?._serialized || 'No ID returned');
        } catch (error) {
          console.error('Error sending message:', error);
          throw error;
        }
      } 
      // Otherwise send text message
      else {
        await whatsapp.client.sendMessage(chatId, messageContent);
        console.log(`Message sent to ${chatId}: ${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}`);
      }
      
      res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  } catch (error) {
    console.error('Error processing send message request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Workflow API endpoints
app.get('/api/workflows', (req, res) => {
  try {
    // Get workflows from the workflow folder
    const fs = require('fs');
    const path = require('path');
    const workflowDir = path.join(__dirname, 'workflow');
    
    // Get list of workflow files
    const files = fs.readdirSync(workflowDir);
    const workflows = [];
    
    // Get list of enabled workflows
    const enabledWorkflows = workflowManager.getEnabledWorkflows();
    
    // Get active workflows from Node-RED for additional info
    let activeNodeREDWorkflows = [];
    try {
      // Use synchronous method instead of async
      const flows = RED?.nodes?.getFlows();
      if (flows && flows.flows) {
        // Find all tab nodes (workflows)
        activeNodeREDWorkflows = flows.flows
          .filter(node => node.type === 'tab')
          .map(tab => tab.id);
        console.log(`[API] Found ${activeNodeREDWorkflows.length} active workflows in Node-RED`);
      }
    } catch (err) {
      console.error('[API] Error getting active Node-RED workflows:', err);
    }
    
    for (const file of files) {
      // Skip directories and non-JSON files
      if (!file.endsWith('.json')) continue;
      
      const id = file.replace('.json', '');
      
      // Read and parse the workflow file
      const filePath = path.join(workflowDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      let flowData;
      
      try {
        flowData = JSON.parse(fileContent);
      } catch (err) {
        console.error(`Error processing workflow file ${file}:`, err);
        workflows.push({
          id,
          name: id,
          description: 'Error parsing workflow file',
          enabled: enabledWorkflows.includes(id),
          activeInNodeRED: false,
          nodeCount: 0,
          file,
          error: true
        });
        continue;
      }
      
      // Find the tab node if it exists
      const tabNode = Array.isArray(flowData) ? 
        flowData.find(node => node.type === 'tab') : null;
      
      const name = tabNode?.label || id;
      const description = tabNode?.info || 'No description available';
      
      // Count nodes
      const nodeCount = Array.isArray(flowData) ? 
        flowData.filter(node => node.type !== 'tab').length : 1;
      
      // Check if this workflow is active in Node-RED
      const isActiveInNodeRED = activeNodeREDWorkflows.includes(id);
      
      workflows.push({
        id,
        name,
        description,
        enabled: enabledWorkflows.includes(id),
        activeInNodeRED: isActiveInNodeRED,
        nodeCount,
        file
      });
    }
    
    // Sort workflows by name for better display
    workflows.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json({ success: true, workflows });
  } catch (error) {
    console.error('Error getting workflows:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle workflow enabled/disabled state
app.post('/api/workflows/toggle', async (req, res) => {
  try {
    const { id, enabled } = req.body;
    
    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing workflow ID' });
    }
    
    if (enabled === undefined) {
      return res.status(400).json({ success: false, error: 'Missing enabled state' });
    }
    
    // Enable or disable the workflow
    if (enabled) {
      await workflowManager.enableWorkflow(id);
    } else {
      workflowManager.disableWorkflow(id);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/workflows/:id', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const id = req.params.id;
    
    // Try to find the workflow file with this ID
    const workflowDir = path.join(__dirname, 'workflow');
    const filePath = path.join(workflowDir, `${id}.json`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Workflow file not found' });
    }
    
    // Read and parse the workflow file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let flowData;
    
    try {
      flowData = JSON.parse(fileContent);
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Invalid workflow file format' });
    }
    
    // Find the tab node if it exists
    const tabNode = Array.isArray(flowData) ? 
      flowData.find(node => node.type === 'tab') : null;
    
    // Get all nodes except the tab node
    const nodes = Array.isArray(flowData) ? 
      flowData.filter(node => node.type !== 'tab') : [];
    
    // Create the workflow object
    const workflow = {
      id,
      name: tabNode?.label || id,
      description: tabNode?.info || 'Workflow file',
      nodes: nodes,
      nodeCount: nodes.length,
      enabled: workflowManager.getEnabledWorkflows().includes(id),
      file: `${id}.json`,
      config: flowData
    };
    
    res.json({ success: true, workflow });
  } catch (error) {
    console.error('Error getting workflow details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/workflows/toggle', async (req, res) => {
  try {
    const { id, enabled } = req.body;
    
    if (!id) {
      return res.status(400).json({ success: false, error: 'Workflow ID is required' });
    }
    
    console.log(`[API] Toggling workflow ${id} to ${enabled ? 'enabled' : 'disabled'}`);
    
    // Toggle workflow in the workflow manager
    if (enabled) {
      const success = await workflowManager.enableWorkflow(id);
      if (!success) {
        return res.status(500).json({ success: false, error: `Failed to enable workflow ${id}` });
      }
    } else {
      await workflowManager.disableWorkflow(id);
    }
    
    // Get updated status from Node-RED
    let isActiveInNodeRED = false;
    try {
      if (RED && RED.nodes) {
        const flows = RED.nodes.getFlows();
        if (flows && flows.flows) {
          isActiveInNodeRED = flows.flows.some(node => node.id === id && node.type === 'tab');
        }
      }
    } catch (err) {
      console.error(`[API] Error checking Node-RED status: ${err.message}`);
    }
    
    res.json({ 
      success: true, 
      enabled: enabled,
      activeInNodeRED: isActiveInNodeRED
    });
  } catch (error) {
    console.error('Error toggling workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// System stats API endpoint
app.get('/api/stats', (req, res) => {
  try {
    const os = require('os');
    const process = require('process');
    
    // Get CPU information
    const cpuInfo = os.cpus();
    const cpuModel = cpuInfo.length > 0 ? cpuInfo[0].model : 'Unknown';
    
    // Calculate CPU usage
    const cpuUsage = process.cpuUsage();
    
    // Get memory information
    const memInfo = process.memoryUsage();
    
    // Get system uptime
    const uptime = process.uptime();
    
    // Get Node.js version
    const nodeVersion = process.version;
    
    // Get platform information
    const platform = `${os.type()} ${os.release()}`;
    
    // Get WhatsApp client status
    const whatsappStatus = global.whatsappClient ? 
      (global.whatsappClient.client ? 'Connected' : 'Initializing') : 
      'Not available';
    
    // Get Node-RED status
    const nodeRedStatus = RED ? 'Running' : 'Not available';
    
    // Get MQTT status
    const mqttStatus = workflowManager.mqttConnected ? 'Connected' : 'Disconnected';
    
    // Get workflow stats
    const enabledWorkflows = workflowManager.getEnabledWorkflows();
    
    // Return all stats
    res.json({
      uptime,
      platform,
      nodeVersion,
      cpuModel,
      cpu: cpuUsage,
      memory: memInfo,
      services: {
        whatsapp: whatsappStatus,
        nodeRed: nodeRedStatus,
        mqtt: mqttStatus
      },
      workflows: {
        enabled: enabledWorkflows.length,
        list: enabledWorkflows
      }
    });
  } catch (error) {
    console.error('Error getting system stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoints for workflow state management
app.post('/api/workflows/clear', async (req, res) => {
  try {
    await workflowManager.clearEnabledWorkflows();
    res.json({ success: true, message: 'All workflows cleared successfully' });
  } catch (error) {
    console.error('Error clearing workflows:', error);
    res.status(500).json({ error: `Failed to clear workflows: ${error.message}` });
  }
});

app.get('/api/workflows/state', (req, res) => {
  try {
    const enabledWorkflows = workflowManager.getEnabledWorkflows();
    res.json({
      success: true,
      enabledWorkflows,
      count: enabledWorkflows.length
    });
  } catch (error) {
    console.error('Error getting workflow state:', error);
    res.status(500).json({ error: `Failed to get workflow state: ${error.message}` });
  }
});

app.post('/api/workflows/save-state', async (req, res) => {
  try {
    await workflowManager.saveWorkflowState();
    res.json({ success: true, message: 'Workflow state saved successfully' });
  } catch (error) {
    console.error('Error saving workflow state:', error);
    res.status(500).json({ error: `Failed to save workflow state: ${error.message}` });
  }
});

app.post('/api/workflows/load-state', async (req, res) => {
  try {
    const success = await workflowManager.loadWorkflowState();
    if (success) {
      res.json({ success: true, message: 'Workflow state loaded successfully' });
    } else {
      res.json({ success: false, message: 'No workflow state found or failed to load' });
    }
  } catch (error) {
    console.error('Error loading workflow state:', error);
    res.status(500).json({ error: `Failed to load workflow state: ${error.message}` });
  }
});

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
    
    // Add showConfig flag from environment variables
    settings.showConfig = process.env.SHOW_CONFIG !== 'false'; // Default to true if not set
    
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

app.post('/api/settings', async (req, res) => {
  try {
    const commandHandler = require('./handlers/commandHandler');
    const newSettings = req.body;
    
    // Update settings and wait for completion
    const result = await commandHandler.updateSettings(newSettings);
    
    if (result && result.error) {
      console.error('Error updating settings:', result.error);
      return res.status(400).json({ success: false, error: result.error });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint for deleting profiles
app.post('/api/profile/delete', (req, res) => {
  try {
    const commandHandler = require('./handlers/commandHandler');
    const { profileName } = req.body;
    
    if (!profileName) {
      return res.status(400).json({ success: false, error: 'Profile name is required' });
    }
    
    // Prevent deletion of default profile
    if (profileName === 'default') {
      return res.status(400).json({ success: false, error: 'Cannot delete the default profile' });
    }
    
    // Delete the profile
    const result = commandHandler.deleteProfile(profileName);
    
    // Return updated settings
    const settings = commandHandler.getCurrentSettings();
    
    // Mask API keys for security
    if (settings.apiKeys && settings.apiKeys.openai) {
      settings.apiKeys.openai = '********';
    }
    if (settings.apiKeys && settings.apiKeys.openrouter) {
      settings.apiKeys.openrouter = '********';
    }
    
    res.json({
      success: true,
      message: result,
      settings: settings
    });
  } catch (error) {
    console.error('Error deleting profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent chats
app.get('/api/chats/recent', (req, res) => {
  try {
    const chatHandler = global.chatHandler || require('./handlers/chatHandler');
    const limit = parseInt(req.query.limit) || 5; // Default to 5 most recent chats
    
    console.log(`[API] Getting ${limit} most recent chats`);
    const recentChats = chatHandler.getRecentChats(limit);
    
    // Return the array of chats - already formatted by getRecentChats
    res.json(recentChats);
  } catch (error) {
    console.error('Error getting recent chats:', error);
    res.status(500).json({ 
      error: 'Failed to load recent chats',
      details: error.message 
    });
  }
});

// Get all chats with pagination and sorting
app.get('/api/chats', (req, res) => {
  try {
    const chatHandler = global.chatHandler || require('./handlers/chatHandler');
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
    const chatHandler = global.chatHandler || require('./handlers/chatHandler');
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
    const chatHandler = global.chatHandler || require('./handlers/chatHandler');
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

// Manual message sending endpoint
app.post('/api/chat/send-manual', express.json(), async (req, res) => {
  console.log('[Manual-Debug] === Manual message endpoint called ===');
  console.log('[Manual-Debug] Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { chatId, message, enableAI } = req.body;
    console.log('[Manual-Debug] Extracted values:', { chatId, message: message?.substring(0, 50) + '...', enableAI });
    
    if (!chatId || !message) {
      console.log('[Manual-Debug] Missing required parameters');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: chatId and message' 
      });
    }
    
    // Get the appropriate client based on chat ID format
    let client = null;
    let platform = 'whatsapp'; // default
    
    console.log('[Manual-Debug] Platform detection for chatId:', chatId);
    
    // Check for both telegram: and telegram_ formats
    if (chatId.startsWith('telegram:') || chatId.startsWith('telegram_')) {
      platform = 'telegram';
      console.log('[Manual-Debug] Detected platform: telegram');
      console.log('[Manual-Debug] global.telegramBot available:', !!global.telegramBot);
      client = global.telegramBot;
      if (!client) {
        console.log('[Manual-Debug] Telegram bot not available, returning error');
        return res.status(500).json({ success: false, error: 'Telegram bot not available' });
      }
    } else {
      console.log('[Manual-Debug] Detected platform: whatsapp');
      console.log('[Manual-Debug] global.whatsappClient available:', !!global.whatsappClient);
      console.log('[Manual-Debug] global.whatsappClient.client available:', !!global.whatsappClient?.client);
      client = global.whatsappClient?.client;
      if (!client) {
        console.log('[Manual-Debug] WhatsApp client not available, returning error');
        return res.status(500).json({ success: false, error: 'WhatsApp client not available' });
      }
    }
    
    // Strip platform prefix from chatId to prevent double prefixing
    // Handle both formats: 'whatsapp:id' and 'whatsapp_id' from frontend
    let cleanChatId = chatId;
    
    console.log(`[Manual-Debug] Original chatId: "${chatId}", platform: "${platform}"`);
    
    if (chatId.startsWith(`${platform}:`)) {
      cleanChatId = chatId.replace(`${platform}:`, '');
      console.log(`[Manual-Debug] Stripped colon prefix, cleanChatId: "${cleanChatId}"`);
    } else if (chatId.startsWith(`${platform}_`)) {
      cleanChatId = chatId.replace(`${platform}_`, '');
      console.log(`[Manual-Debug] Stripped underscore prefix, cleanChatId: "${cleanChatId}"`);
    } else {
      console.log(`[Manual-Debug] No prefix to strip, cleanChatId: "${cleanChatId}"`);
    }
    
    // Add message to chat history as assistant message
    if (global.chatHandler) {
      console.log(`[Manual-Debug] Calling addMessage with: cleanChatId="${cleanChatId}", platform="${platform}"`);
      global.chatHandler.addMessage(cleanChatId, 'assistant', message, platform);
    }
    
    // Send the message
    console.log('[Manual-Debug] About to send message via', platform);
    console.log('[Manual-Debug] Client type:', typeof client);
    console.log('[Manual-Debug] Client available methods:', Object.getOwnPropertyNames(client || {}).slice(0, 10));
    
    try {
      if (platform === 'telegram') {
        console.log(`[Manual-Debug] Sending to Telegram chatId: "${cleanChatId}"`);
        console.log('[Manual-Debug] Telegram client sendMessage method:', typeof client.sendMessage);
        await client.sendMessage(cleanChatId, message);
        console.log('[Manual-Debug] Telegram message sent successfully');
      } else {
        // For WhatsApp, use the cleaned chat ID and convert to proper format
        const whatsappChatId = cleanChatId.replace('_c.us', '@c.us');
        console.log(`[Manual-Debug] Sending to WhatsApp chatId: "${whatsappChatId}"`);
        console.log('[Manual-Debug] WhatsApp client sendMessage method:', typeof client.sendMessage);
        await client.sendMessage(whatsappChatId, message);
        console.log('[Manual-Debug] WhatsApp message sent successfully');
      }
      
      console.log(`[Manual] Message sent to ${chatId} via ${platform}, AI ${enableAI ? 'enabled' : 'disabled'}`);
      
      // If AI is enabled for this manual message, temporarily store the AI state
      // This will be used by the message handlers to determine if AI should respond
      if (enableAI) {
        // Store the AI enable state temporarily for this chat
        if (!global.manualMessageAIStates) {
          global.manualMessageAIStates = new Map();
        }
        global.manualMessageAIStates.set(chatId, { enabled: true, timestamp: Date.now() });
        
        // Clear the state after 30 seconds to prevent indefinite AI enabling
        setTimeout(() => {
          if (global.manualMessageAIStates) {
            global.manualMessageAIStates.delete(chatId);
          }
        }, 30000);
      }
      
      res.json({ 
        success: true, 
        message: 'Message sent successfully',
        aiEnabled: enableAI
      });
    } catch (sendError) {
      console.error('[Manual-Debug] Error sending manual message:');
      console.error('[Manual-Debug] Error name:', sendError.name);
      console.error('[Manual-Debug] Error message:', sendError.message);
      console.error('[Manual-Debug] Error stack:', sendError.stack);
      console.error('[Manual-Debug] Full error object:', sendError);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send message: ' + sendError.message 
      });
    }
    
  } catch (error) {
    console.error('[Manual-Debug] Error in manual message sending:');
    console.error('[Manual-Debug] Error name:', error.name);
    console.error('[Manual-Debug] Error message:', error.message);
    console.error('[Manual-Debug] Error stack:', error.stack);
    console.error('[Manual-Debug] Full error object:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error: ' + error.message 
    });
  }
});

// Clear all chats endpoint
app.post('/api/chats/clear', express.json(), async (req, res) => {
  try {
    const chatHandler = global.chatHandler || require('./handlers/chatHandler');
    
    // Check if clearAllChats method exists
    if (typeof chatHandler.clearAllChats === 'function') {
      chatHandler.clearAllChats();
      res.json({ success: true, message: 'All chat history cleared successfully' });
    } else {
      // Fallback: manually clear conversations
      chatHandler.conversations.clear();
      chatHandler.saveConversations();
      res.json({ success: true, message: 'All chat history cleared successfully (fallback method)' });
    }
  } catch (error) {
    console.error('Error clearing all chats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear chat history: ' + error.message 
    });
  }
});

// AI toggle state management endpoint
app.get('/api/chat/ai-states', (req, res) => {
  try {
    // Get all blocked chats from workflowManager
    const blockedChats = global.workflowManager ? global.workflowManager.getBlockedChats() : [];
    
    // Convert to states object (blocked = AI disabled)
    const statesObj = {};
    blockedChats.forEach(chatId => {
      statesObj[chatId] = false; // false = AI disabled (blocked)
    });
    
    res.json({ 
      success: true, 
      aiStates: statesObj 
    });
  } catch (error) {
    console.error('Error getting AI states:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get AI states: ' + error.message 
    });
  }
});

app.post('/api/chat/ai-states', express.json(), (req, res) => {
  try {
    const { chatId, enabled } = req.body;
    
    if (!chatId || typeof enabled !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: chatId and enabled (boolean)' 
      });
    }
    
    if (!global.workflowManager) {
      return res.status(500).json({ 
        success: false, 
        error: 'WorkflowManager not available' 
      });
    }
    
    // Use workflowManager to block/unblock chat
    if (enabled) {
      // AI enabled = unblock chat
      global.workflowManager.unblockChat(chatId);
    } else {
      // AI disabled = block chat
      global.workflowManager.blockChat(chatId);
    }
    
    console.log(`[AI Toggle] ${enabled ? 'Enabled' : 'Disabled'} AI for chat: ${chatId}`);
    
    res.json({ 
      success: true, 
      message: `AI ${enabled ? 'enabled' : 'disabled'} for chat ${chatId}`,
      chatId: chatId,
      enabled: enabled
    });
  } catch (error) {
    console.error('Error setting AI state:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to set AI state: ' + error.message 
    });
  }
});

// Get AI states for all chats
app.get('/api/chat/ai-states', (req, res) => {
  try {
    if (!global.workflowManager) {
      return res.status(500).json({ 
        success: false, 
        error: 'WorkflowManager not available' 
      });
    }
    
    // Get all blocked chats from workflowManager
    const blockedChats = global.workflowManager.getBlockedChats();
    const states = {};
    
    // Convert blocked chats to AI states (blocked = AI disabled)
    blockedChats.forEach(chatId => {
      // Remove normalization prefix to get original chat ID
      const originalChatId = chatId.replace('chat_whatsapp_', '');
      states[originalChatId] = false; // AI disabled
    });
    
    res.json({
      success: true,
      states: states
    });
  } catch (error) {
    console.error('Error getting AI states:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get AI states: ' + error.message 
    });
  }
});

// Get recent chats
app.get('/api/chats/recent', async (req, res) => {
  try {
    const chatHandler = require('./handlers/chatHandler');
    const fs = require('fs');
    const path = require('path');
    
    // Get all chat files
    const chatsDir = path.join(process.cwd(), 'data', 'chats');
    const chats = [];
    
    if (fs.existsSync(chatsDir)) {
      const files = fs.readdirSync(chatsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(chatsDir, file);
          const stats = fs.statSync(filePath);
          return {
            file: file,
            path: filePath,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.modified - a.modified) // Sort by most recent
        .slice(0, 20); // Get top 20 recent chats
      
      for (const fileInfo of files) {
        try {
          const chatData = JSON.parse(fs.readFileSync(fileInfo.path, 'utf8'));
          const chatId = fileInfo.file.replace('.json', '').replace(/[^a-zA-Z0-9@._:-]/g, ''); // Clean filename to get chat ID
          
          let lastMessage = 'No messages';
          let messageCount = 0;
          
          if (chatData && Array.isArray(chatData) && chatData.length > 0) {
            messageCount = chatData.length;
            const lastMsg = chatData[chatData.length - 1];
            if (lastMsg && lastMsg.content) {
              lastMessage = lastMsg.content;
            }
          }
          
          chats.push({
            chatId: chatId,
            lastMessage: lastMessage,
            messageCount: messageCount,
            lastModified: fileInfo.modified
          });
        } catch (parseError) {
          console.warn(`Failed to parse chat file ${fileInfo.file}:`, parseError.message);
        }
      }
    }
    
    res.json({
      success: true,
      chats: chats
    });
  } catch (error) {
    console.error('Error getting recent chats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent chats: ' + error.message
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

// Endpoint to toggle document enabled state for RAG
app.post('/api/kb/document/toggle', async (req, res) => {
  try {
    const { fileName, enabled } = req.body;
    
    if (!fileName) {
      return res.status(400).json({ success: false, error: 'Document name is required' });
    }
    
    const kbManager = require('./kb/kbManager');
    const result = await kbManager.toggleDocumentEnabled(fileName, enabled);
    res.json(result);
  } catch (error) {
    console.error('Error toggling document status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to toggle document enabled state for RAG
app.post('/api/kb/document/toggle', async (req, res) => {
  try {
    const { fileName, enabled } = req.body;
    
    if (!fileName) {
      return res.status(400).json({ success: false, error: 'Document name is required' });
    }
    
    const kbManager = require('./kb/kbManager');
    const result = await kbManager.toggleDocumentEnabled(fileName, enabled);
    res.json(result);
  } catch (error) {
    console.error('Error toggling document status:', error);
    res.status(500).json({ success: false, error: error.message });
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

// ===============================
// WORKFLOW ENDPOINTS
// ===============================

// Upload workflow files
app.post('/api/workflows/upload', upload.array('workflows'), async (req, res) => {
  console.log('[API] Workflow upload request received');
  res.setHeader('Content-Type', 'application/json');
  
  try {
    if (!req.files || req.files.length === 0) {
      console.log('[API] No workflow files uploaded');
      return res.status(400).json({ 
        success: false,
        error: 'No workflow files provided' 
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const file of req.files) {
      try {
        console.log(`[API] Processing workflow file: ${file.originalname}`);
        
        // Validate file type
        if (!file.originalname.toLowerCase().endsWith('.json')) {
          errors.push(`${file.originalname}: Only JSON files are allowed`);
          continue;
        }
        
        // Parse JSON content
        let workflowData;
        try {
          workflowData = JSON.parse(file.buffer.toString('utf8'));
        } catch (parseError) {
          errors.push(`${file.originalname}: Invalid JSON format - ${parseError.message}`);
          continue;
        }
        
        // Validate workflow structure
        if (!Array.isArray(workflowData)) {
          errors.push(`${file.originalname}: Workflow must be a JSON array of nodes`);
          continue;
        }
        
        // Find workflow ID from tab node or generate one
        let workflowId = null;
        const tabNode = workflowData.find(node => node.type === 'tab');
        if (tabNode) {
          workflowId = tabNode.id;
        } else {
          // Generate workflow ID from filename
          workflowId = file.originalname.replace('.json', '').replace(/[^a-zA-Z0-9-_]/g, '-');
        }
        
        // Save workflow to the workflow directory
        const fs = require('fs');
        const path = require('path');
        const workflowPath = path.join(__dirname, 'workflow', `${workflowId}.json`);
        
        // Create workflow directory if it doesn't exist
        const workflowDir = path.dirname(workflowPath);
        if (!fs.existsSync(workflowDir)) {
          fs.mkdirSync(workflowDir, { recursive: true });
        }
        
        // Write workflow file
        fs.writeFileSync(workflowPath, JSON.stringify(workflowData, null, 2));
        
        // Try to load the workflow into Node-RED if workflow manager is available
        if (global.workflowManager && global.workflowManager.initialized) {
          try {
            const loadResult = await global.workflowManager.loadWorkflowFromPath(workflowPath, workflowId);
            if (loadResult) {
              console.log(`[API] Successfully loaded workflow ${workflowId} into Node-RED`);
            } else {
              console.warn(`[API] Failed to load workflow ${workflowId} into Node-RED`);
            }
          } catch (loadError) {
            console.error(`[API] Error loading workflow ${workflowId} into Node-RED:`, loadError);
          }
        }
        
        results.push({
          filename: file.originalname,
          workflowId: workflowId,
          status: 'success',
          message: 'Workflow uploaded successfully'
        });
        
        console.log(`[API] Successfully uploaded workflow: ${file.originalname} -> ${workflowId}`);
        
      } catch (fileError) {
        console.error(`[API] Error processing workflow file ${file.originalname}:`, fileError);
        errors.push(`${file.originalname}: ${fileError.message}`);
      }
    }
    
    const response = {
      success: results.length > 0,
      uploaded: results.length,
      errors: errors.length,
      results: results
    };
    
    if (errors.length > 0) {
      response.errorDetails = errors;
    }
    
    console.log(`[API] Workflow upload completed: ${results.length} successful, ${errors.length} errors`);
    return res.json(response);
    
  } catch (error) {
    console.error('[API] Error uploading workflows:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to upload workflows',
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
      const { execSync } = require('child_process');
      
      // First try nvidia-smi for NVIDIA GPUs
      try {
        const nvidiaSmiOutput = execSync('nvidia-smi --query-gpu=name,memory.total,driver_version,utilization.gpu --format=csv,noheader,nounits', { encoding: 'utf8' });
        if (nvidiaSmiOutput && nvidiaSmiOutput.trim()) {
          // Parse nvidia-smi output
          const [name, memoryMB, driverVersion, usage] = nvidiaSmiOutput.trim().split(', ');
          
          gpuInfo = {
            model: name.trim(),
            vendor: 'NVIDIA',
            vram: parseInt(memoryMB.trim(), 10),
            driver: driverVersion.trim(),
            usage: parseInt(usage.trim(), 10)
          };
          
          // Successfully got GPU info from nvidia-smi
          return;
        }
      } catch (nvidiaSmiError) {
        // nvidia-smi not available or failed, try AMD next
      }
      
      // Try for AMD GPUs
      try {
        // Check if rocm-smi is available (AMD ROCm)
        const rocmSmiOutput = execSync('rocm-smi --showmeminfo vram --csv', { encoding: 'utf8' });
        if (rocmSmiOutput && rocmSmiOutput.trim()) {
          // Parse rocm-smi output - this is simplified and may need adjustment
          const lines = rocmSmiOutput.trim().split('\n');
          if (lines.length > 1) {
            const gpuLine = lines[1]; // Skip header
            const parts = gpuLine.split(',');
            
            // Try to get GPU name separately
            let gpuName = 'AMD GPU';
            try {
              const nameOutput = execSync('rocm-smi --showproductname', { encoding: 'utf8' });
              if (nameOutput) {
                const nameLine = nameOutput.trim().split('\n')[1]; // Skip header
                if (nameLine) gpuName = nameLine.trim();
              }
            } catch (e) {}
            
            // Get memory info - format varies, this is approximate
            let vramMB = 0;
            if (parts.length > 1) {
              const memoryPart = parts[1].trim();
              const memoryMatch = memoryPart.match(/(\d+)/);
              if (memoryMatch) vramMB = parseInt(memoryMatch[1], 10);
            }
            
            gpuInfo = {
              model: gpuName,
              vendor: 'AMD',
              vram: vramMB,
              driver: 'ROCm',
              usage: null // Would need additional parsing
            };
            
            return;
          }
        }
      } catch (amdError) {
        // AMD tools not available, continue with WMI
      }
      
      // On Windows, we can try to get GPU info from Windows Management Instrumentation
      if (os.platform() === 'win32') {
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

// Branding endpoints
app.get('/api/settings/branding', (req, res) => {
  try {
    // Default to true if SHOW_BRANDING is not set, otherwise use the value from environment
    const showBranding = process.env.SHOW_BRANDING === undefined ? true : process.env.SHOW_BRANDING === 'true';
    
    // If the environment variable is set to false, it will override any client-side setting
    if (process.env.SHOW_BRANDING === 'false') {
      return res.json({ enabled: false, fromEnv: true });
    }
    
    // Otherwise, respect the client's saved state
    res.json({ enabled: showBranding });
  } catch (error) {
    console.error('Error getting branding setting:', error);
    res.status(500).json({ error: 'Failed to get branding setting' });
  }
});

app.post('/api/settings/branding', express.json(), (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    // In a real app, you might want to save this to a database
    // For now, we'll just return the current state
    res.json({ success: true, enabled });
  } catch (error) {
    console.error('Error updating branding setting:', error);
    res.status(500).json({ error: 'Failed to update branding setting' });
  }
});

// Admin mode endpoints
app.post('/api/admin/login', express.json(), (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }
  
  const result = adminUtils.setAdminMode(true, password);
  if (result.success) {
    res.json({ success: true, message: 'Admin mode enabled' });
  } else {
    res.status(401).json(result);
  }
});

app.post('/api/admin/logout', (req, res) => {
  adminUtils.setAdminMode(false, '');
  res.json({ success: true, message: 'Admin mode disabled' });
});

app.get('/api/admin/status', (req, res) => {
  res.json({ 
    adminMode: adminUtils.isAdminMode(),
    authRequired: adminUtils.isAuthRequired()
  });
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

// Triggers API endpoints
app.get('/api/triggers', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const triggersPath = path.join(__dirname, 'config/triggers.json');
    
    // Check if file exists, create it if it doesn't
    if (!fs.existsSync(triggersPath)) {
      const defaultTriggers = {
        groupTriggers: ['bot', 'xeno', 'whatsxeno'],
        customTriggers: []
      };
      fs.writeFileSync(triggersPath, JSON.stringify(defaultTriggers, null, 2));
    }
    
    // Read triggers file
    const triggersData = fs.readFileSync(triggersPath, 'utf8');
    const triggers = JSON.parse(triggersData);
    
    res.json({ success: true, triggers });
  } catch (error) {
    console.error('Error getting triggers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/triggers', express.json(), (req, res) => {
  try {
    const { groupTriggers, customTriggers } = req.body;
    
    if (!Array.isArray(groupTriggers) || !Array.isArray(customTriggers)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid format. Both groupTriggers and customTriggers must be arrays.' 
      });
    }
    
    const fs = require('fs');
    const path = require('path');
    const triggersPath = path.join(__dirname, 'config/triggers.json');
    
    // Ensure config directory exists
    const configDir = path.join(__dirname, 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Write triggers to file
    fs.writeFileSync(triggersPath, JSON.stringify({ groupTriggers, customTriggers }, null, 2));
    
    res.json({ success: true, message: 'Triggers updated successfully' });
  } catch (error) {
    console.error('Error updating triggers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// For any non-API routes, serve the index.html file
app.get('*', (req, res, next) => {
  // Skip workflow paths - let Node-RED handle them
  if (req.path.startsWith('/workflow') || req.path.startsWith('/api/workflow')) {
    return next();
  }
  
  // Don't intercept API requests
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  
  // Serve the main app for all other routes
  res.sendFile(path.join(__dirname, 'gui/public/index.html'));
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected');
  
  // Send a test message to confirm connection
  setTimeout(() => {
    ws.send(JSON.stringify({
      type: 'connection_test',
      data: { message: 'WebSocket connection established' },
      timestamp: new Date().toISOString()
    }));
  }, 1000);
  
  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
  });
  
  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
  });
});

// Function to broadcast updates to all connected clients
function broadcastUpdate(type, data) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('[WebSocket] Error sending message:', error);
      }
    }
  });
}

// Make broadcast function globally available
global.broadcastUpdate = broadcastUpdate;

// Start server
server.listen(port, () => {
  console.log(`GUI server running on port ${port}`);
  console.log(`WebSocket server ready for real-time updates`);
});

// Handle errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Add error handling for unexpected errors
process.on('uncaughtException', (err) => {
console.error('Uncaught Exception in GUI server:', err);
});

// Export server and app for potential use in other modules
module.exports = {
server: server,
app: app
};
