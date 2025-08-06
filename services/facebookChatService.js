const login = require('facebook-chat-api');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FacebookBrowserService = require('./facebookBrowserService');

/**
 * Validate Facebook app state format and required cookies
 * @param {Array} appState - Array of cookie objects
 * @returns {boolean} - Whether app state is valid
 */
function validateFacebookAppState(appState) {
    if (!Array.isArray(appState)) {
        return false;
    }
    
    // Check for essential cookies
    const essentialCookies = ['c_user', 'xs', 'datr'];
    const cookieNames = appState.map(cookie => cookie.key);
    
    return essentialCookies.every(name => cookieNames.includes(name));
}

class FacebookChatService {
    constructor(email, password, appState = null) {
        this.email = email;
        this.password = password;
        this.appState = appState || process.env.FACEBOOK_APP_STATE;
        this.api = null;
        this.isLoggedIn = false;
        this.processedMessages = new Set();
        this.pollingInterval = null; // For polling mode
        this.browserService = null; // For browser emulation
        this.useBrowserMode = false;
        this.messageHandlers = []; // Message event handlers
        this.appStatePath = `./facebook_appstate_${Buffer.from(email || 'default').toString('base64').slice(0, 8)}.json`;
        
        console.log('Facebook Chat service initialized (unofficial API + browser fallback)');
        
        // Log authentication method
        if (this.appState) {
            console.log('📱 Using Facebook App State authentication (recommended)');
        } else if (this.email && this.password) {
            console.log('🔑 Using Facebook email/password authentication');
        } else {
            console.log('⚠️ No Facebook authentication method configured');
        }
    }

    /**
     * Validate Facebook app state format and required cookies
     * @param {Array} appState - Array of cookie objects
     * @returns {boolean} - Whether app state is valid
     */
    validateAppState(appState) {
        return validateFacebookAppState(appState);
    }

    /**
     * Load app state from environment variable or file
     */
    loadAppState() {
        // Try environment variable first
        if (this.appState) {
            try {
                const parsed = JSON.parse(this.appState);
                if (this.validateAppState(parsed)) {
                    console.log(`✅ Valid app state loaded (${parsed.length} cookies)`);
                    return parsed;
                } else {
                    console.log('⚠️ App state format invalid');
                    return null;
                }
            } catch (error) {
                console.log('⚠️ Failed to parse app state:', error.message);
                return null;
            }
        }
        
        // Try loading from file
        try {
            if (fs.existsSync(this.appStatePath)) {
                const fileContent = fs.readFileSync(this.appStatePath, 'utf8');
                const parsed = JSON.parse(fileContent);
                if (this.validateAppState(parsed)) {
                    console.log(`✅ App state loaded from file (${parsed.length} cookies)`);
                    return parsed;
                }
            }
        } catch (error) {
            console.log('⚠️ Failed to load app state from file:', error.message);
        }
        
        return null;
    }

    /**
     * Save app state to file
     */
    saveAppState(appState) {
        try {
            fs.writeFileSync(this.appStatePath, JSON.stringify(appState, null, 2));
            console.log('💾 App state saved to file');
        } catch (error) {
            console.log('⚠️ Failed to save app state:', error.message);
        }
    }

    /**
     * Initialize Facebook service with priority: App State → Browser Emulation → API
     */
    async initialize() {
        console.log('🚀 Initializing Facebook Chat Service...');
        console.log('   • Email:', !!this.email);
        console.log('   • Password:', !!this.password);
        console.log('   • App State:', !!this.appState);
        
        // Check if we have any authentication method
        const hasAppState = !!this.loadAppState();
        const hasCredentials = !!(this.email && this.password);
        
        if (!hasAppState && !hasCredentials) {
            console.error('❌ No Facebook authentication method available');
            console.log('');
            console.log('🔧 SETUP REQUIRED:');
            console.log('   Option 1: Set FACEBOOK_APP_STATE in .env (recommended)');
            console.log('   Option 2: Set FACEBOOK_EMAIL and FACEBOOK_PASSWORD in .env');
            console.log('   Option 3: Use Facebook Messenger Official API instead');
            console.log('');
            return false;
        }
        
        // Priority 1: App State → Browser Emulation (OPTIMAL)
        if (hasAppState) {
            console.log('🌍 App State detected - Using Browser Emulation directly...');
            console.log('✨ This is the optimal approach for reliability and security');
            console.log('🎯 Skipping unreliable API, going straight to browser automation');
            
            try {
                const browserSuccess = await this.tryBrowserEmulation();
                if (browserSuccess) {
                    console.log('✅ Browser emulation with app state successful!');
                    this.isLoggedIn = true;
                    this.useBrowserMode = true;
                    return true;
                } else {
                    console.log('❌ Browser emulation failed, trying API fallback...');
                }
            } catch (browserError) {
                console.log('❌ Browser emulation error:', browserError.message);
                console.log('🔄 Trying API fallback...');
            }
        }
        
        // Priority 2: API Login (Fallback only)
        console.log('🔄 Attempting API login as fallback...');
        console.log('⚠️ Note: API is unreliable due to Facebook blocking');
        
        try {
            const apiSuccess = await this.tryApiLogin(hasAppState, hasCredentials);
            if (apiSuccess) {
                console.log('✅ API login successful (unexpected but good!)');
                this.isLoggedIn = true;
                return true;
            }
        } catch (apiError) {
            console.log('❌ API login failed:', apiError.message);
        }
        
        console.log('❌ All authentication methods failed');
        console.log('💡 Recommendations:');
        console.log('   1. 🌟 Use Facebook Messenger Official API (most reliable)');
        console.log('   2. 🔄 Re-extract fresh app state from browser');
        console.log('   3. 🧪 Run test-appstate-browser.js to diagnose issues');
        
        return false;
    }

