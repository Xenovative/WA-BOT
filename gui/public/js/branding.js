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
    const logos = document.querySelectorAll('img[src*="whatsxeno"], img[alt*="WhatsXENO"]');
    logos.forEach(logo => {
      logo.style.display = this.brandingEnabled ? '' : 'none';
    });

    // Update favicon
    const favicon = document.querySelector('link[rel*="icon"]');
    if (favicon) {
      if (this.brandingEnabled) {
        // Restore original favicon
        favicon.href = favicon.getAttribute('data-original-href') || favicon.href;
      } else {
        // Save original favicon href if not already saved
        if (!favicon.hasAttribute('data-original-href')) {
          favicon.setAttribute('data-original-href', favicon.href);
        }
        // Set blank favicon
        favicon.href = '/favicon/blank.ico';
      }
    }

    // Update page title and branding text
    const brandingTexts = document.querySelectorAll('h1, h2, h3, .branding-text');
    brandingTexts.forEach(element => {
      if (element.textContent.includes('WhatsXENO')) {
        if (this.brandingEnabled) {
          // Restore original text if it was saved
          const originalText = element.getAttribute('data-original-text');
          if (originalText) {
            element.textContent = originalText;
          }
        } else {
          // Save original text and remove branding
          if (!element.hasAttribute('data-original-text')) {
            element.setAttribute('data-original-text', element.textContent);
          }
          element.textContent = element.textContent
            .replace(/WhatsXENO/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        }
      }
    });

    // Update toggle label
    const toggleLabel = document.querySelector('label[for="toggle-branding"]');
    if (toggleLabel) {
      toggleLabel.textContent = this.brandingEnabled 
        ? 'Show Branding (Logo & Text)' 
        : 'Branding is hidden';
    }
  }
}

// Initialize branding manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.brandingManager = new BrandingManager();
});
