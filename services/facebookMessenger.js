const axios = require('axios');
const crypto = require('crypto');

class FacebookMessengerService {
    constructor(pageAccessToken, verifyToken, appSecret) {
        // Use provided parameters or fall back to environment variables
        this.pageAccessToken = pageAccessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
        this.verifyToken = verifyToken || process.env.FACEBOOK_VERIFY_TOKEN;
        this.appSecret = appSecret || process.env.FACEBOOK_APP_SECRET;
        this.apiUrl = 'https://graph.facebook.com/v18.0/me/messages';
        this.isInitialized = false;
        
        console.log('Facebook Messenger service initialized');
    }

    /**
     * Initialize the Facebook Messenger service
     */
    async initialize() {
        try {
            // Validate required credentials
            if (!this.pageAccessToken) {
                throw new Error('Facebook Page Access Token is required');
            }
            if (!this.verifyToken) {
                throw new Error('Facebook Verify Token is required');
            }
            if (!this.appSecret) {
                throw new Error('Facebook App Secret is required');
            }

            // Test the API connection
            await this.testConnection();
            
            // Setup webhook routes if Express app is available
            if (global.app) {
                this.setupWebhookRoutes(global.app);
            }
            
            this.isInitialized = true;
            console.log('✅ Facebook Messenger service initialized successfully');
            
            return {
                success: true,
                message: 'Facebook Messenger connected successfully'
            };
        } catch (error) {
            console.error('❌ Failed to initialize Facebook Messenger service:', error.message);
            throw error;
        }
    }

    /**
     * Test the Facebook API connection
     */
    async testConnection() {
        try {
            const response = await axios.get('https://graph.facebook.com/v18.0/me', {
                params: {
                    access_token: this.pageAccessToken,
                    fields: 'name,id'
                }
            });
            
            console.log(`✅ Connected to Facebook Page: ${response.data.name} (ID: ${response.data.id})`);
            return response.data;
        } catch (error) {
            if (error.response) {
                const errorData = error.response.data;
                throw new Error(`Facebook API Error: ${errorData.error?.message || 'Unknown error'}`);
            } else {
                throw new Error(`Connection Error: ${error.message}`);
            }
        }
    }

    /**
     * Verify webhook signature for security
     */
    verifyWebhookSignature(payload, signature) {
        if (!this.appSecret) {
            console.warn('Facebook App Secret not configured, skipping signature verification');
            return true;
        }

        const expectedSignature = crypto
            .createHmac('sha256', this.appSecret)
            .update(payload)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(`sha256=${expectedSignature}`),
            Buffer.from(signature)
        );
    }

    /**
     * Handle webhook verification
     */
    handleWebhookVerification(mode, token, challenge) {
        if (mode === 'subscribe' && token === this.verifyToken) {
            console.log('Facebook webhook verified successfully');
            return challenge;
        }
        console.error('Facebook webhook verification failed');
        return null;
    }

    /**
     * Process incoming webhook events
     */
    async processWebhookEvent(body) {
        try {
            if (body.object !== 'page') {
                console.log('Webhook event not from page, ignoring');
                return;
            }

            for (const entry of body.entry) {
                for (const event of entry.messaging || []) {
                    await this.handleMessagingEvent(event);
                }
            }
        } catch (error) {
            console.error('Error processing Facebook webhook event:', error);
        }
    }

    /**
     * Handle individual messaging events
     */
    async handleMessagingEvent(event) {
        const senderId = event.sender.id;
        const pageId = event.recipient.id;
        const chatId = `facebook:${senderId}`;

        try {
            // Handle different event types
            if (event.message) {
                await this.handleMessage(event.message, chatId, senderId);
            } else if (event.postback) {
                await this.handlePostback(event.postback, chatId, senderId);
            } else if (event.delivery) {
                console.log('Message delivered:', event.delivery);
            } else if (event.read) {
                console.log('Message read:', event.read);
            }
        } catch (error) {
            console.error('Error handling Facebook messaging event:', error);
        }
    }

    /**
     * Handle incoming messages
     */
    async handleMessage(message, chatId, senderId) {
        try {
            let messageText = '';
            let messageType = 'text';

            if (message.text) {
                messageText = message.text;
            } else if (message.attachments) {
                // Handle attachments (images, files, etc.)
                const attachment = message.attachments[0];
                messageType = attachment.type;
                messageText = `[${attachment.type.toUpperCase()}]`;
                
                if (attachment.payload && attachment.payload.url) {
                    messageText += ` ${attachment.payload.url}`;
                }
            }

            console.log(`Facebook message from ${senderId}: ${messageText}`);

            // Check if chat is blocked (AI disabled)
            const isBlocked = global.chatHandler?.isAIBlocked?.(chatId.replace('facebook:', ''), 'facebook');
            
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
                    await this.sendMessage(senderId, response);
                    
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
     * Handle postback events (button clicks)
     */
    async handlePostback(postback, chatId, senderId) {
        console.log(`Facebook postback from ${senderId}:`, postback.payload);
        
        // Treat postback as a message
        await this.handleMessage({ text: postback.payload }, chatId, senderId);
    }

    /**
     * Send message to Facebook user
     */
    async sendMessage(recipientId, messageText, messageType = 'text') {
        try {
            const messageData = {
                recipient: { id: recipientId },
                message: {}
            };

            if (messageType === 'text') {
                messageData.message.text = messageText;
            } else {
                // Handle other message types (images, attachments, etc.)
                messageData.message.attachment = {
                    type: messageType,
                    payload: { url: messageText }
                };
            }

            const response = await axios.post(this.apiUrl, messageData, {
                params: { access_token: this.pageAccessToken },
                headers: { 'Content-Type': 'application/json' }
            });

            console.log('Facebook message sent successfully:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error sending Facebook message:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Send typing indicator
     */
    async sendTypingIndicator(recipientId, action = 'typing_on') {
        try {
            await axios.post(this.apiUrl, {
                recipient: { id: recipientId },
                sender_action: action
            }, {
                params: { access_token: this.pageAccessToken },
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('Error sending typing indicator:', error);
        }
    }

    /**
     * Get user profile information
     */
    async getUserProfile(userId) {
        try {
            const response = await axios.get(`https://graph.facebook.com/v18.0/${userId}`, {
                params: {
                    fields: 'first_name,last_name,profile_pic',
                    access_token: this.pageAccessToken
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting Facebook user profile:', error);
            return null;
        }
    }

    /**
     * Set up webhook endpoints for Express server
     */
    setupWebhookRoutes(app) {
        // Webhook verification (GET)
        app.get('/webhook/facebook', (req, res) => {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            const result = this.handleWebhookVerification(mode, token, challenge);
            if (result) {
                res.status(200).send(challenge);
            } else {
                res.sendStatus(403);
            }
        });

        // Webhook events (POST)
        app.post('/webhook/facebook', (req, res) => {
            const signature = req.get('X-Hub-Signature-256');
            const payload = JSON.stringify(req.body);

            if (!this.verifyWebhookSignature(payload, signature)) {
                console.error('Invalid Facebook webhook signature');
                return res.sendStatus(403);
            }

            this.processWebhookEvent(req.body);
            res.status(200).send('EVENT_RECEIVED');
        });

        console.log('Facebook Messenger webhook routes configured');
    }
}

module.exports = FacebookMessengerService;
