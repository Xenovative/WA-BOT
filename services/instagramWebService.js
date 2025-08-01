const puppeteer = require('puppeteer');

class InstagramWebService {
    constructor(username, password) {
        this.username = username;
        this.password = password;
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.processedMessages = new Set();
        this.messageCheckInterval = null;
        
        console.log('Instagram Web service initialized (browser automation)');
    }

    /**
     * Initialize and login to Instagram
     */
    async initialize() {
        try {
            console.log('Starting Instagram browser automation...');
            
            // Launch browser
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });

            this.page = await this.browser.newPage();
            
            // Set user agent
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Navigate to Instagram
            console.log('Navigating to Instagram...');
            await this.page.goto('https://www.instagram.com/accounts/login/', {
                waitUntil: 'networkidle2'
            });

            // Wait for login form
            await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });
            
            // Fill login form
            console.log('Filling login form...');
            await this.page.type('input[name="username"]', this.username);
            await this.page.type('input[name="password"]', this.password);
            
            // Click login button
            await this.page.click('button[type="submit"]');
            
            // Wait for navigation
            await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
            
            // Check if login was successful
            const currentUrl = this.page.url();
            if (currentUrl.includes('/accounts/login/') || currentUrl.includes('/challenge/')) {
                throw new Error('Login failed - check credentials or account restrictions');
            }

            console.log('Instagram login successful!');
            this.isLoggedIn = true;

            // Handle "Save Login Info" popup if it appears
            try {
                await this.page.waitForSelector('button:contains("Not Now")', { timeout: 3000 });
                await this.page.click('button:contains("Not Now")');
            } catch (e) {
                // Popup didn't appear, continue
            }

            // Handle "Turn on Notifications" popup if it appears
            try {
                await this.page.waitForSelector('button:contains("Not Now")', { timeout: 3000 });
                await this.page.click('button:contains("Not Now")');
            } catch (e) {
                // Popup didn't appear, continue
            }

            // Start message checking
            this.startMessageChecker();
            
            return true;
        } catch (error) {
            console.error('Instagram initialization failed:', error);
            this.isLoggedIn = false;
            
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
            }
            
            return false;
        }
    }

    /**
     * Start checking for new messages
     */
    startMessageChecker() {
        console.log('Starting Instagram message checker...');
        
        // Check for messages every 30 seconds
        this.messageCheckInterval = setInterval(async () => {
            if (this.isLoggedIn && this.page) {
                await this.checkForNewMessages();
            }
        }, 30000);
    }

    /**
     * Check for new direct messages
     */
    async checkForNewMessages() {
        try {
            // Navigate to direct messages
            await this.page.goto('https://www.instagram.com/direct/inbox/', {
                waitUntil: 'networkidle2'
            });

            // Wait for messages to load
            await this.page.waitForSelector('[role="main"]', { timeout: 10000 });

            // Get conversation list
            const conversations = await this.page.$$('[role="listitem"]');
            
            for (const conversation of conversations.slice(0, 5)) { // Check first 5 conversations
                try {
                    // Click on conversation
                    await conversation.click();
                    await this.page.waitForTimeout(2000);

                    // Get messages in this conversation
                    await this.processConversationMessages();
                    
                } catch (error) {
                    console.error('Error processing conversation:', error);
                }
            }
        } catch (error) {
            console.error('Error checking Instagram messages:', error);
        }
    }

    /**
     * Process messages in current conversation
     */
    async processConversationMessages() {
        try {
            // Get all message elements
            const messages = await this.page.$$('[data-testid="message"]');
            
            // Process last few messages
            for (const message of messages.slice(-3)) {
                try {
                    const messageText = await message.$eval('div', el => el.textContent?.trim() || '');
                    const isFromUser = await message.$eval('[data-testid="message"]', el => 
                        !el.closest('[data-testid="message-container"]')?.querySelector('[data-testid="message-from-you"]')
                    );

                    if (messageText && isFromUser && !this.processedMessages.has(messageText)) {
                        this.processedMessages.add(messageText);
                        
                        // Get sender info (simplified)
                        const senderId = `user_${Date.now()}`;
                        await this.handleMessage(senderId, messageText);
                    }
                } catch (error) {
                    console.error('Error processing individual message:', error);
                }
            }
        } catch (error) {
            console.error('Error processing conversation messages:', error);
        }
    }

    /**
     * Handle incoming message
     */
    async handleMessage(senderId, messageText) {
        try {
            const chatId = `instagram:${senderId}`;
            
            console.log(`Instagram DM from ${senderId}: ${messageText}`);

            // Check if chat is blocked (AI disabled)
            const isBlocked = global.chatHandler?.isAIBlocked?.(senderId, 'instagram');
            
            // Always save user message to chat history
            if (global.chatHandler) {
                global.chatHandler.addMessage(senderId, 'user', messageText, 'instagram');
            }

            // Skip AI processing if blocked
            if (isBlocked) {
                console.log(`AI is disabled for Instagram chat ${chatId}, skipping response`);
                return;
            }

            // Get conversation history
            const conversation = global.chatHandler?.getConversation?.(senderId, 'instagram') || [];

            // Process with workflow manager
            if (global.workflowManager) {
                const response = await global.workflowManager.processMessage(
                    messageText,
                    chatId,
                    conversation,
                    'instagram'
                );

                if (response && response.trim()) {
                    await this.sendMessage(response);
                    
                    // Save assistant response
                    if (global.chatHandler) {
                        global.chatHandler.addMessage(senderId, 'assistant', response, 'instagram');
                    }
                }
            }
        } catch (error) {
            console.error('Error handling Instagram message:', error);
        }
    }

    /**
     * Send message in current conversation
     */
    async sendMessage(messageText) {
        try {
            if (!this.isLoggedIn || !this.page) {
                throw new Error('Instagram not logged in');
            }

            // Find message input
            const messageInput = await this.page.$('textarea[placeholder*="Message"]');
            if (!messageInput) {
                throw new Error('Message input not found');
            }

            // Type message
            await messageInput.click();
            await messageInput.type(messageText);
            
            // Send message
            await this.page.keyboard.press('Enter');
            
            console.log('Instagram message sent successfully');
            return true;
        } catch (error) {
            console.error('Error sending Instagram message:', error);
            throw error;
        }
    }

    /**
     * Send message to specific user (simplified)
     */
    async sendMessageToUser(username, messageText) {
        try {
            // Navigate to user's profile
            await this.page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: 'networkidle2'
            });

            // Click message button
            const messageButton = await this.page.$('button:contains("Message")');
            if (messageButton) {
                await messageButton.click();
                await this.page.waitForTimeout(2000);
                
                return await this.sendMessage(messageText);
            } else {
                throw new Error('Message button not found');
            }
        } catch (error) {
            console.error('Error sending message to user:', error);
            throw error;
        }
    }

    /**
     * Stop the service and cleanup
     */
    async stop() {
        try {
            if (this.messageCheckInterval) {
                clearInterval(this.messageCheckInterval);
                this.messageCheckInterval = null;
            }

            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
            }
            
            this.isLoggedIn = false;
            console.log('Instagram Web service stopped');
        } catch (error) {
            console.error('Error stopping Instagram service:', error);
        }
    }

    /**
     * Check if service is ready
     */
    isReady() {
        return this.isLoggedIn && this.browser !== null && this.page !== null;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isLoggedIn: this.isLoggedIn,
            username: this.username,
            hasBrowser: this.browser !== null,
            hasPage: this.page !== null
        };
    }
}

module.exports = InstagramWebService;
