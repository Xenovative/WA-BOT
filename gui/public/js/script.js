// Main script.js file for WhatsXENO Management Console

// WebSocket connection for real-time updates
let ws = null;
let wsReconnectInterval = null;

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = function() {
      console.log('[WebSocket] Connected to server');
      clearInterval(wsReconnectInterval);
      wsReconnectInterval = null;
      updateConnectionStatus(true);
    };
    
    ws.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    };
    
    ws.onclose = function() {
      console.log('[WebSocket] Connection closed');
      updateConnectionStatus(false);
      // Attempt to reconnect every 5 seconds
      if (!wsReconnectInterval) {
        wsReconnectInterval = setInterval(initWebSocket, 5000);
      }
    };
    
    ws.onerror = function(error) {
      console.error('[WebSocket] Error:', error);
    };
  } catch (error) {
    console.error('[WebSocket] Failed to create connection:', error);
  }
}

function handleWebSocketMessage(data) {
  console.log('[WebSocket] Received:', data);
  
  switch (data.type) {
    case 'chat_message':
      console.log('[WebSocket] Processing chat_message event');
      
      // Show a brief visual indicator for new message
      showNewMessageIndicator(data.data);
      
      // Refresh the chat list when a new message is received
      console.log('[WebSocket] Refreshing chat list...');
      try {
        // Call the function directly since it's in global scope
        window.loadRecentChats();
        console.log('[WebSocket] Chat list refreshed successfully');
      } catch (error) {
        console.error('[WebSocket] Error refreshing chat list:', error);
      }
      
      // If we're currently viewing this chat, refresh the conversation with the new message
      console.log('[WebSocket] Checking for refreshCurrentChatOptimized function:', typeof refreshCurrentChatOptimized);
      if (typeof refreshCurrentChatOptimized === 'function') {
        console.log('[WebSocket] Calling refreshCurrentChatOptimized for:', data.data.chatId);
        // Pass the new message data for optimized append
        refreshCurrentChatOptimized(data.data.chatId, data.data.message);
      } else if (typeof refreshCurrentChat === 'function') {
        console.log('[WebSocket] Falling back to refreshCurrentChat for:', data.data.chatId);
        refreshCurrentChat(data.data.chatId);
      }
      break;
    case 'connection_test':
      console.log('[WebSocket] Connection test received:', data.data.message);
      break;
    default:
      console.log('[WebSocket] Unknown message type:', data.type);
  }
}

function showNewMessageIndicator(messageData) {
  // Create a temporary notification
  const notification = document.createElement('div');
  notification.className = 'alert alert-info alert-dismissible fade show position-fixed';
  notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 300px;';
  notification.innerHTML = `
    <small><strong>New Message</strong></small><br>
    <small>Chat: ${messageData.chatId.replace(/^(whatsapp|telegram):/, '')}</small>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

function updateConnectionStatus(connected) {
  // Find or create connection status indicator
  let statusIndicator = document.getElementById('ws-connection-status');
  if (!statusIndicator) {
    statusIndicator = document.createElement('div');
    statusIndicator.id = 'ws-connection-status';
    statusIndicator.className = 'position-fixed';
    statusIndicator.style.cssText = 'bottom: 20px; right: 20px; z-index: 9998;';
    document.body.appendChild(statusIndicator);
  }
  
  if (connected) {
    statusIndicator.innerHTML = `
      <span class="badge bg-success">
        <i class="fas fa-wifi"></i> Live Updates Active
      </span>
    `;
    // Hide after 2 seconds when connected
    setTimeout(() => {
      if (statusIndicator.style.display !== 'none') {
        statusIndicator.style.display = 'none';
      }
    }, 2000);
  } else {
    statusIndicator.style.display = 'block';
    statusIndicator.innerHTML = `
      <span class="badge bg-warning">
        <i class="fas fa-wifi"></i> Reconnecting...
      </span>
    `;
  }
}

// Initialize WebSocket connection when page loads
document.addEventListener('DOMContentLoaded', function() {
  initWebSocket();
});

// DOM elements
const refreshBtn = document.getElementById('refresh-btn');
const connectionStatus = document.getElementById('connection-status');
const botStatusElement = document.getElementById('bot-status');
const currentModelElement = document.getElementById('current-model');
const ragStatusElement = document.getElementById('rag-status');
const providerElement = document.getElementById('provider');
const settingsForm = document.getElementById('settings-form');
const providerSelect = document.getElementById('provider-select');
const modelInput = document.getElementById('model-input');
const ragEnabledCheckbox = document.getElementById('rag-enabled');
const systemPromptTextarea = document.getElementById('system-prompt');
const chatsTableBody = document.getElementById('chats-table-body');
const kbTableBody = document.getElementById('kb-table-body');
const refreshKbBtn = document.getElementById('refresh-kb');
const kbFileInput = document.getElementById('kb-file-input');
const uploadForm = document.getElementById('upload-form');
const commandHistoryBody = document.getElementById('command-history-body');
const refreshDashboardBtn = document.getElementById('refresh-dashboard');

// API key elements
const openaiApiKeyInput = document.getElementById('openai-api-key');
const openrouterApiKeyInput = document.getElementById('openrouter-api-key');
const toggleVisibilityButtons = document.querySelectorAll('.toggle-visibility');
const configSection = document.getElementById('config-section');

// Upload state
let isUploading = false;

// System stats elements
const uptimeValue = document.getElementById('uptime-value');
const heapUsedValue = document.getElementById('heap-used');
const cpuUsageValue = document.getElementById('cpu-usage');
const platformInfoValue = document.getElementById('platform-info');
const nodeVersionElement = document.getElementById('node-version');
const systemPlatformElement = document.getElementById('system-platform');
const systemUptimeElement = document.getElementById('system-uptime');
const memoryRssElement = document.getElementById('memory-rss');
const memoryHeapTotalElement = document.getElementById('memory-heap-total');
const memoryHeapUsedElement = document.getElementById('memory-heap-used');
const memoryExternalElement = document.getElementById('memory-external');

// Chart context
let memoryChart;

// Profile management functions
function saveSelectedProfile(profileName) {
  try {
    localStorage.setItem('selectedProfile', profileName);
    return true;
  } catch (e) {
    console.error('Error saving selected profile:', e);
    return false;
  }
}

function getSelectedProfile() {
  try {
    return localStorage.getItem('selectedProfile') || 'default';
  } catch (e) {
    console.error('Error loading selected profile:', e);
    return 'default';
  }
}

async function saveProfile(profileName) {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        profileName: profileName,
        saveAsProfile: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save profile: ${response.statusText}`);
    }
    
    const result = await response.json();
    showToast(`Profile '${profileName}' saved successfully`, 'success');
    loadSettings(); // Refresh settings to update profile list
    return result;
  } catch (error) {
    console.error('Error saving profile:', error);
    showToast(`Error saving profile: ${error.message}`, 'danger');
    throw error;
  }
}

async function loadProfile(profileName) {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        profileName: profileName
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load profile: ${response.statusText}`);
    }
    
    const result = await response.json();
    showToast(`Profile '${profileName}' loaded successfully`, 'success');
    loadSettings(); // Refresh settings with new profile data
    return result;
  } catch (error) {
    console.error('Error loading profile:', error);
    showToast(`Error loading profile: ${error.message}`, 'danger');
    throw error;
  }
}

async function deleteProfile(profileName) {
  if (profileName === 'default') {
    showToast('Cannot delete the default profile', 'warning');
    return;
  }
  
  try {
    const response = await fetch('/api/profile/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        profileName: profileName
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete profile: ${response.statusText}`);
    }
    
    const result = await response.json();
    showToast(`Profile '${profileName}' deleted successfully`, 'success');
    loadSettings(); // Refresh settings to update profile list
    return result;
  } catch (error) {
    console.error('Error deleting profile:', error);
    showToast(`Error deleting profile: ${error.message}`, 'danger');
    throw error;
  }
}

// Global state variables
window.chatHistoryState = { loading: false };
window.commandHistoryState = { loading: false };
window.currentTriggers = { groupTriggers: [], customTriggers: [] };
window.currentApp = 'whatsapp'; // Default to WhatsApp
window.qrCodeInterval = null; // For QR code refresh interval

// Initialization
// Save active tab to localStorage
function saveActiveTab(tabId) {
  try {
    localStorage.setItem('activeTab', tabId);
  } catch (e) {
    console.error('Error saving tab state:', e);
  }
}

// Load and activate the saved tab
function loadActiveTab() {
  try {
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) {
      const targetTab = document.querySelector(`a[href="#${savedTab}"][data-bs-toggle="tab"]`);
      if (targetTab) {
        const tab = new bootstrap.Tab(targetTab);
        tab.show();
        return true;
      }
    }
  } catch (e) {
    console.error('Error loading tab state:', e);
  }
  return false;
}

// Initialize tab state persistence
function initTabPersistence() {
  const tabElements = document.querySelectorAll('a[data-bs-toggle="tab"]');
  tabElements.forEach(tab => {
    // Save active tab when a tab is shown
    tab.addEventListener('shown.bs.tab', (e) => {
      const targetId = e.target.getAttribute('href').substring(1);
      saveActiveTab(targetId);
      
      // Handle tab-specific initialization
      switch(targetId) {
        case 'chats':
          loadChats();
          break;
        case 'kb':
          loadKbDocuments();
          break;
        case 'commands':
          loadCommandHistory();
          break;
        case 'triggers':
          loadTriggers();
          break;
      }
    });
    
    // Handle tab click for navigation
    tab.addEventListener('click', (e) => {
      // Prevent default to handle programmatically
      e.preventDefault();
      
      // Switch to the clicked tab
      const tabInstance = new bootstrap.Tab(tab);
      tabInstance.show();
    });
  });
  
  // Load the saved tab after a short delay to ensure Bootstrap is initialized
  setTimeout(loadActiveTab, 100);
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize event listeners for elements that might be accessed early
  if (document.getElementById('refresh-kb')) {
    document.getElementById('refresh-kb').addEventListener('click', loadKbDocuments);
  }
  
  // Load initial data
  loadStatus();
  loadSettings();
  loadChats();
  loadKbDocuments();
  loadCommandHistory();
  loadSystemStats();
  initializeMemoryChart();
  
  // Initialize tab persistence
  initTabPersistence();
  
  // Set up toggle visibility for API keys
  toggleVisibilityButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const inputGroup = e.currentTarget.closest('.input-group');
      const input = inputGroup.querySelector('input');
      const icon = e.currentTarget.querySelector('i');
      const providerType = input.id.split('-')[0]; // Extract provider from input id (openai-api-key, openrouter-api-key)
      
      if (input.type === 'password') {
        // When switching to text mode, fetch the real key from server
        if (input.dataset.masked === 'true') {
          fetchRealApiKey(providerType, input);
        }
        input.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
      } else {
        // Going back to password mode
        input.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
      }
    });
  });
  
  // Show/hide API key inputs based on provider selection
  providerSelect.addEventListener('change', () => {
    updateApiKeyVisibility(providerSelect.value);
  });
  
  // Profile management event listeners
  const profileSelect = document.getElementById('profile-select');
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const deleteProfileBtn = document.getElementById('delete-profile-btn');
  const newProfileNameInput = document.getElementById('new-profile-name');
  
  if (profileSelect) {
    // Load saved profile on page load if available
    const savedProfile = getSelectedProfile();
    if (savedProfile) {
      // Set the dropdown value
      profileSelect.value = savedProfile;
      // Load the profile data
      loadProfile(savedProfile).catch(error => {
        console.error('Error loading saved profile:', error);
      });
    }
    
    // Handle profile changes
    profileSelect.addEventListener('change', async () => {
      const selectedProfile = profileSelect.value;
      if (selectedProfile) {
        try {
          await loadProfile(selectedProfile);
          // Save the selected profile
          saveSelectedProfile(selectedProfile);
        } catch (error) {
          console.error('Error loading profile:', error);
          showToast('Failed to load profile', 'error');
        }
      }
    });
  }
  
  if (saveProfileBtn && newProfileNameInput) {
    saveProfileBtn.addEventListener('click', async () => {
      const profileName = newProfileNameInput.value.trim();
      if (!profileName) {
        showToast('Please enter a profile name', 'warning');
        return;
      }
      
      try {
        await saveProfile(profileName);
        newProfileNameInput.value = ''; // Clear input after saving
      } catch (error) {
        console.error('Error saving profile:', error);
      }
    });
  }
  
  if (deleteProfileBtn && profileSelect) {
    deleteProfileBtn.addEventListener('click', async () => {
      const selectedProfile = profileSelect.value;
      if (!selectedProfile) {
        showToast('Please select a profile to delete', 'warning');
        return;
      }
      
      if (selectedProfile === 'default') {
        showToast('Cannot delete the default profile', 'warning');
        return;
      }
      
      if (confirm(`Are you sure you want to delete the profile '${selectedProfile}'?`)) {
        try {
          await deleteProfile(selectedProfile);
        } catch (error) {
          console.error('Error deleting profile:', error);
        }
      }
    });
  }
  
  // Event listeners
  refreshBtn.addEventListener('click', () => {
    loadStatus();
    loadSettings();
    loadChats();
    loadKbDocuments();
    loadCommandHistory();
    loadSystemStats();
  });
  
  if (refreshDashboardBtn) {
    refreshDashboardBtn.addEventListener('click', () => {
      loadSystemStats();
      updateMemoryChart();
    });
  }
  
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });
  
  // Set up knowledge base file input
  if (kbFileInput) {
    kbFileInput.addEventListener('change', uploadDocument);
  }
  
  // Set up refresh button for KB documents
  const refreshKbBtn = document.getElementById('refresh-kb');
  if (refreshKbBtn) {
    refreshKbBtn.addEventListener('click', () => {
      loadKbDocuments();
    });
  }
  
  // Set up polling for system stats
  setInterval(() => {
    loadSystemStats();
    updateMemoryChart();
  }, 30000); // Update every 30 seconds
  
  // Initial data load
  loadStatus();
  loadSettings();
  loadChats();
  loadKbDocuments();
  loadCommandHistory();
  loadSystemStats();
  
  // Initialize Bootstrap tabs with state persistence
  const tabElements = document.querySelectorAll('a[data-bs-toggle="tab"]');
  tabElements.forEach(tab => {
    // Save active tab when a tab is shown
    tab.addEventListener('shown.bs.tab', (e) => {
      const targetId = e.target.getAttribute('href').substring(1);
      saveActiveTab(targetId);
    });
    
    // Handle tab click for initialization
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = tab.getAttribute('href').substring(1);
      
      // Handle tab-specific initialization
      switch(targetId) {
        case 'chats':
          loadChats();
          break;
        case 'kb':
          loadKbDocuments();
          break;
        case 'commands':
          loadCommandHistory();
          break;
        case 'triggers':
          loadTriggers();
          break;
      }
      
      // Bootstrap will handle showing the tab content
      const tabInstance = new bootstrap.Tab(tab);
      tabInstance.show();
    });
  });
  
  // Load the saved tab after a short delay to ensure Bootstrap is initialized
  setTimeout(loadActiveTab, 100);
});

