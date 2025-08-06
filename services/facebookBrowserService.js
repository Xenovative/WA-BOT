const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const VPSDetection = require('../utils/vpsDetection');

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
            // Try loading from app state first
            if (this.appState) {
                console.log('🔑 Loading Facebook session from app state...');
                const cookies = JSON.parse(this.appState);
                
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
     * Start monitoring for new messages
     */
    async startMessageMonitoring() {
        console.log('👂 Starting Facebook message monitoring...');
        
        // Start polling for new messages every 5 seconds
        this.pollingInterval = setInterval(async () => {
            try {
                await this.checkForNewMessages();
            } catch (error) {
                console.log('⚠️ Error checking for messages:', error.message);
            }
        }, 5000);
        
        console.log('✅ Facebook message monitoring started');
    }

    /**
     * Check for new messages
     */
    async checkForNewMessages() {
        try {
            // Get all message elements
            const messages = await this.page.evaluate(() => {
                const messageElements = document.querySelectorAll('[data-testid="message-container"]');
                const messages = [];
                
                messageElements.forEach((element, index) => {
                    const textElement = element.querySelector('[dir="auto"]');
                    const text = textElement ? textElement.textContent.trim() : '';
                    
                    if (text) {
                        messages.push({
                            id: `msg_${Date.now()}_${index}`,
                            text: text,
                            timestamp: Date.now(),
                            element: element.outerHTML.substring(0, 200) // For debugging
                        });
                    }
                });
                
                return messages;
            });
            
            // Process new messages
            for (const message of messages) {
                if (!this.lastMessageIds.has(message.id)) {
                    this.lastMessageIds.add(message.id);
                    
                    // Only process recent messages (last 30 seconds)
                    if (Date.now() - message.timestamp < 30000) {
                        console.log('📨 New Facebook message:', message.text);
                        
                        // Trigger message handlers
                        for (const handler of this.messageHandlers) {
                            try {
                                await handler({
                                    body: message.text,
                                    senderID: 'unknown', // Will need to extract from DOM
                                    threadID: 'unknown', // Will need to extract from DOM
                                    messageID: message.id,
                                    timestamp: message.timestamp
                                });
                            } catch (error) {
                                console.log('⚠️ Message handler error:', error.message);
                            }
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
