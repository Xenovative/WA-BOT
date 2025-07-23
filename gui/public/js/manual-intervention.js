// ===== MANUAL INTERVENTION FEATURES =====

// Global variables for manual intervention (using namespace to avoid conflicts)
window.ManualIntervention = window.ManualIntervention || {
  currentChatId: null,
  aiResponseEnabled: true
};

/**
 * Initialize manual intervention features when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('Manual intervention script loaded');
  initializeManualIntervention();
});

// Also initialize when the script loads (in case DOM is already ready)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeManualIntervention);
} else {
  initializeManualIntervention();
}

// Set up mutation observer to handle dynamically added content
const observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    if (mutation.type === 'childList') {
      // Check if new view chat buttons were added
      const addedNodes = Array.from(mutation.addedNodes);
      const hasViewButtons = addedNodes.some(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          return node.querySelector && (node.querySelector('.view-chat') || node.classList.contains('view-chat'));
        }
        return false;
      });
      
      if (hasViewButtons) {
        console.log('New view chat buttons detected, setting up listeners');
        setupViewChatListeners();
      }
    }
  });
});

// Start observing the document for changes
observer.observe(document.body, {
  childList: true,
  subtree: true
});

/**
 * Initialize manual intervention event listeners
 */
function initializeManualIntervention() {
  console.log('Initializing manual intervention features...');
  
  // Send manual message button
  const sendBtn = document.getElementById('sendManualMessage');
  if (sendBtn) {
    console.log('Found send button, adding event listener');
    sendBtn.addEventListener('click', sendManualMessage);
  } else {
    console.warn('Send message button not found');
  }
  
  // Manual message input - send on Enter (but not Shift+Enter)
  const messageInput = document.getElementById('manualMessageInput');
  if (messageInput) {
    console.log('Found message input, adding event listener');
    messageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendManualMessage();
      }
    });
  } else {
    console.warn('Message input not found');
  }
  
  // AI response toggle
  const aiToggle = document.getElementById('aiResponseToggle');
  if (aiToggle) {
    console.log('Found AI toggle, adding event listener');
    aiToggle.addEventListener('change', function() {
      window.ManualIntervention.aiResponseEnabled = this.checked;
      updateAIResponseStatus();
    });
  } else {
    console.warn('AI response toggle not found');
  }
  
  // Refresh chat button
  const refreshBtn = document.getElementById('refreshChatBtn');
  if (refreshBtn) {
    console.log('Found refresh button, adding event listener');
    refreshBtn.addEventListener('click', function() {
      if (window.ManualIntervention.currentChatId) {
        viewChat(window.ManualIntervention.currentChatId);
      }
    });
  } else {
    console.warn('Refresh chat button not found');
  }
  
  // Set up view chat button listeners for existing chat table
  setupViewChatListeners();
  
  console.log('Manual intervention initialization complete');
}

/**
 * Send a manual message via the bot
 */
async function sendManualMessage() {
  const messageInput = document.getElementById('manualMessageInput');
  const sendBtn = document.getElementById('sendManualMessage');
  
  if (!messageInput || !sendBtn) {
    showToast('Manual message interface not found', 'error');
    return;
  }
  
  const message = messageInput.value.trim();
  if (!message) {
    showToast('Please enter a message to send', 'warning');
    messageInput.focus();
    return;
  }
  
  if (!window.ManualIntervention.currentChatId) {
    showToast('No chat selected', 'error');
    return;
  }
  
  // Show loading state
  const originalBtnText = sendBtn.innerHTML;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Sending...';
  
  try {
    const response = await fetch('/api/chats/send-manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: window.ManualIntervention.currentChatId,
        message: message,
        aiResponseEnabled: window.ManualIntervention.aiResponseEnabled
      })
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to send message');
    }
    
    // Clear the input
    messageInput.value = '';
    
    // Show success message
    showToast('Message sent successfully', 'success');
    
    // Refresh the chat view after a short delay to show the new message
    setTimeout(() => {
      if (window.ManualIntervention.currentChatId) {
        viewChat(window.ManualIntervention.currentChatId);
      }
    }, 1000);
    
  } catch (error) {
    console.error('Error sending manual message:', error);
    showToast(`Failed to send message: ${error.message}`, 'error');
  } finally {
    // Reset button state
    sendBtn.disabled = false;
    sendBtn.innerHTML = originalBtnText;
    messageInput.focus();
  }
}

/**
 * Update AI response status display
 */
function updateAIResponseStatus() {
  const toggle = document.getElementById('aiResponseToggle');
  const label = toggle ? toggle.nextElementSibling : null;
  
  if (label) {
    const icon = label.querySelector('i');
    if (icon) {
      icon.className = window.ManualIntervention.aiResponseEnabled ? 'bi bi-robot me-1' : 'bi bi-robot me-1 text-muted';
    }
    
    // Update label text
    const labelText = window.ManualIntervention.aiResponseEnabled ? 'AI Auto-Response' : 'AI Auto-Response (Disabled)';
    label.innerHTML = `<i class="${icon ? icon.className : 'bi bi-robot me-1'}"></i> ${labelText}`;
  }
  
  // Show toast notification
  const status = window.ManualIntervention.aiResponseEnabled ? 'enabled' : 'disabled';
  showToast(`AI auto-response ${status}`, window.ManualIntervention.aiResponseEnabled ? 'success' : 'warning');
}