// API functions
async function loadStatus() {
  try {
    const response = await fetch(`/api/status?app=${window.currentApp}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Update status elements
    botStatusElement.textContent = data.status;
    currentModelElement.textContent = data.model || 'Not set';
    ragStatusElement.textContent = data.ragEnabled ? 'Enabled' : 'Disabled';
    providerElement.textContent = data.provider || 'Not set';
    
    connectionStatus.className = 'badge ' + (data.status === 'online' ? 'bg-success' : 'bg-danger');
  } catch (error) {
    console.error('Error loading status:', error);
    connectionStatus.className = 'badge bg-danger';
    connectionStatus.textContent = 'Offline';
  }
}

// Toggle advanced options visibility
function toggleAdvancedOptions(show) {
  const advancedConfig = document.querySelector('#settings #advanced-config');
  if (!advancedConfig) return;
  
  // If showConfig is false, don't show advanced options
  const showConfig = advancedConfig.style.display !== 'none';
  if (!showConfig) return;
  
  const advancedOptions = advancedConfig.querySelector('#advanced-options');
  const toggleBtn = advancedConfig.querySelector('#toggle-advanced');
  
  if (advancedOptions && toggleBtn) {
    if (show === undefined) {
      show = window.getComputedStyle(advancedOptions).display === 'none';
    }
    
    advancedOptions.style.display = show ? 'block' : 'none';
    toggleBtn.innerHTML = `<i class="bi bi-chevron-${show ? 'up' : 'down'}"></i> ${show ? 'Hide' : 'Show'} Advanced`;
    
    // Save the state in localStorage
    localStorage.setItem('showAdvancedSettings', show);
  }
}

// Initialize advanced options toggle
document.addEventListener('DOMContentLoaded', () => {
  // Handle tab changes
  const tabLinks = document.querySelectorAll('a[data-bs-toggle="tab"]');
  tabLinks.forEach(link => {
    link.addEventListener('shown.bs.tab', () => {
      if (link.getAttribute('href') === '#settings') {
        const advancedConfig = document.querySelector('#settings #advanced-config');
        if (advancedConfig && advancedConfig.style.display !== 'none') {
          const toggleBtn = advancedConfig.querySelector('#toggle-advanced');
          if (toggleBtn) {
            // Load the saved state
            const showAdvanced = localStorage.getItem('showAdvancedSettings') === 'true';
            toggleAdvancedOptions(showAdvanced);
            
            // Add click handler if not already added
            if (!toggleBtn.hasAttribute('data-listener-attached')) {
              toggleBtn.setAttribute('data-listener-attached', 'true');
              toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                toggleAdvancedOptions();
              });
            }
          }
        }
      }
    });
  });
  
  // Initialize for the first load if settings tab is active
  if (window.location.hash === '#settings' || !window.location.hash) {
    const advancedConfig = document.querySelector('#settings #advanced-config');
    if (advancedConfig && advancedConfig.style.display !== 'none') {
      const toggleBtn = advancedConfig.querySelector('#toggle-advanced');
      if (toggleBtn) {
        const showAdvanced = localStorage.getItem('showAdvancedSettings') === 'true';
        toggleAdvancedOptions(showAdvanced);
        
        // Add click handler if not already added
        if (!toggleBtn.hasAttribute('data-listener-attached')) {
          toggleBtn.setAttribute('data-listener-attached', 'true');
          toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleAdvancedOptions();
          });
        }
      }
    }
  }
});

async function loadSettings() {
  try {
    const response = await fetch('/api/settings');
    const settings = await response.json();
    
    // Always ensure these tabs are visible
    const alwaysVisibleTabs = ['#kb', '#commands', '#system', '#workflows'];
    alwaysVisibleTabs.forEach(tabId => {
      const tab = document.querySelector(`[href="${tabId}"]`);
      if (tab) {
        tab.closest('.nav-item').style.display = 'block';
      }
    });
    
    // Handle advanced config visibility based on showConfig flag
    const showConfig = settings.showConfig !== false; // Default to true if not specified
    const advancedConfig = document.querySelector('#settings #advanced-config');
    
    // Hide the entire advanced config section if showConfig is false
    if (advancedConfig) {
      if (!showConfig) {
        advancedConfig.style.display = 'none';
      } else {
        // Only show the toggle and handle its state if showConfig is true
        const advancedOptions = advancedConfig.querySelector('#advanced-options');
        const toggleBtn = advancedConfig.querySelector('#toggle-advanced');
        
        if (advancedOptions && toggleBtn) {
          const showAdvanced = localStorage.getItem('showAdvancedSettings') === 'true';
          advancedOptions.style.display = showAdvanced ? 'block' : 'none';
          toggleBtn.innerHTML = `<i class="bi bi-chevron-${showAdvanced ? 'up' : 'down'}"></i> ${showAdvanced ? 'Hide' : 'Show'} Advanced`;
        }
      }
    }
    
    // Update form fields
    if (settings.provider) document.getElementById('provider-select').value = settings.provider;
    if (settings.model) document.getElementById('model-input').value = settings.model;
    if (settings.ragEnabled !== undefined) document.getElementById('rag-enabled').checked = settings.ragEnabled;
    if (settings.systemPrompt) document.getElementById('system-prompt').value = settings.systemPrompt;
    
    // API keys - show masked versions if present (already masked by backend)
    if (settings.apiKeys) {
      if (settings.apiKeys.openai) {
        openaiApiKeyInput.value = settings.apiKeys.openai;
        openaiApiKeyInput.dataset.masked = 'true';
      }
      
      if (settings.apiKeys.openrouter) {
        openrouterApiKeyInput.value = settings.apiKeys.openrouter;
        openrouterApiKeyInput.dataset.masked = 'true';
      }
    }
    
    // Update which API key fields are visible
    updateApiKeyVisibility(settings.provider);
    
    // Update profile information if available
    const profileSelect = document.getElementById('profile-select');
    if (profileSelect && settings.availableProfiles) {
      // Clear existing options
      profileSelect.innerHTML = '';
      
      // Add all profiles
      settings.availableProfiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile;
        option.textContent = profile;
        profileSelect.appendChild(option);
      });
      
      // Select current profile
      if (settings.currentProfileName) {
        profileSelect.value = settings.currentProfileName;
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings() {
  try {
    const settings = {
      provider: providerSelect.value,
      model: modelInput.value,
      ragEnabled: ragEnabledCheckbox.checked,
      systemPrompt: systemPromptTextarea.value,
      apiKeys: {}
    };
    
    // Only send API keys if they've been changed (not masked)
    if (openaiApiKeyInput.value && openaiApiKeyInput.dataset.masked !== 'true') {
      settings.apiKeys.openai = openaiApiKeyInput.value;
    }
    
    if (openrouterApiKeyInput.value && openrouterApiKeyInput.dataset.masked !== 'true') {
      settings.apiKeys.openrouter = openrouterApiKeyInput.value;
    }
    
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('Settings saved successfully!');
      // Reload settings to get properly masked keys from backend
      loadSettings();
      loadStatus(); // Refresh status to show updated settings
    } else {
      showToast(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showToast(`Error saving settings: ${error.message}`, 'error');
  }
}

// Helper function to update API key field visibility based on provider
function updateApiKeyVisibility(provider) {
  const openaiKeyGroup = document.getElementById('openai-key-group');
  const openrouterKeyGroup = document.getElementById('openrouter-key-group');
  
  // Hide all by default
  openaiKeyGroup.style.display = 'none';
  openrouterKeyGroup.style.display = 'none';
  
  // Show relevant ones
  switch(provider) {
    case 'openai':
      openaiKeyGroup.style.display = 'block';
      break;
    case 'openrouter':
      openrouterKeyGroup.style.display = 'block';
      break;
    case 'mcp':
    case 'ollama':
      // No API keys needed for these
      break;
  }
}

// Helper function to mask API keys
// Function to fetch the real API key from the server
async function fetchRealApiKey(provider, inputElement) {
  try {
    const response = await fetch(`/api/key/${provider}`);
    if (response.ok) {
      const data = await response.json();
      if (data.key) {
        inputElement.value = data.key;
        inputElement.dataset.masked = 'false';
        return;
      }
    }
    // If we couldn't get the key, just clear the input
    inputElement.value = '';
    inputElement.dataset.masked = 'false';
  } catch (error) {
    console.error(`Error fetching ${provider} API key:`, error);
    inputElement.value = '';
    inputElement.dataset.masked = 'false';
  }
  inputElement.focus();
}

// Event listeners for API key inputs to clear masked status
if (openaiApiKeyInput) {
  openaiApiKeyInput.addEventListener('input', function() {
    this.dataset.masked = 'false';
  });
}

if (openrouterApiKeyInput) {
  openrouterApiKeyInput.addEventListener('input', function() {
    this.dataset.masked = 'false';
  });
}

// Settings form submission handler
if (settingsForm) {
  settingsForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    console.log('[DEBUG] Settings form submitted');
    await saveSettings();
  });
}

// Server control event listeners
document.addEventListener('DOMContentLoaded', () => {
  const restartBtn = document.getElementById('restart-server');
  if (restartBtn) {
    restartBtn.addEventListener('click', async () => {
      try {
        const confirmed = await showConfirmDialog(
          'Restart Server',
          'Are you sure you want to restart the server? This will temporarily interrupt service.',
          'Restart',
          'Cancel',
          'warning'
        );

        if (!confirmed) return;

        // Show loading state
        const originalText = restartBtn.innerHTML;
        restartBtn.disabled = true;
        restartBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Restarting...';

        // Make the API call
        const response = await fetch('/api/server/restart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
          showToast('Server is restarting. Please wait a moment and refresh the page.', 'info', 10000);
          // Disable the button to prevent multiple clicks
          restartBtn.disabled = true;
        } else {
          throw new Error(result.error || 'Failed to restart server');
        }
      } catch (error) {
        console.error('Error restarting server:', error);
        showToast(`Error: ${error.message}`, 'error');
        // Reset button state on error
        restartBtn.disabled = false;
        restartBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i> Restart Server';
      }
    });
  }
});

// Chat management functions
async function deleteChat(chatId) {
  try {
    const confirmed = await showConfirmDialog(
      'Delete Chat',
      'Are you sure you want to delete this chat? This action cannot be undone.',
      'Delete',
      'Cancel',
      'danger'
    );

    if (!confirmed) return;

    const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      showToast('Chat deleted successfully', 'success');
      loadChats(); // Refresh the chat list
      loadRecentChats(); // Also refresh the recent chats in dashboard
    } else {
      throw new Error(result.error || 'Failed to delete chat');
    }
  } catch (error) {
    console.error('Error deleting chat:', error);
    showToast(`Error: ${error.message}`, 'error');
  }
}

// Chat management event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Refresh chats button
  const refreshChatsBtn = document.getElementById('refresh-chats');
  if (refreshChatsBtn) {
    refreshChatsBtn.addEventListener('click', loadChats);
  }

  // Clear all chats button
  const clearAllChatsBtn = document.getElementById('clear-all-chats');
  if (clearAllChatsBtn) {
    clearAllChatsBtn.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog(
        'Clear All Chats',
        'Are you sure you want to delete ALL chat history? This action cannot be undone.',
        'Clear All',
        'Cancel',
        'danger'
      );
      
      if (confirmed) {
        try {
          const response = await fetch('/api/chats', {
            method: 'DELETE'
          });
          
          const result = await response.json();
          if (result.success) {
            loadChats();
            showToast('All chat history has been cleared', 'success');
          } else {
            throw new Error(result.error || 'Failed to clear all chats');
          }
        } catch (error) {
          console.error('Error clearing all chats:', error);
          showToast(`Error: ${error.message}`, 'danger');
        }
      }
    });
  }
});

// Export chat functionality
document.addEventListener('DOMContentLoaded', () => {
  const exportChatBtn = document.getElementById('exportChatBtn');
  if (exportChatBtn) {
    exportChatBtn.addEventListener('click', exportCurrentChat);
  }
});

let currentChatId = null;

async function exportCurrentChat() {
  if (!currentChatId) return;
  
  try {
    // Get the chat data
    const response = await fetch(`/api/chats/${encodeURIComponent(currentChatId)}`);
    if (!response.ok) throw new Error('Failed to fetch chat for export');
    
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Failed to export chat');
    
    const messages = result.conversation || [];
    
    // Format messages as text
    const formattedMessages = messages.map(msg => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const time = new Date(msg.timestamp).toLocaleString();
      return `[${time}] ${role}: ${msg.content}`;
    }).join('\n\n');
    
    // Create a download link
    const blob = new Blob([formattedMessages], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${currentChatId}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Chat exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting chat:', error);
    showToast(`Error exporting chat: ${error.message}`, 'danger');
  }
}

// File upload handling
if (kbFileInput) {
  kbFileInput.addEventListener('change', handleFileUpload);
}

if (refreshKbBtn) {
  refreshKbBtn.addEventListener('click', loadKnowledgeBase);
}

// Load knowledge base when the page loads
document.addEventListener('DOMContentLoaded', () => {
  loadKnowledgeBase();
});

// Triggers management
// Load triggers from the server
async function loadTriggers() {
  try {
    const response = await fetch(`/api/triggers?app=${window.currentApp}`);
    if (!response.ok) throw new Error('Failed to fetch triggers');
    
    const data = await response.json();
    window.currentTriggers = data;
    renderTriggers();
  } catch (error) {
    console.error('Error loading triggers:', error);
    showToast('Failed to load triggers', 'error');
  }
    // currentTriggers is already initialized globally
    
    try {
        const response = await fetch('/api/triggers');
        const data = await response.json();
        
        if (data.success) {
            window.currentTriggers = data.triggers;
            renderTriggers();
        } else {
            showToast('Error', 'Failed to load triggers');
        }
    } catch (error) {
        console.error('Error loading triggers:', error);
        showToast('Error', 'Failed to load triggers: ' + error.message);
    }
}

// Render triggers in the UI
function renderTriggers() {
    // Clear existing lists
    $('#groupTriggersList').empty();
    $('#customTriggersList').empty();
    
    // Render group triggers
    if (currentTriggers.groupTriggers && currentTriggers.groupTriggers.length > 0) {
        currentTriggers.groupTriggers.forEach(function(trigger) {
            addTriggerToUI('group', trigger);
        });
    } else {
        $('#groupTriggersList').append('<div class="list-group-item text-muted">No group triggers defined</div>');
    }
    
    // Render custom triggers
    if (currentTriggers.customTriggers && currentTriggers.customTriggers.length > 0) {
        currentTriggers.customTriggers.forEach(function(trigger) {
            addTriggerToUI('custom', trigger);
        });
    } else {
        $('#customTriggersList').append('<div class="list-group-item text-muted">No custom triggers defined</div>');
    }
}

// Add a trigger to the UI
function addTriggerToUI(type, trigger) {
    const listId = type === 'group' ? 'groupTriggersList' : 'customTriggersList';
    const triggerItem = $(`
        <div class="list-group-item d-flex justify-content-between align-items-center">
            <span class="trigger-text">${trigger}</span>
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary edit-trigger" data-type="${type}" data-trigger="${trigger}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger delete-trigger" data-type="${type}" data-trigger="${trigger}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `);
    
    $(`#${listId}`).append(triggerItem);
}

// Save triggers to the server
function saveTriggers() {
    $.ajax({
        url: '/api/triggers',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(currentTriggers),
        success: function(response) {
            if (response.success) {
                showToast('Success', 'Triggers saved successfully');
            } else {
                showToast('Error', 'Failed to save triggers: ' + (response.error || 'Unknown error'));
            }
        },
        error: function(xhr, status, error) {
            showToast('Error', 'Failed to save triggers: ' + error);
        }
    });
}

// Handle app switching
document.getElementById('app-selector').addEventListener('change', function(e) {
    const newApp = e.target.value;
    if (newApp !== window.currentApp) {
        window.currentApp = newApp;
        // Update UI elements based on the selected app
        updateAppUI();
        // Reload relevant data for the new app
        loadStatus();
        loadRecentChats();
        loadTriggers();
    }
});

// Update UI elements based on the selected app
function updateAppUI() {
    if (!window.currentApp) return;
    
    const appName = window.currentApp.charAt(0).toUpperCase() + window.currentApp.slice(1);
    document.title = `${appName} Management Console`;
    
    const h2Element = document.querySelector('h2');
    if (h2Element) {
        h2Element.textContent = `${appName} Management Console`;
    }
    
    // Toggle between WhatsApp and Telegram auth UI
    const whatsappAuth = document.getElementById('whatsapp-auth-container');
    const telegramAuth = document.getElementById('telegram-auth-container');
    
    if (window.currentApp === 'whatsapp') {
        if (whatsappAuth) whatsappAuth.style.display = 'block';
        if (telegramAuth) telegramAuth.style.display = 'none';
    } else if (window.currentApp === 'telegram') {
        if (whatsappAuth) whatsappAuth.style.display = 'none';
        if (telegramAuth) telegramAuth.style.display = 'block';
        
        // Load saved token if exists
        const savedToken = localStorage.getItem('telegram_bot_token');
        if (savedToken) {
            const tokenInput = document.getElementById('telegram-token');
            if (tokenInput) {
                tokenInput.value = savedToken;
                updateTelegramStatus('Token loaded', 'success');
            }
        }
    }
}

/**
 * Generate a QR code from a string
 * @param {string} qrData - The data to encode in the QR code
 * @param {HTMLElement} container - The container to render the QR code in
 */
function generateQRCode(qrData, container) {
    // Clear previous QR code if any
    container.innerHTML = '';
    
    // Create a canvas element for the QR code
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    
    // Create QR code using the QRCode.js library
    return new Promise((resolve) => {
        QRCode.toCanvas(canvas, qrData, {
            width: 200,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        }, (error) => {
            if (error) {
                console.error('Error generating QR code:', error);
                container.innerHTML = '<p class="text-danger">Failed to generate QR code</p>';
            }
            resolve();
        });
    });
}

/**
 * Check WhatsApp authentication status
 */
async function checkWhatsAppAuth() {
    try {
        const response = await fetch('/api/whatsapp/status');
        const data = await response.json();
        
        if (data.authenticated) {
            // Hide QR scanner if authenticated
            const qrScannerBtn = document.getElementById('show-qr-scanner');
            if (qrScannerBtn) qrScannerBtn.style.display = 'none';
            
            // Update connection status
            const statusElement = document.getElementById('connection-status');
            if (statusElement) {
                statusElement.className = 'badge bg-success mt-1';
                statusElement.textContent = 'Connected';
            }
            
            // Close QR scanner modal if open
            const qrModal = bootstrap.Modal.getInstance(document.getElementById('qrScannerModal'));
            if (qrModal) qrModal.hide();
            
            // Clear any existing interval
            if (window.qrCodeInterval) {
                clearInterval(window.qrCodeInterval);
                window.qrCodeInterval = null;
            }
            
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error checking WhatsApp auth status:', error);
        return false;
    }
}

/**
 * Start QR code generation and checking
 */
async function startQRCodeGeneration() {
    const qrContainer = document.getElementById('qr-code-container');
    const qrStatus = document.getElementById('qr-status');
    
    if (!qrContainer || !qrStatus) return;
    
    try {
        // Clear any existing interval
        if (window.qrCodeInterval) {
            clearInterval(window.qrCodeInterval);
        }
        
        // Show loading state
        qrContainer.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
        qrStatus.textContent = 'Generating QR code...';
        
        // Get QR code data from server
        const response = await fetch('/api/whatsapp/qr');
        if (!response.ok) {
            throw new Error('Failed to get QR code');
        }
        
        const data = await response.json();
        
        if (data.qr) {
            // Generate QR code
            qrContainer.innerHTML = '';
            await generateQRCode(data.qr, qrContainer);
            qrStatus.textContent = 'Scan the QR code with your WhatsApp mobile app';
            
            // Start checking authentication status
            window.qrCodeInterval = setInterval(async () => {
                const isAuthenticated = await checkWhatsAppAuth();
                if (isAuthenticated) {
                    clearInterval(window.qrCodeInterval);
                    window.qrCodeInterval = null;
                    
                    // Refresh chats after successful authentication
                    if (window.currentApp === 'whatsapp') {
                        loadRecentChats();
                    }
                }
            }, 3000);
        } else {
            qrContainer.innerHTML = '<p class="text-danger">Failed to generate QR code</p>';
            qrStatus.textContent = 'Please try again';
        }
    } catch (error) {
        console.error('Error generating QR code:', error);
        qrContainer.innerHTML = '<p class="text-danger">Error: ' + error.message + '</p>';
        qrStatus.textContent = 'Failed to generate QR code';
    }
}

/**
 * Update Telegram status message
 * @param {string} message - Status message to display
 * @param {string} type - Message type (success, error, info)
 */
function updateTelegramStatus(message, type = 'info') {
    const statusElement = document.getElementById('telegram-status');
    if (!statusElement) return;
    
    // Set appropriate icon based on type
    let icon = 'info-circle';
    let textClass = 'text-muted';
    
    if (type === 'success') {
        icon = 'check-circle';
        textClass = 'text-success';
    } else if (type === 'error') {
        icon = 'exclamation-circle';
        textClass = 'text-danger';
    }
    
    statusElement.innerHTML = `<i class="bi bi-${icon}"></i> ${message}`;
    statusElement.className = `small ${textClass}`;
}

// Initialize QR code scanner modal
document.addEventListener('DOMContentLoaded', function() {
    const qrScannerModal = document.getElementById('qrScannerModal');
    if (qrScannerModal) {
        qrScannerModal.addEventListener('show.bs.modal', function() {
            startQRCodeGeneration();
        });
        
        qrScannerModal.addEventListener('hidden.bs.modal', function() {
            // Clean up when modal is closed
            if (window.qrCodeInterval) {
                clearInterval(window.qrCodeInterval);
                window.qrCodeInterval = null;
            }
        });
    }
    
    // Refresh QR code button
    const refreshQrBtn = document.getElementById('refresh-qr');
    if (refreshQrBtn) {
        refreshQrBtn.addEventListener('click', startQRCodeGeneration);
    }
    
    // Initial check if already authenticated
    if (window.currentApp === 'whatsapp') {
        checkWhatsAppAuth();
    }
    
    // Handle Telegram token save
    const saveTokenBtn = document.getElementById('save-telegram-token');
    const telegramTokenInput = document.getElementById('telegram-token');
    
    if (saveTokenBtn && telegramTokenInput) {
        saveTokenBtn.addEventListener('click', async () => {
            const token = telegramTokenInput.value.trim();
            if (!token) {
                updateTelegramStatus('Please enter a token', 'error');
                return;
            }
            
            try {
                // Save token to localStorage
                localStorage.setItem('telegram_bot_token', token);
                
                // Send token to server
                const response = await fetch('/api/telegram/set-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token })
                });
                
                if (response.ok) {
                    updateTelegramStatus('Token saved and bot restarted', 'success');
                    // Reload the page to apply changes
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to save token');
                }
            } catch (error) {
                console.error('Error saving Telegram token:', error);
                updateTelegramStatus(`Error: ${error.message}`, 'error');
            }
        });
        
        // Allow saving with Enter key
        telegramTokenInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveTokenBtn.click();
            }
        });
    }
});

