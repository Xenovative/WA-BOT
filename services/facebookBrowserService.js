const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const VPSDetection = require('../utils/vpsDetection');
const AppStateBrowserOptimizer = require('../utils/appStateBrowserOptimizer');

class FacebookBrowserService {
    constructor(email, password, appState) {
        this.email = email;
        this.password = password;
        this.appState = appState;
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
        this.messageHandlers = [];
        this.pollingInterval = null;
        this.lastMessageIds = new Set();
        
        // Browser configuration
        this.userDataDir = path.join(__dirname, '..', 'browser_data', 'facebook');
        this.sessionFile = path.join(this.userDataDir, 'session.json');
    }

    /**
     * Initialize browser and login to Facebook
     */
    async initialize() {
        try {
            console.log('🌐 Starting Facebook Browser Service...');
            
            // Ensure user data directory exists
            await fs.mkdir(this.userDataDir, { recursive: true });
            
            // Detect environment and get optimized browser config
            const detection = VPSDetection.printDetectionResults();
            const { isVPS, browserConfig } = detection;
            
            // Check browser availability
            const browserAvailable = await VPSDetection.checkBrowserAvailability();
            if (!browserAvailable) {
                throw new Error('Chrome/Chromium not found. Run setup-vps-browser.sh to install dependencies.');
            }
            
            console.log('🚀 Launching browser with optimized settings...');
            
            // Launch browser with VPS-optimized settings
            this.browser = await puppeteer.launch({
                ...browserConfig.config,
                userDataDir: this.userDataDir
            });

            this.page = await this.browser.newPage();
            
            // Set realistic viewport and user agent
            await this.page.setViewport({ width: 1366, height: 768 });
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Set longer timeouts for VPS environments
            this.page.setDefaultTimeout(60000); // 60 seconds
            this.page.setDefaultNavigationTimeout(60000); // 60 seconds
            
            // Load existing session if available
            const loggedIn = await this.loadSession();
            
            if (!loggedIn) {
                await this.login();
            }
            
            // Navigate to Messenger (with fallback)
            try {
                await this.navigateToMessenger();
            } catch (messengerError) {
                console.log('⚠️ Messenger navigation failed, trying Facebook main site...');
                await this.navigateWithRetry('https://facebook.com/messages');
            }
            
            // Start message monitoring
            await this.startMessageMonitoring();
            
            this.isInitialized = true;
            console.log('✅ Facebook Browser Service initialized successfully');
            
        } catch (error) {
            console.error('❌ Facebook Browser Service initialization failed:', error.message);
            await this.cleanup();
            throw error;
        }
    }

    /**
     * Navigate with retry logic for VPS environments
     */
    async navigateWithRetry(url, options = {}, maxRetries = 3) {
        const defaultOptions = { 
            waitUntil: 'domcontentloaded', // Less strict than networkidle0
            timeout: 60000 
        };
        const finalOptions = { ...defaultOptions, ...options };
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🌍 Navigating to ${url} (attempt ${attempt}/${maxRetries})...`);
                await this.page.goto(url, finalOptions);
                console.log('✅ Navigation successful');
                return true;
            } catch (error) {
                console.log(`⚠️ Navigation attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    console.log('❌ All navigation attempts failed');
                    throw error;
                }
                
