// Platform Management JavaScript
class PlatformManager {
    constructor() {
        this.platforms = ['whatsapp', 'telegram', 'facebook', 'instagram'];
        this.platformStatus = {};
        this.statusPollTimer = null;
        this._lastStatusErrorAt = 0;
        this.initializeEventHandlers();
        this.loadPlatformStatus();
        // Periodically refresh status when Platforms tab is visible
        this.statusPollTimer = setInterval(() => {
            if (this.isPlatformsTabVisible()) {
                this.loadPlatformStatus();
            }
        }, 5000);
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
        
        // Instagram authentication method change removed - session ID only

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
        
        // Instagram session extraction buttons
        document.getElementById('extract-session-btn')?.addEventListener('click', () => {
            this.extractInstagramSession();
        });
        
        document.getElementById('session-extractor-help-btn')?.addEventListener('click', () => {
            this.showSessionExtractorHelp();
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

    // handleInstagramAuthMethodChange method removed - session ID only authentication

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

    // Safe toast helper that delegates to the global UI toast when available
    showToast(message, type = 'info') {
        try {
            // Prefer the UI's global showToast from script.js if present
            if (typeof window !== 'undefined' && typeof window.showToast === 'function' && window.showToast !== this.showToast) {
                return window.showToast(message, type);
            }
            // If a global function named showToast exists and it's not this method, call it
            if (typeof showToast === 'function' && showToast !== this.showToast) {
                return showToast(message, type);
            }
        } catch (_) { /* no-op */ }
        console.log(`${(type || 'info').toUpperCase()}: ${message}`);
    }

    handlePlatformToggle(platform, enabled, suppressDisconnect = false) {
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
            if (!suppressDisconnect && status && status.status === 'connected') {
                this.disconnectPlatform(platform);
            }
        }
        
        // Save platform enabled state
        this.savePlatformEnabledState(platform, enabled);
    }

    async savePlatformEnabledState(platform, enabled) {
        try {
            const base = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '';
            await fetch(`${base}/api/platforms/${platform}/enabled`, {
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
                this.setInputValue('facebook-page-token', credentials.pageAccessToken);
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
            // Private API credentials - Session ID only
            this.setInputValue('instagram-session-id', credentials.sessionId);
            // Web Automation credentials
            this.setInputValue('instagram-web-username', credentials.webUsername);
            this.setInputValue('instagram-web-password', credentials.webPassword);
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
            const base = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '';
            const response = await fetch(`${base}/api/platforms/status`);
            if (response.ok) {
                this.platformStatus = await response.json();
                this.updatePlatformUI();
                this.updateStatusTable();
            } else {
                console.warn('Failed to load platform status', response.status, response.statusText);
                // Throttle status error toast to at most once per 30s
                const now = Date.now();
                if (now - this._lastStatusErrorAt > 30000) {
                    this._lastStatusErrorAt = now;
                    // Avoid noisy toasts for 404s in non-matching environments
                    if (response.status !== 404) {
                        this.showToast(window.i18n?.t('platforms.connection_failed') || 'Failed to load platform status', 'error');
                    }
                }
            }
        } catch (error) {
            console.error('Error loading platform status:', error);
            const now = Date.now();
            if (now - this._lastStatusErrorAt > 30000) {
                this._lastStatusErrorAt = now;
                this.showToast(window.i18n?.t('platforms.connection_failed') || 'Failed to load platform status', 'error');
            }
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
                // Apply visual state without auto-disconnecting during initialization
                this.handlePlatformToggle(platform, isEnabled, true);
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

    isPlatformsTabVisible() {
        const pane = document.getElementById('platforms');
        // If we can't find the element (ID differences), default to true to keep polling
        if (!pane) return true;
        // Bootstrap tab-pane visibility
        return pane.classList.contains('active') || pane.classList.contains('show');
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
            const base = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '';
            const response = await fetch(`${base}/api/platforms/${platform}/connect`, {
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
            const base = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '';
            const response = await fetch(`${base}/api/platforms/${platform}/disconnect`, {
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
                    // Easy setup method - check authentication method
                    const authMethod = document.getElementById('facebook-auth-method')?.value || 'app_state';
                    config.authMethod = authMethod;
                    
                    if (authMethod === 'app_state') {
                        const appStateValue = document.getElementById('facebook-app-state')?.value;
                        config.appState = appStateValue;
                        
                        // Validate app state before sending
                        if (appStateValue && appStateValue.trim() !== '') {
                            try {
                                const appState = JSON.parse(appStateValue);
                                
                                // Check for template placeholders
                                const templateCookies = ['c_user', 'xs', 'datr'].filter(cookieName => {
                                    const cookie = appState.find(c => c.key === cookieName);
                                    return cookie && cookie.value && 
                                        (cookie.value.includes('PASTE_YOUR_') || cookie.value.includes('_HERE'));
                                });
                                
                                if (templateCookies.length > 0) {
                                    if (!confirm('Facebook app state still contains template placeholders. Are you sure you want to continue?')) {
                                        return null; // Cancel connection
                                    }
                                }
                            } catch (e) {
                                // Invalid JSON, let server handle it
                            }
                        }
                    } else {
                        config.email = document.getElementById('facebook-email')?.value;
                        config.password = document.getElementById('facebook-password')?.value;
                    }
                }
                break;
            case 'instagram':
                if (method === 'official') {
                    config.accessToken = document.getElementById('instagram-access-token')?.value;
                    config.verifyToken = document.getElementById('instagram-verify-token')?.value;
                    config.appSecret = document.getElementById('instagram-app-secret')?.value;
                } else if (method === 'private') {
                    // Private API only supports session ID authentication
                    config.authMethod = 'session';
                    config.sessionId = document.getElementById('instagram-session-id')?.value;
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
    
    /**
     * Extract Instagram session ID from browser
     */
    async extractInstagramSession() {
        const extractBtn = document.getElementById('extract-session-btn');
        const sessionTextarea = document.getElementById('instagram-session-id');
        
        if (!extractBtn || !sessionTextarea) return;
        
        // Disable button and show loading
        extractBtn.disabled = true;
        extractBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Extracting...';
        
        try {
            // Method 1: Try to extract from current browser cookies
            const sessionId = await this.extractSessionFromCookies();
            
            if (sessionId) {
                sessionTextarea.value = sessionId;
                this.showToast('✅ Session ID extracted successfully!', 'success');
                
                // Validate the session
                this.validateExtractedSession(sessionId);
            } else {
                // Method 2: Open session extractor tool
                this.openSessionExtractorTool();
            }
            
        } catch (error) {
            console.error('Session extraction error:', error);
            this.showToast('❌ Failed to extract session. Try the manual method.', 'error');
            this.openSessionExtractorTool();
        } finally {
            // Re-enable button
            extractBtn.disabled = false;
            extractBtn.innerHTML = '<i class="bi bi-download"></i> Extract';
        }
    }
    
    /**
     * Extract session ID from browser cookies
     */
    async extractSessionFromCookies() {
        try {
            // Check if we can access Instagram cookies
            const cookies = document.cookie.split(';');
            
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'sessionid') {
                    return decodeURIComponent(value);
                }
            }
            
            // If no direct cookie access, try iframe method
            return await this.extractSessionFromIframe();
            
        } catch (error) {
            console.error('Cookie extraction failed:', error);
            return null;
        }
    }
    
    /**
     * Extract session using iframe method
     */
    async extractSessionFromIframe() {
        return new Promise((resolve) => {
            // Create hidden iframe to Instagram
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = 'https://www.instagram.com';
            
            iframe.onload = () => {
                try {
                    // Try to access iframe cookies (may be blocked by CORS)
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const cookies = iframeDoc.cookie.split(';');
                    
                    for (let cookie of cookies) {
                        const [name, value] = cookie.trim().split('=');
                        if (name === 'sessionid') {
                            document.body.removeChild(iframe);
                            resolve(decodeURIComponent(value));
                            return;
                        }
                    }
                } catch (error) {
                    console.log('Iframe method blocked by CORS:', error);
                }
                
                document.body.removeChild(iframe);
                resolve(null);
            };
            
            iframe.onerror = () => {
                document.body.removeChild(iframe);
                resolve(null);
            };
            
            document.body.appendChild(iframe);
            
            // Timeout after 5 seconds
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                    resolve(null);
                }
            }, 5000);
        });
    }
    
    /**
     * Validate extracted session ID
     */
    async validateExtractedSession(sessionId) {
        try {
            // Simple validation - check if it looks like a valid session ID
            if (sessionId.length < 20) {
                this.showToast('⚠️ Session ID seems too short. Please verify.', 'warning');
                return;
            }
            
            // You could add more validation here, like testing the session
            this.showToast('✅ Session ID appears valid', 'success');
            
        } catch (error) {
            console.error('Session validation error:', error);
        }
    }
    
    /**
     * Open session extractor tool in new window
     */
    openSessionExtractorTool() {
        const extractorUrl = '/utils/instagram-session-extractor.html';
        const extractorWindow = window.open(
            extractorUrl,
            'instagram-session-extractor',
            'width=900,height=700,scrollbars=yes,resizable=yes'
        );
        
        if (extractorWindow) {
            this.showToast('📱 Session extractor opened in new window', 'info');
            
            // Listen for messages from the extractor window
            window.addEventListener('message', (event) => {
                if (event.origin !== window.location.origin) return;
                
                if (event.data.type === 'instagram-session-extracted') {
                    const sessionTextarea = document.getElementById('instagram-session-id');
                    if (sessionTextarea && event.data.sessionId) {
                        sessionTextarea.value = event.data.sessionId;
                        this.showToast('✅ Session ID received from extractor!', 'success');
                        extractorWindow.close();
                    }
                }
            });
        } else {
            this.showToast('❌ Please allow popups and try again', 'error');
        }
    }
    
    /**
     * Show session extractor help modal
     */
    showSessionExtractorHelp() {
        const helpModal = `
            <div class="modal fade" id="sessionExtractorHelpModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-question-circle me-2"></i>
                                How to Extract Instagram Session ID
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="bi bi-info-circle me-2"></i>
                                <strong>Session ID is more stable than username/password login</strong>
                            </div>
                            
                            <h6><i class="bi bi-1-circle me-2"></i>Method 1: Automatic Extraction</h6>
                            <ol>
                                <li>Make sure you're logged into Instagram in this browser</li>
                                <li>Click the "Extract" button above</li>
                                <li>If successful, the session ID will be filled automatically</li>
                            </ol>
                            
                            <h6 class="mt-4"><i class="bi bi-2-circle me-2"></i>Method 2: Manual Browser Extraction</h6>
                            <ol>
                                <li>Go to <a href="https://www.instagram.com" target="_blank">instagram.com</a> and login</li>
                                <li>Press <kbd>F12</kbd> to open Developer Tools</li>
                                <li>Go to <strong>Application</strong> tab → <strong>Cookies</strong> → <strong>https://www.instagram.com</strong></li>
                                <li>Find the cookie named <code>sessionid</code></li>
                                <li>Copy the <strong>Value</strong> and paste it above</li>
                            </ol>
                            
                            <h6 class="mt-4"><i class="bi bi-3-circle me-2"></i>Method 3: Session Extractor Tool</h6>
                            <ol>
                                <li>Click the "Extract" button to open the session extractor tool</li>
                                <li>Follow the instructions in the new window</li>
                                <li>The session ID will be automatically filled when extracted</li>
                            </ol>
                            
                            <div class="alert alert-warning mt-3">
                                <i class="bi bi-exclamation-triangle me-2"></i>
                                <strong>Security Note:</strong> Only use this on your own computer. Session IDs provide full account access.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="window.platformManager.openSessionExtractorTool()">
                                <i class="bi bi-tools me-1"></i> Open Session Extractor Tool
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if present
        const existingModal = document.getElementById('sessionExtractorHelpModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', helpModal);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('sessionExtractorHelpModal'));
        modal.show();
        
        // Clean up modal when hidden
        document.getElementById('sessionExtractorHelpModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
}

// Global function for Facebook authentication method change
function handleFacebookAuthMethodChange() {
    const authMethod = document.getElementById('facebook-auth-method').value;
    const appStateAuth = document.getElementById('facebook-app-state-auth');
    const loginAuth = document.getElementById('facebook-login-auth');
    
    if (authMethod === 'app_state') {
        appStateAuth.style.display = 'block';
        loginAuth.style.display = 'none';
        initializeFacebookAppStateHelpers();
    } else {
        appStateAuth.style.display = 'none';
        loginAuth.style.display = 'block';
    }
}

// Initialize Facebook App State helper functions
function initializeFacebookAppStateHelpers() {
    const textarea = document.getElementById('facebook-app-state');
    const templateBtn = document.getElementById('facebook-template-btn');
    const validateBtn = document.getElementById('facebook-validate-btn');
    const formatBtn = document.getElementById('facebook-format-btn');
    const helpBtn = document.getElementById('facebook-help-btn');
    const statusDiv = document.getElementById('facebook-app-state-status');
    const resultDiv = document.getElementById('facebook-validation-result');
    
    if (!textarea || !templateBtn || !validateBtn || !formatBtn || !helpBtn) return;
    
    // Real-time validation on input
    textarea.addEventListener('input', () => {
        validateFacebookAppState(false);
    });
    
    // Template button
    templateBtn.addEventListener('click', () => {
        fillFacebookAppStateTemplate();
    });
    
    // Validate button
    validateBtn.addEventListener('click', () => {
        validateFacebookAppState(true);
    });
    
    // Format button
    formatBtn.addEventListener('click', () => {
        formatFacebookAppState();
    });
    
    // Help button
    helpBtn.addEventListener('click', () => {
        showFacebookAppStateHelp();
    });
}

// Fill Facebook App State template
function fillFacebookAppStateTemplate() {
    const textarea = document.getElementById('facebook-app-state');
    if (!textarea) return;
    
    const template = `[
  {
    "key": "c_user",
    "value": "PASTE_YOUR_C_USER_VALUE_HERE",
    "domain": ".facebook.com"
  },
  {
    "key": "xs",
    "value": "PASTE_YOUR_XS_VALUE_HERE",
    "domain": ".facebook.com"
  },
  {
    "key": "datr",
    "value": "PASTE_YOUR_DATR_VALUE_HERE",
    "domain": ".facebook.com"
  },
  {
    "key": "sb",
    "value": "PASTE_YOUR_SB_VALUE_HERE",
    "domain": ".facebook.com"
  }
]`;
    
    textarea.value = template;
    textarea.focus();
    
    // Clear validation status
    const statusDiv = document.getElementById('facebook-app-state-status');
    const resultDiv = document.getElementById('facebook-validation-result');
    if (statusDiv) statusDiv.innerHTML = '';
    if (resultDiv) resultDiv.style.display = 'none';
    
    // Show helpful message
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div class="alert alert-info small">
                <i class="bi bi-info-circle me-1"></i>
                <strong>Template loaded!</strong> Now replace each <code>PASTE_YOUR_..._HERE</code> placeholder with the actual cookie value from your browser.
                <br><br>
                <strong>Steps:</strong>
                <ol class="mb-0 mt-2">
                    <li>Login to <strong>facebook.com</strong> in your browser</li>
                    <li>Press <kbd>F12</kbd> to open Developer Tools</li>
                    <li>Go to <strong>Application</strong> tab → <strong>Cookies</strong> → <strong>facebook.com</strong></li>
                    <li>Find each cookie (c_user, xs, datr, sb) and copy its <strong>Value</strong></li>
                    <li>Replace the corresponding placeholder in the template above</li>
                </ol>
            </div>
        `;
        resultDiv.style.display = 'block';
    }
}

// Validate Facebook App State
function validateFacebookAppState(showDetails = false) {
    const textarea = document.getElementById('facebook-app-state');
    const statusDiv = document.getElementById('facebook-app-state-status');
    const resultDiv = document.getElementById('facebook-validation-result');
    
    if (!textarea || !statusDiv) return;
    
    const value = textarea.value.trim();
    
    // Clear previous status
    statusDiv.innerHTML = '';
    if (resultDiv) resultDiv.style.display = 'none';
    
    if (!value) {
        if (showDetails && resultDiv) {
            resultDiv.innerHTML = '<div class="alert alert-warning small"><i class="bi bi-exclamation-triangle me-1"></i>Please paste your Facebook app state JSON</div>';
            resultDiv.style.display = 'block';
        }
        return;
    }
    
    try {
        const appState = JSON.parse(value);
        
        // Check if it's an array
        if (!Array.isArray(appState)) {
            throw new Error('App state must be an array of cookie objects');
        }
        
        // Check for required cookies
        const requiredCookies = ['c_user', 'xs', 'datr', 'sb'];
        const foundCookies = [];
        const missingCookies = [];
        const templatePlaceholders = [];
        
        requiredCookies.forEach(cookieName => {
            const cookie = appState.find(c => c.key === cookieName);
            if (cookie && cookie.value && cookie.value.trim() !== '') {
                // Check if it's still a template placeholder
                if (cookie.value.includes('PASTE_YOUR_') && cookie.value.includes('_HERE')) {
                    templatePlaceholders.push(cookieName);
                } else {
                    foundCookies.push(cookieName);
                }
            } else {
                missingCookies.push(cookieName);
            }
        });
        
        // Check cookie structure
        const invalidCookies = appState.filter(cookie => {
            return !cookie.key && !cookie.name || !cookie.value;
        });
        
        if (invalidCookies.length > 0) {
            throw new Error('Some cookies are missing key or value properties');
        }
        
        // Show status
        if (templatePlaceholders.length > 0) {
            statusDiv.innerHTML = '<span class="badge bg-warning"><i class="bi bi-exclamation-triangle"></i> Template</span>';
            if (showDetails && resultDiv) {
                resultDiv.innerHTML = `
                    <div class="alert alert-warning small">
                        <i class="bi bi-exclamation-triangle me-1"></i>
                        <strong>Template placeholders detected!</strong> Please replace the following placeholders with actual cookie values:
                        <ul class="mb-0 mt-2">
                            ${templatePlaceholders.map(cookie => `<li><code>${cookie}</code>: Replace <code>PASTE_YOUR_${cookie.toUpperCase()}_VALUE_HERE</code></li>`).join('')}
                        </ul>
                    </div>
                `;
                resultDiv.style.display = 'block';
            }
        } else if (missingCookies.length === 0) {
            statusDiv.innerHTML = '<span class="badge bg-success"><i class="bi bi-check-circle"></i> Valid</span>';
            if (showDetails && resultDiv) {
                resultDiv.innerHTML = `
                    <div class="alert alert-success small">
                        <i class="bi bi-check-circle me-1"></i>
                        <strong>Valid App State!</strong><br>
                        Found ${appState.length} cookies including all required ones: ${requiredCookies.join(', ')}
                    </div>
                `;
                resultDiv.style.display = 'block';
            }
        } else {
            statusDiv.innerHTML = '<span class="badge bg-warning"><i class="bi bi-exclamation-triangle"></i> Incomplete</span>';
            if (showDetails && resultDiv) {
                resultDiv.innerHTML = `
                    <div class="alert alert-warning small">
                        <i class="bi bi-exclamation-triangle me-1"></i>
                        <strong>Incomplete App State</strong><br>
                        Missing required cookies: <code>${missingCookies.join(', ')}</code><br>
                        Found cookies: <code>${foundCookies.join(', ')}</code>
                    </div>
                `;
                resultDiv.style.display = 'block';
            }
        }
        
    } catch (error) {
        statusDiv.innerHTML = '<span class="badge bg-danger"><i class="bi bi-x-circle"></i> Invalid</span>';
        if (showDetails && resultDiv) {
            resultDiv.innerHTML = `
                <div class="alert alert-danger small">
                    <i class="bi bi-x-circle me-1"></i>
                    <strong>Invalid JSON:</strong> ${error.message}<br>
                    <small class="text-muted">Make sure your app state is valid JSON format</small>
                </div>
            `;
            resultDiv.style.display = 'block';
        }
    }
}

// Format Facebook App State JSON
function formatFacebookAppState() {
    const textarea = document.getElementById('facebook-app-state');
    if (!textarea) return;
    
    const value = textarea.value.trim();
    if (!value) return;
    
    try {
        const appState = JSON.parse(value);
        const formatted = JSON.stringify(appState, null, 2);
        textarea.value = formatted;
        validateFacebookAppState();
    } catch (error) {
        alert('Cannot format invalid JSON. Please fix the JSON syntax first.');
    }
}

// Show Facebook App State extraction help
function showFacebookAppStateHelp() {
    const helpModal = `
        <div class="modal fade" id="facebookAppStateHelpModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-facebook text-primary me-2"></i>
                            How to Extract Facebook App State
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-1"></i>
                            <strong>App State</strong> contains your Facebook session cookies that allow WA-BOT to authenticate without username/password.
                        </div>
                        
                        <h6><i class="bi bi-1-circle text-primary me-1"></i> Login to Facebook</h6>
                        <p>Open your browser and login to <strong>facebook.com</strong> with the account you want to use for the bot.</p>
                        
                        <h6><i class="bi bi-2-circle text-primary me-1"></i> Open Developer Tools</h6>
                        <div class="row">
                            <div class="col-md-4">
                                <strong>Chrome/Edge:</strong><br>
                                <kbd>F12</kbd> or <kbd>Ctrl+Shift+I</kbd><br>
                                → Application tab → Cookies → facebook.com
                            </div>
                            <div class="col-md-4">
                                <strong>Firefox:</strong><br>
                                <kbd>F12</kbd> or <kbd>Ctrl+Shift+I</kbd><br>
                                → Storage tab → Cookies → facebook.com
                            </div>
                            <div class="col-md-4">
                                <strong>Safari:</strong><br>
                                <kbd>Cmd+Opt+I</kbd><br>
                                → Storage tab → Cookies → facebook.com
                            </div>
                        </div>
                        
                        <h6 class="mt-3"><i class="bi bi-3-circle text-primary me-1"></i> Find Required Cookies</h6>
                        <p>Look for these 4 cookies and copy their <strong>Value</strong> (not the name):</p>
                        <ul>
                            <li><code>c_user</code> - Your Facebook user ID (numbers only)</li>
                            <li><code>xs</code> - Session token (long string)</li>
                            <li><code>datr</code> - Browser fingerprint</li>
                            <li><code>sb</code> - Session browser token</li>
                        </ul>
                        
                        <h6><i class="bi bi-4-circle text-primary me-1"></i> Format as JSON</h6>
                        <p>Create a JSON array with this structure:</p>
                        <pre class="bg-light p-2 rounded"><code>[{"key":"c_user","value":"YOUR_C_USER_VALUE","domain":".facebook.com"},{"key":"xs","value":"YOUR_XS_VALUE","domain":".facebook.com"},{"key":"datr","value":"YOUR_DATR_VALUE","domain":".facebook.com"},{"key":"sb","value":"YOUR_SB_VALUE","domain":".facebook.com"}]</code></pre>
                        
                        <div class="alert alert-warning mt-3">
                            <i class="bi bi-shield-exclamation me-1"></i>
                            <strong>Security Note:</strong> Treat your app state like a password. Don't share it or commit it to version control.
                        </div>
                        
                        <div class="alert alert-success">
                            <i class="bi bi-lightbulb me-1"></i>
                            <strong>Pro Tip:</strong> You can also use the <code>facebook-session-extractor.html</code> tool in the utils folder for automatic extraction.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="window.open('/utils/facebook-session-extractor.html', '_blank')">Open Extractor Tool</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal
    const existingModal = document.getElementById('facebookAppStateHelpModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', helpModal);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('facebookAppStateHelpModal'));
    modal.show();
    
    // Clean up modal when hidden
    document.getElementById('facebookAppStateHelpModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
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
        
        // Initialize Facebook authentication method
        const facebookAuthMethod = document.getElementById('facebook-auth-method');
        if (facebookAuthMethod) {
            handleFacebookAuthMethodChange();
            // Initialize app state helpers if app state is selected
            if (facebookAuthMethod.value === 'app_state') {
                setTimeout(() => initializeFacebookAppStateHelpers(), 100);
            }
        }
        
        // Instagram authentication method initialization removed - session ID only
        
        // Initialize Facebook official API helpers
        initializeFacebookOfficialHelpers();
    }
});

// Facebook Official API Helper Functions
function initializeFacebookOfficialHelpers() {
    // Setup guide button
    const setupGuideBtn = document.getElementById('facebook-setup-guide-btn');
    if (setupGuideBtn) {
        setupGuideBtn.addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('facebookSetupGuideModal'));
            modal.show();
        });
    }
    
    // Token visibility toggle
    const tokenToggle = document.getElementById('facebook-token-toggle');
    if (tokenToggle) {
        tokenToggle.addEventListener('click', () => {
            togglePasswordVisibility('facebook-page-token');
        });
    }
    
    // Secret visibility toggle
    const secretToggle = document.getElementById('facebook-secret-toggle');
    if (secretToggle) {
        secretToggle.addEventListener('click', () => {
            togglePasswordVisibility('facebook-app-secret');
        });
    }
    
    // Generate verify token
    const generateVerifyBtn = document.getElementById('facebook-generate-verify-btn');
    if (generateVerifyBtn) {
        generateVerifyBtn.addEventListener('click', () => {
            generateFacebookVerifyToken();
        });
    }
    
    // Copy webhook URL
    const webhookCopyBtn = document.getElementById('facebook-webhook-copy');
    if (webhookCopyBtn) {
        webhookCopyBtn.addEventListener('click', () => {
            copyFacebookWebhookUrl();
        });
    }
    
    // Test connection
    const testConnectionBtn = document.getElementById('facebook-test-connection');
    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', () => {
            testFacebookConnection();
        });
    }
    
    // Update webhook URL on page load
    updateFacebookWebhookUrl();
}

// Generate a random verify token
function generateFacebookVerifyToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'fb_verify_';
    for (let i = 0; i < 16; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const verifyTokenInput = document.getElementById('facebook-verify-token');
    if (verifyTokenInput) {
        verifyTokenInput.value = token;
        
        // Show success message
        showToast('Verify token generated successfully!', 'success');
    }
}

// Update webhook URL based on current server settings
function updateFacebookWebhookUrl() {
    const webhookUrlInput = document.getElementById('facebook-webhook-url');
    if (!webhookUrlInput) return;
    
    // Get current host and port
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const port = window.location.port;
    
    let webhookUrl = `${protocol}//${host}`;
    if (port && port !== '80' && port !== '443') {
        webhookUrl += `:${port}`;
    }
    webhookUrl += '/webhook/facebook';
    
    webhookUrlInput.value = webhookUrl;
}

// Copy webhook URL to clipboard
function copyFacebookWebhookUrl() {
    const webhookUrlInput = document.getElementById('facebook-webhook-url');
    if (!webhookUrlInput) return;
    
    webhookUrlInput.select();
    webhookUrlInput.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        document.execCommand('copy');
        showToast('Webhook URL copied to clipboard!', 'success');
    } catch (err) {
        // Fallback for modern browsers
        navigator.clipboard.writeText(webhookUrlInput.value).then(() => {
            showToast('Webhook URL copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Failed to copy webhook URL', 'error');
        });
    }
}

// Test Facebook connection
async function testFacebookConnection() {
    const testBtn = document.getElementById('facebook-test-connection');
    const resultDiv = document.getElementById('facebook-test-result');
    
    if (!testBtn || !resultDiv) return;
    
    // Get form values
    const pageToken = document.getElementById('facebook-page-token')?.value;
    const verifyToken = document.getElementById('facebook-verify-token')?.value;
    const appSecret = document.getElementById('facebook-app-secret')?.value;
    
    if (!pageToken || !verifyToken || !appSecret) {
        resultDiv.innerHTML = `
            <div class="alert alert-warning small">
                <i class="bi bi-exclamation-triangle me-1"></i>
                Please fill in all required fields before testing.
            </div>
        `;
        resultDiv.style.display = 'block';
        return;
    }
    
    // Show loading state
    const originalText = testBtn.innerHTML;
    testBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Testing...';
    testBtn.disabled = true;
    
    try {
        // Test the Facebook API connection
        const base = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : '';
        const response = await fetch(`${base}/api/platforms/facebook/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pageAccessToken: pageToken,
                verifyToken: verifyToken,
                appSecret: appSecret
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            resultDiv.innerHTML = `
                <div class="alert alert-success small">
                    <i class="bi bi-check-circle me-1"></i>
                    <strong>Connection successful!</strong><br>
                    ${result.message || 'Facebook API is working correctly.'}
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-danger small">
                    <i class="bi bi-x-circle me-1"></i>
                    <strong>Connection failed:</strong><br>
                    ${result.message || 'Unknown error occurred.'}
                </div>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger small">
                <i class="bi bi-x-circle me-1"></i>
                <strong>Test failed:</strong><br>
                ${error.message}
            </div>
        `;
    } finally {
        // Restore button state
        testBtn.innerHTML = originalText;
        testBtn.disabled = false;
        resultDiv.style.display = 'block';
    }
}

// Helper function to toggle password visibility
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = document.querySelector(`#${inputId} + button, button[onclick*="${inputId}"]`);
    
    if (!input) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        if (button) {
            button.innerHTML = '<i class="bi bi-eye-slash"></i>';
        }
    } else {
        input.type = 'password';
        if (button) {
            button.innerHTML = '<i class="bi bi-eye"></i>';
        }
    }
}

// (Removed duplicate global showToast to avoid recursion with script.js' showToast)