// Document ready handler
$(document).ready(function() {
    // Load triggers when the tab is shown
    $('a[href="#triggers"]').on('shown.bs.tab', function() {
        loadTriggers();
    });
    
    // Refresh triggers button
    $('#refresh-triggers').on('click', function() {
        loadTriggers();
        showToast('Info', 'Refreshing triggers...');
    });
    
    // Add group trigger
    $('#addGroupTrigger').on('click', function() {
        addGroupTrigger();
    });
    
    // Handle Enter key press in group trigger input
    $('#newGroupTrigger').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            e.preventDefault();
            addGroupTrigger();
        }
    });
    
    // Function to add group trigger
    function addGroupTrigger() {
        const newTrigger = $('#newGroupTrigger').val().trim();
        if (newTrigger) {
            // Check if trigger already exists
            if (currentTriggers.groupTriggers.includes(newTrigger)) {
                showToast('Warning', 'This trigger already exists!');
                return;
            }
            
            // Add to current triggers
            currentTriggers.groupTriggers.push(newTrigger);
            
            // Add to UI
            addTriggerToUI('group', newTrigger);
            
            // Clear input
            $('#newGroupTrigger').val('');
            
            // Remove empty message if it exists
            $('#groupTriggersList .text-muted').remove();
        }
    }
    
    // Add custom trigger
    $('#addCustomTrigger').on('click', function() {
        addCustomTrigger();
    });
    
    // Handle Enter key press in custom trigger input
    $('#newCustomTrigger').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            e.preventDefault();
            addCustomTrigger();
        }
    });
    
    // Function to add custom trigger
    function addCustomTrigger() {
        const newTrigger = $('#newCustomTrigger').val().trim();
        if (newTrigger) {
            // Check if trigger already exists
            if (currentTriggers.customTriggers.includes(newTrigger)) {
                showToast('Warning', 'This trigger already exists!');
                return;
            }
            
            // Add to current triggers
            currentTriggers.customTriggers.push(newTrigger);
            
            // Add to UI
            addTriggerToUI('custom', newTrigger);
            
            // Clear input
            $('#newCustomTrigger').val('');
            
            // Remove empty message if it exists
            $('#customTriggersList .text-muted').remove();
        }
    }
    
    // Delete trigger (use event delegation for dynamically created elements)
    $(document).on('click', '.delete-trigger', function() {
        const triggerType = $(this).data('type');
        const triggerText = $(this).data('trigger');
        
        // Remove from current triggers
        if (triggerType === 'group') {
            currentTriggers.groupTriggers = currentTriggers.groupTriggers.filter(t => t !== triggerText);
        } else {
            currentTriggers.customTriggers = currentTriggers.customTriggers.filter(t => t !== triggerText);
        }
        
        // Remove from UI
        $(this).closest('.list-group-item').remove();
        
        // Show empty message if no triggers left
        const listId = triggerType === 'group' ? 'groupTriggersList' : 'customTriggersList';
        if ($(`#${listId}`).children().length === 0) {
            $(`#${listId}`).append('<div class="list-group-item text-muted">No ' + triggerType + ' triggers defined</div>');
        }
    });
    
    // Edit trigger (use event delegation for dynamically created elements)
    $(document).on('click', '.edit-trigger', function() {
        const triggerType = $(this).data('type');
        const triggerText = $(this).data('trigger');
        const listItem = $(this).closest('.list-group-item');
        const triggerTextElement = listItem.find('.trigger-text');
        
        // Replace text with input field
        const inputField = $(`<input type="text" class="form-control edit-trigger-input" value="${triggerText}">`);
        triggerTextElement.replaceWith(inputField);
        
        // Focus on the input field
        inputField.focus();
        
        // Replace edit button with save button
        const saveButton = $(`<button class="btn btn-sm btn-success save-trigger" data-type="${triggerType}" data-trigger="${triggerText}"><i class="bi bi-check"></i></button>`);
        $(this).replaceWith(saveButton);
        
        // Handle save button click
        saveButton.on('click', function() {
            saveTriggerEdit($(this), inputField, triggerType, triggerText);
        });
        
        // Handle Enter key press
        inputField.on('keypress', function(e) {
            if (e.which === 13) { // Enter key
                e.preventDefault();
                saveTriggerEdit(saveButton, inputField, triggerType, triggerText);
            }
        });
        
        // Handle Escape key press to cancel
        inputField.on('keydown', function(e) {
            if (e.which === 27) { // Escape key
                e.preventDefault();
                // Restore original text
                inputField.replaceWith(`<span class="trigger-text">${triggerText}</span>`);
                // Restore edit button
                saveButton.replaceWith(`<button class="btn btn-sm btn-outline-primary edit-trigger" data-type="${triggerType}" data-trigger="${triggerText}"><i class="bi bi-pencil"></i></button>`);
            }
        });
    });
    
    // Function to save trigger edit
    function saveTriggerEdit(saveButton, inputField, triggerType, oldTriggerText) {
        const newTriggerText = inputField.val().trim();
        
        if (!newTriggerText) {
            showToast('Warning', 'Trigger text cannot be empty');
            return;
        }
        
        if (newTriggerText === oldTriggerText) {
            // No change, just restore the UI
            inputField.replaceWith(`<span class="trigger-text">${oldTriggerText}</span>`);
            saveButton.replaceWith(`<button class="btn btn-sm btn-outline-primary edit-trigger" data-type="${triggerType}" data-trigger="${oldTriggerText}"><i class="bi bi-pencil"></i></button>`);
            return;
        }
        
        // Check if new trigger already exists
        const triggerArray = triggerType === 'group' ? currentTriggers.groupTriggers : currentTriggers.customTriggers;
        if (triggerArray.includes(newTriggerText)) {
            showToast('Warning', 'This trigger already exists!');
            return;
        }
        
        // Update the trigger in the array
        const index = triggerArray.indexOf(oldTriggerText);
        if (index !== -1) {
            triggerArray[index] = newTriggerText;
            
            // Update the UI
            inputField.replaceWith(`<span class="trigger-text">${newTriggerText}</span>`);
            
            // Update the buttons with new data attributes
            const listItem = saveButton.closest('.list-group-item');
            const buttonGroup = listItem.find('.btn-group');
            
            buttonGroup.html(`
                <button class="btn btn-sm btn-outline-primary edit-trigger" data-type="${triggerType}" data-trigger="${newTriggerText}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-danger delete-trigger" data-type="${triggerType}" data-trigger="${newTriggerText}">
                    <i class="bi bi-trash"></i>
                </button>
            `);
            
            showToast('Success', 'Trigger updated');
        }
    }
    
    // Save triggers
    $('#saveTriggers').on('click', function() {
        saveTriggers();
    });
    
    // Load triggers on initial page load if triggers tab is active
    if (window.location.hash === '#triggers') {
        loadTriggers();
    }
});

