// ===== MANUAL INTERVENTION FEATURES =====

// Global variables for manual intervention
let currentChatId = null;
let aiResponseEnabled = true;

/**
 * Initialize manual intervention features when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
  initializeManualIntervention();
});

/**
 * Initialize manual intervention event listeners
 */
function initializeManualIntervention() {
  // Send manual message button
  const sendBtn = document.getElementById('sendManualMessage');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendManualMessage);
  }
  
  // Manual message input - send on Enter (but not Shift+Enter)
  const messageInput = document.getElementById('manualMessageInput');
  if (messageInput) {
    messageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendManualMessage();
      }
    });
  }
  
  // AI response toggle
  const aiToggle = document.getElementById('aiResponseToggle');
  if (aiToggle) {
    aiToggle.addEventListener('change', function() {
      aiResponseEnabled = this.checked;
      updateAIResponseStatus();
    });
  }
  
  // Refresh chat button
  const refreshBtn = document.getElementById('refreshChatBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      if (currentChatId) {
        viewChat(currentChatId);
      }
    });
  }
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
  
  if (!currentChatId) {
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
        chatId: currentChatId,
        message: message,
        aiResponseEnabled: aiResponseEnabled
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
      if (currentChatId) {
        viewChat(currentChatId);
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
      icon.className = aiResponseEnabled ? 'bi bi-robot me-1' : 'bi bi-robot me-1 text-muted';
    }
    
    // Update label text
    const labelText = aiResponseEnabled ? 'AI Auto-Response' : 'AI Auto-Response (Disabled)';
    label.innerHTML = `<i class="${icon ? icon.className : 'bi bi-robot me-1'}"></i> ${labelText}`;
  }
  
  // Show toast notification
  const status = aiResponseEnabled ? 'enabled' : 'disabled';
  showToast(`AI auto-response ${status}`, aiResponseEnabled ? 'success' : 'warning');
}

/**
 * Set current chat ID for manual intervention
 */
function setCurrentChatId(chatId) {
  currentChatId = chatId;
  console.log(`Manual intervention enabled for chat: ${chatId}`);
}

// Override the viewChat function to set current chat ID
const originalViewChat = window.viewChat;
if (originalViewChat) {
  window.viewChat = function(chatId, messages) {
    // Set current chat ID for manual intervention
    setCurrentChatId(chatId);
    
    // Call the original viewChat function
    return originalViewChat(chatId, messages);
  };
} else {
  // If viewChat doesn't exist yet, create it
  window.viewChat = function(chatId, messages) {
    setCurrentChatId(chatId);
    console.log('viewChat called with:', chatId);
  };
}

// ===== END MANUAL INTERVENTION FEATURES =====
