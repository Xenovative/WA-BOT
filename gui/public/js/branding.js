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

  loadBrandingState() {
    const savedState = localStorage.getItem('brandingEnabled');
    if (savedState !== null) {
      this.brandingEnabled = savedState === 'true';
      if (this.toggleSwitch) {
        this.toggleSwitch.checked = this.brandingEnabled;
      }
      this.updateBranding();
    }
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