// Load chats when document is ready
document.addEventListener('DOMContentLoaded', function() {
    loadChats();
    loadRecentChats();
    
    // Add refresh button event listener
    const refreshBtn = document.getElementById('refresh-recent-chats');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadRecentChats);
    }
    
    // Other event listeners...
});

// Chat loading and management functions
async function loadRecentChats() {
    const recentChatsBody = document.getElementById('recent-chats-body');
    if (!recentChatsBody) return;
    
    try {
        // Show loading state
        recentChatsBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">
                    <div class="spinner-border spinner-border-sm" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <span class="ms-2">Loading recent chats...</span>
                </td>
            </tr>
        `;
        
        // Fetch recent chats from API
        const response = await fetch('/api/chats/recent');
        if (!response.ok) {
            throw new Error('Failed to fetch recent chats');
        }
        
        const data = await response.json();
        const chats = data.chats || [];
        
        if (chats.length === 0) {
            recentChatsBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">
                        <i class="bi bi-chat-text me-2"></i>
                        No recent chats found
                    </td>
                </tr>
            `;
            return;
        }
        
        // Get AI states for all chats
        const aiStatesResponse = await fetch('/api/chat/ai-states');
        const aiStatesData = aiStatesResponse.ok ? await aiStatesResponse.json() : { states: {} };
        const aiStates = aiStatesData.states || {};
        
        // Clear loading and populate with actual data
        recentChatsBody.innerHTML = '';
        
        chats.forEach(chat => {
            const chatId = chat.chatId || chat.id;
            const lastMessage = chat.lastMessage || chat.content || 'No messages';
            const messageCount = chat.messageCount || chat.messages || 0;
            const isAIEnabled = aiStates[chatId] !== false; // Default to enabled
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <span class="fw-medium">${escapeHtml(chatId)}</span>
                </td>
                <td>
                    <span class="text-truncate d-inline-block" style="max-width: 300px;" title="${escapeHtml(lastMessage)}">
                        ${escapeHtml(lastMessage.substring(0, 100))}${lastMessage.length > 100 ? '...' : ''}
                    </span>
                </td>
                <td>
                    <span class="badge bg-secondary">${messageCount}</span>
                </td>
                <td>
                    <div class="form-check form-switch">
                        <input class="form-check-input ai-toggle" 
                               type="checkbox" 
                               data-chat-id="${escapeHtml(chatId)}"
                               ${isAIEnabled ? 'checked' : ''}>
                        <label class="form-check-label small text-muted">
                            ${isAIEnabled ? 'On' : 'Off'}
                        </label>
                    </div>
                </td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="viewChat('${escapeHtml(chatId)}')" 
                                title="View Chat">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="deleteChat('${escapeHtml(chatId)}')" 
                                title="Delete Chat">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            recentChatsBody.appendChild(row);
        });
        
        // Add event listeners for AI toggles
        addAIToggleListeners();
        
    } catch (error) {
        console.error('Error loading recent chats:', error);
        recentChatsBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Error loading chats: ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}

// Global variable to track currently open chat
let currentOpenChatId = null;

// View chat function
async function viewChat(chatId) {
  try {
    currentOpenChatId = chatId;
    
    // Set modal title
    const modalTitle = document.getElementById('chatModalTitle');
    if (modalTitle) {
      modalTitle.textContent = `Chat: ${chatId}`;
    }
    
    // Initialize AI toggle state
    await initializeChatModalControls(chatId);
    
    // Load chat messages
    await loadChatMessages(chatId);
    
    // Show the modal
    const chatModal = new bootstrap.Modal(document.getElementById('chatModal'));
    chatModal.show();
    
    // Clear current chat when modal is closed
    document.getElementById('chatModal').addEventListener('hidden.bs.modal', function() {
      currentOpenChatId = null;
      // Remove event listeners to prevent memory leaks
      removeChatModalEventListeners();
    }, { once: true });
    
  } catch (error) {
    console.error('Error viewing chat:', error);
    showToast(`Error loading chat: ${error.message}`, 'danger');
  }
}

// Load chat messages
async function loadChatMessages(chatId) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;
  
  try {
    // Show loading state
    messagesContainer.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="mt-2">Loading messages...</div>
      </div>
    `;
    
    // Fetch chat messages
    const response = await fetch(`/api/chat/${encodeURIComponent(chatId)}`);
    if (!response.ok) {
      throw new Error('Failed to load chat messages');
    }
    
    const data = await response.json();
    const messages = data.messages || [];
    
    // Clear container
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="text-center py-4 text-muted">
          <i class="bi bi-chat-text me-2"></i>
          No messages in this chat
        </div>
      `;
      return;
    }
    
    // Display messages
    messages.forEach(message => {
      const messageDiv = document.createElement('div');
      messageDiv.className = `mb-3 ${message.role === 'user' ? 'text-end' : 'text-start'}`;
      
      const timestamp = new Date(message.timestamp).toLocaleString();
      const roleClass = message.role === 'user' ? 'bg-primary text-white' : 'bg-light';
      const roleIcon = message.role === 'user' ? 'bi-person-fill' : 'bi-robot';
      
      messageDiv.innerHTML = `
        <div class="d-inline-block p-3 rounded ${roleClass}" style="max-width: 70%;">
          <div class="d-flex align-items-center mb-1">
            <i class="bi ${roleIcon} me-2"></i>
            <small class="${message.role === 'user' ? 'text-white-50' : 'text-muted'}">  
              ${message.role === 'user' ? 'User' : 'Assistant'} • ${timestamp}
            </small>
          </div>
          <div>${escapeHtml(message.content)}</div>
        </div>
      `;
      
      messagesContainer.appendChild(messageDiv);
    });
    
    // Scroll to bottom smoothly
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: 'smooth'
    });
    
    // Add a subtle flash effect to indicate new content
    messagesContainer.style.transition = 'background-color 0.3s ease';
    messagesContainer.style.backgroundColor = '#f8f9fa';
    setTimeout(() => {
      messagesContainer.style.backgroundColor = '';
    }, 300);
    
  } catch (error) {
    console.error('Error loading chat messages:', error);
    messagesContainer.innerHTML = `
      <div class="text-center py-4 text-danger">
        <i class="bi bi-exclamation-triangle me-2"></i>
        Error loading messages: ${escapeHtml(error.message)}
      </div>
    `;
  }
}

// Refresh current chat if it's open
function refreshCurrentChat(chatId) {
  console.log(`[WebSocket] refreshCurrentChat called with chatId: ${chatId}`);
  console.log(`[WebSocket] currentOpenChatId: ${currentOpenChatId}`);
  
  if (!currentOpenChatId) {
    console.log('[WebSocket] No chat currently open');
    return;
  }
  
  // Check for exact match first
  if (currentOpenChatId === chatId) {
    console.log(`[WebSocket] Exact match - refreshing chat: ${chatId}`);
    loadChatMessages(chatId);
    return;
  }
  
  // Check for normalized chat ID matches (handle different formats)
  const normalizedCurrent = currentOpenChatId.replace(/^(whatsapp|telegram):/, '').replace(/_/g, '').replace(/@.*$/, '');
  const normalizedIncoming = chatId.replace(/^(whatsapp|telegram):/, '').replace(/_/g, '').replace(/@.*$/, '');
  
  console.log(`[WebSocket] Normalized current: ${normalizedCurrent}`);
  console.log(`[WebSocket] Normalized incoming: ${normalizedIncoming}`);
  
  if (normalizedCurrent === normalizedIncoming) {
    console.log(`[WebSocket] Normalized match - refreshing chat: ${chatId}`);
    loadChatMessages(currentOpenChatId); // Use the original chat ID for loading
    return;
  }
  
  console.log(`[WebSocket] No match found - not refreshing chat`);
}

// Append a single new message to the current chat view (more efficient than full reload)
function appendNewMessage(message) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `mb-3 ${message.role === 'user' ? 'text-end' : 'text-start'}`;
  
  const timestamp = new Date(message.timestamp).toLocaleString();
  const roleClass = message.role === 'user' ? 'bg-primary text-white' : 'bg-light';
  const roleIcon = message.role === 'user' ? 'bi-person-fill' : 'bi-robot';
  
  messageDiv.innerHTML = `
    <div class="d-inline-block p-3 rounded ${roleClass}" style="max-width: 70%;">
      <div class="d-flex align-items-center mb-1">
        <i class="bi ${roleIcon} me-2"></i>
        <small class="${message.role === 'user' ? 'text-white-50' : 'text-muted'}">
          ${message.role === 'user' ? 'User' : 'Assistant'} • ${timestamp}
        </small>
      </div>
      <div>${escapeHtml(message.content)}</div>
    </div>
  `;
  
  // Add a subtle animation for new messages
  messageDiv.style.opacity = '0';
  messageDiv.style.transform = 'translateY(20px)';
  messageDiv.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  
  messagesContainer.appendChild(messageDiv);
  
  // Trigger animation
  setTimeout(() => {
    messageDiv.style.opacity = '1';
    messageDiv.style.transform = 'translateY(0)';
  }, 10);
  
  // Scroll to bottom smoothly
  setTimeout(() => {
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: 'smooth'
    });
  }, 100);
}

// Enhanced refresh function that can append single messages or do full reload
function refreshCurrentChatOptimized(chatId, newMessage = null) {
  console.log(`[WebSocket] refreshCurrentChatOptimized called with chatId: ${chatId}`);
  
  if (!currentOpenChatId) {
    console.log('[WebSocket] No chat currently open');
    return;
  }
  
  // Check if this is for the current chat
  const isCurrentChat = currentOpenChatId === chatId || 
    currentOpenChatId.replace(/^(whatsapp|telegram):/, '').replace(/_/g, '').replace(/@.*$/, '') ===
    chatId.replace(/^(whatsapp|telegram):/, '').replace(/_/g, '').replace(/@.*$/, '');
  
  if (!isCurrentChat) {
    console.log(`[WebSocket] Message not for current chat`);
    return;
  }
  
  // If we have a specific new message, just append it
  if (newMessage) {
    console.log(`[WebSocket] Appending new message to current chat`);
    appendNewMessage(newMessage);
  } else {
    // Otherwise do a full reload
    console.log(`[WebSocket] Full reload of current chat`);
    loadChatMessages(currentOpenChatId);
  }
}

// Initialize chat modal controls (AI toggle and refresh button)
async function initializeChatModalControls(chatId) {
  try {
    // Get current AI state for this chat
    const response = await fetch('/api/chat/ai-states');
    const data = response.ok ? await response.json() : { states: {} };
    const aiStates = data.states || {};
    const isAIEnabled = aiStates[chatId] !== false; // Default to enabled
    
    // Set AI toggle state
    const aiToggle = document.getElementById('chatModalAiToggle');
    const aiToggleLabel = document.getElementById('chatModalAiToggleLabel');
    
    if (aiToggle && aiToggleLabel) {
      aiToggle.checked = isAIEnabled;
      aiToggleLabel.textContent = isAIEnabled ? 'On' : 'Off';
      
      // Store chat ID in toggle for event handler
      aiToggle.setAttribute('data-chat-id', chatId);
    }
    
    // Add event listeners
    addChatModalEventListeners();
    
  } catch (error) {
    console.error('Error initializing chat modal controls:', error);
  }
}

// Add event listeners for chat modal controls
function addChatModalEventListeners() {
  // AI Toggle event listener
  const aiToggle = document.getElementById('chatModalAiToggle');
  if (aiToggle) {
    // Remove existing listener to prevent duplicates
    aiToggle.removeEventListener('change', handleChatModalAiToggle);
    aiToggle.addEventListener('change', handleChatModalAiToggle);
  }
  
  // Refresh button event listener
  const refreshBtn = document.getElementById('chatModalRefreshBtn');
  if (refreshBtn) {
    refreshBtn.removeEventListener('click', handleChatModalRefresh);
    refreshBtn.addEventListener('click', handleChatModalRefresh);
  }
}

// Remove event listeners for chat modal controls
function removeChatModalEventListeners() {
  const aiToggle = document.getElementById('chatModalAiToggle');
  const refreshBtn = document.getElementById('chatModalRefreshBtn');
  
  if (aiToggle) {
    aiToggle.removeEventListener('change', handleChatModalAiToggle);
  }
  
  if (refreshBtn) {
    refreshBtn.removeEventListener('click', handleChatModalRefresh);
  }
}