/**
 * Set up event listeners for view chat buttons
 */
function setupViewChatListeners() {
  // Set up listeners for existing view chat buttons
  const viewButtons = document.querySelectorAll('.view-chat, [data-chat-id]');
  console.log(`Found ${viewButtons.length} view chat buttons`);
  
  viewButtons.forEach(button => {
    const chatId = button.getAttribute('data-chat-id');
    if (chatId) {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        viewChat(chatId);
      });
    }
  });
}

/**
 * View chat messages in a modal
 * @param {string} chatId - The ID of the chat to view
 */
async function viewChat(chatId) {
  try {
    console.log(`Opening chat: ${chatId}`);
    setCurrentChatId(chatId);
    
    // Get modal elements
    const chatModal = document.getElementById('chatModal');
    const chatModalTitle = document.getElementById('chatModalTitle');
    const chatMessages = document.getElementById('chatMessages');
    
    if (!chatModal || !chatModalTitle || !chatMessages) {
      throw new Error('Chat modal elements not found');
    }
    
    // Update modal title
    chatModalTitle.textContent = `Chat: ${formatChatId(chatId)}`;
    
    // Show loading state
    chatMessages.innerHTML = `
      <div class="text-center p-4">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2">Loading chat messages...</p>
      </div>`;
    
    // Show the modal
    const modal = new bootstrap.Modal(chatModal);
    modal.show();
    
    // Fetch chat messages
    const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch chat: ${response.statusText}`);
    }
    
    const data = await response.json();
    const messages = data.conversation || [];
    
    // Render messages
    renderChatMessages(chatMessages, messages);
    
  } catch (error) {
    console.error('Error viewing chat:', error);
    const chatMessages = document.getElementById('chatMessages');
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
 * Render chat messages in the container
 * @param {HTMLElement} container - The container to render messages in
 * @param {Array} messages - Array of message objects
 */
function renderChatMessages(container, messages) {
  if (!container) return;
  
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
  
  messages.forEach(msg => {
    if (!msg || typeof msg !== 'object') return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message mb-3 p-3 rounded ${msg.role === 'user' ? 'bg-light' : 'bg-primary text-white'}`;
    
    const roleIcon = msg.role === 'user' ? 'bi-person-fill' : 'bi-robot';
    const roleName = msg.role === 'user' ? 'User' : 'Assistant';
    
    messageDiv.innerHTML = `
      <div class="d-flex align-items-center mb-2">
        <i class="bi ${roleIcon} me-2"></i>
        <strong>${roleName}</strong>
        <small class="ms-auto opacity-75">
          ${msg.timestamp ? new Date(msg.timestamp).toLocaleString() : 'Unknown time'}
        </small>
      </div>
      <div class="message-content">
        ${escapeHtml(msg.content || 'No content')}
      </div>`;
    
    container.appendChild(messageDiv);
  });
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

/**
 * Format chat ID for display
 * @param {string} chatId - The chat ID to format
 * @returns {string} - Formatted chat ID
 */
function formatChatId(chatId) {
  if (chatId.includes('telegram_')) {
    return `Telegram: ${chatId.replace('telegram_', '')}`;
  }
  if (chatId.includes('@c.us') || chatId.includes('_c.us')) {
    return `WhatsApp: ${chatId.replace(/@c\.us$|_c\.us$/, '')}`;
  }
  return chatId;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Set current chat ID for manual intervention
 */
function setCurrentChatId(chatId) {
  window.ManualIntervention.currentChatId = chatId;
  console.log(`Manual intervention enabled for chat: ${chatId}`);
}

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - Type of toast (success, error, warning, info)
 */
function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toastId = `toast-${Date.now()}`;
  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.id = toastId;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  
  // Set background color based on type
  let bgClass = 'bg-info';
  let icon = 'bi-info-circle';
  if (type === 'success') {
    bgClass = 'bg-success';
    icon = 'bi-check-circle';
  } else if (type === 'error') {
    bgClass = 'bg-danger';
    icon = 'bi-exclamation-triangle';
  } else if (type === 'warning') {
    bgClass = 'bg-warning';
    icon = 'bi-exclamation-triangle';
  }
  
  toastEl.innerHTML = `
    <div class="toast-header ${bgClass} text-white">
      <i class="bi ${icon} me-2"></i>
      <strong class="me-auto">WA-BOT</strong>
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
    <div class="toast-body">
      ${escapeHtml(message)}
    </div>`;
  
  toastContainer.appendChild(toastEl);
  
  // Initialize and show the toast
  const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
  toast.show();
  
  // Remove the toast element after it's hidden
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

// Make functions available globally
window.viewChat = viewChat;
window.showToast = showToast;

// ===== END MANUAL INTERVENTION FEATURES =====
