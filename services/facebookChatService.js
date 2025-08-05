const login = require('facebook-chat-api');

/**
 * Validate Facebook app state format and required cookies
 * @param {Array} appState - Array of cookie objects
 * @returns {boolean} - Whether app state is valid
 */
function validateFacebookAppState(appState) {
    if (!Array.isArray(appState)) {
        return false;
    }
    
    // Check for required cookies
    const requiredCookies = ['c_user', 'xs', 'datr'];
    const foundCookies = requiredCookies.filter(cookieName => 
        appState.some(cookie => cookie.key === cookieName && cookie.value && cookie.value.trim() !== '')
    );
    
    // Also check for common cookie structure
    const hasValidStructure = appState.every(cookie => 
        (cookie.key || cookie.name) && cookie.value !== undefined
    );
    
    return foundCookies.length >= 3 && hasValidStructure; // At least 3 required cookies and valid structure
}

class FacebookChatService {
    constructor(email, password, appState = null) {
        this.email = email;
        this.password = password;
        this.appState = appState || process.env.FACEBOOK_APP_STATE;
        this.api = null;
        this.isLoggedIn = false;
        this.processedMessages = new Set();
        this.appStatePath = `./facebook_appstate_${Buffer.from(email || 'default').toString('base64').slice(0, 8)}.json`;
        
        console.log('Facebook Chat service initialized (unofficial API)');
        
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
     * Test if app state is likely to work for login
     * @param {Array} appState - Array of cookie objects
     * @returns {boolean} - Whether app state is likely valid for login
     */
    testAppStateValidity(appState) {
        if (!this.validateAppState(appState)) {
            return false;
        }
        
        // Check if required cookies have non-empty values
        const requiredCookies = ['c_user', 'xs', 'datr'];
        for (const cookieName of requiredCookies) {
            const cookie = appState.find(c => c.key === cookieName);
            if (!cookie || !cookie.value || cookie.value.trim() === '' || 
                cookie.value.includes('PASTE_YOUR_') || cookie.value.includes('_HERE')) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Load saved app state for persistent login
     */
    loadAppState() {
        try {
            // First, try to use app state from environment variable
            if (this.appState) {
                console.log('🌍 Loading Facebook app state from environment variable...');
                
                // Parse app state
                let appState;
                if (typeof this.appState === 'string') {
                    try {
                        appState = JSON.parse(this.appState);
                    } catch (parseError) {
                        console.log('❌ Invalid JSON in FACEBOOK_APP_STATE environment variable');
                        console.log('   • Error:', parseError.message);
                        console.log('   • Make sure FACEBOOK_APP_STATE contains valid JSON');
                        return null;
                    }
                } else {
                    appState = this.appState;
                }
                
                // Validate app state format
                if (!this.validateAppState(appState)) {
                    console.log('❌ Invalid Facebook app state format');
                    console.log('   • App state must be an array of cookie objects');
                    console.log('   • Required cookies: c_user, xs, datr');
                    
                    // Show what we got
                    if (Array.isArray(appState)) {
                        console.log(`   • Found ${appState.length} cookies in app state`);
                        appState.slice(0, 5).forEach((cookie, index) => {
                            console.log(`     ${index + 1}. ${cookie.key || cookie.name || 'unknown'}: ${cookie.value ? '✓' : '✗'}`);
                        });
                        if (appState.length > 5) {
                            console.log(`     ... and ${appState.length - 5} more cookies`);
                        }
                    } else {
                        console.log('   • App state is not an array:', typeof appState);
                    }
                    return null;
                }
                
                console.log(`✅ Loaded app state with ${appState.length} cookies from environment`);
                return appState;
            }
            
            // Fallback to file-based app state
            const fs = require('fs');
            if (fs.existsSync(this.appStatePath)) {
                const appState = JSON.parse(fs.readFileSync(this.appStatePath, 'utf8'));
                
                // Validate app state format
                if (!this.validateAppState(appState)) {
                    console.log('❌ Invalid Facebook app state format in file');
                    return null;
                }
                
                console.log(`📱 Loaded Facebook app state from file (${appState.length} cookies)`);
                return appState;
            }
        } catch (error) {
            console.log('⚠️ Could not load Facebook app state:', error.message);
            if (this.appState) {
                console.log('   • Check if FACEBOOK_APP_STATE is valid JSON format');
                console.log('   • Make sure the app state was extracted correctly');
            }
        }
        return null;
    }

    /**
     * Save app state for future logins
     */
    saveAppState(appState) {
        try {
            const fs = require('fs');
            fs.writeFileSync(this.appStatePath, JSON.stringify(appState, null, 2));
            console.log('💾 Saved Facebook app state for future logins');
        } catch (error) {
            console.error('❌ Failed to save Facebook app state:', error.message);
        }
    }

    /**
     * Initialize and login to Facebook
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            try {
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
                    resolve(false);
                    return;
                }
                
                console.log(`🔑 Attempting Facebook login (${hasAppState ? 'App State' : 'Email/Password'})...`);
                
                // Use latest Chrome user agents and additional bypass options
                const userAgents = [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ];
                const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
                
                const appState = this.loadAppState();
                
                const loginOptions = {
                    userAgent: randomUserAgent,
                    pauseLog: true,
                    logLevel: 'silent',
                    selfListen: false,
                    listenEvents: false,
                    updatePresence: false,
                    autoMarkDelivery: false,
                    autoMarkRead: false,
                    forceLogin: true,
                    pageID: null,
                    proxy: null,
                    online: false,
                    autoReconnect: true, // Enable auto-reconnect
                    session: true, // Enable session persistence
                    keepAlive: true // Keep connection alive
                };
                
                // Add authentication method
                if (appState) {
                    // Test app state validity
                    if (!this.testAppStateValidity(appState)) {
                        console.log('⚠️ Facebook app state may be invalid or contain template placeholders');
                        console.log('   • Make sure all required cookies have actual values');
                        console.log('   • Required cookies: c_user, xs, datr');
                        
                        // Still proceed but with warning
                    }
                    
                    // App state authentication (preferred)
                    loginOptions.appState = appState;
                    console.log('📱 Using app state authentication');
                    
                    // Log app state info for debugging
                    const requiredCookies = ['c_user', 'xs', 'datr', 'sb'];
                    requiredCookies.forEach(cookieName => {
                        const cookie = appState.find(c => c.key === cookieName);
                        if (cookie) {
                            const hasValue = cookie.value && cookie.value.trim() !== '';
                            const isTemplate = cookie.value && (cookie.value.includes('PASTE_YOUR_') || cookie.value.includes('_HERE'));
                            console.log(`   • ${cookieName}: ${hasValue && !isTemplate ? '✓ Present' : isTemplate ? '⚠️ Template' : '✗ Empty'}`);
                        } else {
                            console.log(`   • ${cookieName}: ✗ Not found`);
                        }
                    });
                } else {
                    // Email/password authentication (fallback)
                    loginOptions.email = this.email;
                    loginOptions.password = this.password;
                    loginOptions.forceLogin = true;
                    console.log('🔑 Using email/password authentication');
                }

                console.log(`🔑 Attempting Facebook login with enhanced options (User-Agent: ${randomUserAgent.includes('Chrome') ? 'Chrome' : randomUserAgent.includes('Firefox') ? 'Firefox' : 'Safari'})...`);
                
                // Enhanced login with retry mechanism for 404 errors
                let retryCount = 0;
                const maxRetries = 3;
                
                const attemptLogin = () => {
                    if (retryCount > 0) {
                        console.log(`🔄 Retry attempt ${retryCount}/${maxRetries - 1}...`);
                        // Use different user agent for retry
                        loginOptions.userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
                    }
                    
                    // Try alternative facebook-chat-api first, fallback to original
                    let login;
                    try {
                        login = require('fca-unofficial');
                        console.log('🔄 Using fca-unofficial (alternative Facebook API)');
                    } catch (e) {
                        login = require('facebook-chat-api');
                        console.log('🔄 Using facebook-chat-api (original)');
                    }
                    
                    login(loginOptions, (err, api) => {
                    if (err) {
                        console.error('❌ Facebook login failed:', err);
                        
                        // Provide specific guidance based on error
                        if (err.error && err.error.includes('login approvals')) {
                            console.log('');
                            console.log('🚨 FACEBOOK 2FA ISSUE DETECTED:');
                            console.log('   • Your Facebook account has 2FA (login approvals) enabled');
                            console.log('   • Facebook unofficial API cannot handle 2FA automatically');
                            console.log('');
                            console.log('🔧 SOLUTIONS:');
                            console.log('   1. Disable 2FA on this Facebook account (recommended for bots)');
                            console.log('   2. Use Facebook Messenger Official API instead');
                            console.log('   3. Create a dedicated bot account without 2FA');
                            console.log('');
                        } else if (err.error && err.error.includes('blocked')) {
                            console.log('');
                            console.log('🚫 FACEBOOK UNOFFICIAL API BLOCKED:');
                            console.log('   • Facebook has detected and blocked the unofficial API');
                            console.log('   • This is NOT a problem with your account - you can still login normally');
                            console.log('   • Facebook actively blocks third-party chat APIs for security');
                            console.log('');
                            console.log('🔧 SOLUTIONS (in order of recommendation):');
                            console.log('   1. 🌟 Use Facebook Messenger Official API (recommended)');
                            console.log('      - More reliable and officially supported');
                            console.log('      - Requires Facebook Developer setup');
                            console.log('      - Set FACEBOOK_PAGE_ACCESS_TOKEN in .env');
                            console.log('');
                            console.log('   2. 🔄 Try different unofficial API workarounds:');
                            console.log('      - Use a VPN or different IP address');
                            console.log('      - Create a brand new Facebook account');
                            console.log('      - Wait 24-48 hours and try again');
                            console.log('');
                            console.log('   3. 📱 Alternative: Use Instagram Private API instead');
                            console.log('      - Instagram messaging works more reliably');
                            console.log('      - Set INSTAGRAM_SESSION_ID in .env');
                            console.log('');
                            console.log('📚 FACEBOOK OFFICIAL API SETUP GUIDE:');
                            console.log('   1. Go to https://developers.facebook.com/');
                            console.log('   2. Create a new app and add Messenger product');
                            console.log('   3. Get Page Access Token from your Facebook page');
                            console.log('   4. Set FACEBOOK_PAGE_ACCESS_TOKEN in your .env file');
                            console.log('   5. Configure webhook URL for message receiving');
                            console.log('');
                        } else if (err.error && (err.error.includes('404') || err.error.includes('parseAndCheckLogin') || err.toString().includes('404'))) {
                            console.log('');
                            console.log('🚨 FACEBOOK API ENDPOINT ERROR (404):');
                            console.log('   • Facebook has changed or blocked the unofficial API endpoints');
                            console.log('   • This is a common issue with the unofficial facebook-chat-api');
                            console.log('');
                            
                            // Retry with different options if we have retries left
                            if (retryCount < maxRetries - 1) {
                                retryCount++;
                                console.log(`🔄 Retrying with different configuration (${retryCount}/${maxRetries - 1})...`);
                                
                                // Modify login options for retry
                                loginOptions.userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
                                loginOptions.forceLogin = !loginOptions.forceLogin; // Toggle forceLogin
                                loginOptions.online = retryCount % 2 === 0; // Alternate online status
                                
                                setTimeout(attemptLogin, 3000 * retryCount); // Exponential backoff
                                return;
                            } else {
                                console.log('🔧 ALL RETRY ATTEMPTS FAILED - SOLUTIONS:');
                                console.log('   1. 🌟 Switch to Facebook Messenger Official API (highly recommended)');
                                console.log('   2. 🔄 Try updating facebook-chat-api: npm install fca-unofficial');
                                console.log('   3. 🌐 Use a VPN or different IP address');
                                console.log('   4. 🔄 Re-extract fresh app state cookies from browser');
                                console.log('   5. ⏰ Wait several hours and try again');
                                console.log('');
                            }
                        }
                        
                        this.isLoggedIn = false;
                        resolve(false);
                        return;
                    }

                    console.log('✅ Facebook login successful!');
                    this.api = api;
                    this.isLoggedIn = true;

                    // Save app state for future logins
                    try {
                        const appState = api.getAppState();
                        this.saveAppState(appState);
                    } catch (stateError) {
                        console.log('⚠️ Could not save app state:', stateError.message);
                    }

                    // Set minimal options to reduce detection
                    api.setOptions({
                        listenEvents: true,
                        logLevel: 'silent',
                        updatePresence: false,
                        selfListen: false,
                        autoMarkDelivery: false,
                        autoMarkRead: false,
                        online: false
                    });

                    // Test API connection before starting listener
                    console.log('🔍 Testing Facebook session validity...');
                    api.getCurrentUserID((err, userID) => {
                        if (err) {
                            console.log('⚠️ Session validation failed:', err);
                            console.log('❌ Facebook has blocked the session immediately after login');
                            console.log('📤 This confirms Facebook is actively blocking unofficial API access');
                            console.log('');
                            console.log('🎆 SOLUTION: Use Facebook Messenger Official API instead');
                            console.log('   • Go to Platforms tab in WA-BOT GUI');
                            console.log('   • Select "Official API (Recommended)"');
                            console.log('   • Follow the step-by-step setup guide');
                            console.log('');
                            // Don't start listener if session is invalid
                        } else {
                            console.log('✅ Session validated successfully! User ID:', userID);
                            console.log('🚀 Starting message listener in 5 seconds...');
                            
                            // Add longer delay before starting listener
                            setTimeout(() => {
                                this.startMessageListener();
                            }, 5000); // 5 second delay
                        }
                    });
                    
                    resolve(true);
                    });
                };
                
                // Start the first login attempt
                attemptLogin();
                
            } catch (error) {
                console.error('Facebook initialization error:', error);
                this.isLoggedIn = false;
                resolve(false);
            }
        });
    }

    /**
     * Start listening for messages
     */
    startMessageListener() {
        if (!this.api) {
            console.error('Facebook API not initialized');
            return;
        }

        console.log('Facebook message listener started');

        this.api.listen((err, message) => {
            if (err) {
                console.error('Facebook listen error:', err);
                
                // Handle session invalidation
                if (err.error === 'Not logged in' || (err.res && err.res.error === 1357004)) {
                    console.log('');
                    console.log('🔐 FACEBOOK SESSION INVALIDATED:');
                    console.log('   • Facebook has invalidated the current session');
                    console.log('   • This is common with unofficial API usage');
                    console.log('');
                    console.log('🔧 RECOMMENDED SOLUTION:');
                    console.log('   🌟 Switch to Facebook Messenger Official API');
                    console.log('   • Go to Platforms tab in WA-BOT GUI');
                    console.log('   • Select "Official API (Recommended)"');
                    console.log('   • Click "Need help setting up?" for step-by-step guide');
                    console.log('');
                    console.log('🔄 ALTERNATIVE: Re-extract app state');
                    console.log('   • Use utils/extract-facebook-cookies.ps1');
                    console.log('   • Update FACEBOOK_APP_STATE in .env');
                    console.log('');
                    
                    // Mark as disconnected and stop trying
                    this.api = null;
                    console.log('⚠️ Facebook listener stopped due to session invalidation');
                    console.log('📤 Manual intervention required - please use Official API');
                    
                    return;
                }
                
                // Handle specific error types
                if (err.message && err.message.includes('404')) {
                    console.log('');
                    console.log('🚨 FACEBOOK API ENDPOINT NOT FOUND (404):');
                    console.log('   • The Facebook unofficial API endpoint is currently unavailable');
                    console.log('   • This is likely due to Facebook blocking the unofficial API');
                    console.log('');
                    console.log('🔧 IMMEDIATE SOLUTIONS:');
                    console.log('   1. 🌟 Switch to Facebook Messenger Official API (recommended)');
                    console.log('      - Set FACEBOOK_PAGE_ACCESS_TOKEN in .env');
                    console.log('      - Configure webhook URL in Facebook Developer Portal');
                    console.log('');
                    console.log('   2. 🔄 Refresh your Facebook app state:');
                    console.log('      - Re-extract app state using facebook-session-extractor.html');
                    console.log('      - Update FACEBOOK_APP_STATE in .env with new values');
                    console.log('');
                    console.log('   3. 🌐 Try a different network/connection:');
                    console.log('      - Use a VPN or different IP address');
                    console.log('      - Restart your router/modem');
                    console.log('');
                } else if (err.message && err.message.includes('ECONN')) {
                    console.log('');
                    console.log('🌐 FACEBOOK CONNECTION ERROR:');
                    console.log('   • Cannot connect to Facebook servers');
                    console.log('   • Check your internet connection');
                    console.log('');
                }
                
                // Try to reinitialize connection after a delay
                setTimeout(() => {
                    console.log('🔄 Attempting to reinitialize Facebook connection...');
                    this.initialize();
                }, 30000); // 30 second delay
                
                return;
            }

            this.handleMessage(message);
        });
    }

    /**
     * Handle incoming messages
     */
    async handleMessage(message) {
        try {
            // Only handle message events
            if (message.type !== 'message') {
                return;
            }

            // Skip messages from self
            if (message.senderID === this.api.getCurrentUserID()) {
                return;
            }

            // Skip if already processed
            if (this.processedMessages.has(message.messageID)) {
                return;
            }
            this.processedMessages.add(message.messageID);

            const senderId = message.senderID;
            const threadId = message.threadID;
            const chatId = `facebook:${senderId}`;
            let messageText = message.body || '';

            // Handle attachments
            if (message.attachments && message.attachments.length > 0) {
                const attachment = message.attachments[0];
                if (attachment.type === 'photo') {
                    messageText = messageText || '[PHOTO]';
                } else if (attachment.type === 'video') {
                    messageText = messageText || '[VIDEO]';
                } else if (attachment.type === 'audio') {
                    messageText = messageText || '[AUDIO]';
                } else if (attachment.type === 'file') {
                    messageText = messageText || '[FILE]';
                } else {
                    messageText = messageText || `[${attachment.type.toUpperCase()}]`;
                }
            }

            if (!messageText.trim()) {
                return; // Skip empty messages
            }

            console.log(`Facebook message from ${senderId}: ${messageText}`);

            // Check if chat is blocked (AI disabled)
            const isBlocked = global.chatHandler?.isAIBlocked?.(senderId, 'facebook');
            
            // Always save user message to chat history
            if (global.chatHandler) {
                global.chatHandler.addMessage(senderId, 'user', messageText, 'facebook');
            }

            // Skip AI processing if blocked
            if (isBlocked) {
                console.log(`AI is disabled for Facebook chat ${chatId}, skipping response`);
                return;
            }

            // Get conversation history
            const conversation = global.chatHandler?.getConversation?.(senderId, 'facebook') || [];

            // Process with workflow manager
            if (global.workflowManager) {
                const response = await global.workflowManager.processMessage(
                    messageText,
                    chatId,
                    conversation,
                    'facebook'
                );

                if (response && response.trim()) {
                    await this.sendMessage(threadId, response);
                    
                    // Save assistant response
                    if (global.chatHandler) {
                        global.chatHandler.addMessage(senderId, 'assistant', response, 'facebook');
                    }
                }
            }
        } catch (error) {
            console.error('Error handling Facebook message:', error);
        }
    }

    /**
     * Send message to Facebook user/thread
     */
    async sendMessage(threadId, messageText) {
        return new Promise((resolve, reject) => {
            if (!this.api || !this.isLoggedIn) {
                reject(new Error('Facebook not logged in'));
                return;
            }

            this.api.sendMessage(messageText, threadId, (err, messageInfo) => {
                if (err) {
                    console.error('Error sending Facebook message:', err);
                    reject(err);
                } else {
                    console.log('Facebook message sent successfully');
                    resolve(messageInfo);
                }
            });
        });
    }

    /**
     * Get user information
     */
    async getUserInfo(userId) {
        return new Promise((resolve, reject) => {
            if (!this.api || !this.isLoggedIn) {
                reject(new Error('Facebook not logged in'));
                return;
            }

            this.api.getUserInfo(userId, (err, userInfo) => {
                if (err) {
                    console.error('Error getting Facebook user info:', err);
                    resolve(null);
                } else {
                    resolve(userInfo[userId]);
                }
            });
        });
    }

    /**
     * Get thread information
     */
    async getThreadInfo(threadId) {
        return new Promise((resolve, reject) => {
            if (!this.api || !this.isLoggedIn) {
                reject(new Error('Facebook not logged in'));
                return;
            }

            this.api.getThreadInfo(threadId, (err, threadInfo) => {
                if (err) {
                    console.error('Error getting Facebook thread info:', err);
                    resolve(null);
                } else {
                    resolve(threadInfo);
                }
            });
        });
    }

    /**
     * Send message by user ID (creates new thread if needed)
     */
    async sendMessageToUser(userId, messageText) {
        return this.sendMessage(userId, messageText);
    }

    /**
     * Stop the service and cleanup
     */
    async stop() {
        try {
            if (this.api && typeof this.api.logout === 'function') {
                this.api.logout();
            }
            
            this.isLoggedIn = false;
            this.api = null;
            console.log('Facebook Chat service stopped');
        } catch (error) {
            console.error('Error stopping Facebook service:', error);
        }
    }

    /**
     * Check if service is ready
     */
    isReady() {
        return this.isLoggedIn && this.api !== null;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isLoggedIn: this.isLoggedIn,
            email: this.email,
            hasApi: this.api !== null
        };
    }
}

module.exports = FacebookChatService;
