const login = require('facebook-chat-api');

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
        if (this.appState) {
            console.log('📱 App State authentication available - will use instead of email/password');
        }
    }

    /**
     * Load saved app state for persistent login
     */
    loadAppState() {
        try {
            // First try to use app state from environment variable or constructor
            if (this.appState) {
                console.log('📱 Using Facebook app state from environment/constructor');
                if (typeof this.appState === 'string') {
                    return JSON.parse(this.appState);
                }
                return this.appState;
            }
            
            // Fallback to file-based app state
            const fs = require('fs');
            if (fs.existsSync(this.appStatePath)) {
                const appState = JSON.parse(fs.readFileSync(this.appStatePath, 'utf8'));
                console.log('📱 Loaded Facebook app state from file for persistent login');
                return appState;
            }
        } catch (error) {
            console.log('⚠️ Could not load Facebook app state:', error.message);
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
                const appState = this.loadAppState();
                
                if (appState) {
                    console.log('📱 Attempting Facebook login with App State (session-based)...');
                } else {
                    console.log('🔑 Attempting Facebook login with email/password...');
                }
                
                // Try multiple user agents to avoid detection
                const userAgents = [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
                ];
                
                const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
                
                const loginOptions = {
                    userAgent: randomUserAgent,
                    // Additional options to bypass Facebook restrictions
                    pauseLog: true,
                    logLevel: 'silent',
                    selfListen: false,
                    listenEvents: false,
                    updatePresence: false,
                    autoMarkDelivery: false,
                    autoMarkRead: false,
                    forceLogin: true  // Force login even with 2FA
                };
                
                // Use app state if available, otherwise use email/password
                if (appState) {
                    loginOptions.appState = appState;
                } else {
                    if (!this.email || !this.password) {
                        throw new Error('No app state provided and email/password missing');
                    }
                    loginOptions.email = this.email;
                    loginOptions.password = this.password;
                }

                console.log(`🔑 Attempting Facebook login with enhanced options (User-Agent: ${randomUserAgent.includes('Chrome') ? 'Chrome' : randomUserAgent.includes('Firefox') ? 'Firefox' : 'Safari'})...`);
                
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
                            console.log('🎆 FACEBOOK APP STATE EXTRACTION (Alternative):');
                            console.log('   1. Open utils/facebook-session-extractor.html in browser');
                            console.log('   2. Navigate to facebook.com and login');
                            console.log('   3. Extract your Facebook App State (cookies)');
                            console.log('   4. Set FACEBOOK_APP_STATE in your .env file');
                            console.log('   5. This bypasses email/password authentication');
                            console.log('');
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

                    // Set options
                    api.setOptions({
                        listenEvents: true,
                        logLevel: 'silent',
                        updatePresence: false,
                        selfListen: false
                    });

                    // Start listening for messages
                    this.startMessageListener();
                    resolve(true);
                });
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
