// Platform Management JavaScript
class PlatformManager {
    constructor() {
        this.platforms = ['whatsapp', 'telegram', 'facebook', 'instagram'];
        this.platformStatus = {};
        this.initializeEventHandlers();
        this.loadPlatformStatus();
    }

    initializeEventHandlers() {
        // Refresh platforms button
        document.getElementById('refresh-platforms-btn')?.addEventListener('click', () => {
            this.loadPlatformStatus();
        });

        // Platform connection method changes
        this.platforms.forEach(platform => {
            const methodSelect = document.getElementById(`${platform}-method`);
            if (methodSelect) {
                methodSelect.addEventListener('change', (e) => {
                    this.handleMethodChange(platform, e.target.value);
                });
            }
        });
        
        // Instagram authentication method change
        const instagramAuthMethod = document.getElementById('instagram-auth-method');
        if (instagramAuthMethod) {
            instagramAuthMethod.addEventListener('change', (e) => {
                this.handleInstagramAuthMethodChange(e.target.value);
            });
        }

        // Connect/disconnect buttons
        this.platforms.forEach(platform => {
            const connectBtn = document.getElementById(`${platform}-connect-btn`);
            const disconnectBtn = document.getElementById(`${platform}-disconnect-btn`);
            
            if (connectBtn) {
                connectBtn.addEventListener('click', () => {
                    this.connectPlatform(platform);
                });
            }
            
            if (disconnectBtn) {
                disconnectBtn.addEventListener('click', () => {
                    this.disconnectPlatform(platform);
                });
            }
        });

        // Password toggle buttons
        document.getElementById('telegram-token-toggle')?.addEventListener('click', () => {
            this.togglePasswordVisibility('telegram-token');
        });

        // WhatsApp connect button (special case for QR code)
        document.getElementById('whatsapp-connect-btn')?.addEventListener('click', () => {
            this.showQRModal();
        });
        
        // Platform enable/disable toggles
        this.platforms.forEach(platform => {
            const enableToggle = document.getElementById(`${platform}-enabled`);
            if (enableToggle) {
                enableToggle.addEventListener('change', (e) => {
                    this.handlePlatformToggle(platform, e.target.checked);
                });
            }
        });
    }

    handleMethodChange(platform, method) {
        // Hide all method configs for this platform
        const configs = document.querySelectorAll(`[id^="${platform}-"][id$="-config"]`);
        configs.forEach(config => {
            config.style.display = 'none';
        });

        // Show selected method config
        const selectedConfig = document.getElementById(`${platform}-${method}-config`);
        if (selectedConfig) {
            selectedConfig.style.display = 'block';
        }
    }

