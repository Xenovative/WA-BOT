// Main script.js file for WhatsXENO Management Console

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

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Load initial data
  loadStatus();
  loadSettings();
  loadChats();
  loadKbDocuments();
  loadCommandHistory();
  loadSystemStats();
  initializeMemoryChart();
  
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
  
  refreshKbBtn.addEventListener('click', loadKbDocuments);
  
  // Set up knowledge base file input
  if (kbFileInput) {
    kbFileInput.addEventListener('change', uploadDocument);
    console.log('KB file input listener initialized');
  } else {
    console.error('KB file input element not found');
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
  
  // Initialize Bootstrap tabs
  const tabElements = document.querySelectorAll('.nav-link');
  tabElements.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = tab.getAttribute('href').substring(1);
      
      // Hide all tabs
      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('show', 'active');
      });
      
      // Deactivate all tab links
      tabElements.forEach(t => {
        t.classList.remove('active');
      });
      
      // Show current tab and activate link
      document.getElementById(targetId).classList.add('show', 'active');
      tab.classList.add('active');
    });
  });
});

// API functions
async function loadStatus() {
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('Failed to fetch status');
    
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

async function loadSettings() {
  try {
    const response = await fetch('/api/settings');
    const settings = await response.json();
    
    // Update form fields
    providerSelect.value = settings.provider;
    modelInput.value = settings.model;
    ragEnabledCheckbox.checked = settings.ragEnabled;
    systemPromptTextarea.value = settings.systemPrompt;
    
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

// ...

/**
 * Load and display recent chats in the dashboard
 */
async function loadRecentChats() {
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
let chatHistoryState = {
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
  
  if (chatHistoryState.loading) return;
  chatHistoryState.loading = true;
  
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
    console.log('Loading KB documents...');
    const response = await fetch('/api/kb/documents');
    
    // Handle non-OK responses
    if (!response.ok) {
      const text = await response.text();
      console.error('KB documents error response:', text);
      throw new Error(`Failed to fetch KB documents: ${response.status} ${response.statusText}`);
    }
    
    // Check if response is empty
    const responseText = await response.text();
    console.log('Raw KB documents response:', responseText);
    
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response received from server');
    }
    
    // Try to parse the response
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse KB documents response:', parseError);
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
    }
    
    console.log('Parsed KB documents response:', result);
    
    // Handle the parsed response
    if (result && result.success) {
      renderKnowledgeBase(result.documents || []);
    } else if (result && result.error) {
      kbContainer.innerHTML = `<div class="alert alert-warning">${result.error}</div>`;
      console.warn('KB documents warning:', result.error);
    } else {
      throw new Error('Unknown error loading documents');
    }
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
      <th>Uploaded</th>
      <th>Actions</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Create table body
  const tbody = document.createElement('tbody');
  
  // Debug: Log the entire documents array
  console.log('Documents to render:', JSON.stringify(documents, null, 2));
  
  documents.forEach(doc => {
    // Debug: Log each document
    console.log('Document:', doc);
    
    const tr = document.createElement('tr');
    
    // Format file size
    let sizeText = 'Unknown';
    if (doc.fileSize) {
      if (doc.fileSize < 1024) {
        sizeText = `${doc.fileSize} B`;
      } else if (doc.fileSize < 1024 * 1024) {
        sizeText = `${(doc.fileSize / 1024).toFixed(1)} KB`;
      } else {
        sizeText = `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`;
      }
    }
    
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
    
    tr.innerHTML = `
      <td>${doc.name || 'Unknown'}</td>
      <td>${sizeText}</td>
      <td>${dateText}</td>
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
  if (size < 1024) {
    return `${size} B`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  } else {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '1100';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toastId = 'toast-' + Date.now();
  const toast = document.createElement('div');
  toast.id = toastId;
  toast.className = `toast align-items-center text-white bg-${type} border-0`;
  toast.role = 'alert';
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  
  // Set up auto-hide
  const hideAfter = duration > 0;
  if (hideAfter) {
    toast.setAttribute('data-bs-autohide', 'true');
    toast.setAttribute('data-bs-delay', duration);
  } else {
    toast.setAttribute('data-bs-autohide', 'false');
  }
  
  // Set toast content
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>`;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Initialize and show toast
  const bsToast = new bootstrap.Toast(toast, { autohide: hideAfter, delay: duration });
  bsToast.show();
  
  // Remove toast from DOM after it's hidden
  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
  });
  
  return bsToast;
}

// Command history state
let commandHistoryState = {
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
