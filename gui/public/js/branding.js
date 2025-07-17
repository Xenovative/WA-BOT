/**
 * Branding Manager - Controls visibility of WhatsXENO logo and favicon
 */
class BrandingManager {
  constructor() {
    this.brandingEnabled = true;
    this.toggleSwitch = document.getElementById('toggle-branding');
    this.logoElement = document.querySelector('img[alt="WhatsXENO Logo"]');
    this.titleElement = document.querySelector('h3.text-light');
    this.faviconLinks = document.querySelectorAll('link[rel*="icon"]');
    this.initEventListeners();
    this.loadBrandingState();
  }

  initEventListeners() {
    if (this.toggleSwitch) {
      this.toggleSwitch.addEventListener('change', () => {
        this.brandingEnabled = this.toggleSwitch.checked;
        this.updateBranding();
        this.saveBrandingState();
      });
    }
  }

  async loadBrandingState() {
    try {
      // Try to get the initial state from the server
      const response = await fetch('/api/settings/branding');
      if (response.ok) {
        const data = await response.json();
        // If the setting comes from environment, force the state
        if (data.fromEnv) {
          this.brandingEnabled = data.enabled;
          // Disable the toggle since it's controlled by environment
          if (this.toggleSwitch) {
            this.toggleSwitch.disabled = true;
            this.toggleSwitch.title = 'Branding is controlled by server configuration';
          }
        } else {
          this.brandingEnabled = data.enabled !== false;
        }
      } else {
        // Fallback to localStorage if server fetch fails
        const savedState = localStorage.getItem('brandingEnabled');
        this.brandingEnabled = savedState !== null ? savedState === 'true' : true;
      }
    } catch (error) {
      console.error('Error loading branding state:', error);
      // Fallback to localStorage if there's an error
      const savedState = localStorage.getItem('brandingEnabled');
      this.brandingEnabled = savedState !== null ? savedState === 'true' : true;
    }

    // Update UI
    if (this.toggleSwitch) {
      this.toggleSwitch.checked = this.brandingEnabled;
    }
    this.updateBranding();
  }

  saveBrandingState() {
    localStorage.setItem('brandingEnabled', this.brandingEnabled);
    
    // Also save to server settings if possible
    fetch('/api/settings/branding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: this.brandingEnabled })
    }).catch(err => console.error('Failed to save branding setting to server:', err));
  }

  updateBranding() {
    // Update logo visibility
    if (this.logoElement) {
      this.logoElement.style.display = this.brandingEnabled ? '' : 'none';
    }
    
    // Update title visibility
    if (this.titleElement) {
      this.titleElement.textContent = this.brandingEnabled ? 'WhatsXENO' : 'Management Console';
    }
    
    // Update favicon
    this.faviconLinks.forEach(link => {
      link.href = this.brandingEnabled ? link.href : '/favicon/blank.ico';
    });
    
    // Update page title
    document.title = this.brandingEnabled ? 'WhatsXENO Management Console' : 'Management Console';
  }
}

// Initialize branding manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.brandingManager = new BrandingManager();
});