    handleInstagramAuthMethodChange(authMethod) {
        // Hide all Instagram auth configs
        const loginConfig = document.getElementById('instagram-login-config');
        const sessionConfig = document.getElementById('instagram-session-config');
        
        if (loginConfig && sessionConfig) {
            if (authMethod === 'session') {
                loginConfig.style.display = 'none';
                sessionConfig.style.display = 'block';
            } else {
                loginConfig.style.display = 'block';
                sessionConfig.style.display = 'none';
            }
        }
    }

    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(`${inputId}-toggle`);
        const icon = button.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'bi bi-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'bi bi-eye';
        }
    }

    handlePlatformToggle(platform, enabled) {
        const platformCard = document.querySelector(`#${platform}-enabled`).closest('.card');
        const connectBtn = document.getElementById(`${platform}-connect-btn`);
        const disconnectBtn = document.getElementById(`${platform}-disconnect-btn`);
        const inputs = platformCard.querySelectorAll('input:not([type="checkbox"]), select, textarea');
        
        if (enabled) {
            // Enable platform
            platformCard.style.opacity = '1';
            inputs.forEach(input => input.disabled = false);
            if (connectBtn) connectBtn.disabled = false;
            if (disconnectBtn) disconnectBtn.disabled = false;
        } else {
            // Disable platform
            platformCard.style.opacity = '0.6';
            inputs.forEach(input => input.disabled = true);
            if (connectBtn) connectBtn.disabled = true;
            if (disconnectBtn) disconnectBtn.disabled = true;
            
            // Disconnect if currently connected
            const status = this.platformStatus[platform];
            if (status && status.status === 'connected') {
                this.disconnectPlatform(platform);
            }
        }
        
        // Save platform enabled state
        this.savePlatformEnabledState(platform, enabled);
    }

    async savePlatformEnabledState(platform, enabled) {
        try {
            await fetch(`/api/platforms/${platform}/enabled`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled })
            });
        } catch (error) {
            console.error(`Failed to save ${platform} enabled state:`, error);
        }
    }

    getStatusText(status) {
        const statusMap = {
            'connected': window.i18n?.t('platforms.status.connected') || 'Connected',
            'disconnected': window.i18n?.t('platforms.status.disconnected') || 'Disconnected',
            'not_connected': window.i18n?.t('platforms.status.not_connected') || 'Not connected',
            'connecting': window.i18n?.t('platforms.status.connecting') || 'Connecting',
            'error': window.i18n?.t('platforms.status.error') || 'Error',
            'unknown': window.i18n?.t('platforms.status.unknown') || 'Unknown'
        };
        return statusMap[status] || statusMap['unknown'];
    }

    populatePlatformCredentials(platform, credentials) {
        switch (platform) {
            case 'telegram':
                this.setInputValue('telegram-token', credentials.token);
                break;
                
            case 'facebook':
                // Official API credentials
                this.setInputValue('facebook-page-access-token', credentials.pageAccessToken);
                this.setInputValue('facebook-verify-token', credentials.verifyToken);
                this.setInputValue('facebook-app-secret', credentials.appSecret);
                // Easy Setup credentials
                this.setInputValue('facebook-email', credentials.email);
                this.setInputValue('facebook-password', credentials.password);
                break;
                
            case 'instagram':
                // Official API credentials
                this.setInputValue('instagram-access-token', credentials.accessToken);
                this.setInputValue('instagram-verify-token', credentials.verifyToken);
                this.setInputValue('instagram-app-secret', credentials.appSecret);
                // Private API credentials
                this.setInputValue('instagram-username', credentials.username);
                this.setInputValue('instagram-password', credentials.password);
                this.setInputValue('instagram-session-id', credentials.sessionId);
                // Web Automation credentials
                this.setInputValue('instagram-web-username', credentials.webUsername);
                this.setInputValue('instagram-web-password', credentials.webPassword);
                
                // Set Instagram authentication method based on available credentials
                if (credentials.sessionId) {
                    this.setInputValue('instagram-auth-method', 'session');
                    this.handleInstagramAuthMethodChange('session');
                } else if (credentials.username && credentials.password) {
                    this.setInputValue('instagram-auth-method', 'login');
                    this.handleInstagramAuthMethodChange('login');
                }
                break;
                
            case 'whatsapp':
                // WhatsApp uses QR code, no stored credentials to populate
                break;
        }
    }
    
    setInputValue(inputId, value) {
        const input = document.getElementById(inputId);
        if (input && value) {
            input.value = value;
        }
    }

    async loadPlatformStatus() {
        try {
            const response = await fetch('/api/platforms/status');
            if (response.ok) {
                this.platformStatus = await response.json();
                this.updatePlatformUI();
                this.updateStatusTable();
            } else {
                console.error('Failed to load platform status');
                this.showToast(window.i18n?.t('platforms.connection_failed') || 'Failed to load platform status', 'error');
            }
        } catch (error) {
            console.error('Error loading platform status:', error);
            this.showToast(window.i18n?.t('platforms.connection_failed') || 'Failed to load platform status', 'error');
        }
    }

    updatePlatformUI() {
        this.platforms.forEach(platform => {
            const status = this.platformStatus[platform] || { status: 'unknown' };
            const statusBadge = document.getElementById(`${platform}-status`);
            const connectBtn = document.getElementById(`${platform}-connect-btn`);
            const disconnectBtn = document.getElementById(`${platform}-disconnect-btn`);

            if (statusBadge) {
                this.updateStatusBadge(statusBadge, status.status);
            }

            if (connectBtn && disconnectBtn) {
                if (status.status === 'connected') {
                    connectBtn.style.display = 'none';
                    disconnectBtn.style.display = 'block';
                } else {
                    connectBtn.style.display = 'block';
                    disconnectBtn.style.display = 'none';
                }
            }

            // Update method selector if available
            const methodSelect = document.getElementById(`${platform}-method`);
            if (methodSelect && status.method) {
                methodSelect.value = status.method;
                this.handleMethodChange(platform, status.method);
            }
            
            // Initialize platform enabled state (default to enabled)
            const enableToggle = document.getElementById(`${platform}-enabled`);
            if (enableToggle) {
                const isEnabled = status.enabled !== false; // Default to true if not specified
                enableToggle.checked = isEnabled;
                this.handlePlatformToggle(platform, isEnabled);
            }
            
            // Populate credentials from environment variables
            if (status.credentials) {
                this.populatePlatformCredentials(platform, status.credentials);
            }
        });
    }

    updateStatusBadge(badge, status) {
        // Remove existing status classes
        badge.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'bg-secondary');
        
        switch (status) {
            case 'connected':
                badge.classList.add('bg-success');
                badge.textContent = window.i18n?.t('platforms.status.connected') || 'Connected';
                break;
            case 'disconnected':
                badge.classList.add('bg-danger');
                badge.textContent = window.i18n?.t('platforms.status.disconnected') || 'Disconnected';
                break;
            case 'connecting':
                badge.classList.add('bg-warning');
                badge.textContent = window.i18n?.t('platforms.status.connecting') || 'Connecting';
                break;
            case 'error':
                badge.classList.add('bg-danger');
                badge.textContent = window.i18n?.t('platforms.status.error') || 'Error';
                break;
            case 'not_connected':
                badge.classList.add('bg-secondary');
                badge.textContent = window.i18n?.t('platforms.status.not_connected') || 'Not connected';
                break;
            default:
                badge.classList.add('bg-secondary');
                badge.textContent = window.i18n?.t('platforms.status.unknown') || 'Unknown';
        }
    }

    updateStatusTable() {
        const tableBody = document.getElementById('platforms-status-table');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        this.platforms.forEach(platform => {
            const status = this.platformStatus[platform] || { status: 'unknown' };
            const row = document.createElement('tr');
            
            const platformName = window.i18n?.t(`platforms.${platform}`) || platform.charAt(0).toUpperCase() + platform.slice(1);
            const statusText = this.getStatusText(status.status);
            const methodText = status.method ? this.getMethodText(platform, status.method) : '-';
            const lastActivity = status.lastActivity ? this.formatDate(status.lastActivity) : (window.i18n?.t('platforms.never') || 'Never');
            
            row.innerHTML = `
                <td>
                    <i class="bi bi-${this.getPlatformIcon(platform)} me-2"></i>
                    ${platformName}
                </td>
                <td>
                    <span class="badge ${this.getStatusClass(status.status)}">${statusText}</span>
                </td>
                <td>${methodText}</td>
                <td>${lastActivity}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="platformManager.connectPlatform('${platform}')">
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    getPlatformIcon(platform) {
        const icons = {
            whatsapp: 'whatsapp',
            telegram: 'telegram',
            facebook: 'messenger',
            instagram: 'instagram'
        };
        return icons[platform] || 'share';
    }

    getStatusText(status) {
        return window.i18n?.t(`platforms.status.${status}`) || status.charAt(0).toUpperCase() + status.slice(1);
    }

    getStatusClass(status) {
        const classes = {
            connected: 'bg-success',
            disconnected: 'bg-danger',
            not_connected: 'bg-secondary',
            connecting: 'bg-warning',
            error: 'bg-danger'
        };
        return classes[status] || 'bg-secondary';
    }

    getMethodText(platform, method) {
        return window.i18n?.t(`platforms.${platform}_${method}`) || method.charAt(0).toUpperCase() + method.slice(1);
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleString();
        } catch (error) {
            return dateString;
        }
    }

    async connectPlatform(platform) {
        if (platform === 'whatsapp') {
            this.showQRModal();
            return;
        }

        const config = this.getPlatformConfig(platform);
        if (!config) {
            this.showToast(window.i18n?.t('platforms.invalid_credentials') || 'Invalid credentials', 'error');
            return;
        }

        try {
            this.updateConnectionStatus(platform, 'connecting');
            
            const response = await fetch(`/api/platforms/${platform}/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showToast(window.i18n?.t('platforms.connected_success') || 'Connected successfully', 'success');
                this.loadPlatformStatus();
            } else {
                this.updateConnectionStatus(platform, 'error');
                this.showToast(result.message || (window.i18n?.t('platforms.connection_failed') || 'Connection failed'), 'error');
            }
        } catch (error) {
            console.error(`Error connecting ${platform}:`, error);
            this.updateConnectionStatus(platform, 'error');
            this.showToast(window.i18n?.t('platforms.connection_failed') || 'Connection failed', 'error');
        }
    }

    async disconnectPlatform(platform) {
        try {
            const response = await fetch(`/api/platforms/${platform}/disconnect`, {
                method: 'POST'
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
                this.showToast(window.i18n?.t('platforms.disconnected_success') || 'Disconnected successfully', 'success');
                this.loadPlatformStatus();
            } else {
                this.showToast(result.message || (window.i18n?.t('platforms.disconnect_failed') || 'Disconnect failed'), 'error');
            }
        } catch (error) {
            console.error(`Error disconnecting ${platform}:`, error);
            this.showToast(window.i18n?.t('platforms.disconnect_failed') || 'Disconnect failed', 'error');
        }
    }

    getPlatformConfig(platform) {
        const methodSelect = document.getElementById(`${platform}-method`);
        const method = methodSelect ? methodSelect.value : 'official';

        const config = { method };

        switch (platform) {
            case 'telegram':
                config.token = document.getElementById('telegram-token')?.value;
                break;
            case 'facebook':
                if (method === 'official') {
                    config.pageAccessToken = document.getElementById('facebook-page-token')?.value;
                    config.verifyToken = document.getElementById('facebook-verify-token')?.value;
                    config.appSecret = document.getElementById('facebook-app-secret')?.value;
                } else {
                    config.email = document.getElementById('facebook-email')?.value;
                    config.password = document.getElementById('facebook-password')?.value;
                }
                break;
            case 'instagram':
                if (method === 'official') {
                    config.accessToken = document.getElementById('instagram-access-token')?.value;
                    config.verifyToken = document.getElementById('instagram-verify-token')?.value;
                    config.appSecret = document.getElementById('instagram-app-secret')?.value;
                } else if (method === 'private') {
                    const authMethod = document.getElementById('instagram-auth-method')?.value || 'login';
                    config.authMethod = authMethod;
                    
                    if (authMethod === 'session') {
                        config.sessionId = document.getElementById('instagram-session-id')?.value;
                    } else {
                        config.username = document.getElementById('instagram-username')?.value;
                        config.password = document.getElementById('instagram-password')?.value;
                    }
                } else if (method === 'web') {
                    config.username = document.getElementById('instagram-web-username')?.value;
                    config.password = document.getElementById('instagram-web-password')?.value;
                }
                break;
        }

        // Validate required fields
        const requiredFields = Object.values(config).filter(value => value && value.trim() !== '');
        if (requiredFields.length < 2) { // At least method + one credential
            return null;
        }

        return config;
    }

    updateConnectionStatus(platform, status) {
        const statusBadge = document.getElementById(`${platform}-status`);
        if (statusBadge) {
            this.updateStatusBadge(statusBadge, status);
        }
    }

    showQRModal() {
        const qrModal = new bootstrap.Modal(document.getElementById('qrScannerModal'));
        qrModal.show();
    }

    showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Initialize platform manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.platformManager = new PlatformManager();
});

// Initialize method change handlers when tab is shown
document.addEventListener('shown.bs.tab', (event) => {
    if (event.target.getAttribute('href') === '#platforms') {
        // Initialize method configurations
        ['facebook', 'instagram'].forEach(platform => {
            const methodSelect = document.getElementById(`${platform}-method`);
            if (methodSelect) {
                window.platformManager.handleMethodChange(platform, methodSelect.value);
            }
        });
        
        // Initialize Instagram authentication method
        const instagramAuthMethod = document.getElementById('instagram-auth-method');
        if (instagramAuthMethod) {
            window.platformManager.handleInstagramAuthMethodChange(instagramAuthMethod.value);
        }
    }
});