// Handle AI toggle change in chat modal
async function handleChatModalAiToggle(event) {
  const chatId = event.target.getAttribute('data-chat-id');
  const enabled = event.target.checked;
  const label = document.getElementById('chatModalAiToggleLabel');
  
  try {
    console.log(`[ChatModal] Toggling AI for chat ${chatId}: ${enabled}`);
    
    // Show loading state
    event.target.disabled = true;
    if (label) label.textContent = 'Updating...';
    
    // Call the existing toggle function
    await toggleChatAI(chatId, enabled);
    
    // Update label
    if (label) {
      label.textContent = enabled ? 'On' : 'Off';
    }
    
    // Show success message
    showToast(`AI ${enabled ? 'enabled' : 'disabled'} for this chat`, 'success');
    
    // Refresh the main chat list to sync the toggle state
    if (typeof window.loadRecentChats === 'function') {
      window.loadRecentChats();
    }
    
  } catch (error) {
    console.error('Error toggling AI in chat modal:', error);
    
    // Revert the toggle state
    event.target.checked = !enabled;
    if (label) {
      label.textContent = !enabled ? 'On' : 'Off';
    }
    
    showToast(`Error: ${error.message}`, 'danger');
  } finally {
    event.target.disabled = false;
  }
}

// Handle refresh button click in chat modal
function handleChatModalRefresh() {
  if (!currentOpenChatId) {
    console.warn('[ChatModal] No chat currently open for refresh');
    return;
  }
  
  console.log(`[ChatModal] Refreshing chat: ${currentOpenChatId}`);
  
  // Show loading state on button
  const refreshBtn = document.getElementById('chatModalRefreshBtn');
  if (refreshBtn) {
    const originalHtml = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i>';
    refreshBtn.disabled = true;
    
    // Add CSS for spin animation if not already present
    if (!document.querySelector('style[data-chat-modal-styles]')) {
      const style = document.createElement('style');
      style.setAttribute('data-chat-modal-styles', 'true');
      style.textContent = `
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Refresh the chat messages
    loadChatMessages(currentOpenChatId).finally(() => {
      // Restore button state
      refreshBtn.innerHTML = originalHtml;
      refreshBtn.disabled = false;
    });
  } else {
    // Fallback if button not found
    loadChatMessages(currentOpenChatId);
  }
}

// Make functions globally available
window.loadRecentChats = loadRecentChats;
window.viewChat = viewChat;
window.refreshCurrentChat = refreshCurrentChat;
window.refreshCurrentChatOptimized = refreshCurrentChatOptimized;
window.loadChatMessages = loadChatMessages;
window.appendNewMessage = appendNewMessage;
window.initializeChatModalControls = initializeChatModalControls;
window.handleChatModalAiToggle = handleChatModalAiToggle;
window.handleChatModalRefresh = handleChatModalRefresh;

// Add event listeners for AI toggle switches
function addAIToggleListeners() {
    const toggles = document.querySelectorAll('.ai-toggle');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', async function() {
            const chatId = this.getAttribute('data-chat-id');
            const enabled = this.checked;
            
            try {
                await toggleChatAI(chatId, enabled);
                
                // Update the label
                const label = this.nextElementSibling;
                if (label) {
                    label.textContent = enabled ? 'On' : 'Off';
                }
                
                showToast(`AI ${enabled ? 'enabled' : 'disabled'} for chat`, 'success');
            } catch (error) {
                console.error('Error toggling AI:', error);
                
                // Revert the toggle state
                this.checked = !enabled;
                
                showToast(`Error: ${error.message}`, 'danger');
            }
        });
    });
}

// Toggle AI for a specific chat
async function toggleChatAI(chatId, enabled) {
    const response = await fetch('/api/chat/ai-states', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chatId: chatId,
            enabled: enabled
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Failed to toggle AI state');
    }
    
    return result;
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// loadChats function (alias for loadRecentChats for compatibility)
function loadChats() {
    loadRecentChats();
}

/**
 * Load and display recent chats in the dashboard
 */
async function loadRecentChats() {
  try {
    const response = await fetch(`/api/chats/recent?limit=10&app=${window.currentApp}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch recent chats: ${response.statusText}`);
    }
    
    const data = await response.json();
    const chatsTableBody = document.getElementById('recent-chats-body');
    if (!chatsTableBody) {
      console.warn('Chats table body not found');
      return;
    }
    
    // Clear existing rows
    chatsTableBody.innerHTML = '';
    
    // Ensure data is an array
    const chats = Array.isArray(data) ? data : [];
    
    if (chats.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="4" class="text-center">No recent chats found</td>';
      chatsTableBody.appendChild(row);
      return;
    }
    
    // Process each chat
    chats.forEach(chat => {
      try {
        const row = document.createElement('tr');
        const lastMessage = chat.lastMessage || '';
        const timestamp = chat.timestamp ? new Date(chat.timestamp).toLocaleString() : 'N/A';
        
        row.innerHTML = `
          <td>${escapeHtml(chat.name || 'Unknown')}</td>
          <td>${escapeHtml(lastMessage.substring(0, 50))}${lastMessage.length > 50 ? '...' : ''}</td>
          <td>${timestamp}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary view-chat" data-chat-id="${chat.id || ''}">
              <i class="bi bi-chat-dots"></i> View
            </button>
          </td>
        `;
        chatsTableBody.appendChild(row);
      } catch (error) {
        console.error('Error rendering chat row:', error, chat);
      }
    });
    
    // Add event listeners to view chat buttons
    document.querySelectorAll('.view-chat').forEach(button => {
      button.addEventListener('click', (e) => {
        const chatId = e.currentTarget.getAttribute('data-chat-id');
        if (chatId) {
          viewChat(chatId);
        }
      });
    });
  } catch (error) {
    console.error('Error loading recent chats:', error);
    showToast(`Failed to load recent chats: ${error.message}`, 'error');
    
    // Show error in the table if possible
    const chatsTableBody = document.getElementById('recent-chats-body');
    if (chatsTableBody) {
      chatsTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-danger">
            Failed to load chats: ${escapeHtml(error.message)}
          </td>
        </tr>`;
    }
  }
    const tbody = document.getElementById('recent-chats-body');
    if (!tbody) return;
    
    try {
        // Show loading state
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4">
                    <div class="spinner-border spinner-border-sm" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <span class="ms-2">Loading recent chats...</span>
                </td>
            </tr>`;
        
        // Fetch recent chats from the server with pagination and sorting
        const response = await fetch('/api/chats?limit=5&sort=desc');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        let chats = [];
        
        // Handle different response formats
        if (Array.isArray(result)) {
            // Direct array format
            chats = result;
        } else if (result.data && Array.isArray(result.data)) {
            // Object with data array
            chats = result.data;
        } else if (result.success && Array.isArray(result.chats)) {
            // Success response with chats array
            chats = result.chats;
        } else {
            console.warn('Unexpected response format:', result);
            throw new Error('Invalid response format from server');
        }
        
        if (chats.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4 text-muted">
                        <i class="bi bi-chat-square-text me-2"></i>
                        No recent chats found
                    </td>
                </tr>`;
            return;
        }
        
        // Render the chats
        tbody.innerHTML = chats.map(chat => {
            // Get the preview content or use a default message
            let lastMessage = chat.preview || 'No messages';
            lastMessage = lastMessage.length > 50 
                ? lastMessage.substring(0, 50) + '...' 
                : lastMessage;
            
            // Get timestamp
            let lastMessageTime = 'Unknown';
            if (chat.timestamp) {
                lastMessageTime = new Date(chat.timestamp).toLocaleString();
            } else if (chat.updatedAt) {
                lastMessageTime = new Date(chat.updatedAt).toLocaleString();
            }
            
            // Format chat ID for display (show last 8 characters)
            const displayId = chat.id.length > 8 
                ? '...' + chat.id.slice(-8) 
                : chat.id;
                
            return `
                <tr class="chat-row" data-chat-id="${chat.id}">
                    <td class="align-middle">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-chat-dots text-muted me-2"></i>
                            <span class="text-truncate" style="max-width: 180px;" title="${escapeHtml(chat.id)}">
                                ${escapeHtml(displayId)}
                            </span>
                        </div>
                    </td>
                    <td class="align-middle">
                        <div class="text-truncate" style="max-width: 250px;" title="${escapeHtml(lastMessage)}">
                            ${escapeHtml(lastMessage)}
                        </div>
                        <small class="text-muted">${lastMessageTime}</small>
                    </td>
                    <td class="align-middle">
                        <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-2 py-1">
                            <i class="bi bi-chat-square-text me-1"></i>
                            ${chat.messageCount || 0}
                        </span>
                    </td>
                    <td class="align-middle">
                        <div class="d-flex">
                            <button class="btn btn-sm btn-outline-primary view-chat" data-chat-id="${chat.id}" 
                                data-bs-toggle="tooltip" title="View chat">
                                <i class="bi bi-eye"></i>
                                <span class="d-none d-md-inline ms-1">View</span>
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-chat ms-2" 
                                data-chat-id="${chat.id}"
                                data-bs-toggle="tooltip" title="Delete chat">
                                <i class="bi bi-trash"></i>
                                <span class="d-none d-md-inline ms-1">Delete</span>
                            </button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
        
                // Initialize tooltips
        const tooltipTriggerList = [].slice.call(tbody.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
        
        // Use event delegation for view and delete buttons
        tbody.addEventListener('click', async (e) => {
            const viewBtn = e.target.closest('.view-chat');
            const deleteBtn = e.target.closest('.delete-chat');
            
            if (viewBtn) {
                e.preventDefault();
                const chatId = viewBtn.dataset.chatId;
                await viewChat(chatId);
                // Switch to the chats tab
                const chatTab = new bootstrap.Tab(document.querySelector('a[href="#chats"]'));
                chatTab.show();
                return;
            }
            
            if (deleteBtn) {
                e.preventDefault();
                const chatId = deleteBtn.dataset.chatId;
                
                // Show confirmation dialog
                const confirmed = await showConfirmationDialog(
                    'Delete Chat',
                    'Are you sure you want to delete this chat? This action cannot be undone.',
                    'Delete',
                    'Cancel',
                    'danger'
                );
                
                if (confirmed) {
                    try {
                        await deleteChat(chatId);
                        showToast('Chat deleted successfully', 'success');
                        loadRecentChats(); // Refresh the list
                    } catch (error) {
                        console.error('Error deleting chat:', error);
                        showToast('Failed to delete chat', 'error');
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading recent chats:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Failed to load recent chats. Please try again later.
                </td>
            </tr>`;
    }
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Handle file upload for knowledge base documents
 * @param {Event} event - The file input change event
 */
async function handleFileUpload(event) {
  const fileInput = event.target;
  const file = fileInput.files[0];
  
  if (!file) return;
  
  // Validate file type
  const validTypes = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'text/html',
    'application/json'
  ];
  
  if (!validTypes.includes(file.type)) {
    showToast('Error: Invalid file type. Please upload a PDF, TXT, MD, DOC, DOCX, CSV, JSON, or HTML file.', 'error');
    fileInput.value = '';
    return;
  }
  
  // Validate file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showToast('Error: File is too large. Maximum size is 10MB.', 'error');
    fileInput.value = '';
    return;
  }
  
  const formData = new FormData();
  formData.append('document', file);
  
  // Show loading state
  const uploadButton = document.getElementById('upload-button');
  let originalHTML = '';
  
  if (uploadButton) {
    originalHTML = uploadButton.innerHTML;
    uploadButton.disabled = true;
    uploadButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Uploading...';
  }
  
  try {
    const response = await fetch('/api/kb/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to upload document');
    }
    
    showToast('Document uploaded successfully', 'success');
    
    // Reload the documents list
    await loadKnowledgeBase();
    
  } catch (error) {
    console.error('Error uploading document:', error);
    showToast(`Error: ${error.message}`, 'error');
    
  } finally {
    // Reset the file input
    fileInput.value = '';
    
    // Reset the button state if it exists
    if (uploadButton) {
      uploadButton.disabled = false;
      uploadButton.innerHTML = originalHTML;
    }
  }
}

/**
 * Load and display knowledge base documents
 */
