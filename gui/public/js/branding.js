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
    // Update all branding elements
    const brandingElements = document.querySelectorAll('.branding-element, img[src*="whatsxeno"], img[alt*="WhatsXENO"]');
    
    brandingElements.forEach(element => {
      if (element.tagName === 'IMG') {
        // Handle logo images
        element.style.display = this.brandingEnabled ? '' : 'none';
      } else {
        // Handle text elements
        if (this.brandingEnabled) {
          // Restore original text if saved
          const originalText = element.getAttribute('data-original-text');
          if (originalText) {
            element.textContent = originalText;
          }
        } else {
          // Save original text and replace WhatsXENO with WA-BOT
          if (!element.hasAttribute('data-original-text')) {
            element.setAttribute('data-original-text', element.textContent);
          }
          element.textContent = element.textContent.replace(/WhatsXENO/gi, 'WA-BOT').trim();
        }
      }
    });

    // Update favicon
    const favicons = document.querySelectorAll('link[rel*="icon"]');
    favicons.forEach(favicon => {
      if (this.brandingEnabled) {
        // Restore original favicon
        const originalHref = favicon.getAttribute('data-original-href');
        if (originalHref) {
          favicon.href = originalHref;
        }
      } else {
        // Save original favicon href if not already saved
        if (!favicon.hasAttribute('data-original-href')) {
          favicon.setAttribute('data-original-href', favicon.href);
        }
        // Set blank favicon
        favicon.href = 'data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      }
    });

    // Update page title
    const pageTitle = document.querySelector('title');
    if (pageTitle) {
      if (this.brandingEnabled) {
        const originalTitle = pageTitle.getAttribute('data-original-title');
        if (originalTitle) {
          pageTitle.textContent = originalTitle;
        }
      } else {
        if (!pageTitle.hasAttribute('data-original-title')) {
          pageTitle.setAttribute('data-original-title', pageTitle.textContent);
        }
        pageTitle.textContent = pageTitle.textContent.replace(/WhatsXENO/gi, 'WA-BOT').trim();
      }
    }

    // Update branding toggle label text
    const toggleLabel = document.querySelector('label[for="toggle-branding"]');
    if (toggleLabel) {
      if (this.brandingEnabled) {
        const originalText = toggleLabel.getAttribute('data-original-text');
        if (originalText) {
          toggleLabel.textContent = originalText;
        }
      } else {
        if (!toggleLabel.hasAttribute('data-original-text')) {
          toggleLabel.setAttribute('data-original-text', toggleLabel.textContent);
        }
        toggleLabel.textContent = toggleLabel.textContent.replace(/WhatsXENO/gi, 'WA-BOT').trim();
      }
    }

    console.log(`Branding ${this.brandingEnabled ? 'enabled' : 'disabled'}`);
  }
}

// Initialize branding manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.brandingManager = new BrandingManager();
});