                // Wait before retry (exponential backoff)
                const waitTime = attempt * 2000;
                console.log(`🔄 Retrying in ${waitTime/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    /**
     * Load existing session from cookies
     */
    async loadSession() {
        try {
            // Try loading from app state first (optimized)
            if (this.appState) {
                console.log('🔑 Loading Facebook session from app state...');
                
                // Validate and optimize app state
                const validation = AppStateBrowserOptimizer.validateAppStateForBrowser(this.appState);
                if (!validation.valid) {
                    console.log('❌ App state validation failed:', validation.error);
                    throw new Error(`Invalid app state: ${validation.error}`);
                }
                
                console.log('✅ App state validation passed:');
                console.log('   • Cookies found:', validation.cookieCount);
                console.log('   • Essential cookies:', validation.essentialCookies.join(', '));
                
                if (validation.recommendations.length > 0) {
                    console.log('💡 Recommendations:');
                    validation.recommendations.forEach(rec => console.log('   •', rec));
                }
                
                // Optimize app state for browser emulation
                const optimizedAppState = AppStateBrowserOptimizer.optimizeAppStateForBrowser(this.appState);
                const cookies = JSON.parse(optimizedAppState);
                
                await this.navigateWithRetry('https://facebook.com');
                
                for (const cookie of cookies) {
                    await this.page.setCookie({
                        name: cookie.key,
                        value: cookie.value,
                        domain: cookie.domain || '.facebook.com',
                        path: cookie.path || '/',
                        httpOnly: cookie.httpOnly || false,
                        secure: cookie.secure || false
                    });
                }
                
                // Test if session is valid
                await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
                
                const isLoggedIn = await this.page.evaluate(() => {
                    return !document.querySelector('input[name="email"]') && 
                           !document.querySelector('input[name="pass"]');
                });
                
                if (isLoggedIn) {
                    console.log('✅ Facebook session loaded successfully from app state');
                    return true;
                }
            }
            
            // Try loading saved session file
            if (await fs.access(this.sessionFile).then(() => true).catch(() => false)) {
                console.log('🔑 Loading Facebook session from file...');
                const sessionData = JSON.parse(await fs.readFile(this.sessionFile, 'utf8'));
                
                await this.navigateWithRetry('https://facebook.com');
                await this.page.setCookie(...sessionData.cookies);
                await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
                
                const isLoggedIn = await this.page.evaluate(() => {
                    return !document.querySelector('input[name="email"]') && 
                           !document.querySelector('input[name="pass"]');
                });
                
                if (isLoggedIn) {
                    console.log('✅ Facebook session loaded successfully from file');
                    return true;
                }
            }
            
            console.log('⚠️ No valid Facebook session found, will need to login');
            return false;
            
        } catch (error) {
            console.log('⚠️ Failed to load Facebook session:', error.message);
            return false;
        }
    }

    /**
     * Login to Facebook using email/password
     */
    async login() {
        if (!this.email || !this.password) {
            throw new Error('Email and password required for Facebook login');
        }
        
        console.log('🔐 Logging into Facebook...');
        
        await this.navigateWithRetry('https://facebook.com');
        
        // Wait for login form
        await this.page.waitForSelector('input[name="email"]', { timeout: 10000 });
        
        // Fill login form
        await this.page.type('input[name="email"]', this.email, { delay: 100 });
        await this.page.type('input[name="pass"]', this.password, { delay: 100 });
        
        // Submit login
        await Promise.all([
            this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
            this.page.click('button[name="login"]')
        ]);
        
        // Check for 2FA or other challenges
        await this.page.waitForTimeout(3000);
        
        const currentUrl = this.page.url();
        if (currentUrl.includes('checkpoint') || currentUrl.includes('two_factor')) {
            throw new Error('Facebook login requires 2FA or security checkpoint. Please use app state authentication instead.');
        }
        
        // Check if login was successful
        const isLoggedIn = await this.page.evaluate(() => {
            return !document.querySelector('input[name="email"]') && 
                   !document.querySelector('input[name="pass"]');
        });
        
        if (!isLoggedIn) {
            throw new Error('Facebook login failed. Please check credentials or use app state authentication.');
        }
        
        // Save session
        await this.saveSession();
        
        console.log('✅ Facebook login successful');
    }

    /**
     * Save current session cookies
     */
    async saveSession() {
        try {
            const cookies = await this.page.cookies();
            const sessionData = {
                cookies: cookies,
                timestamp: Date.now()
            };
            
            await fs.writeFile(this.sessionFile, JSON.stringify(sessionData, null, 2));
            console.log('💾 Facebook session saved');
            
        } catch (error) {
            console.log('⚠️ Failed to save Facebook session:', error.message);
        }
    }

    /**
     * Navigate to Facebook Messenger
     */
    async navigateToMessenger() {
        console.log('📱 Navigating to Facebook Messenger...');
        
        await this.navigateWithRetry('https://www.messenger.com');
        
        // Wait for messenger to load
        await this.page.waitForTimeout(5000);
        
        // Check if we're on messenger
        const isOnMessenger = await this.page.evaluate(() => {
            return window.location.hostname.includes('messenger.com');
        });
        
        if (!isOnMessenger) {
            throw new Error('Failed to navigate to Facebook Messenger');
        }
        
        console.log('✅ Successfully navigated to Facebook Messenger');
    }

    /**
     * Navigate to first available conversation
     */
    async navigateToFirstConversation() {
        console.log('🎯 Navigating to first available conversation...');
        
        try {
            const currentUrl = await this.page.url();
            
            // If we're already in a conversation, stay there
            if (currentUrl.includes('/t/')) {
                console.log('✅ Already in a conversation');
                return true;
            }
            
            // Look for conversation threads
            const conversationFound = await this.page.evaluate(() => {
                const selectors = [
                    '[role="gridcell"] [role="link"]',
                    'a[href*="/t/"]',
                    '[data-testid="conversation-list"] [role="link"]'
                ];
                
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        console.log(`Found ${elements.length} conversations with: ${selector}`);
                        // Click the first conversation
                        elements[0].click();
                        return true;
                    }
                }
                return false;
            });
            
            if (conversationFound) {
                // Wait for navigation
                await this.page.waitForTimeout(3000);
                const newUrl = await this.page.url();
                console.log('✅ Navigated to conversation:', newUrl);
                return true;
            } else {
                console.log('⚠️ No conversations found to navigate to');
                return false;
            }
            
        } catch (error) {
            console.log('❌ Failed to navigate to conversation:', error.message);
            return false;
        }
    }

    /**
     * Start monitoring for new messages across all conversations
     */
    async startMessageMonitoring() {
        console.log('👂 Starting Facebook multi-conversation monitoring...');
        
        // Navigate back to conversation list for multi-conversation monitoring
        await this.navigateToConversationList();
        
        // Start polling for new messages every 5 seconds
        this.pollingInterval = setInterval(async () => {
            try {
                await this.checkAllConversationsForNewMessages();
            } catch (error) {
                console.log('⚠️ Error checking for messages:', error.message);
            }
        }, 5000);
        
        console.log('✅ Facebook multi-conversation monitoring started');
    }

    /**
     * Navigate to conversation list
     */
    async navigateToConversationList() {
        console.log('📋 Navigating to conversation list...');
        
        try {
            const currentUrl = await this.page.url();
            
            // If already on conversation list, stay there
            if (currentUrl.includes('/messages') && !currentUrl.includes('/t/')) {
                console.log('✅ Already on conversation list');
                return true;
            }
            
            // Navigate to messages list
            const navigationUrls = [
                'https://www.messenger.com',
                'https://facebook.com/messages'
            ];
            
            for (const url of navigationUrls) {
                try {
                    await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
                    await this.page.waitForTimeout(2000);
                    
                    const finalUrl = await this.page.url();
                    if (finalUrl.includes('/messages') || finalUrl.includes('messenger.com')) {
                        console.log('✅ Successfully navigated to conversation list');
                        return true;
                    }
                } catch (navError) {
                    console.log(`⚠️ Failed to navigate to ${url}:`, navError.message);
                }
            }
            
            return false;
            
        } catch (error) {
            console.log('❌ Failed to navigate to conversation list:', error.message);
            return false;
        }
    }

    /**
     * Check all conversations for new messages
     */
    async checkAllConversationsForNewMessages() {
        try {
            console.log('🔍 Scanning all conversations for new messages...');
            
            // Get conversation threads with unread indicators
            const conversationsWithNewMessages = await this.page.evaluate(() => {
                const conversations = [];
                
                // Try different selectors for conversation threads
                const selectors = [
                    '[role="gridcell"]', // Main conversation cells
                    '[data-testid="conversation-list-item"]',
                    '.conversation-list-item'
                ];
                
                let foundThreads = [];
                
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        foundThreads = Array.from(elements);
                        console.log(`Found ${elements.length} conversation threads with: ${selector}`);
                        break;
                    }
                }
                
                foundThreads.forEach((thread, index) => {
                    try {
                        // Look for unread indicators
                        const hasUnreadBadge = thread.querySelector('[data-testid="unread-count"]') || 
                                              thread.querySelector('.unread-count') ||
                                              thread.querySelector('[aria-label*="unread"]') ||
                                              thread.querySelector('.badge');
                        
                        // Look for bold text (indicates unread)
                        const hasBoldText = thread.querySelector('[style*="font-weight: bold"]') ||
                                          thread.querySelector('.font-weight-bold');
                        
                        // Get conversation name/preview
                        const nameElement = thread.querySelector('[dir="auto"]');
                        const name = nameElement ? nameElement.textContent.trim() : `Conversation ${index + 1}`;
                        
                        // Get message preview
                        const previewElements = thread.querySelectorAll('[dir="auto"]');
                        let messagePreview = '';
                        if (previewElements.length > 1) {
                            messagePreview = previewElements[1].textContent.trim();
                        }
                        
                        // Get conversation link
                        const linkElement = thread.querySelector('a[href*="/t/"]');
                        const href = linkElement ? linkElement.href : null;
                        
                        if (hasUnreadBadge || hasBoldText || messagePreview) {
                            conversations.push({
                                name: name.substring(0, 50),
                                preview: messagePreview.substring(0, 100),
                                href: href,
                                hasUnread: !!(hasUnreadBadge || hasBoldText),
                                threadId: href ? href.split('/t/')[1] : `thread_${index}`
                            });
                        }
                    } catch (error) {
                        console.log('Error processing thread:', error.message);
                    }
                });
                
                return conversations;
            });
            
            console.log(`💬 Found ${conversationsWithNewMessages.length} conversations with potential new messages`);
            
            // Process each conversation with new messages
            for (const conversation of conversationsWithNewMessages) {
                if (conversation.hasUnread && conversation.preview) {
                    // Create unique message ID
                    const messageId = `msg_${conversation.threadId}_${conversation.preview.substring(0, 20).replace(/\s+/g, '_')}_${conversation.preview.length}`;
                    
                    if (!this.lastMessageIds.has(messageId)) {
                        this.lastMessageIds.add(messageId);
                        
                        console.log('🆕 NEW message from conversation:', conversation.name);
                        console.log('💬 Message preview:', conversation.preview);
                        
                        // Trigger message handlers
                        for (const handler of this.messageHandlers) {
                            try {
                                await handler({
                                    body: conversation.preview,
                                    senderID: conversation.name,
                                    threadID: conversation.threadId,
                                    messageID: messageId,
                                    timestamp: Date.now(),
                                    conversationName: conversation.name,
                                    isFromConversationList: true
                                });
                            } catch (error) {
                                console.log('⚠️ Message handler error:', error.message);
                            }
                        }
                    }
                }
            }
            
            // Clean up old message IDs (keep last 200 for multi-conversation)
            if (this.lastMessageIds.size > 200) {
                const idsArray = Array.from(this.lastMessageIds);
                this.lastMessageIds = new Set(idsArray.slice(-200));
            }
            
        } catch (error) {
            console.log('⚠️ Error in checkAllConversationsForNewMessages:', error.message);
        }
    }

    /**
     * Check for new messages (legacy single conversation method)
     */
    async checkForNewMessages() {
        try {
            // Get all message elements using multiple selectors
            const messages = await this.page.evaluate(() => {
                // Try multiple selectors for Facebook messages
                const selectors = [
                    '[data-testid="message-container"]',
                    '[role="gridcell"] [dir="auto"]',
                    '.x1n2onr6 [dir="auto"]',
                    '[data-scope="messages_table"] [dir="auto"]',
                    '.conversation-message [dir="auto"]',
                    '[aria-label*="message"] [dir="auto"]'
                ];
                
                const messages = [];
                let foundElements = [];
                
                // Try each selector
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        foundElements = Array.from(elements);
                        console.log(`Found ${elements.length} elements with selector: ${selector}`);
                        break;
                    }
                }
                
                // If no specific selectors work, try generic text content
                if (foundElements.length === 0) {
                    foundElements = Array.from(document.querySelectorAll('[dir="auto"]'))
                        .filter(el => el.textContent && el.textContent.trim().length > 0);
                    console.log(`Fallback: Found ${foundElements.length} elements with dir="auto"`);
                }
                
                foundElements.forEach((element, index) => {
                    const text = element.textContent ? element.textContent.trim() : '';
                    
                    if (text && text.length > 0 && text.length < 1000) { // Reasonable message length
                        // Filter out Facebook UI elements and timestamps
                        const isTimestamp = /^\d+\s*(分鐘|小時|天|秒|minute|hour|day|second|min|hr|sec|ago|剛才|now)$/i.test(text);
                        const isUIElement = /^(已讀|seen|delivered|sent|typing|online|active|離線|在線上)$/i.test(text);
                        const isReaction = /^[👍👎❤️😂😮😢😡🔥💯]$/.test(text);
                        const isShortText = text.length < 3; // Very short text likely UI
                        const isNumber = /^\d+$/.test(text); // Pure numbers
                        
                        if (isTimestamp || isUIElement || isReaction || isShortText || isNumber) {
                            console.log(`⏭️ Skipping UI element: "${text}"`);
                            return; // Skip this element
                        }
                        
                        // Try to determine if this is a received message (not sent by us)
                        const isReceived = !element.closest('[data-testid="outgoing_message"]') && 
                                         !element.closest('.x1rg5ohu') && // Sent message class
                                         !element.closest('[aria-label*="You sent"]') &&
                                         !element.closest('[data-scope="message_sender"]');
                        
                        // Additional check: look for message bubble containers
                        const isInMessageBubble = element.closest('[data-testid="message_bubble"]') || 
                                                 element.closest('[role="gridcell"]') ||
                                                 element.closest('.message');
                        
                        if (isReceived && isInMessageBubble) {
                            messages.push({
                                id: `msg_${Date.now()}_${index}`,
                                text: text,
                                timestamp: Date.now(),
                                isReceived: true,
                                element: element.outerHTML.substring(0, 300) // For debugging
                            });
                        }
                    }
                });
                
                console.log(`Total messages found: ${messages.length}`);
                return messages;
            });
            
            // Debug: Log all found messages
            if (messages.length > 0) {
                console.log(`🔍 Found ${messages.length} messages in DOM`);
                messages.forEach((msg, i) => {
                    console.log(`   ${i + 1}. "${msg.text.substring(0, 50)}${msg.text.length > 50 ? '...' : ''}"`);
                });
            }
            
            // Process new messages
            for (const message of messages) {
                // Create a more unique ID based on text content
                const uniqueId = `msg_${message.text.substring(0, 20).replace(/\s+/g, '_')}_${message.text.length}`;
                
                if (!this.lastMessageIds.has(uniqueId)) {
                    this.lastMessageIds.add(uniqueId);
                    
                    console.log('🆕 NEW Facebook message detected:', message.text);
                    console.log('📊 Message details:', {
                        id: uniqueId,
                        length: message.text.length,
                        isReceived: message.isReceived
                    });
                    
                    // Trigger message handlers
                    for (const handler of this.messageHandlers) {
                        try {
                            await handler({
                                body: message.text,
                                senderID: 'facebook_user', // Generic sender ID
                                threadID: 'facebook_thread', // Generic thread ID
                                messageID: uniqueId,
                                timestamp: message.timestamp,
                                isReceived: message.isReceived
                            });
                        } catch (error) {
                            console.log('⚠️ Message handler error:', error.message);
                        }
                    }
                }
            }
            
            // Clean up old message IDs (keep last 100)
            if (this.lastMessageIds.size > 100) {
                const idsArray = Array.from(this.lastMessageIds);
                this.lastMessageIds = new Set(idsArray.slice(-100));
            }
            
        } catch (error) {
            console.log('⚠️ Error in checkForNewMessages:', error.message);
        }
    }

    /**
     * Send a message
     */
    async sendMessage(message, threadID = null) {
        try {
            console.log('📤 Sending Facebook message:', message);
            
            // Find the message input
            const messageInput = await this.page.waitForSelector('[contenteditable="true"][data-testid="message-input"]', { timeout: 5000 });
            
            if (!messageInput) {
                throw new Error('Could not find message input field');
            }
            
            // Clear and type message
            await messageInput.click();
            await this.page.keyboard.selectAll();
            await this.page.keyboard.press('Delete');
            await messageInput.type(message, { delay: 50 });
            
            // Send message
            await this.page.keyboard.press('Enter');
            
            console.log('✅ Facebook message sent successfully');
            return true;
            
        } catch (error) {
            console.log('❌ Failed to send Facebook message:', error.message);
            return false;
        }
    }

    /**
     * Add message handler
     */
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }

    /**
     * Stop the service
     */
    async stop() {
        console.log('🛑 Stopping Facebook Browser Service...');
        
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        await this.cleanup();
        
        console.log('✅ Facebook Browser Service stopped');
    }

    /**
     * Cleanup browser resources
     */
    async cleanup() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
        } catch (error) {
            console.log('⚠️ Error during cleanup:', error.message);
        }
    }
}

module.exports = FacebookBrowserService;