function loadKnowledgeBase() {
  if (!kbTableBody) return;
  
  // Show loading state
  kbTableBody.innerHTML = '<tr><td colspan="4" class="text-center"><div class="spinner-border spinner-border-sm" role="status"></div> Loading documents...</td></tr>';
  
  // Use the loadKbDocuments function which handles the response correctly
  loadKbDocuments().catch(error => {
    console.error('Error loading knowledge base:', error);
    kbTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error: ${error.message}</td></tr>`;
  });
}

/**
 * Render knowledge base documents in the table
 * @param {Array} documents - Array of document objects
 */
function renderKnowledgeBase(documents) {
  if (!kbTableBody) return;
  
  if (!documents || documents.length === 0) {
    kbTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted">No documents in knowledge base</td>
      </tr>`;
    return;
  }
  
  kbTableBody.innerHTML = documents.map(doc => {
    const docId = doc.id || doc.filename;
    const docName = doc.filename || 'Unknown';
    const docSize = doc.size || 0;
    const uploadedDate = doc.uploaded || doc.added || new Date().toISOString();
    
    return `
      <tr data-document-id="${docId}">
        <td>${docName}</td>
        <td>${formatFileSize(docSize)}</td>
        <td>${new Date(uploadedDate).toLocaleString()}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-danger delete-document" data-id="${docId}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Add event listeners to delete buttons
  document.querySelectorAll('.delete-document').forEach(button => {
    button.addEventListener('click', handleDeleteDocument);
  });
}

/**
 * Handle document deletion
 * @param {Event} event - The click event
 */
async function handleDeleteDocument(event) {
  const button = event.currentTarget;
  const documentId = button.getAttribute('data-id');
  
  if (!documentId) {
    console.error('No document ID found for deletion');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
    return;
  }
  
  try {
    // Show loading state
    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>';
    
    const response = await fetch(`/api/kb/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to delete document');
    }
    
    // Remove the row from the table
    const row = button.closest('tr');
    if (row) {
      row.remove();
      
      // If no more documents, show empty state
      if (kbTableBody.querySelectorAll('tr').length === 0) {
        kbTableBody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center text-muted">No documents in knowledge base</td>
          </tr>`;
      }
    }
    
    showToast('Document deleted successfully', 'success');
    
  } catch (error) {
    console.error('Error deleting document:', error);
    showToast(`Error: ${error.message}`, 'error');
    
    // Reset button state
    const button = event.currentTarget;
    if (button) {
      button.disabled = false;
      button.innerHTML = '<i class="bi bi-trash"></i>';
    }
  }
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Chat history state
window.chatHistoryState = {
  limit: 20,
  offset: 0,
  sort: 'desc',
  total: 0,
  loading: false
};

// Update chat pagination controls
function updateChatPagination() {
  const paginationContainer = document.getElementById('chats-pagination');
  if (!paginationContainer) return;
  
  const { limit, offset, total } = chatHistoryState;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;
  
  let paginationHTML = `
    <div class="d-flex justify-content-between align-items-center">
      <div class="text-muted small">
        ${total > 0 ? `Showing ${offset + 1} to ${Math.min(offset + limit, total)} of ${total} chats` : 'No chats to display'}
      </div>
      <nav>
        <ul class="pagination pagination-sm mb-0">
          ${total > 0 ? `
          <li class="page-item ${offset === 0 ? 'disabled' : ''}">
            <button class="page-link" ${offset === 0 ? 'disabled' : ''} 
              onclick="changeChatPage(${Math.max(0, offset - limit)})">
              <i class="bi bi-chevron-left"></i>
            </button>
          </li>
          <li class="page-item active">
            <span class="page-link">${currentPage} of ${totalPages}</span>
          </li>
          <li class="page-item ${offset + limit >= total ? 'disabled' : ''}">
            <button class="page-link" ${offset + limit >= total ? 'disabled' : ''}
              onclick="changeChatPage(${offset + limit})">
              <i class="bi bi-chevron-right"></i>
            </button>
          </li>
          ` : ''}
        </ul>
      </nav>
    </div>`;
    
  paginationContainer.innerHTML = paginationHTML;
}

// Handle page change for chat history
window.changeChatPage = (newOffset) => {
  chatHistoryState.offset = Math.max(0, newOffset);
  loadChats();
};

// Toggle sort order for chat history
window.toggleChatSort = () => {
  chatHistoryState.sort = chatHistoryState.sort === 'asc' ? 'desc' : 'asc';
  chatHistoryState.offset = 0; // Reset to first page
  
  // Update sort icon
  const sortIcon = document.getElementById('sort-chats');
  if (sortIcon) {
    sortIcon.className = chatHistoryState.sort === 'asc' 
      ? 'bi bi-sort-down' 
      : 'bi bi-sort-up';
  }
  
  loadChats();
};

async function loadChats() {
  const chatsTableBody = document.getElementById('chats-table-body');
  const chatsCountEl = document.getElementById('chats-count');
  const refreshBtn = document.getElementById('refresh-chats');
  
  // chatHistoryState is already initialized globally
  
  if (window.chatHistoryState.loading) return;
  window.chatHistoryState.loading = true;
  
  try {
    // Show loading state
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
    }
    
    // Show loading in table
    chatsTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4">
          <div class="spinner-border text-secondary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-2 mb-0">Loading chat history...</p>
        </td>
      </tr>`;
    
    // Fetch chats with pagination
    const { limit, offset, sort } = chatHistoryState;
    const url = `/api/chats?limit=${limit}&offset=${offset}&sort=${sort}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    const { data: chats, total } = result;
    
    // Update pagination state
    chatHistoryState.total = total || (chats ? chats.length : 0);
    
    // Clear table and update count
    chatsTableBody.innerHTML = '';
    
    // Update the chats count display
    const chatsCountEl = document.getElementById('chats-count');
    if (chatsCountEl) {
      chatsCountEl.textContent = chatHistoryState.total > 0 ? `${chatHistoryState.total} chats` : '';
    }
    
    // Add rows
    if (!chats || chats.length === 0) {
      const noChatsMsg = offset === 0 
        ? 'No chat history found' 
        : 'No more chats to show';
        
      chatsTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-muted">
            <i class="bi bi-chat-square-text fs-1 d-block mb-2"></i>
            ${noChatsMsg}
          </td>
        </tr>`;
      
      updateChatPagination();
      return;
    }
    
    // Add chat rows
    chats.forEach(chat => {
      const row = document.createElement('tr');
      
      const idCell = document.createElement('td');
      idCell.innerHTML = `
        <div class="d-flex align-items-center">
          <i class="bi bi-chat-dots-fill text-primary me-2"></i>
          <span>${formatChatId(chat.id)}</span>
        </div>`;
      
      const previewCell = document.createElement('td');
      const previewText = chat.preview || 'No messages';
      previewCell.innerHTML = `
        <div class="text-truncate" style="max-width: 300px;" title="${escapeHtml(previewText)}">
          ${escapeHtml(previewText)}
        </div>`;
      
      const lastActiveCell = document.createElement('td');
      lastActiveCell.className = 'text-nowrap';
      lastActiveCell.innerHTML = chat.timestamp ? `
        <div class="d-flex align-items-center">
          <i class="bi bi-clock-history text-muted me-2"></i>
          <span>${new Date(chat.timestamp).toLocaleString()}</span>
        </div>` : 'N/A';
      
      const messageCountCell = document.createElement('td');
      messageCountCell.className = 'text-center';
      messageCountCell.innerHTML = `
        <span class="badge bg-primary rounded-pill">
          ${chat.messageCount || 0}
        </span>`;
      
      const actionsCell = document.createElement('td');
      actionsCell.className = 'text-nowrap text-end';
      
      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn btn-sm btn-outline-primary me-2';
      viewBtn.innerHTML = '<i class="bi bi-eye"></i> View';
      viewBtn.addEventListener('click', () => viewChat(chat.id));
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
      deleteBtn.addEventListener('click', async () => {
        const confirmed = await showConfirmDialog(
          'Delete Chat',
          `Are you sure you want to delete this chat history? This action cannot be undone.`,
          'Delete',
          'Cancel',
          'danger'
        );
        
        if (confirmed) {
          try {
            const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
              method: 'DELETE'
            });
            if (response.ok) {
              loadChats(); // Refresh the list
              showToast('Chat deleted successfully', 'success');
            } else {
              throw new Error('Failed to delete chat');
            }
          } catch (error) {
            console.error('Error deleting chat:', error);
            showToast('Error deleting chat', 'danger');
          }
        }
      });
      
      actionsCell.appendChild(viewBtn);
      actionsCell.appendChild(deleteBtn);
      
      row.appendChild(idCell);
      row.appendChild(previewCell);
      row.appendChild(lastActiveCell);
      row.appendChild(messageCountCell);
      row.appendChild(actionsCell);
      
      chatsTableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading chats:', error);
    
    // Only update the UI if the error is not due to abort
    if (error.name !== 'AbortError') {
      chatsTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4">
            <i class="bi bi-exclamation-triangle text-danger fs-1 d-block mb-2"></i>
            <p class="text-danger mb-0">Error loading chats: ${error.message}</p>
            <button class="btn btn-sm btn-outline-primary mt-3" onclick="loadChats()">
              <i class="bi bi-arrow-clockwise"></i> Try Again
            </button>
          </td>
        </tr>`;
      
      if (chatsCountEl) {
        chatsCountEl.textContent = 'Error loading chats';
      }
    }
  } finally {
    chatHistoryState.loading = false;
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
    }
    
    // Update pagination controls
    updateChatPagination();
  }
}

/**
 * View chat messages in a modal
 * @param {string} chatId - The ID of the chat to view
 * @param {Array} [messages] - Optional messages array. If not provided, will be fetched from server
 */
async function viewChat(chatId, messages) {
  try {
    // Get DOM elements
    const chatModalEl = document.getElementById('chatModal');
    const chatModalTitle = document.getElementById('chatModalTitle');
    const chatMessages = document.getElementById('chatMessages');
    
    if (!chatModalEl || !chatModalTitle || !chatMessages) {
      throw new Error('Required chat UI elements not found');
    }
    
    // Initialize modal
    const chatModal = new bootstrap.Modal(chatModalEl);
    
    // Set current chat ID for export
    currentChatId = chatId;
    
    // Update UI
    chatModalTitle.textContent = `Chat: ${formatChatId(chatId)}`;
    chatMessages.innerHTML = '<div class="text-center p-3"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';
    
    // Show modal immediately with loading state
    chatModal.show();
    
    // Clear current chat ID when modal is closed
    const onModalClose = () => {
      currentChatId = null;
      chatModalEl.removeEventListener('hidden.bs.modal', onModalClose);
    };
    chatModalEl.addEventListener('hidden.bs.modal', onModalClose);
    
    // If messages not provided, fetch them from the server
    if (!messages) {
      try {
        console.log(`Fetching chat messages for ID: ${chatId}`);
        const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`);
        if (!response.ok) throw new Error(`Failed to fetch chat: ${response.statusText}`);
        
        const responseText = await response.text();
        console.log('Raw API response:', responseText);
        
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
        }
        
        console.log('Parsed response:', result);
        
        // Handle different response formats
        if (result.messages) {
          console.log('Using messages from result.messages');
          messages = result.messages;
        } else if (result.conversation) {
          console.log('Using messages from result.conversation');
          messages = result.conversation;
        } else if (Array.isArray(result)) {
          console.log('Using array result directly');
          messages = result;
        } else if (!result.success) {
          throw new Error(result.error || 'Failed to load chat');
        } else {
          console.warn('No messages found in response');
          messages = [];
        }
        
        console.log('Final messages array:', messages);
      } catch (error) {
        console.error('Error fetching chat:', error);
        throw new Error(`Failed to fetch chat: ${error.message}`);
      }
    }
    
    // Render messages
    renderChatMessages(chatMessages, messages);
    
  } catch (error) {
    console.error('Error viewing chat:', error);
    showToast(`Error loading chat: ${error.message}`, 'danger');
    
    // Update UI with error message
    if (chatMessages) {
      chatMessages.innerHTML = `
        <div class="alert alert-danger m-3">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>
          Failed to load chat: ${error.message}
        </div>`;
    }
  }
}

/**
 * Render chat messages in the messages container with markdown support
 * @param {HTMLElement} container - The container element to render messages in
 * @param {Array} messages - Array of message objects
 */
function renderChatMessages(container, messages) {
  if (!container) return;
  
  // Configure marked.js options
  // Make sure marked is available before configuring
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      gfm: true,
      breaks: true,
      headerIds: false,
      mangle: false,
      smartypants: true
    });
  } else {
    console.error('marked.js is not loaded');
  }
  
  // Clear container
  container.innerHTML = '';
  
  if (!Array.isArray(messages) || messages.length === 0) {
    container.innerHTML = `
      <div class="text-center p-4">
        <div class="text-muted">
          <i class="bi bi-chat-square-text fs-1 d-block mb-2"></i>
          No messages in this chat
        </div>
      </div>`;
    return;
  }
  
  // Create a document fragment for better performance
  const fragment = document.createDocumentFragment();
  
  messages.forEach(msg => {
    if (!msg || typeof msg !== 'object') return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message mb-3 p-3 rounded-3 position-relative ${
      msg.role === 'user' 
        ? 'bg-primary bg-opacity-10 border border-primary border-opacity-25' 
        : 'bg-light border'
    }`;
    
    // Message header with role and timestamp
    const headerDiv = document.createElement('div');
    headerDiv.className = 'd-flex justify-content-between align-items-center mb-2';
    
    // Role badge with icon
    const roleBadge = document.createElement('span');
    roleBadge.className = `badge d-inline-flex align-items-center ${
      msg.role === 'user' ? 'bg-primary' : 'bg-success'
    }`;
    
    const icon = document.createElement('i');
    icon.className = `bi ${msg.role === 'user' ? 'bi-person' : 'bi-robot'} me-1`;
    roleBadge.appendChild(icon);
    
    const roleText = document.createElement('span');
    roleText.textContent = msg.role === 'user' ? 'You' : 'Assistant';
    roleBadge.appendChild(roleText);
    
    // Timestamp
    const timeSpan = document.createElement('small');
    timeSpan.className = 'text-muted';
    timeSpan.textContent = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : 'Just now';
    
    headerDiv.appendChild(roleBadge);
    headerDiv.appendChild(timeSpan);
    
    // Message content with markdown support
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content mt-2';
    
    try {
      // Sanitize and render markdown
      const rawContent = String(msg.content || '');
      let sanitizedHtml = '';
      
      // Check if marked is available
      if (typeof marked !== 'undefined') {
        try {
          // Use marked.parse for newer versions or marked for older versions
          const parsedContent = marked.parse ? marked.parse(rawContent) : marked(rawContent);
          
          // Sanitize the HTML if DOMPurify is available
          if (typeof DOMPurify !== 'undefined') {
            sanitizedHtml = DOMPurify.sanitize(parsedContent, {
              ALLOWED_TAGS: [
                'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
              ],
              ALLOWED_ATTR: ['href', 'target', 'rel']
            });
          } else {
            sanitizedHtml = parsedContent;
            console.warn('DOMPurify is not loaded, using unsanitized HTML');
          }
        } catch (parseError) {
          console.error('Error parsing markdown:', parseError);
          sanitizedHtml = escapeHtml(rawContent);
        }
      } else {
        // Fallback to plain text with line breaks if marked is not available
        sanitizedHtml = escapeHtml(rawContent).replace(/\n/g, '<br>');
      }
      
      contentDiv.innerHTML = sanitizedHtml;
      
      // Add styling to code blocks
      const codeBlocks = contentDiv.querySelectorAll('pre code');
      codeBlocks.forEach(block => {
        block.classList.add('p-2', 'bg-dark', 'text-light', 'rounded', 'd-block');
      });
      
      // Add styling to links
      const links = contentDiv.querySelectorAll('a');
      links.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      });
      
    } catch (error) {
      console.error('Error rendering message content:', error);
      contentDiv.textContent = msg.content || '';
    }
    
    // Assemble the message
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    
    fragment.appendChild(messageDiv);
  });
  
  // Append all messages at once
  container.appendChild(fragment);
  
  // Apply syntax highlighting if available
  if (window.hljs) {
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightBlock(block);
    });
  }
  
  // Auto-scroll to bottom with smooth behavior
  container.scrollTo({
    top: container.scrollHeight,
    behavior: 'smooth'
  });
}

async function uploadDocument(event) {
  try {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Show loading indicator
    const kbContainer = document.getElementById('kb-documents');
    if (kbContainer) {
      kbContainer.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><p>Uploading document...</p></div>';
    }
    
    const response = await fetch('/api/kb/documents', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Upload response:', text);
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    if (result.success) {
      showToast('success', `Document "${file.name}" uploaded successfully`);
      // Reload the document list
      await loadKbDocuments();
    } else {
      throw new Error(result.error || 'Upload failed');
    }
  } catch (error) {
    console.error('Error uploading document:', error);
    showToast('error', `Upload failed: ${error.message}`);
  } finally {
    // Reset the file input
    const fileInput = document.getElementById('kb-file-input');
    if (fileInput) fileInput.value = '';
  }
}

async function uploadDocument(event) {
  try {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('Uploading document:', file.name);
    
    // Show upload in progress
    const kbContainer = document.getElementById('kb-documents');
    if (kbContainer) {
      kbContainer.innerHTML = `
        <div class="text-center">
          <div class="spinner-border" role="status"></div>
          <p>Uploading ${file.name}...</p>
        </div>
      `;
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('document', file);
    
    // Send the file to the server
    const response = await fetch('/api/kb/upload', {
      method: 'POST',
      body: formData
    });
    
    // Get response text first
    const responseText = await response.text();
    console.log('Raw response:', responseText);
    
    // Try to parse as JSON
    let result;
    try {
      result = JSON.parse(responseText);
      console.log('Upload response:', result);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      throw new Error(`Server returned invalid JSON response. Status: ${response.status} ${response.statusText}`);
    }
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || `Failed to upload document: ${response.status} ${response.statusText}`);
    }
    
    // Reset the file input
    event.target.value = '';
    
    // Show success message
    showToast('Document uploaded successfully', 'success');
    
    // Reload the KB documents list
    loadKbDocuments();
  } catch (error) {
    console.error('Error uploading document:', error);
    showToast(`Upload failed: ${error.message}`, 'error');
    
    // Reset the file input
    event.target.value = '';
    
    // Reload the KB documents list
    loadKbDocuments();
  }
}

async function loadKbDocuments() {
  const kbContainer = document.getElementById('kb-documents');
  if (!kbContainer) return;
  
  // Show loading state
  kbContainer.innerHTML = `
    <div class="text-center">
      <div class="spinner-border" role="status"></div>
      <p>Loading knowledge base documents...</p>
    </div>
  `;
  
  try {
    const response = await fetch('/api/kb');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch KB documents: ${response.status} ${response.statusText}`);
    }
    
    const documents = await response.json();
    renderKnowledgeBase(Array.isArray(documents) ? documents : []);
  } catch (error) {
    console.error('Error loading KB documents:', error);
    kbContainer.innerHTML = `<div class="alert alert-danger">Failed to load knowledge base: ${error.message}</div>`;
  }
}

