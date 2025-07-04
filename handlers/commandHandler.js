const chatHandler = require('./chatHandler');
const kbManager = require('../kb/kbManager');
const fs = require('fs');
const path = require('path');

class CommandHandler {
  constructor() {
    this.prefix = '!';
    
    // Authentication settings
    this.authRequired = process.env.COMMAND_AUTH_REQUIRED === 'true';
    this.adminPhoneNumbers = process.env.ADMIN_PHONE_NUMBERS 
      ? process.env.ADMIN_PHONE_NUMBERS.split(',').map(num => num.trim())
      : [];
      
    // Command history tracking
    this.commandHistory = [];
    this.commandHistoryFile = path.join(__dirname, '../data/command_history.json');
    this.loadCommandHistory();
    
    // Configuration profiles
    this.configProfiles = {};
    this.currentProfileName = 'default';
    this.configProfilesFile = path.join(__dirname, '../data/config_profiles.json');
    
    this.commands = {
      help: this.handleHelp,
      clear: this.handleClear,
      provider: this.handleProvider,
      model: this.handleModel,
      prompt: this.handleSystemPrompt,
      params: this.handleParams,
      param: this.handleSingleParam,
      mcp: this.handleMCP,
      listmcp: this.handleListMCP,
      rag: this.handleRAGToggle,
      kblist: this.handleKBList,
      kbdelete: this.handleKBDelete,
      citations: this.handleCitationsToggle,
      profile: this.handleProfile
    };
    
    // Load configuration profiles
    this.loadConfigProfiles();
    
    // Store current provider and model settings
    this.currentProvider = process.env.LLM_PROVIDER || 'openai';
    this.currentModel = this.getModelForProvider(this.currentProvider);
    
    // System prompt setting
    this.systemPrompt = process.env.DEFAULT_SYSTEM_PROMPT || 'You are a helpful WhatsApp assistant. Be concise in your responses.';
    
    // LLM parameters
    this.parameters = {
      temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7'),
      max_tokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '500'),
      top_p: parseFloat(process.env.DEFAULT_TOP_P || '1.0'),
      frequency_penalty: parseFloat(process.env.DEFAULT_FREQUENCY_PENALTY || '0.0'),
      presence_penalty: parseFloat(process.env.DEFAULT_PRESENCE_PENALTY || '0.0')
    };
    
    // MCP settings
    this.mcpServerName = process.env.MCP_SERVER_NAME || 'localhost:8080';
    this.mcpResourceUri = null;
    
