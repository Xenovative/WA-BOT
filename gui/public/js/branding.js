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
      // First try to get the initial state from the server
      const response = await fetch('/api/settings/branding');
      if (response.ok) {
        const data = await response.json();
        this.brandingEnabled = data.enabled !== false; // Default to true if not set
        
        // If the environment variable is set to false, override the UI state
        if (process.env.SHOW_BRANDING === 'false') {
          this.brandingEnabled = false;
          if (this.toggleSwitch) {
            this.toggleSwitch.checked = false;
          }
        }
        
        // Save the state to localStorage for consistency
        localStorage.setItem('brandingEnabled', this.brandingEnabled);
      } else {
        // Fallback to localStorage if server fetch fails
        const savedState = localStorage.getItem('brandingEnabled');
        if (savedState !== null) {
          this.brandingEnabled = savedState === 'true';
        } else if (process.env.SHOW_BRANDING !== undefined) {
          // Use environment variable if no saved state
          this.brandingEnabled = process.env.SHOW_BRANDING === 'true';
        }
      }
    } catch (error) {
      console.error('Error loading branding state:', error);
      // Fallback to localStorage or environment variable if there's an error
      const savedState = localStorage.getItem('brandingEnabled');
      if (savedState !== null) {
        this.brandingEnabled = savedState === 'true';
      } else if (process.env.SHOW_BRANDING !== undefined) {
        this.brandingEnabled = process.env.SHOW_BRANDING === 'true';
      }
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