function renderKnowledgeBase(documents) {
  const kbContainer = document.getElementById('kb-documents');
  if (!kbContainer) return;
  
  if (!documents || documents.length === 0) {
    kbContainer.innerHTML = `<div class="alert alert-info">No documents found in knowledge base</div>`;
    return;
  }
  
  // Create a table to display the documents
  const table = document.createElement('table');
  table.className = 'table table-striped';
  
  // Create table header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Filename</th>
      <th>Size</th>
      <th>Chunks</th>
      <th>Uploaded</th>
      <th>Use in RAG</th>
      <th>Actions</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Create table body
  const tbody = document.createElement('tbody');
    
  documents.forEach(doc => {
    const tr = document.createElement('tr');
    
    // Determine if document is enabled (default to true if not specified)
    const isEnabled = doc.enabled !== false;
    
    // Format file size
    const sizeText = formatFileSize(doc.fileSize || 0);
    
    // Format date
    let dateText = 'Unknown';
    if (doc.timestamp) {
      try {
        const date = new Date(doc.timestamp);
        dateText = date.toLocaleString();
      } catch (e) {
        console.error('Error formatting date:', e);
      }
    }
    
    // Create the toggle switch for enabling/disabling the document
    const toggleId = `doc-toggle-${doc.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    tr.innerHTML = `
      <td>${doc.name || 'Unknown'}</td>
      <td>${sizeText}</td>
      <td>${doc.chunks || 0}</td>
      <td>${dateText}</td>
      <td>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="${toggleId}" 
                 ${isEnabled ? 'checked' : ''} 
                 onchange="toggleKbDocument('${doc.name}', this.checked)">
          <label class="form-check-label" for="${toggleId}">
            ${isEnabled ? 'Enabled' : 'Disabled'}
          </label>
        </div>
      </td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteKbDocument('${doc.name}')">
          <i class="bi bi-trash"></i> Delete
        </button>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  kbContainer.innerHTML = '';
  kbContainer.appendChild(table);
}

async function deleteKbDocument(filename) {
  if (!confirm(`Are you sure you want to delete ${filename}?`)) {
    return;
  }
  
  try {
    console.log('Deleting document:', filename);
    
    const response = await fetch(`/api/kb/documents/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Delete error response:', text);
      throw new Error(`Failed to delete document: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Delete response:', result);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete document');
    }
    
    // Show success message
    showToast('Document deleted successfully', 'success');
    
    // Reload the KB documents list
    loadKbDocuments();
  } catch (error) {
    console.error('Error deleting document:', error);
    showToast(`Delete failed: ${error.message}`, 'error');
    
    // Reload the KB documents list
    loadKbDocuments();
  }
}

// Format file size helper function
function formatFileSize(size) {
  if (size < 1024) return `${size} bytes`;
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1073741824) return `${(size / 1048576).toFixed(1)} MB`;
  return `${(size / 1073741824).toFixed(1)} GB`;
}

// Toggle document enabled/disabled state for RAG operations
async function toggleKbDocument(fileName, enabled) {
  try {
    const response = await fetch('/api/kb/document/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fileName, enabled })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.success) {
      showToast(`Document ${fileName} ${enabled ? 'enabled' : 'disabled'} for RAG operations`, 'success');
    } else {
      throw new Error(result.message || 'Failed to toggle document status');
    }
    
    // Update the document list to reflect the change
    loadKbDocuments();
    
    return result;
  } catch (error) {
    console.error('Error toggling document status:', error);
    showToast(`Error: ${error.message}`, 'danger');
    return { success: false, error: error.message };
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(toastContainer);
  }
  
  // Create a unique ID for this toast
  const toastId = `toast-${Date.now()}`;
  
  // Set the background color based on the type
  let bgClass = 'bg-info';
  if (type === 'success') bgClass = 'bg-success';
  if (type === 'error') bgClass = 'bg-danger';
  if (type === 'warning') bgClass = 'bg-warning';
  
  // Create the toast element
  const toastEl = document.createElement('div');
  toastEl.className = `toast ${bgClass} text-white`;
  toastEl.id = toastId;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  
  toastEl.innerHTML = `
    <div class="toast-header">
      <strong class="me-auto">WhatsXENO</strong>
      <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
    <div class="toast-body">
      ${message}
    </div>
  `;
  
  // Add the toast to the container
  toastContainer.appendChild(toastEl);
  
  // Initialize the toast
  const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
  
  // Show the toast
  toast.show();
  
  // Remove the toast element after it's hidden
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

// End of KB management functions

// Utility functions
function formatChatId(chatId) {
  return chatId.includes('@') ? chatId : `${chatId.replace(/@c\.us$/g, '')}`;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Show a confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {string} confirmText - Text for confirm button
 * @param {string} cancelText - Text for cancel button
 * @param {string} variant - Bootstrap variant (e.g., 'danger', 'primary')
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
function showConfirmDialog(title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'primary') {
  return new Promise((resolve) => {
    // Create modal elements
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.tabIndex = '-1';
    modal.setAttribute('data-bs-backdrop', 'static');
    modal.setAttribute('data-bs-keyboard', 'false');
    
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">${cancelText}</button>
            <button type="button" class="btn btn-${variant}" id="confirmBtn">${confirmText}</button>
          </div>
        </div>
      </div>`;
    
    // Append to body
    document.body.appendChild(modal);
    
    // Initialize modal
    const bsModal = new bootstrap.Modal(modal);
    
    // Handle confirm button
    const confirmBtn = modal.querySelector('#confirmBtn');
    confirmBtn.addEventListener('click', () => {
      resolve(true);
      bsModal.hide();
    });
    
    // Handle modal close
    modal.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modal);
    });
    
    // Show modal
    bsModal.show();
    
    // Focus confirm button for better keyboard navigation
    setTimeout(() => {
      confirmBtn.focus();
    }, 100);
  });
}

// Command history state
window.commandHistoryState = {
  limit: 50,
  offset: 0,
  sort: 'desc',
  total: 0,
  loading: false
};

// Command history functions
async function loadCommandHistory() {
  if (commandHistoryState.loading) return;
  
  commandHistoryState.loading = true;
  updateCommandHistoryLoadingState(true);
  
  try {
    const { limit, offset, sort } = commandHistoryState;
    const url = `/api/commands?limit=${limit}&offset=${offset}&sort=${sort}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch command history');
    
    const { data: commands, total } = await response.json();
    commandHistoryState.total = total;
    
    // Clear table
    commandHistoryBody.innerHTML = '';
    
    // Add rows
    if (!commands || commands.length === 0) {
      commandHistoryBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted">
            <i class="bi bi-clock-history me-2"></i>
            No commands found
          </td>
        </tr>`;
      updatePaginationControls();
      return;
    }
    
    commands.forEach(cmd => {
      const row = document.createElement('tr');
      
      const timeCell = document.createElement('td');
      timeCell.className = 'text-nowrap';
      timeCell.innerHTML = `
        <div class="d-flex align-items-center">
          <i class="bi bi-clock-history text-muted me-2"></i>
          <span>${new Date(cmd.timestamp).toLocaleString()}</span>
        </div>`;
      
      const senderCell = document.createElement('td');
      senderCell.innerHTML = `
        <div class="d-flex align-items-center">
          <i class="bi bi-person-fill text-primary me-2"></i>
          <span>${formatChatId(cmd.sender || 'System')}</span>
        </div>`;
      
      const commandCell = document.createElement('td');
      commandCell.className = 'font-monospace';
      commandCell.textContent = cmd.command;
      
      const argsCell = document.createElement('td');
      argsCell.className = 'text-muted';
      argsCell.textContent = cmd.args ? cmd.args.join(' ') : '';
      
      row.appendChild(timeCell);
      row.appendChild(senderCell);
      row.appendChild(commandCell);
      row.appendChild(argsCell);
      
      commandHistoryBody.appendChild(row);
    });
    
    updatePaginationControls();
  } catch (error) {
    console.error('Error loading command history:', error);
    commandHistoryBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Failed to load command history: ${error.message}
        </td>
      </tr>`;
  } finally {
    commandHistoryState.loading = false;
    updateCommandHistoryLoadingState(false);
  }
}

function updateCommandHistoryLoadingState(isLoading) {
  const loadingIndicator = document.getElementById('command-history-loading');
  const refreshButton = document.getElementById('refresh-commands');
  
  if (loadingIndicator) {
    loadingIndicator.style.display = isLoading ? 'block' : 'none';
  }
  
  if (refreshButton) {
    refreshButton.disabled = isLoading;
    refreshButton.innerHTML = isLoading 
      ? '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...'
      : '<i class="bi bi-arrow-clockwise"></i> Refresh';
  }
}

function updatePaginationControls() {
  const pagination = document.getElementById('command-history-pagination');
  if (!pagination) return;
  
  const { limit, offset, total } = commandHistoryState;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  
  let paginationHTML = `
    <div class="d-flex justify-content-between align-items-center">
      <div class="text-muted small">
        Showing ${Math.min(offset + 1, total)} to ${Math.min(offset + limit, total)} of ${total} commands
      </div>
      <nav>
        <ul class="pagination pagination-sm mb-0">
          <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <button class="page-link" onclick="changeCommandHistoryPage(${offset - limit})" ${currentPage === 1 ? 'disabled' : ''}>
              <i class="bi bi-chevron-left"></i>
            </button>
          </li>
          <li class="page-item active">
            <span class="page-link">${currentPage}</span>
          </li>
          <li class="page-item ${currentPage >= totalPages ? 'disabled' : ''}">
            <button class="page-link" onclick="changeCommandHistoryPage(${offset + limit})" ${currentPage >= totalPages ? 'disabled' : ''}>
              <i class="bi bi-chevron-right"></i>
            </button>
          </li>
        </ul>
      </nav>
    </div>`;
    
  pagination.innerHTML = paginationHTML;
}

// Global function for pagination
window.changeCommandHistoryPage = (newOffset) => {
  commandHistoryState.offset = Math.max(0, newOffset);
  loadCommandHistory();
};

// Toggle sort order
function toggleCommandHistorySort() {
  commandHistoryState.sort = commandHistoryState.sort === 'asc' ? 'desc' : 'asc';
  commandHistoryState.offset = 0; // Reset to first page
  loadCommandHistory();
  
  // Update sort icon
  const sortIcon = document.getElementById('sort-command-history');
  if (sortIcon) {
    sortIcon.className = commandHistoryState.sort === 'asc' 
      ? 'bi bi-sort-down' 
      : 'bi bi-sort-up';
  }
}

// Initialize memory chart
function initializeMemoryChart() {
  const ctx = document.getElementById('memoryChart');
  if (!ctx) return;
  
  // Create initial empty chart
  memoryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Heap Used (MB)',
        data: [],
        borderColor: 'rgba(78, 115, 223, 1)',
        backgroundColor: 'rgba(78, 115, 223, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(78, 115, 223, 1)',
        pointBorderColor: '#fff',
        pointHoverRadius: 5,
        pointHoverBackgroundColor: 'rgba(78, 115, 223, 1)',
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            callback: (value) => value + ' MB'
          }
        }
      },
      plugins: {
        legend: {
          display: true
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.raw} MB`
          }
        }
      }
    }
  });
  
  // Initial update
  updateMemoryChart();
}

// System stats functions
async function loadSystemStats() {
  try {
    const response = await fetch('/api/stats');
    if (!response.ok) throw new Error('Failed to fetch system stats');
    
    const stats = await response.json();
    
    // Update dashboard values
    uptimeValue.textContent = formatUptime(stats.uptime);
    heapUsedValue.textContent = formatBytes(stats.memory.heapUsed);
    cpuUsageValue.textContent = formatCpuUsage(stats.cpu);
    platformInfoValue.textContent = `${stats.platform} (${stats.nodeVersion})`;
    
    // Update system tab values
    nodeVersionElement.textContent = stats.nodeVersion;
    systemPlatformElement.textContent = stats.platform;
    systemUptimeElement.textContent = formatUptime(stats.uptime);
    
    // Update CPU model
    const cpuModelElement = document.getElementById('cpu-model');
    if (cpuModelElement && stats.cpuModel) {
      cpuModelElement.textContent = stats.cpuModel;
    }
    
    // Memory usage details
    memoryRssElement.textContent = formatBytes(stats.memory.rss);
    memoryHeapTotalElement.textContent = formatBytes(stats.memory.heapTotal);
    memoryHeapUsedElement.textContent = formatBytes(stats.memory.heapUsed);
    memoryExternalElement.textContent = formatBytes(stats.memory.external || 0);
    
    // Update GPU information if available
    updateGpuInfo(stats.gpu);
  } catch (error) {
    console.error('Error loading system stats:', error);
  }
}

// Update GPU information display
function updateGpuInfo(gpuData) {
  const gpuLoading = document.getElementById('gpu-loading');
  const gpuInfo = document.getElementById('gpu-info');
  const gpuNotAvailable = document.getElementById('gpu-not-available');
  
  // Handle case when no GPU data is available
  if (!gpuData) {
    if (gpuLoading) gpuLoading.style.display = 'none';
    if (gpuNotAvailable) gpuNotAvailable.style.display = 'block';
    if (gpuInfo) gpuInfo.style.display = 'none';
    return;
  }
  
  // Hide loading and show GPU info
  if (gpuLoading) gpuLoading.style.display = 'none';
  if (gpuNotAvailable) gpuNotAvailable.style.display = 'none';
  if (gpuInfo) gpuInfo.style.display = 'block';
  
  // Update GPU details
  const modelElement = document.getElementById('gpu-model');
  if (modelElement && gpuData.model) modelElement.textContent = gpuData.model;
  
  const vendorElement = document.getElementById('gpu-vendor');
  if (vendorElement && gpuData.vendor) vendorElement.textContent = gpuData.vendor;
  
  // Format and display VRAM if available
  const vramElement = document.getElementById('gpu-vram');
  if (vramElement && gpuData.vram) {
    // VRAM is already in MB from backend, convert to GB if large enough
    if (gpuData.vram >= 1024) {
      const vramInGB = (gpuData.vram / 1024).toFixed(1);
      vramElement.textContent = `${vramInGB} GB`;
    } else {
      vramElement.textContent = `${gpuData.vram} MB`;
    }
  } else if (vramElement) {
    vramElement.textContent = 'Unknown';
  }
  
  // Display driver version if available
  const driverElement = document.getElementById('gpu-driver');
  if (driverElement && gpuData.driver) {
    driverElement.textContent = gpuData.driver;
  } else if (driverElement) {
    driverElement.textContent = 'Unknown';
  }
  
  // Update GPU usage if available
  const usageBar = document.getElementById('gpu-usage-bar');
  const usageText = document.getElementById('gpu-usage-text');
  const usageContainer = document.getElementById('gpu-usage-container');
  
  if (usageContainer) {
    if (gpuData.usage !== null && gpuData.usage !== undefined) {
      usageContainer.style.display = 'block';
      const usagePercent = Math.round(gpuData.usage);
      
      if (usageBar) {
        usageBar.style.width = `${usagePercent}%`;
        usageBar.setAttribute('aria-valuenow', usagePercent);
        
        // Remove existing color classes and add the appropriate one
        usageBar.classList.remove('bg-success', 'bg-warning', 'bg-danger');
        usageBar.classList.add(
          usagePercent > 80 ? 'bg-danger' : 
          usagePercent > 50 ? 'bg-warning' : 
          'bg-success'
        );
      }
      
      if (usageText) {
        usageText.textContent = `${usagePercent}%`;
      }
    } else {
      usageContainer.style.display = 'none';
      
      if (usageBar) {
        usageBar.style.width = '0%';
        usageBar.setAttribute('aria-valuenow', 0);
        usageBar.classList.add('bg-secondary');
      }
      
      if (usageText) {
        usageText.textContent = 'N/A';
      }
    }
  }
}

async function updateMemoryChart() {
  if (!memoryChart) return;
  
  try {
    const response = await fetch('/api/stats');
    if (!response.ok) throw new Error('Failed to fetch stats for chart');
    
    const stats = await response.json();
    const heapUsedMB = Math.round(stats.memory.heapUsed / (1024 * 1024) * 100) / 100;
    
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();
    
    // Add new data point
    memoryChart.data.labels.push(timeLabel);
    memoryChart.data.datasets[0].data.push(heapUsedMB);
    
    // Keep only the last 10 data points
    if (memoryChart.data.labels.length > 10) {
      memoryChart.data.labels.shift();
      memoryChart.data.datasets[0].data.shift();
    }
    
    memoryChart.update();
  } catch (error) {
    console.error('Error updating memory chart:', error);
  }
}

// Utility functions for formatting
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}

function formatCpuUsage(cpu) {
  if (!cpu) return 'N/A';
  const total = cpu.user + cpu.system;
  return `${Math.round(total / 1000)} ms`;
}

function formatBytes(bytes) {
  return formatFileSize(bytes);
}

// ===============================
// CHAT FUNCTIONALITY
// ===============================

// currentChatId already declared above, reusing it
let chatsPagination = { offset: 0, limit: 20, total: 0 };
let currentChatSort = 'desc';
let aiToggleStates = new Map(); // Track AI toggle state per chat

// Load AI states from backend
async function loadAIStates() {
  try {
    const response = await fetch('/api/chat/ai-states');
    const data = await response.json();
    
    if (data.success && data.aiStates) {
      // Convert object back to Map
      aiToggleStates = new Map(Object.entries(data.aiStates));
      console.log(`Loaded AI states for ${aiToggleStates.size} chats`);
    }
  } catch (error) {
    console.error('Error loading AI states:', error);
  }
}

// Save AI state to backend
async function saveAIState(chatId, enabled) {
  try {
    const response = await fetch('/api/chat/ai-states', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: chatId,
        enabled: enabled
      })
    });
    
    const result = await response.json();
    if (!result.success) {
      console.error('Failed to save AI state:', result.error);
    }
  } catch (error) {
    console.error('Error saving AI state:', error);
  }
}

// Load chats when the tab is shown
document.addEventListener('DOMContentLoaded', function() {
  // Add event listener for chats tab
  const chatsTab = document.querySelector('a[href="#chats"]');
  if (chatsTab) {
    chatsTab.addEventListener('shown.bs.tab', function() {
      loadAIStates().then(() => loadChats());
    });
  }
  
  // Add refresh button listener
  const refreshChatsBtn = document.getElementById('refresh-chats');
  if (refreshChatsBtn) {
    refreshChatsBtn.addEventListener('click', loadChats);
  }
  
  // Add clear all chats button listener
  const clearAllChatsBtn = document.getElementById('clear-all-chats');
  if (clearAllChatsBtn) {
    clearAllChatsBtn.addEventListener('click', clearAllChats);
  }
});

// Load and display chats
async function loadChats() {
  try {
    const response = await fetch(`/api/chats?limit=${chatsPagination.limit}&offset=${chatsPagination.offset}&sort=${currentChatSort}`);
    const data = await response.json();
    
    if (data.success) {
      displayChats(data.data);
      chatsPagination = { offset: data.offset, limit: data.limit, total: data.total };
      updateChatsCount(data.total);
      updateChatsPagination(data);
    } else {
      console.error('Failed to load chats:', data.error);
      showError('Failed to load chat history');
    }
  } catch (error) {
    console.error('Error loading chats:', error);
    showError('Error loading chat history');
  }
}

// Display chats in the table
function displayChats(chats) {
  const tbody = document.getElementById('chats-table-body');
  if (!tbody) return;
  
  if (!chats || chats.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4">
          <i class="bi bi-chat-dots-fill fs-1 text-muted"></i>
          <p class="mt-2 mb-0 text-muted">No chat history found</p>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = chats.map(chat => {
    const lastActive = new Date(chat.timestamp).toLocaleString();
    const preview = chat.preview ? escapeHtml(chat.preview.substring(0, 50)) + (chat.preview.length > 50 ? '...' : '') : 'No messages';
    const chatId = escapeHtml(chat.id);
    const isAIEnabled = aiToggleStates.get(chat.id) !== false; // Default to enabled
    
    return `
      <tr class="chat-row" data-chat-id="${chatId}">
        <td>
          <div class="d-flex align-items-center">
            <span class="chat-id-display" title="${chatId}">${chatId.length > 20 ? chatId.substring(0, 20) + '...' : chatId}</span>
            <div class="ms-auto">
              <div class="form-check form-switch form-check-inline">
                <input class="form-check-input ai-toggle" type="checkbox" 
                       id="ai-toggle-${chatId}" 
                       data-chat-id="${chatId}" 
                       ${isAIEnabled ? 'checked' : ''}>
                <label class="form-check-label small text-muted" for="ai-toggle-${chatId}" title="Toggle AI responses">
                  AI
                </label>
              </div>
            </div>
          </div>
        </td>
        <td>
          <div class="chat-preview">${preview}</div>
        </td>
        <td>
          <small class="text-muted">${lastActive}</small>
        </td>
        <td class="text-center">
          <span class="badge bg-primary">${chat.messageCount || 0}</span>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary view-chat-btn" 
                  data-chat-id="${chatId}" 
                  data-bs-toggle="modal" 
                  data-bs-target="#chatModal">
            <i class="bi bi-eye"></i> View
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  // Add event listeners for view buttons and AI toggles
  tbody.querySelectorAll('.view-chat-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const chatId = this.getAttribute('data-chat-id');
      openChatModal(chatId);
    });
  });
  
  tbody.querySelectorAll('.ai-toggle').forEach(toggle => {
    toggle.addEventListener('change', async function() {
      const chatId = this.getAttribute('data-chat-id');
      const isEnabled = this.checked;
      
      // Update local state
      aiToggleStates.set(chatId, isEnabled);
      
      // Save to backend
      await saveAIState(chatId, isEnabled);
      
      console.log(`AI ${isEnabled ? 'enabled' : 'disabled'} for chat: ${chatId}`);
    });
  });
}

