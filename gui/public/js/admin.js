class AdminManager {
  constructor() {
    this.adminMode = false;
    this.initEventListeners();
    this.checkAdminStatus();
    this.adminModal = new bootstrap.Modal(document.getElementById('adminLoginModal'));
  }

  async checkAdminStatus() {
    try {
      const response = await fetch('/api/admin/status');
      const data = await response.json();
      this.adminMode = data.adminMode;
      this.updateUI();
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  }

  async login(password) {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      if (data.success) {
        this.adminMode = true;
        this.updateUI();
        this.adminModal.hide();
        // Show success toast
        this.showToast('Admin mode enabled', 'success');
        return true;
      }
      return data;
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Connection error' };
    }
  }

  async logout() {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      this.adminMode = false;
      this.updateUI();
      // Show info toast
      this.showToast('Admin mode disabled', 'info');
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  updateUI() {
    // Toggle admin-only tabs and elements
    const adminElements = document.querySelectorAll('[data-admin-only]');
    adminElements.forEach(el => {
      if (el.classList.contains('tab-pane') || el.closest('.tab-pane')) {
        // For tab panes, we need to handle them specially
        const tabLink = document.querySelector(`[href="#${el.id}"]`);
        if (tabLink) {
          const tabItem = tabLink.closest('.nav-item');
          if (tabItem) {
            tabItem.style.display = this.adminMode ? '' : 'none';
          }
        }
      } else {
        // For other admin-only elements
        el.style.display = this.adminMode ? '' : 'none';
      }
    });

    // Toggle non-admin elements
    const nonAdminElements = document.querySelectorAll('[data-non-admin-only]');
    nonAdminElements.forEach(el => {
      el.style.display = this.adminMode ? 'none' : '';
    });

    // Update login/logout buttons
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (loginBtn) loginBtn.style.display = this.adminMode ? 'none' : 'inline-block';
    if (logoutBtn) logoutBtn.style.display = this.adminMode ? 'inline-block' : 'none';

    // Update body class for global styling
    if (this.adminMode) {
      document.body.classList.add('admin-mode');
      // Make sure all admin tabs are visible
      document.querySelectorAll('[data-admin-only].tab-pane').forEach(tab => {
        const tabLink = document.querySelector(`[href="#${tab.id}"]`);
        if (tabLink) {
          const tabItem = tabLink.closest('.nav-item');
          if (tabItem) tabItem.style.display = '';
        }
      });
    } else {
      document.body.classList.remove('admin-mode');
    }
  }

  initEventListeners() {
    // Login button
    document.getElementById('login-btn')?.addEventListener('click', () => {
      this.showLoginModal();
    });

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      await this.logout();
      // Don't reload the page, just update the UI
      this.updateUI();
    });

    // Login form submission
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('admin-password').value;
        const result = await this.login(password);
        
        if (result === true) {
          // Success - UI will be updated by the login method
        } else {
          this.showToast(result.message || 'Login failed', 'error');
        }
      });
    }

    // Modal shown event - clear password field
    document.getElementById('adminLoginModal')?.addEventListener('shown.bs.modal', () => {
      const passwordField = document.getElementById('admin-password');
      if (passwordField) passwordField.value = '';
    });
  }

  showLoginModal() {
    this.adminModal.show();
  }

  hideLoginModal() {
    this.adminModal.hide();
  }

  showToast(message, type = 'info') {
    // Check if toast container exists, create if not
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1100;
        max-width: 300px;
      `;
      document.body.appendChild(toastContainer);
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast show align-items-center text-white bg-${type} border-0`;
    toast.role = 'alert';
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    // Set a random ID for the toast
    const toastId = 'toast-' + Math.random().toString(36).substr(2, 9);
    toast.id = toastId;
    
    // Determine icon based on type
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-triangle';
    if (type === 'warning') icon = 'exclamation-circle';

    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <i class="bi bi-${icon} me-2"></i>
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Auto-remove after delay
    setTimeout(() => {
      const toastElement = document.getElementById(toastId);
      if (toastElement) {
        toastElement.classList.remove('show');
        setTimeout(() => toastElement.remove(), 150);
      }
    }, 3000);
  }
}

// Initialize admin manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait for Bootstrap to be loaded
  if (typeof bootstrap !== 'undefined') {
    window.adminManager = new AdminManager();
    
    // Check admin status after a short delay to ensure all elements are rendered
    setTimeout(() => {
      window.adminManager.checkAdminStatus();
    }, 500);
  } else {
    console.error('Bootstrap not loaded. Admin features will not work.');
  }
});