    // RAG settings
    this.ragEnabled = process.env.KB_ENABLED === 'true';
    this.showCitations = process.env.KB_SHOW_CITATIONS === 'true';
  }

  /**
   * Check if a message is a command
   * @param {string} message - Message text
   * @returns {boolean} True if message is a command
   */
  isCommand(message) {
    return message.startsWith(this.prefix) && message.length > 1;
  }

  /**
   * Process a command message
   * @param {string} message - Command message
   * @param {string} chatId - Chat ID for context
   * @param {string} senderPhone - Phone number of the sender
   * @returns {Promise<string>} Response to the command
   */
  async processCommand(message, chatId, senderPhone) {
    // Check authentication if required
    if (this.authRequired) {
      // Format the phone number - remove any WhatsApp suffixes
      const cleanPhone = senderPhone.split('@')[0];
      
      // Check if sender is an admin
      if (!this.isAdmin(cleanPhone)) {
        // Only allow help command for non-admins
        if (!message.toLowerCase().startsWith('!help')) {
          return 'You are not authorized to use bot commands. Contact the bot administrator for access.';
        }
      }
    }
    
    const args = message.slice(this.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    
    // Add to command history
    this.commandHistory.push({
      timestamp: new Date().toISOString(),
      command: message,
      sender: senderPhone,
      chatId: chatId
    });
    
    // Limit history to last 50 commands
    if (this.commandHistory.length > 50) {
      this.commandHistory.shift();
    }
    
    // Save command history
    this.saveCommandHistory();
    
    if (this.commands[commandName]) {
      return await this.commands[commandName].call(this, args, chatId);
    }
    
    return `Unknown command: ${commandName}. Type !help for available commands.`;
  }
  
  /**
   * Check if a phone number is in the admin list
   * @param {string} phoneNumber - Phone number to check
   * @returns {boolean} - True if admin, false otherwise
   */
  isAdmin(phoneNumber) {
    // If no admins defined, everyone is allowed
    if (this.adminPhoneNumbers.length === 0) {
      return true;
    }
    
    return this.adminPhoneNumbers.includes(phoneNumber);
  }

  /**
   * Handle the help command
   * @returns {string} Help message
   */
  async handleHelp() {
    const paramsList = Object.entries(this.parameters)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
      
    const authStatus = this.authRequired ? 
      `

*Authentication:*
Command access restricted to authorized numbers: ${this.adminPhoneNumbers.length > 0 ? 'Yes' : 'No admins configured'}` : 
      '';
      
    return `*Available Commands:*
!help - Show this help message
!clear - Clear conversation history
!provider [name] - Get or set LLM provider (openai, openrouter, ollama, mcp)
!model [name] - Get or set model for current provider
!prompt [text] - Get or set system prompt
!params - Show all parameters
!param [name] [value] - Get or set a specific parameter
!mcp [uri] - Connect to MCP resource
!listmcp - List available MCP resources

*Knowledge Base Commands:*
!rag [on|off] - Enable/disable RAG functionality
!citations [on|off] - Enable/disable source citations
!kblist - List documents in knowledge base
!kbdelete [filename] - Delete document from knowledge base${authStatus}

*Current Settings:*
Provider: ${this.currentProvider}
Model: ${this.currentModel}
System Prompt: ${this.systemPrompt.substring(0, 50)}${this.systemPrompt.length > 50 ? '...' : ''}
Parameters: ${paramsList}
MCP URI: ${this.mcpResourceUri || 'Not set'}
RAG Enabled: ${this.ragEnabled ? 'Yes' : 'No'}
Show Citations: ${this.showCitations ? 'Yes' : 'No'}`;
  }

  /**
   * Handle the clear command to reset conversation
   * @param {Array} args - Command arguments
   * @param {string} chatId - Chat ID to clear
   * @returns {string} Confirmation message
   */
  async handleClear(args, chatId) {
    chatHandler.clearConversation(chatId);
    return 'Conversation history cleared!';
  }

  /**
   * Handle the provider command to change providers
   * @param {Array} args - Command arguments
   * @returns {string} Response message
   */
  async handleProvider(args) {
    if (args.length === 0) {
      return `Current LLM provider: ${this.currentProvider}`;
    }
    
    const newProvider = args[0].toLowerCase();
    const validProviders = ['openai', 'openrouter', 'ollama', 'mcp'];
    
    if (!validProviders.includes(newProvider)) {
      return `Invalid provider. Valid options are: ${validProviders.join(', ')}`;
    }
    
    // Special handling for MCP provider
    if (newProvider === 'mcp' && !this.mcpResourceUri) {
      return `To use MCP provider, first set an MCP resource with !mcp [uri]`;
    }
    
    this.currentProvider = newProvider;
    this.currentModel = this.getModelForProvider(newProvider);
    
    return `Provider changed to ${newProvider}. Default model set to ${this.currentModel}`;
  }

  /**
   * Handle the model command
   * @param {Array} args - Command arguments
   * @returns {string} Response message
   */
  async handleModel(args) {
    if (args.length === 0) {
      return `Current model for ${this.currentProvider}: ${this.currentModel}`;
    }
    
    this.currentModel = args[0];
    return `Model changed to ${this.currentModel} for provider ${this.currentProvider}`;
  }
  
  /**
   * Handle the system prompt command
   * @param {Array} args - Command arguments (joined as the new prompt)
   * @returns {string} Response message
   */
  async handleSystemPrompt(args) {
    if (args.length === 0) {
      return `Current system prompt: ${this.systemPrompt}`;
    }
    
    // Join all arguments back into a single string for the prompt
    this.systemPrompt = args.join(' ');
    return `System prompt updated to: ${this.systemPrompt}`;
  }
  
  /**
   * Handle the params command to display all parameters
   * @returns {string} Response message with all parameters
   */
  async handleParams() {
    const paramsList = Object.entries(this.parameters)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
      
    return `*Current Parameters:*\n${paramsList}`;
  }
  
  /**
   * Handle setting/getting a single parameter
   * @param {Array} args - Command arguments [name, value]
   * @returns {string} Response message
   */
  async handleSingleParam(args) {
    if (args.length === 0) {
      return 'Usage: !param [name] [value]';
    }
    
    const paramName = args[0].toLowerCase();
    
    // Check if parameter exists
    if (!this.parameters.hasOwnProperty(paramName)) {
      const validParams = Object.keys(this.parameters).join(', ');
      return `Invalid parameter: ${paramName}. Valid parameters are: ${validParams}`;
    }
    
    // Get parameter value if no new value provided
    if (args.length === 1) {
      return `${paramName} = ${this.parameters[paramName]}`;
    }
    
    // Set new parameter value
    try {
      const paramValue = parseFloat(args[1]);
      if (isNaN(paramValue)) {
        throw new Error('Parameter value must be a number');
      }
      
      // Parameter-specific validation
      if (paramName === 'temperature' && (paramValue < 0 || paramValue > 2)) {
        return 'Temperature must be between 0 and 2';
      } else if (paramName === 'max_tokens' && (paramValue < 1 || paramValue > 4000)) {
        return 'max_tokens must be between 1 and 4000';
      } else if ((paramName === 'top_p' || paramName === 'frequency_penalty' || paramName === 'presence_penalty') && 
                (paramValue < 0 || paramValue > 2)) {
        return `${paramName} must be between 0 and 2`;
      }
      
      this.parameters[paramName] = paramValue;
      return `${paramName} set to ${paramValue}`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }
  
  /**
   * Handle MCP resource selection
   * @param {Array} args - Command arguments [uri]
   * @returns {string} Response message
   */
  async handleMCP(args) {
    if (args.length === 0) {
      return `Current MCP resource: ${this.mcpResourceUri || 'Not set'}`;
    }
    
    // Set new MCP resource URI
    this.mcpResourceUri = args[0];
    return `MCP resource set to: ${this.mcpResourceUri}`;
  }
  
  /**
   * Handle listing MCP resources
   * @returns {string} Response message with available resources
   */
  async handleListMCP() {
    // This function would use the list_resources tool to get actual resources
    // For now, we'll return a placeholder message
    return `To list MCP resources, please use the server name with the list_resources tool in your code. Current server: ${this.mcpServerName}`;
  }

  /**
   * Get the default model for a provider
   * @param {string} provider - Provider name
   * @returns {string} Default model name
   */
  getModelForProvider(provider) {
    switch (provider) {
      case 'openai':
        return process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
      case 'openrouter':
        return process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';
      case 'ollama':
        return process.env.OLLAMA_MODEL || 'mannix/llama3.1-8b-abliterated:latest';
      case 'mcp':
        return 'mcp-default'; // MCP doesn't really use models in the same way
      default:
        return 'gpt-3.5-turbo';
    }
  }
  
  /**
   * Handle the RAG toggle command
   * @param {Array} args - Command arguments
   * @returns {string} Response message
   */
  async handleRAGToggle(args) {
    if (args.length === 0) {
      return `RAG functionality is currently ${this.ragEnabled ? 'enabled' : 'disabled'}`;
    }
    
    const action = args[0].toLowerCase();
    if (action === 'on' || action === 'true') {
      this.ragEnabled = true;
      return 'RAG functionality enabled';
    } else if (action === 'off' || action === 'false') {
      this.ragEnabled = false;
      return 'RAG functionality disabled';
    } else {
      return 'Invalid option. Use !rag on or !rag off';
    }
  }
  
  /**
   * Handle listing documents in the knowledge base
   * @returns {string} Response with document list
   */
  async handleKBList() {
    try {
      const documents = await kbManager.listDocuments();
      
      if (documents.length === 0) {
        return 'No documents found in knowledge base.';
      }
      
      return `*Documents in Knowledge Base:*\n${documents.map((doc, i) => `${i+1}. ${doc}`).join('\n')}`;
    } catch (error) {
      return `Error listing documents: ${error.message}`;
    }
  }
  
  /**
   * Handle deleting a document from the knowledge base
   * @param {Array} args - Command arguments [filename]
   * @returns {string} Response message
   */
  async handleKBDelete(args) {
    if (args.length === 0) {
      return 'Usage: !kbdelete [filename]';
    }
    
    const filename = args[0];
    try {
      const result = await kbManager.deleteDocument(filename);
      return result.message;
    } catch (error) {
      return `Error deleting document: ${error.message}`;
    }
  }
  
  /**
   * Handle enabling/disabling citations
   * @param {Array} args - Command arguments [on|off]
   * @returns {string} Response message
   */
  async handleCitationsToggle(args) {
    if (args.length === 0) {
      return `Citations are currently ${this.showCitations ? 'enabled' : 'disabled'}`;
    }
    
    const action = args[0].toLowerCase();
    if (action === 'on' || action === 'true' || action === 'enable') {
      this.showCitations = true;
      process.env.KB_SHOW_CITATIONS = 'true';
      return 'Citations enabled';
    } else if (action === 'off' || action === 'false' || action === 'disable') {
      this.showCitations = false;
      process.env.KB_SHOW_CITATIONS = 'false';
      return 'Citations disabled';
    } else {
      return `Invalid option. Use 'on' or 'off'.`;
    }
  }
  
  /**
   * Handle profile command to manage configuration profiles
   * @param {Array} args - Command arguments
   * @returns {string} Response message
   */
  async handleProfile(args) {
    if (args.length === 0) {
      // List available profiles
      const profiles = Object.keys(this.configProfiles);
      return `Current profile: ${this.currentProfileName}\nAvailable profiles: ${profiles.join(', ') || 'None'}`;
    }
    
    const action = args[0].toLowerCase();
    
    if (action === 'save' || action === 'create') {
      // Save current settings as a profile
      if (args.length < 2) {
        return 'Usage: !profile save [name]';
      }
      
      const profileName = args[1];
      return this.saveProfile(profileName);
    } 
    else if (action === 'load' || action === 'switch') {
      // Load a profile
      if (args.length < 2) {
        return 'Usage: !profile load [name]';
      }
      
      const profileName = args[1];
      return this.loadProfile(profileName);
    }
    else if (action === 'delete' || action === 'remove') {
      // Delete a profile
      if (args.length < 2) {
        return 'Usage: !profile delete [name]';
      }
      
      const profileName = args[1];
      return this.deleteProfile(profileName);
    }
    else {
      // Assume it's a profile name to load
      return this.loadProfile(action);
    }
  }
  
  /**
   * Get current provider and model
   * @returns {Object} Current settings
   */
  getCurrentSettings() {
    return {
      provider: this.currentProvider,
      model: this.currentModel,
      systemPrompt: this.systemPrompt,
      parameters: { ...this.parameters },
      mcpResourceUri: this.mcpResourceUri,
      ragEnabled: this.ragEnabled,
      showCitations: this.showCitations,
      apiKeys: {
        openai: process.env.OPENAI_API_KEY || '',
        openrouter: process.env.OPENROUTER_API_KEY || ''
      },
      currentProfileName: this.currentProfileName,
      availableProfiles: Object.keys(this.configProfiles)
    };
  }
  
  /**
   * Update settings from API request
   * @param {Object} newSettings - New settings to apply
   */
  updateSettings(newSettings) {
    if (newSettings.provider) {
      this.currentProvider = newSettings.provider;
    }
    
    if (newSettings.model) {
      this.currentModel = newSettings.model;
    }
    
    if (newSettings.systemPrompt) {
      this.systemPrompt = newSettings.systemPrompt;
    }
    
    if (newSettings.parameters) {
      this.parameters = { ...this.parameters, ...newSettings.parameters };
    }
    
    if (newSettings.mcpResourceUri !== undefined) {
      this.mcpResourceUri = newSettings.mcpResourceUri;
    }
    
    if (newSettings.ragEnabled !== undefined) {
      this.ragEnabled = newSettings.ragEnabled;
    }
    
    if (newSettings.showCitations !== undefined) {
      this.showCitations = newSettings.showCitations;
    }
    
    if (newSettings.profileName) {
      if (this.configProfiles[newSettings.profileName]) {
        this.loadProfile(newSettings.profileName);
      } else if (newSettings.saveAsProfile) {
        this.saveProfile(newSettings.profileName);
      }
    }
    
    // Save current settings as the active profile
    if (this.currentProfileName) {
      this.saveProfile(this.currentProfileName, false);
    }
  }
  
  /**
   * Get command history
   * @returns {Array} Array of command history objects
   */
  getCommandHistory() {
    return this.commandHistory;
  }
  
  /**
   * Save command history to disk
   */
  saveCommandHistory() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.commandHistoryFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.commandHistoryFile, JSON.stringify(this.commandHistory, null, 2));
    } catch (error) {
      console.error('Error saving command history:', error);
    }
  }
  
  // Load command history from disk
  loadCommandHistory() {
    try {
      if (fs.existsSync(this.commandHistoryFile)) {
        const data = fs.readFileSync(this.commandHistoryFile, 'utf8');
        this.commandHistory = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading command history:', error);
      this.commandHistory = [];
    }
  }
  
  /**
   * Load configuration profiles from file
   */
  loadConfigProfiles() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.configProfilesFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      if (fs.existsSync(this.configProfilesFile)) {
        const data = fs.readFileSync(this.configProfilesFile, 'utf8');
        this.configProfiles = JSON.parse(data);
        
        // Load the default profile if it exists and we don't have a current profile
        if (this.configProfiles.default && !this.configProfiles[this.currentProfileName]) {
          this.loadProfile('default', false);
        }
      } else {
        // Create a default profile with current settings
        this.saveProfile('default', false);
      }
    } catch (error) {
      console.error('Error loading configuration profiles:', error);
      this.configProfiles = {};
      // Create a default profile with current settings
      this.saveProfile('default', false);
    }
  }
  
  /**
   * Save configuration profiles to file
   */
  saveConfigProfiles() {
    try {
      fs.writeFileSync(this.configProfilesFile, JSON.stringify(this.configProfiles, null, 2));
    } catch (error) {
      console.error('Error saving configuration profiles:', error);
    }
  }
  
  /**
   * Save current settings as a profile
   * @param {string} profileName - Name of the profile to save
   * @param {boolean} updateCurrent - Whether to update current profile name
   * @returns {string} Response message
   */
  saveProfile(profileName, updateCurrent = true) {
    try {
      // Get current settings
      const settings = {
        provider: this.currentProvider,
        model: this.currentModel,
        systemPrompt: this.systemPrompt,
        parameters: { ...this.parameters },
        mcpServerName: this.mcpServerName,
        mcpResourceUri: this.mcpResourceUri,
        ragEnabled: this.ragEnabled,
        showCitations: this.showCitations
      };
      
      // Save to profiles
      this.configProfiles[profileName] = settings;
      this.saveConfigProfiles();
      
      if (updateCurrent) {
        this.currentProfileName = profileName;
      }
      
      return `Settings saved as profile '${profileName}'`;
    } catch (error) {
      console.error('Error saving profile:', error);
      return `Error saving profile: ${error.message}`;
    }
  }
  
  /**
   * Load a profile
   * @param {string} profileName - Name of the profile to load
   * @returns {string} Response message
   */
  loadProfile(profileName) {
    try {
      if (!this.configProfiles[profileName]) {
        return `Profile '${profileName}' not found`;
      }
      
      const profile = this.configProfiles[profileName];
      
      // Apply settings
      this.currentProvider = profile.provider || this.currentProvider;
      this.currentModel = profile.model || this.currentModel;
      this.systemPrompt = profile.systemPrompt || this.systemPrompt;
      this.parameters = { ...this.parameters, ...profile.parameters };
      this.mcpServerName = profile.mcpServerName || this.mcpServerName;
      this.mcpResourceUri = profile.mcpResourceUri || this.mcpResourceUri;
      this.ragEnabled = profile.ragEnabled !== undefined ? profile.ragEnabled : this.ragEnabled;
      this.showCitations = profile.showCitations !== undefined ? profile.showCitations : this.showCitations;
      
      // Update current profile name
      this.currentProfileName = profileName;
      
      return `Loaded profile '${profileName}'`;
    } catch (error) {
      console.error('Error loading profile:', error);
      return `Error loading profile: ${error.message}`;
    }
  }
  
  /**
   * Delete a profile
   * @param {string} profileName - Name of the profile to delete
   * @returns {string} Response message
   */
  deleteProfile(profileName) {
    try {
      if (profileName === 'default') {
        return `Cannot delete the default profile`;
      }
      
      if (!this.configProfiles[profileName]) {
        return `Profile '${profileName}' not found`;
      }
      
      // Delete the profile
      delete this.configProfiles[profileName];
      this.saveConfigProfiles();
      
      // If current profile was deleted, switch to default
      if (this.currentProfileName === profileName) {
        this.currentProfileName = 'default';
        if (this.configProfiles.default) {
          this.loadProfile('default');
        }
      }
      
      return `Deleted profile '${profileName}'`;
    } catch (error) {
      console.error('Error deleting profile:', error);
      return `Error deleting profile: ${error.message}`;
    }
  }
}

module.exports = new CommandHandler();
