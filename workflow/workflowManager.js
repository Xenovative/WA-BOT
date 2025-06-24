/**
 * Workflow Manager for WA-BOT
 * Manages integration between the chatbot and Node-RED workflow engine
 */
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const express = require('express');
const http = require('http');
const RED = require('node-red');
const aedes = require('aedes')();
const net = require('net');
const { exec } = require('child_process');
const { MessageMedia } = require('whatsapp-web.js');

class WorkflowManager extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
    this.workflowPort = process.env.WORKFLOW_PORT || 1880;
    this.mqttPort = process.env.MQTT_PORT || 1883;
    this.app = null;
    this.server = null;
    this.mqttServer = null;
    this.enabledWorkflows = [];
    this.mqtt = null;
    this.mqttConnected = false;
    this.stateFilePath = path.join(__dirname, 'workflow-state.json');
    this.profileStatePath = path.join(__dirname, 'workflow-profiles.json');
    this.currentProfile = 'default';
    this.profiles = {};
    
    this.settings = {
      flowFile: path.join(__dirname, '../.node-red/flows.json'),
      userDir: path.join(__dirname, '../.node-red/'),
      functionGlobalContext: {
        // Make core bot components available to Node-RED
        os: require('os'),
        process: process,
        // Will add bot components during initialization
      },
      editorTheme: {
        projects: {
          enabled: false
        }
      },
      // Disable authentication for development
      // adminAuth: {
      //   type: 'credentials',
      //   users: [{
      //     username: process.env.WORKFLOW_ADMIN_USER || 'admin',
      //     password: process.env.WORKFLOW_ADMIN_PASSWORD || 'password',
      //     permissions: '*'
      //   }]
      // },
      logging: {
        console: {
          level: 'info',
          metrics: false,
          audit: false
        }
      }
    };
    
    // Store available triggers and actions
    this.availableTriggers = {
      time: {
        description: 'Trigger workflow at specific times',
        params: ['cron', 'timezone']
      },
      keyword: {
        description: 'Trigger workflow when a message contains specific keywords',
        params: ['keywords', 'matchType']
      },
      file: {
        description: 'Trigger workflow when a file is created, modified, or deleted',
        params: ['path', 'event']
      }
    };
    
    this.availableActions = {
      sendMessage: {
        description: 'Send a WhatsApp message',
        params: ['recipient', 'message']
      },
      runCommand: {
        description: 'Run a system command',
        params: ['command', 'args']
      },
      processFile: {
        description: 'Process a file (move, copy, delete)',
        params: ['path', 'action', 'destination']
      }
    };
  }
  
  /**
   * Initialize the workflow manager and start Node-RED
   * @param {Object} botComponents - Core bot components to make available to workflows
   * @returns {Promise} - Resolves when initialization is complete
   */
  /**
   * Load saved state from disk
   * @private
   */
  async loadState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const stateData = fs.readFileSync(this.stateFilePath, 'utf8');
        const state = JSON.parse(stateData);
        
        if (state.enabledWorkflows) {
          this.enabledWorkflows = state.enabledWorkflows;
          console.log(`[WorkflowManager] Loaded ${this.enabledWorkflows.length} enabled workflows from state`);
        }
        
        if (state.currentProfile) {
          this.currentProfile = state.currentProfile;
          console.log(`[WorkflowManager] Loaded active profile: ${this.currentProfile}`);
        }
        
        if (state.profiles) {
          this.profiles = state.profiles;
          console.log(`[WorkflowManager] Loaded ${Object.keys(this.profiles).length} profiles`);
        }
        
        return true;
      }
      console.log('[WorkflowManager] No saved state found, starting fresh');
      return false;
    } catch (error) {
      console.error('[WorkflowManager] Error loading state:', error);
      return false;
    }
  }
  
  /**
   * Save current state to disk
   * @private
   * @returns {Promise<boolean>} - Success status
   */
  async saveState() {
    try {
      const state = {
        enabledWorkflows: this.enabledWorkflows,
        currentProfile: this.currentProfile,
        profiles: this.profiles,
        lastUpdated: new Date().toISOString()
      };
      
      // Create directory if it doesn't exist
      const dir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), 'utf8');
      console.log('[WorkflowManager] State saved successfully');
      return true;
    } catch (error) {
      console.error('[WorkflowManager] Error saving state:', error);
      return false;
    }
  }

  async initialize(botComponents) {
    if (this.initialized) {
      console.log('[WorkflowManager] Already initialized');
      return true;
    }
    
    console.log('[WorkflowManager] Initializing workflow manager...');
    
    try {
      // Store bot components
      this.botComponents = botComponents;
      
      // Load saved state
      await this.loadState();
      
      // Make bot components available globally
      if (!global.whatsappClient && botComponents.whatsappClient) {
        global.whatsappClient = botComponents.whatsappClient;
      }
      
      console.log('[WorkflowManager] Initializing workflow system...');
      
      // Store bot components in function context
      this.settings.functionGlobalContext.bot = botComponents;
      
      // Start MQTT broker
      await this.startMQTTBroker();
      
      // Create Express app
      this.app = express();
      this.server = http.createServer(this.app);
      
      // Initialize Node-RED
      RED.init(this.server, this.settings);
      
      // Serve UI files
      this.app.use(express.static(path.join(__dirname, 'public')));
      
      // Register custom nodes and API endpoints
      this.registerCustomNodes();
      
      // Start Node-RED
      await new Promise((resolve, reject) => {
        RED.start().then(() => {
          console.log('[WorkflowManager] Node-RED started');
          resolve();
        }).catch(err => {
          console.error('[WorkflowManager] Failed to start Node-RED:', err);
          reject(err);
        });
      });
      
      // Initialize MQTT client
      await this.initMQTT();
      
      // Start HTTP server
      await new Promise((resolve, reject) => {
        this.server.listen(this.workflowPort, () => {
          console.log(`[WorkflowManager] Workflow server running on port ${this.workflowPort}`);
          resolve();
        }).on('error', reject);
      });
      
      this.initialized = true;
      console.log('[WorkflowManager] Initialization complete');
      
      // Load any enabled workflows
      await this.loadEnabledWorkflows();
      
      return true;
    } catch (error) {
      console.error('[WorkflowManager] Initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Load all enabled workflows into Node-RED
   */
  async loadEnabledWorkflows() {
    if (!this.enabledWorkflows || this.enabledWorkflows.length === 0) {
      console.log('[WorkflowManager] No workflows to load');
      return;
    }
    
    console.log(`[WorkflowManager] Loading ${this.enabledWorkflows.length} enabled workflows...`);
    
    for (const workflowId of this.enabledWorkflows) {
      try {
        console.log(`[WorkflowManager] Loading workflow: ${workflowId}`);
        await this.loadWorkflowIntoNodeRED(workflowId);
      } catch (error) {
        console.error(`[WorkflowManager] Failed to load workflow ${workflowId}:`, error);
      }
    }
  }
  
  /**
   * Start a built-in MQTT broker
   */
  async startMQTTBroker() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[WorkflowManager] Starting built-in MQTT broker on port ${this.mqttPort}`);
        
        // Create the MQTT server
        this.mqttServer = net.createServer(aedes.handle);
        
        // Set up event handlers
        aedes.on('client', (client) => {
          console.log(`[MQTT] Client connected: ${client.id}`);
        });
        
        aedes.on('clientDisconnect', (client) => {
          console.log(`[MQTT] Client disconnected: ${client.id}`);
        });
        
        aedes.on('publish', (packet, client) => {
          if (client && packet.topic !== 'aedes/heartbeat') {
            console.log(`[MQTT] Client ${client.id} published to ${packet.topic}`);
          }
        });
        
        aedes.on('subscribe', (subscriptions, client) => {
          if (client) {
            console.log(`[MQTT] Client ${client.id} subscribed to ${subscriptions.map(s => s.topic).join(', ')}`);
          }
        });
        
        // Start the server
        this.mqttServer.listen(this.mqttPort, () => {
          console.log(`[WorkflowManager] MQTT broker running on port ${this.mqttPort}`);
          
          // Wait a moment to ensure the broker is fully ready
          setTimeout(() => {
            console.log('[WorkflowManager] MQTT broker ready for connections');
            resolve();
          }, 1000);
        });
        
        this.mqttServer.on('error', (err) => {
          console.error(`[WorkflowManager] MQTT broker error: ${err.message}`);
          // Don't reject as this might be non-fatal
          // Just continue without the built-in broker
          resolve();
        });
      } catch (error) {
        console.error(`[WorkflowManager] Failed to start MQTT broker: ${error.message}`);
        // Don't reject as this is non-fatal
        // Just continue without the built-in broker
        resolve();
      }
    });
  }

  /**
   * Set up API endpoints for Node-RED integration
   */
  registerCustomNodes() {
    try {
      console.log('[WorkflowManager] Setting up API endpoints for Node-RED integration');
      
      // Create API endpoints for Node-RED to interact with the WhatsApp bot
      this.app.post('/api/workflow/send-message', express.json(), async (req, res) => {
        try {
          // Support both recipient and chatId parameters for compatibility
          const { recipient, chatId, message, messageType = 'text' } = req.body;
          const targetId = chatId || recipient;
          
          if (!targetId || !message) {
            return res.status(400).json({ success: false, error: 'Missing required parameters: chatId/recipient or message' });
          }
          
          // Get WhatsApp client from global context or function context
          const whatsapp = global.whatsappClient || this.botComponents?.whatsappClient;
          
          if (!whatsapp) {
            return res.status(500).json({ success: false, error: 'WhatsApp client not available' });
          }
          
          let result;
          try {
            if (messageType === 'text') {
              result = await whatsapp.client.sendMessage(targetId, message);
            } else if (messageType === 'file' || messageType === 'image') {
              const { MessageMedia } = require('whatsapp-web.js');
              const media = MessageMedia.fromFilePath(message);
              result = await whatsapp.client.sendMessage(targetId, media);
            }
            
            console.log(`[WorkflowManager] Message sent to ${targetId}`);
          } catch (err) {
            console.error(`[WorkflowManager] Error sending message: ${err.message}`);
            throw err;
          }
          
          res.json({ success: true, messageId: result.id._serialized });
        } catch (error) {
          console.error('[WorkflowManager] Error sending message:', error);
          res.status(500).json({ success: false, error: error.message });
        }
      });
      
      // API endpoint to run a command
      this.app.post('/api/workflow/run-command', express.json(), async (req, res) => {
        try {
          const { command, args = [] } = req.body;
          
          if (!command) {
            return res.status(400).json({ success: false, error: 'Missing command parameter' });
          }
          
          exec(command, (error, stdout, stderr) => {
            if (error) {
              return res.status(500).json({ 
                success: false, 
                error: error.message,
                stderr,
                exitCode: error.code 
              });
            }
            
            res.json({ 
              success: true, 
              stdout, 
              stderr,
              exitCode: 0 
            });
          });
        } catch (error) {
          console.error('[WorkflowManager] Error running command:', error);
          res.status(500).json({ success: false, error: error.message });
        }
      });
      
      // API endpoint to process a file
      this.app.post('/api/workflow/process-file', express.json(), async (req, res) => {
        try {
          const { filename, action } = req.body;
          
          if (!filename || !action) {
            return res.status(400).json({ success: false, error: 'Missing required parameters' });
          }
          
          // Get knowledge base manager from global context
          const kbManager = global.kbManager;
          
          if (!kbManager) {
            return res.status(500).json({ success: false, error: 'Knowledge base manager not available' });
          }
          
          let result;
          if (action === 'add_to_kb') {
            result = await kbManager.addDocument(filename);
          } else if (action === 'delete_from_kb') {
            result = await kbManager.removeDocument(filename);
          } else {
            return res.status(400).json({ success: false, error: 'Invalid action' });
          }
          
          res.json({ success: true, result });
        } catch (error) {
          console.error('[WorkflowManager] Error processing file:', error);
          res.status(500).json({ success: false, error: error.message });
        }
      });
      
      console.log('[WorkflowManager] API endpoints for Node-RED integration set up successfully');
    } catch (error) {
      console.error('[WorkflowManager] Error setting up API endpoints:', error);
    }
  }
  
  /**
   * Initialize MQTT client for workflow triggers
   */
  async initMQTT() {
    try {
      const mqtt = require('mqtt');
      
      // Wait a moment for the MQTT broker to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Connect to MQTT broker with timeout and error handling
      console.log('[WorkflowManager] Connecting to MQTT broker...');
      
      // Set up connection options with timeout
      const connectOptions = {
        connectTimeout: 5000, // 5 second timeout
        reconnectPeriod: 10000, // Try to reconnect every 10 seconds
        clientId: `wa-bot-client-${Math.random().toString(16).substring(2, 10)}`,
      };
      
      // Create client but don't connect yet
      // Use localhost since that's what Node-RED is using
      this.mqttClient = mqtt.connect('mqtt://localhost:' + this.mqttPort, connectOptions);
      
      // Set up event handlers
      this.mqttClient.on('connect', () => {
        console.log('[WorkflowManager] Connected to MQTT broker');
        this.mqttConnected = true;
        console.log('[WorkflowManager] MQTT connection status: Connected');
      });
      
      this.mqttClient.on('error', (err) => {
        console.error('[WorkflowManager] MQTT error:', err);
        this.mqttConnected = false;
      });
      
      this.mqttClient.on('close', () => {
        console.log('[WorkflowManager] MQTT connection closed');
        this.mqttConnected = false;
      });
      
      // Set a timeout for the initial connection
      const connectTimeout = setTimeout(() => {
        if (!this.mqttConnected) {
          console.warn('[WorkflowManager] MQTT connection timed out. Workflows requiring MQTT will not function.');
          // Don't end the client as it will try to reconnect automatically
        }
      }, 5000);
      
      // Clear the timeout if connected
      this.mqttClient.on('connect', () => {
        clearTimeout(connectTimeout);
      });
      
    } catch (error) {
      console.error(`[WorkflowManager] Error initializing MQTT: ${error.message}`);
      console.log('[WorkflowManager] Workflows requiring MQTT will not function.');
    }
  }
  
  /**
   * Publish a WhatsApp message to MQTT for workflow triggers
   * @param {Object} message - The WhatsApp message object
   * @returns {boolean} - Success status
   */
  async publishWhatsAppMessage(message) {
    // Try to reconnect if not connected
    if (!this.mqttClient || !this.mqttConnected) {
      console.log('[WorkflowManager] MQTT not connected for publishing, attempting to reconnect...');
      
      try {
        // End existing client if any
        if (this.mqttClient) {
          this.mqttClient.end(true);
        }
        
        // Reinitialize MQTT
        await this.initMQTT();
        
        // Short wait for connection
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error('[WorkflowManager] Failed to reconnect to MQTT:', err.message);
      }
    }
    
    // Check again after reconnection attempt
    if (!this.mqttClient) {
      console.warn('[WorkflowManager] MQTT not initialized, cannot publish message');
      return false;
    }
    
    if (!this.mqttConnected) {
      console.warn('[WorkflowManager] MQTT still not connected after reconnection attempt, cannot publish message');
      return false;
    }
    
    try {
      // Format the message to match Node-RED flow expectations
      const mqttPayload = {
        chatId: message.chatId || message.from,
        text: message.body,
        from: message.from,
        timestamp: message.timestamp || Date.now(),
        type: message.type || 'text',
        // Include common WhatsApp message fields
        body: message.body,
        // Include the original message for reference
        originalMessage: message
      };
      
      // Publish to whatsapp/messages topic
      const payloadStr = JSON.stringify(mqttPayload);
      this.mqttClient.publish('whatsapp/messages', payloadStr, { qos: 1 });
      console.log(`[WorkflowManager] Published message to MQTT: ${message.body?.substring(0, 20)}...`);
      console.log(`[WorkflowManager] Message chatId: ${mqttPayload.chatId}`);
      console.log(`[WorkflowManager] Full MQTT payload: ${payloadStr}`);
      return true;
    } catch (error) {
      console.error(`[WorkflowManager] Error publishing message to MQTT: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Process a file using the workflow system
   * @param {string} filePath - Path to the file to process
   * @returns {Promise<boolean>} - Success status
   */
  async processFile(filePath) {
    try {
      console.log(`[WorkflowManager] Processing file: ${filePath}`);
      // Implementation will depend on how files should be processed
      return true;
    } catch (error) {
      console.error(`[WorkflowManager] Error processing file: ${error.message}`);
      return false;
    }
  }

  /**
   * Enable a workflow by ID
   * @param {string} workflowId - ID of the workflow to enable
   */
  async enableWorkflow(workflowId) {
    try {
      console.log(`[WorkflowManager] Enabling workflow: ${workflowId}`);
      
      // Check if already enabled
      if (this.enabledWorkflows.includes(workflowId)) {
        console.log(`[WorkflowManager] Workflow already enabled: ${workflowId}`);
        return true;
      }
      
      // Add to enabled workflows
      this.enabledWorkflows.push(workflowId);
      
      // Save state immediately
      await this.saveState();
      console.log(`[WorkflowManager] Saved state after enabling workflow: ${workflowId}`);
      
      // Load the workflow into Node-RED
      const loadSuccess = await this.loadWorkflowIntoNodeRED(workflowId);
      
      if (loadSuccess) {
        // Save state again after successful load
        await this.saveState();
        this.emit('workflow-enabled', workflowId);
        console.log(`[WorkflowManager] Workflow enabled and loaded successfully: ${workflowId}`);
        return true;
      } else {
        // If loading failed, rollback
        const index = this.enabledWorkflows.indexOf(workflowId);
        if (index !== -1) {
          this.enabledWorkflows.splice(index, 1);
          await this.saveState();
        }
        console.error(`[WorkflowManager] Failed to load workflow into Node-RED: ${workflowId}`);
        return false;
      }
    } catch (error) {
      console.error(`[WorkflowManager] Error enabling workflow ${workflowId}:`, error);
      // Ensure we don't leave the workflow in an inconsistent state
      const index = this.enabledWorkflows.indexOf(workflowId);
      if (index !== -1) {
        this.enabledWorkflows.splice(index, 1);
        await this.saveState();
      }
      return false;
    }
  }
  
  /**
   * Load a workflow file into Node-RED
   * @param {string} workflowId - ID of the workflow to load
   * @returns {Promise<boolean>} - Success status
   */
  async loadWorkflowIntoNodeRED(workflowId) {
    try {
      // Get the workflow file path - look directly in the workflow folder
      const workflowPath = path.join(__dirname, `${workflowId}.json`);
      
      // Check if file exists
      if (!fs.existsSync(workflowPath)) {
        console.error(`[WorkflowManager] Workflow file not found: ${workflowPath}`);
        
        // Try with CJDentalReply.json which is the known workflow
        const alternativePath = path.join(__dirname, 'CJDentalReply.json');
        if (fs.existsSync(alternativePath)) {
          console.log(`[WorkflowManager] Using alternative workflow file: ${alternativePath}`);
          return this.loadWorkflowFromPath(alternativePath, workflowId);
        }
        
        return false;
      }
      
      return this.loadWorkflowFromPath(workflowPath, workflowId);
    } catch (error) {
      console.error(`[WorkflowManager] Error loading workflow: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Load a workflow from a specific file path
   * @param {string} filePath - Path to the workflow file
   * @param {string} workflowId - ID to use for the workflow
   * @returns {Promise<boolean>} - Success status
   */
  async loadWorkflowFromPath(filePath, workflowId) {
    try {
      // Read the workflow file
      const workflowData = fs.readFileSync(filePath, 'utf8');
      let flowData;
      
      try {
        flowData = JSON.parse(workflowData);
        
        // Ensure the workflow ID matches what we expect
        // Find the tab node and update its ID if needed
        if (Array.isArray(flowData)) {
          const tabNode = flowData.find(node => node.type === 'tab');
          if (tabNode) {
            console.log(`[WorkflowManager] Found tab node with ID: ${tabNode.id}, updating to: ${workflowId}`);
            const originalId = tabNode.id;
            tabNode.id = workflowId;
            
            // Update all nodes that reference this tab
            flowData.forEach(node => {
              if (node.z === originalId) {
                node.z = workflowId;
              }
            });
          } else {
            console.warn(`[WorkflowManager] No tab node found in workflow file: ${filePath}`);
          }
        }
      } catch (err) {
        console.error(`[WorkflowManager] Invalid workflow file format: ${err.message}`);
        return false;
      }
      
      // Add the flow to Node-RED
      console.log(`[WorkflowManager] Loading workflow into Node-RED: ${workflowId}`);
      
      try {
        // Get current flows from Node-RED
        if (!RED || !RED.nodes) {
          console.error('[WorkflowManager] Node-RED not initialized, cannot load workflow');
          return false;
        }
        
        // Get current flows
        const currentFlows = RED.nodes.getFlows();
        if (!currentFlows || !currentFlows.flows) {
          console.error('[WorkflowManager] Could not get current flows from Node-RED');
          return false;
        }
        
        console.log(`[WorkflowManager] Current flows: ${currentFlows.flows.length} nodes`);
        
        // Check if this workflow is already loaded
        const existingTab = currentFlows.flows.find(node => node.id === workflowId && node.type === 'tab');
        if (existingTab) {
          console.log(`[WorkflowManager] Workflow ${workflowId} is already loaded in Node-RED`);
          return true;
        }
        
        // Prepare to add the new flow
        console.log(`[WorkflowManager] Adding workflow ${workflowId} to Node-RED`);
        
        // Combine current flows with the new flow
        const updatedFlows = [...currentFlows.flows, ...flowData];
        
        // Try multiple approaches to deploy the updated flows
        try {
          // Approach 1: With flows property and deployment type
          console.log('[WorkflowManager] Deploying workflow - approach 1');
          await RED.nodes.setFlows({
            flows: updatedFlows,
            deploymentType: 'full'
          });
          console.log('[WorkflowManager] Successfully deployed workflow with approach 1');
          return true;
        } catch (err1) {
          console.log(`[WorkflowManager] Approach 1 failed: ${err1.message}`);
          
          try {
            // Approach 2: Just with flows property
            console.log('[WorkflowManager] Deploying workflow - approach 2');
            await RED.nodes.setFlows({ flows: updatedFlows });
            console.log('[WorkflowManager] Successfully deployed workflow with approach 2');
            return true;
          } catch (err2) {
            console.log(`[WorkflowManager] Approach 2 failed: ${err2.message}`);
            
            try {
              // Approach 3: Just the array
              console.log('[WorkflowManager] Deploying workflow - approach 3');
              await RED.nodes.setFlows(updatedFlows);
              console.log('[WorkflowManager] Successfully deployed workflow with approach 3');
              return true;
            } catch (err3) {
              console.error(`[WorkflowManager] All approaches failed: ${err3.message}`);
              return false;
            }
          }
        }
      } catch (err) {
        console.error(`[WorkflowManager] Error deploying workflow: ${err.message}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`[WorkflowManager] Error loading workflow: ${error.message}`);
      return false;
    }
  }

  /**
   * Disable a workflow by ID
   * @param {string} workflowId - ID of the workflow to disable
   * @returns {Promise<boolean>} - Success status
   */
  async disableWorkflow(workflowId) {
    console.log(`[WorkflowManager] Disabling workflow: ${workflowId}`);
    
    try {
      // Check if workflow is already disabled
      const index = this.enabledWorkflows.indexOf(workflowId);
      if (index === -1) {
        console.log(`[WorkflowManager] Workflow ${workflowId} is not enabled`);
        return true; // Already disabled
      }
      
      // Remove from enabled workflows
      this.enabledWorkflows.splice(index, 1);
      console.log(`[WorkflowManager] Removed workflow ${workflowId} from enabled workflows`);
      
      // Save state immediately
      await this.saveState();
      console.log(`[WorkflowManager] Saved state after disabling workflow: ${workflowId}`);
      
      // Unload from Node-RED if available
      if (RED && RED.nodes) {
        try {
          await this.unloadWorkflowFromNodeRED(workflowId);
        } catch (err) {
          console.error(`[WorkflowManager] Error unloading workflow ${workflowId} from Node-RED:`, err);
        }
      }
      
      this.emit('workflow-disabled', workflowId);
      console.log(`[WorkflowManager] Successfully disabled workflow: ${workflowId}`);
      return true;
    } catch (error) {
      console.error(`[WorkflowManager] Error disabling workflow ${workflowId}:`, error);
      throw error; // Re-throw to allow caller to handle the error
    }
  }
  
  /**
   * Unload a workflow from Node-RED
   * @private
   * @param {string} workflowId - ID of the workflow to unload
   * @returns {Promise<boolean>} - Success status
   */
  async unloadWorkflowFromNodeRED(workflowId) {
    if (!RED || !RED.nodes) {
      console.log('[WorkflowManager] Node-RED not initialized, skipping unload');
      return false;
    }
    
    try {
      // Get current flows
      const flows = RED.nodes.getFlows();
      if (!flows || !flows.flows) {
        console.log('[WorkflowManager] No flows found in Node-RED');
        return false;
      }
      
      // Check if workflow exists
      const workflowTab = flows.flows.find(node => node.id === workflowId && node.type === 'tab');
      if (!workflowTab) {
        console.log(`[WorkflowManager] Workflow ${workflowId} not found in Node-RED`);
        return true; // Already unloaded
      }
      
      console.log(`[WorkflowManager] Found workflow tab: ${workflowId}, Label: ${workflowTab.label || 'Unnamed'}`);
      
      // Find all nodes belonging to this workflow
      const workflowNodes = flows.flows.filter(node => 
        node.z === workflowId || node.id === workflowId
      );
      
      if (workflowNodes.length === 0) {
        console.log(`[WorkflowManager] No nodes found for workflow ${workflowId}`);
        return true;
      }
      
      // Log node types being removed
      const nodeTypes = {};
      workflowNodes.forEach(node => {
        if (!nodeTypes[node.type]) nodeTypes[node.type] = 0;
        nodeTypes[node.type]++;
      });
      console.log(`[WorkflowManager] Node types to remove: ${JSON.stringify(nodeTypes)}`);
      
      // Create new flows array without the workflow nodes
      const updatedFlows = flows.flows.filter(node => 
        node.z !== workflowId && node.id !== workflowId
      );
      
      console.log(`[WorkflowManager] Deploying updated flows with ${updatedFlows.length} nodes`);
      
      // Attempt to deploy the updated flows
      await this.deployUpdatedFlows(updatedFlows, flows.rev);
      
      console.log(`[WorkflowManager] Successfully unloaded workflow ${workflowId} from Node-RED`);
      return true;
    } catch (error) {
      console.error(`[WorkflowManager] Error in unloadWorkflowFromNodeRED for ${workflowId}:`, error);
      throw error;
    }
  }
  
  /**
   * Deploy updated flows to Node-RED with retry logic
   * @private
   * @param {Array} updatedFlows - The updated flows array
   * @param {string} rev - The revision ID
   * @returns {Promise<void>}
   */
  async deployUpdatedFlows(updatedFlows, rev) {
    const deployAttempts = [
      // Try with full deployment info first
      async () => {
        console.log('[WorkflowManager] Attempting deployment with full config');
        return RED.nodes.setFlows({
          flows: updatedFlows,
          rev: rev || Date.now().toString(),
          deploymentType: 'full'
        });
      },
      // Fallback to minimal config
      async () => {
        console.log('[WorkflowManager] Attempting deployment with minimal config');
        return RED.nodes.setFlows({ flows: updatedFlows });
      },
      // Last resort - just the array
      async () => {
        console.log('[WorkflowManager] Attempting deployment with array only');
        return RED.nodes.setFlows(updatedFlows);
      }
    ];
    
    let lastError;
    for (let i = 0; i < deployAttempts.length; i++) {
      try {
        await deployAttempts[i]();
        console.log(`[WorkflowManager] Deployment successful with approach ${i + 1}`);
        return; // Success
      } catch (err) {
        lastError = err;
        console.warn(`[WorkflowManager] Deployment approach ${i + 1} failed:`, err.message);
      }
    }
    
    // If we get here, all deployment attempts failed
    throw lastError || new Error('All deployment attempts failed');
  }

  /**
   * Get list of enabled workflow IDs
   * @returns {string[]} - Array of enabled workflow IDs
   */
  getEnabledWorkflows() {
    return this.enabledWorkflows;
  }
  
  /**
   * Get list of active workflows in Node-RED
   * @returns {Promise<string[]>} - Array of active workflow IDs in Node-RED
   */
  async getActiveNodeREDWorkflows() {
    try {
      if (!RED || !RED.nodes) {
        console.log('[WorkflowManager] Node-RED not initialized, cannot get active workflows');
        return [];
      }
      
      // Get current flows from Node-RED
      const flows = RED.nodes.getFlows();
      if (!flows || !flows.flows) {
        console.log('[WorkflowManager] No flows found in Node-RED');
        return [];
      }
      
      // Find all tab nodes (workflows)
      const tabNodes = flows.flows.filter(node => node.type === 'tab');
      console.log(`[WorkflowManager] Found ${tabNodes.length} tabs in Node-RED`);
      
      // Return array of tab IDs
      return tabNodes.map(tab => tab.id);
    } catch (err) {
      console.error('[WorkflowManager] Error getting active Node-RED workflows:', err);
      return [];
    }
  }
  
  /**
   * Clear all enabled workflows
   * @returns {Promise<boolean>} - Success status
   */
  async clearEnabledWorkflows() {
    try {
      console.log('[WorkflowManager] Clearing all enabled workflows');
      
      // First, get all active workflows directly from Node-RED
      const activeWorkflows = await this.getActiveNodeREDWorkflows();
      console.log(`[WorkflowManager] Found ${activeWorkflows.length} active workflows in Node-RED`);
      
      // Disable all active workflows in Node-RED
      if (activeWorkflows.length > 0) {
        console.log(`[WorkflowManager] Disabling ${activeWorkflows.length} active Node-RED workflows...`);
        for (const workflowId of activeWorkflows) {
          try {
            await this.disableWorkflow(workflowId);
          } catch (err) {
            console.error(`[WorkflowManager] Error disabling active workflow ${workflowId}:`, err);
          }
        }
      }
      
      // Also disable any tracked workflows that might not be in Node-RED
      const workflowsToDisable = [...this.enabledWorkflows];
      if (workflowsToDisable.length > 0) {
        console.log(`[WorkflowManager] Disabling ${workflowsToDisable.length} tracked workflows...`);
        for (const workflowId of workflowsToDisable) {
          if (!activeWorkflows.includes(workflowId)) {
            try {
              await this.disableWorkflow(workflowId);
            } catch (err) {
              console.error(`[WorkflowManager] Error disabling tracked workflow ${workflowId}:`, err);
            }
          }
        }
      }
      
      // Force clear all flows in Node-RED as a guaranteed way to disable everything
      await this.forceClearAllFlows();
      
      // Clear the tracking array
      this.enabledWorkflows = [];
      
      // Save the updated state
      await this.saveWorkflowState();
      
      console.log('[WorkflowManager] All workflows cleared successfully');
      return true;
    } catch (error) {
      console.error(`[WorkflowManager] Error clearing workflows: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Save the current workflow state to disk
   * @returns {Promise<boolean>} - Success status
   */
  async saveWorkflowState() {
    try {
      const state = {
        enabledWorkflows: this.enabledWorkflows,
        lastUpdated: new Date().toISOString()
      };
      
      console.log(`[WorkflowManager] Saving workflow state: ${JSON.stringify(state)}`);
      console.log(`[WorkflowManager] Saving to path: ${this.stateFilePath}`);
      
      fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2));
      console.log(`[WorkflowManager] Workflow state saved successfully`);
      
      // Verify the file was written
      if (fs.existsSync(this.stateFilePath)) {
        const fileContent = fs.readFileSync(this.stateFilePath, 'utf8');
        console.log(`[WorkflowManager] Verified saved state: ${fileContent}`);
      } else {
        console.error(`[WorkflowManager] Failed to verify state file exists after save`);
      }
      
      return true;
    } catch (error) {
      console.error(`[WorkflowManager] Error saving workflow state: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Load workflow state from disk
   * @returns {Promise<boolean>} - Success status
   */
  async loadWorkflowState() {
    try {
      if (!fs.existsSync(this.stateFilePath)) {
        console.log('[WorkflowManager] No workflow state file found');
        return false;
      }
      
      console.log(`[WorkflowManager] Loading workflow state from: ${this.stateFilePath}`);
      const data = fs.readFileSync(this.stateFilePath, 'utf8');
      console.log(`[WorkflowManager] Raw workflow state data: ${data}`);
      
      const state = JSON.parse(data);
      
      if (state && Array.isArray(state.enabledWorkflows)) {
        this.enabledWorkflows = state.enabledWorkflows;
        console.log(`[WorkflowManager] Loaded workflow state: ${this.enabledWorkflows.length} enabled workflows`);
        console.log(`[WorkflowManager] Enabled workflows: ${JSON.stringify(this.enabledWorkflows)}`);
        return true;
      } else {
        console.log(`[WorkflowManager] Invalid workflow state format: ${JSON.stringify(state)}`);
      }
      
      return false;
    } catch (error) {
      console.error(`[WorkflowManager] Error loading workflow state: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Trigger a workflow by name with data
   * @param {string} triggerName - Name of the trigger
   * @param {Object} data - Data to pass to the workflow
   */
  triggerWorkflow(triggerName, data) {
    if (!this.initialized) {
      console.warn('[WorkflowManager] Cannot trigger workflow, not initialized');
      return;
    }
    
    console.log(`[WorkflowManager] Triggering workflow: ${triggerName}`);
    this.emit(`workflow:${triggerName}`, data);
  }
  
  /**
   * Process an incoming message to check for keyword triggers
   * @param {Object} message - WhatsApp message object
   * @param {string} chatId - Chat ID
   */
  processMessage(message, chatId) {
    if (!this.initialized) return;
    
    // Emit message event for keyword triggers
    this.emit('message', {
      text: message.body,
      chatId: chatId,
      message: message
    });
  }
  
  /**
   * Process a file event
   * @param {string} event - Event type (upload, delete, etc)
   * @param {Object} fileInfo - File information
   */
  processFileEvent(event, fileInfo) {
    if (!this.initialized) return;
    
    // Emit file event for file triggers
    this.emit('file', {
      event: event,
      file: fileInfo
    });
  }
  
  /**
   * Get all available triggers
   * @returns {Object} - Available triggers
   */
  getTriggers() {
    return this.availableTriggers;
  }
  
  /**
   * Get all available actions
   * @returns {Object} - Available actions
   */
  getActions() {
    return this.availableActions;
  }
  
  /**
   * Force clear all flows in Node-RED
   * This is a nuclear option that completely wipes all flows
   * @returns {Promise<boolean>} - Success status
   */
  async forceClearAllFlows() {
    try {
      if (!RED || !RED.nodes) {
        console.log('[WorkflowManager] Node-RED not initialized, cannot clear flows');
        return false;
      }
      
      console.log('[WorkflowManager] FORCE CLEARING ALL NODE-RED FLOWS');
      
      // Try multiple approaches to clear flows
      try {
        // Approach 1: Try the simplest possible empty array
        console.log('[WorkflowManager] Approach 1: Setting flows to empty array');
        await RED.nodes.setFlows([]);
        console.log('[WorkflowManager] Successfully cleared flows with approach 1');
        return true;
      } catch (err1) {
        console.log(`[WorkflowManager] Approach 1 failed: ${err1.message}`);
        
        try {
          // Approach 2: Try with an empty object with flows property
          console.log('[WorkflowManager] Approach 2: Setting flows with empty flows array');
          await RED.nodes.setFlows({ flows: [] });
          console.log('[WorkflowManager] Successfully cleared flows with approach 2');
          return true;
        } catch (err2) {
          console.log(`[WorkflowManager] Approach 2 failed: ${err2.message}`);
          
          try {
            // Approach 3: Try with a minimal valid flow configuration
            console.log('[WorkflowManager] Approach 3: Setting minimal valid flow config');
            await RED.nodes.setFlows({ flows: [], deploymentType: 'full' });
            console.log('[WorkflowManager] Successfully cleared flows with approach 3');
            return true;
          } catch (err3) {
            console.log(`[WorkflowManager] Approach 3 failed: ${err3.message}`);
            throw new Error('All approaches to clear flows failed');
          }
        }
      }
    } catch (error) {
      console.error(`[WorkflowManager] Error force clearing flows: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get all active workflows from Node-RED
   * @returns {Array} - Array of workflow IDs
   */
  async getActiveNodeREDWorkflows() {
    try {
      if (!RED || !RED.nodes) {
        console.log('[WorkflowManager] Node-RED not initialized, cannot get active workflows');
        return [];
      }
      
      // Get all flows from Node-RED
      const flows = RED.nodes.getFlows();
      if (!flows || !flows.flows || !Array.isArray(flows.flows)) {
        console.log('[WorkflowManager] No flows found in Node-RED');
        return [];
      }
      
      // Find all tab nodes (workflows)
      const tabNodes = flows.flows.filter(node => node.type === 'tab');
      console.log(`[WorkflowManager] Found ${tabNodes.length} workflow tabs in Node-RED`);
      
      // Log details about each tab
      tabNodes.forEach(tab => {
        console.log(`[WorkflowManager] Workflow tab: ${tab.id}, Label: ${tab.label || 'Unnamed'}, Disabled: ${tab.disabled || false}`);
        
        // Count nodes in this tab
        const tabNodes = flows.flows.filter(node => node.z === tab.id);
        console.log(`[WorkflowManager] Tab ${tab.id} has ${tabNodes.length} nodes`);
        
        // Log the first few nodes for debugging
        if (tabNodes.length > 0) {
          console.log(`[WorkflowManager] First node in tab ${tab.id}: Type=${tabNodes[0].type}, Name=${tabNodes[0].name || 'Unnamed'}`);
        }
      });
      
      // Return the IDs of all tab nodes
      return tabNodes.map(node => node.id);
    } catch (error) {
      console.error(`[WorkflowManager] Error getting active workflows: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Shutdown the workflow system
   */
  async shutdown() {
    console.log('[WorkflowManager] Shutting down workflow system...');
    
    try {
      // Explicitly check for the contact-info-flow that we know exists
      console.log('[WorkflowManager] Checking for contact-info-flow workflow...');
      try {
        if (RED && RED.nodes) {
          const flows = RED.nodes.getFlows();
          if (flows && flows.flows) {
            const contactInfoFlow = flows.flows.find(node => node.id === 'contact-info-flow');
            if (contactInfoFlow) {
              console.log('[WorkflowManager] Found contact-info-flow, explicitly disabling it');
              await this.disableWorkflow('contact-info-flow');
            }
          }
        }
      } catch (err) {
        console.error('[WorkflowManager] Error handling contact-info-flow:', err);
      }
      
      // Get all active workflows from Node-RED
      const activeWorkflows = await this.getActiveNodeREDWorkflows();
      console.log(`[WorkflowManager] Found ${activeWorkflows.length} active workflows in Node-RED`);
      
      // Disable all active workflows
      if (activeWorkflows.length > 0) {
        console.log(`[WorkflowManager] Disabling ${activeWorkflows.length} active workflows...`);
        
        for (const workflowId of activeWorkflows) {
          try {
            await this.disableWorkflow(workflowId);
            console.log(`[WorkflowManager] Successfully disabled workflow: ${workflowId}`);
          } catch (err) {
            console.error(`[WorkflowManager] Error disabling workflow ${workflowId}:`, err);
          }
        }
      } else {
        console.log('[WorkflowManager] No active workflows found in Node-RED');
      }
      
      // Also check our tracked enabled workflows
      if (this.enabledWorkflows && this.enabledWorkflows.length > 0) {
        console.log(`[WorkflowManager] Also disabling ${this.enabledWorkflows.length} tracked workflows...`);
        
        // Create a copy of the array since we'll be modifying it during iteration
        const workflowsToDisable = [...this.enabledWorkflows];
        
        for (const workflowId of workflowsToDisable) {
          if (!activeWorkflows.includes(workflowId)) {
            try {
              await this.disableWorkflow(workflowId);
              console.log(`[WorkflowManager] Successfully disabled tracked workflow: ${workflowId}`);
            } catch (err) {
              console.error(`[WorkflowManager] Error disabling tracked workflow ${workflowId}:`, err);
            }
          }
        }
      } else {
        console.log('[WorkflowManager] No additional tracked workflows to disable');
      }
      
      // Make sure workflow state is saved
      try {
        await this.saveWorkflowState();
        console.log('[WorkflowManager] Workflow state saved successfully');
      } catch (err) {
        console.error('[WorkflowManager] Error saving workflow state:', err);
      }
      
      // Force clear all flows as a final measure to ensure nothing is running
      try {
        await this.forceClearAllFlows();
        console.log('[WorkflowManager] All flows forcefully cleared during shutdown');
      } catch (err) {
        console.error('[WorkflowManager] Error force clearing flows during shutdown:', err);
      }
      
      // Close MQTT client if it exists
      if (this.mqttClient) {
        console.log('[WorkflowManager] Closing MQTT client...');
        this.mqttClient.end();
        this.mqttConnected = false;
      }
      
      // Close MQTT broker if it exists
      if (this.mqttServer && typeof this.mqttServer.close === 'function') {
        console.log('[WorkflowManager] Stopping MQTT broker...');
        await new Promise(resolve => this.mqttServer.close(resolve));
      }
      
      // Stop Node-RED if it's running
      if (RED && typeof RED.stop === 'function') {
        console.log('[WorkflowManager] Stopping Node-RED...');
        try {
          await RED.stop();
          console.log('[WorkflowManager] Node-RED stopped successfully');
        } catch (err) {
          console.warn('[WorkflowManager] Error stopping Node-RED:', err.message);
        }
      } else {
        console.log('[WorkflowManager] Node-RED not initialized or missing stop method');
      }
      
      this.initialized = false;
      console.log('[WorkflowManager] Workflow system shut down successfully');
    } catch (error) {
      console.error('[WorkflowManager] Error shutting down workflow system:', error);
      throw error;
    }
  }
}

module.exports = WorkflowManager;