    /**
     * Try API login (fallback method)
     */
    async tryApiLogin(hasAppState, hasCredentials) {
        return new Promise((resolve, reject) => {
            try {
                const appState = this.loadAppState();
                
                const loginOptions = {
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    pauseLog: true,
                    logLevel: 'silent',
                    selfListen: false,
                    listenEvents: false,
                    updatePresence: false,
                    autoMarkDelivery: false,
                    autoMarkRead: false,
                    forceLogin: true,
                    autoReconnect: false,
                    session: false,
                    keepAlive: false,
                    listenTyping: false,
                    autoMarkSeen: false,
                    mqttEndpoint: null,
                    region: 'www'
                };
                
                // Add authentication method
                if (appState) {
                    loginOptions.appState = appState;
                } else if (hasCredentials) {
                    loginOptions.email = this.email;
                    loginOptions.password = this.password;
                } else {
                    reject(new Error('No authentication method available'));
                    return;
                }
                
                // Try login
                login(loginOptions, (err, api) => {
                    if (err) {
                        console.log('❌ API login failed:', err.message || err);
                        
                        // Try browser emulation as final fallback
                        console.log('🌍 Trying browser emulation as final fallback...');
                        this.tryBrowserEmulation().then((browserSuccess) => {
                            if (browserSuccess) {
                                console.log('✅ Browser emulation fallback successful!');
                                this.isLoggedIn = true;
                                this.useBrowserMode = true;
                                resolve(true);
                            } else {
                                console.log('❌ Browser emulation also failed');
                                resolve(false);
                            }
                        }).catch((browserError) => {
                            console.log('❌ Browser emulation error:', browserError.message);
                            resolve(false);
                        });
                        return;
                    }
                    
                    console.log('✅ API login successful!');
                    this.api = api;
                    this.isLoggedIn = true;
                    
                    // Save app state for future use
                    try {
                        const newAppState = api.getAppState();
                        this.saveAppState(newAppState);
                    } catch (stateError) {
                        console.log('⚠️ Could not save app state:', stateError.message);
                    }
                    
                    // Start polling mode (more reliable than real-time listener)
                    this.startPollingMode();
                    
                    resolve(true);
                });
                
            } catch (error) {
                console.log('❌ API login setup error:', error.message);
                reject(error);
            }
        });
    }

    /**
     * Start polling mode for API
     */
    startPollingMode() {
        if (!this.api) {
            console.log('❌ No API available for polling');
            return;
        }
        
        console.log('🔄 Starting Facebook API polling mode...');
        
        this.pollingInterval = setInterval(async () => {
            try {
                this.api.getThreadList(3, null, [], (err, threads) => {
                    if (err) {
                        const errorMsg = err.message || err.error || 'Unknown error';
                        console.log('⚠️ Polling error:', errorMsg);
                        
                        if (errorMsg.includes('1357004') || errorMsg.includes('login') || errorMsg.includes('session')) {
                            console.log('❌ Session invalidated, stopping polling');
                            this.stopPollingMode();
                        }
                        return;
                    }
                    
                    console.log(`💬 Found ${threads ? threads.length : 0} Facebook threads`);
                    // Process messages here if needed
                });
            } catch (error) {
                console.log('⚠️ Polling cycle error:', error.message);
            }
        }, 10000);
        
        console.log('✅ Facebook API polling started');
    }

    /**
     * Stop polling mode
     */
    stopPollingMode() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('⏹️ Facebook API polling stopped');
        }
    }

    /**
     * Try browser emulation
     */
    async tryBrowserEmulation() {
        try {
            console.log('🌍 Initializing Facebook Browser Service...');
            
            this.browserService = new FacebookBrowserService(
                this.email, 
                this.password, 
                this.appState
            );
            
            await this.browserService.initialize();
            
            // Set up message handler to bridge browser messages to existing handlers
            this.browserService.onMessage((message) => {
                console.log('💬 Browser message received:', message.body);
                
                // Convert browser message format to API format
                const apiMessage = {
                    body: message.body,
                    senderID: message.senderID,
                    threadID: message.threadID,
                    messageID: message.messageID,
                    timestamp: message.timestamp
                };
                
                // Trigger existing message handlers
                this.messageHandlers.forEach(handler => {
                    try {
                        handler(null, apiMessage);
                    } catch (error) {
                        console.log('⚠️ Browser message handler error:', error.message);
                    }
                });
            });
            
            console.log('✅ Browser emulation initialized successfully');
            return true;
            
        } catch (error) {
            console.log('❌ Browser emulation failed:', error.message);
            return false;
        }
    }

    /**
     * Add message event handler
     */
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }

    /**
     * Send message (supports both API and browser mode)
     */
    async sendMessage(message, threadID) {
        if (this.useBrowserMode && this.browserService) {
            return await this.browserService.sendMessage(message, threadID);
        } else if (this.api) {
            return new Promise((resolve, reject) => {
                this.api.sendMessage(message, threadID, (err) => {
                    if (err) {
                        console.log('❌ API sendMessage failed:', err.message);
                        reject(err);
                    } else {
                        console.log('✅ API message sent successfully');
                        resolve(true);
                    }
                });
            });
        } else {
            throw new Error('No Facebook service available (neither API nor browser)');
        }
    }

    /**
     * Stop the service
     */
    async stop() {
        console.log('🛑 Stopping Facebook Chat Service...');
        
        this.stopPollingMode();
        
        if (this.browserService) {
            await this.browserService.stop();
            this.browserService = null;
        }
        
        this.isLoggedIn = false;
        this.useBrowserMode = false;
        
        console.log('✅ Facebook Chat Service stopped');
    }
}

module.exports = FacebookChatService;
