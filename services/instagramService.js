const axios = require('axios');
const crypto = require('crypto');

class InstagramService {
    constructor(accessToken, verifyToken, appSecret) {
        this.accessToken = accessToken;
        this.verifyToken = verifyToken;
        this.appSecret = appSecret;
        this.apiUrl = 'https://graph.instagram.com/v18.0';
        this.messagesApiUrl = 'https://graph.facebook.com/v18.0';
        
        console.log('Instagram service initialized');
    }

    /**
     * Verify webhook signature for security
     */
    verifyWebhookSignature(payload, signature) {
        if (!this.appSecret) {
            console.warn('Instagram App Secret not configured, skipping signature verification');
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
            console.log('Instagram webhook verified successfully');
            return challenge;
        }
        console.error('Instagram webhook verification failed');
        return null;
    }

    /**
     * Process incoming webhook events
     */
    async processWebhookEvent(body) {
        try {
            if (body.object !== 'instagram') {
                console.log('Webhook event not from Instagram, ignoring');
                return;
            }

            for (const entry of body.entry) {
                // Handle different event types
                if (entry.messaging) {
                    for (const event of entry.messaging) {
                        await this.handleMessagingEvent(event);
                    }
                } else if (entry.changes) {
                    for (const change of entry.changes) {
                        await this.handleChangeEvent(change);
                    }
                }
            }
        } catch (error) {
            console.error('Error processing Instagram webhook event:', error);
        }
    }

    /**
     * Handle messaging events (DMs)
     */
    async handleMessagingEvent(event) {
        const senderId = event.sender.id;
        const recipientId = event.recipient.id;
        const chatId = `instagram:${senderId}`;

        try {
            if (event.message) {
                await this.handleMessage(event.message, chatId, senderId);
            } else if (event.postback) {
                await this.handlePostback(event.postback, chatId, senderId);
            }
        } catch (error) {
            console.error('Error handling Instagram messaging event:', error);
        }
    }

    /**
     * Handle change events (comments, mentions, etc.)
     */
    async handleChangeEvent(change) {
        try {
            console.log('Instagram change event:', change.field, change.value);
            
            if (change.field === 'comments') {
                await this.handleComment(change.value);
            } else if (change.field === 'mentions') {
                await this.handleMention(change.value);
            }
        } catch (error) {
            console.error('Error handling Instagram change event:', error);
        }
    }

    /**
     * Handle incoming DM messages
     */
    async handleMessage(message, chatId, senderId) {
        try {
            let messageText = '';
            let messageType = 'text';

            if (message.text) {
                messageText = message.text;
            } else if (message.attachments) {
                const attachment = message.attachments[0];
                messageType = attachment.type;
                messageText = `[${attachment.type.toUpperCase()}]`;
                
                if (attachment.payload && attachment.payload.url) {
                    messageText += ` ${attachment.payload.url}`;
                }
            }

            console.log(`Instagram DM from ${senderId}: ${messageText}`);

            // Check if chat is blocked (AI disabled)
            const isBlocked = global.chatHandler?.isAIBlocked?.(chatId.replace('instagram:', ''), 'instagram');
            
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
                    await this.sendMessage(senderId, response);
                    
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
     * Handle comments on posts
     */
    async handleComment(commentData) {
        try {
            const commentId = commentData.id;
            const comment = await this.getComment(commentId);
            
            if (comment && comment.text) {
                console.log(`Instagram comment: ${comment.text}`);
                
                // Process comment with AI if needed
                // You can implement auto-reply to comments here
            }
        } catch (error) {
            console.error('Error handling Instagram comment:', error);
        }
    }

    /**
     * Handle mentions in stories/posts
     */
    async handleMention(mentionData) {
        try {
            console.log('Instagram mention received:', mentionData);
            // Handle mentions if needed
        } catch (error) {
            console.error('Error handling Instagram mention:', error);
        }
    }

    /**
     * Send DM message to Instagram user
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
                messageData.message.attachment = {
                    type: messageType,
                    payload: { url: messageText }
                };
            }

            const response = await axios.post(`${this.messagesApiUrl}/me/messages`, messageData, {
                params: { access_token: this.accessToken },
                headers: { 'Content-Type': 'application/json' }
            });

            console.log('Instagram message sent successfully:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error sending Instagram message:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get comment details
     */
    async getComment(commentId) {
        try {
            const response = await axios.get(`${this.apiUrl}/${commentId}`, {
                params: {
                    fields: 'id,text,username,timestamp',
                    access_token: this.accessToken
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting Instagram comment:', error);
            return null;
        }
    }

    /**
     * Get user profile information
     */
    async getUserProfile(userId) {
        try {
            const response = await axios.get(`${this.apiUrl}/${userId}`, {
                params: {
                    fields: 'id,username,account_type,media_count',
                    access_token: this.accessToken
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting Instagram user profile:', error);
            return null;
        }
    }

    /**
     * Reply to a comment
     */
    async replyToComment(commentId, replyText) {
        try {
            const response = await axios.post(`${this.apiUrl}/${commentId}/replies`, {
                message: replyText
            }, {
                params: { access_token: this.accessToken },
                headers: { 'Content-Type': 'application/json' }
            });

            console.log('Instagram comment reply sent:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error replying to Instagram comment:', error);
            throw error;
        }
    }

    /**
     * Set up webhook endpoints for Express server
     */
    setupWebhookRoutes(app) {
        // Webhook verification (GET)
        app.get('/webhook/instagram', (req, res) => {
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
        app.post('/webhook/instagram', (req, res) => {
            const signature = req.get('X-Hub-Signature-256');
            const payload = JSON.stringify(req.body);

            if (!this.verifyWebhookSignature(payload, signature)) {
                console.error('Invalid Instagram webhook signature');
                return res.sendStatus(403);
            }

            this.processWebhookEvent(req.body);
            res.status(200).send('EVENT_RECEIVED');
        });

        console.log('Instagram webhook routes configured');
    }
}

module.exports = InstagramService;