// Open chat modal and load conversation
async function openChatModal(chatId) {
  currentChatId = chatId;
  const modal = document.getElementById('chatModal');
  const title = modal.querySelector('.modal-title');
  const body = modal.querySelector('#chat-messages');
  
  if (title) title.textContent = `Chat: ${chatId}`;
  if (body) body.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
  
  try {
    const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`);
    const data = await response.json();
    
    if (data.success && data.conversation) {
      displayChatMessages(data.conversation);
    } else {
      body.innerHTML = '<div class="alert alert-warning">No messages found for this chat.</div>';
    }
  } catch (error) {
    console.error('Error loading chat:', error);
    body.innerHTML = '<div class="alert alert-danger">Error loading chat messages.</div>';
  }
}

// Display chat messages in modal
function displayChatMessages(messages) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  
  if (!messages || messages.length === 0) {
    container.innerHTML = '<div class="alert alert-info">No messages in this conversation.</div>';
    return;
  }
  
  container.innerHTML = messages.map(msg => {
    const isUser = msg.role === 'user';
    const timestamp = new Date(msg.timestamp).toLocaleString();
    const content = escapeHtml(msg.content);
    
    return `
      <div class="message mb-3 ${isUser ? 'user-message' : 'assistant-message'}">
        <div class="d-flex ${isUser ? 'justify-content-end' : 'justify-content-start'}">
          <div class="message-bubble ${isUser ? 'bg-primary text-white' : 'bg-light'} p-3 rounded" style="max-width: 80%;">
            <div class="message-content">${content}</div>
            <div class="message-time small mt-1 ${isUser ? 'text-light' : 'text-muted'}">
              <i class="bi bi-${isUser ? 'person-fill' : 'robot'}"></i> ${timestamp}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Send manual message
async function sendManualMessage() {
  const messageInput = document.getElementById('manual-message-input');
  const sendBtn = document.getElementById('send-manual-message');
  
  if (!currentChatId || !messageInput) return;
  
  const message = messageInput.value.trim();
  if (!message) return;
  
  // Disable input and button
  messageInput.disabled = true;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Sending...';
  
  try {
    // Check if AI is enabled for this chat
    const isAIEnabled = aiToggleStates.get(currentChatId) !== false;
    
    const response = await fetch('/api/chat/send-manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: currentChatId,
        message: message,
        enableAI: isAIEnabled
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      messageInput.value = '';
      // Reload the conversation
      await openChatModal(currentChatId);
      showSuccess('Message sent successfully');
    } else {
      showError('Failed to send message: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showError('Error sending message');
  } finally {
    // Re-enable input and button
    messageInput.disabled = false;
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="bi bi-send"></i> Send';
  }
}

// Toggle chat sort
function toggleChatSort() {
  currentChatSort = currentChatSort === 'desc' ? 'asc' : 'desc';
  const sortIcon = document.getElementById('sort-chats');
  const sortText = document.getElementById('sort-text');
  
  if (sortIcon && sortText) {
    if (currentChatSort === 'asc') {
      sortIcon.className = 'bi bi-sort-up';
      sortText.textContent = 'Oldest First';
    } else {
      sortIcon.className = 'bi bi-sort-down';
      sortText.textContent = 'Newest First';
    }
  }
  
  // Reset pagination and reload
  chatsPagination.offset = 0;
  loadChats();
}

// Update chats count display
function updateChatsCount(total) {
  const countEl = document.getElementById('chats-count');
  if (countEl) {
    countEl.textContent = `${total} chat${total !== 1 ? 's' : ''} total`;
  }
}

// Update pagination controls
function updateChatsPagination(data) {
  const paginationEl = document.getElementById('chats-pagination');
  if (!paginationEl) return;
  
  const hasMore = data.hasMore;
  const currentPage = Math.floor(data.offset / data.limit) + 1;
  const totalPages = Math.ceil(data.total / data.limit);
  
  let paginationHTML = '';
  
  if (totalPages > 1) {
    paginationHTML = `
      <nav aria-label="Chat pagination">
        <ul class="pagination pagination-sm mb-0 justify-content-center">
          <li class="page-item ${data.offset === 0 ? 'disabled' : ''}">
            <button class="page-link" onclick="loadChatPage(${Math.max(0, data.offset - data.limit)})" ${data.offset === 0 ? 'disabled' : ''}>
              <i class="bi bi-chevron-left"></i> Previous
            </button>
          </li>
          <li class="page-item active">
            <span class="page-link">${currentPage} of ${totalPages}</span>
          </li>
          <li class="page-item ${!hasMore ? 'disabled' : ''}">
            <button class="page-link" onclick="loadChatPage(${data.offset + data.limit})" ${!hasMore ? 'disabled' : ''}>
              Next <i class="bi bi-chevron-right"></i>
            </button>
          </li>
        </ul>
      </nav>
    `;
  }
  
  paginationEl.innerHTML = paginationHTML;
}

// Load specific page
function loadChatPage(offset) {
  chatsPagination.offset = offset;
  loadChats();
}

// Clear all chats
async function clearAllChats() {
  if (!confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
    return;
  }
  
  try {
    const response = await fetch('/api/chats/clear', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      showSuccess('All chat history cleared successfully');
      loadChats(); // Reload the empty list
    } else {
      showError('Failed to clear chat history: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error clearing chats:', error);
    showError('Error clearing chat history');
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
