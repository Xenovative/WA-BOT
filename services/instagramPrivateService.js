const { IgApiClient } = require('instagram-private-api');
const LLMFactory = require('../llm/llmFactory');
const commandHandler = require('../handlers/commandHandler');
const ragProcessor = require('../kb/ragProcessor');
const voiceHandler = require('../utils/voiceHandler');
const fetch = require('node-fetch');

class InstagramPrivateService {
    constructor() {
        this.username = process.env.INSTAGRAM_USERNAME;
        this.password = process.env.INSTAGRAM_PASSWORD;
        this.sessionId = process.env.INSTAGRAM_SESSION_ID;
        this.ig = new IgApiClient();
        this.isLoggedIn = false;
        this.user = null;
        this.processedMessages = new Set();
        this.lastMessageTimestamp = {}; // Track last message timestamp per thread
        this.llmClient = null;
        
        console.log('Instagram Private API service initialized');
    }

    /**
     * Get the LLM client, using the global one if available
     * @returns {Object} The LLM client instance
     */
    getLLMClient() {
        // Use the global LLM client if available (will be updated by updateLLMClient)
        if (global.currentLLMClient) {
            this.llmClient = global.currentLLMClient;
            return this.llmClient;
        }
        
        // Fallback to creating a new client if global one isn't available
        if (!this.llmClient) {
            const settings = commandHandler.getCurrentSettings();
            const options = {
                mcpResourceUri: settings.mcpResourceUri
            };
            
            this.llmClient = LLMFactory.createLLMClient(settings.provider, options);
            
            // Update the model if needed
            if (['openai', 'openrouter', 'ollama'].includes(settings.provider)) {
                this.llmClient.model = settings.model;
                
                // Set base URL for Ollama if needed
                if (settings.provider === 'ollama') {
                    this.llmClient.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
                }
            }
            
            console.log(`[Instagram] Created new LLM client - Provider: ${settings.provider}, Model: ${settings.model}`);
        }
        
        return this.llmClient;
    }

    /**
     * Initialize and login to Instagram
     */
    async initialize() {
        try {
            console.log('Instagram Private API initialization started');
            console.log('Available auth methods:', {
                sessionId: !!this.sessionId,
                username: !!this.username,
                password: !!this.password
            });
            
            // Only proceed if we have a valid session ID
            if (!this.sessionId) {
                console.log('Instagram Private API: No session ID provided, skipping login');
                console.log('To connect Instagram, please provide a valid session ID through the platform management interface');
                console.log('Session ID authentication is the only supported method for stability and security');
                this.isLoggedIn = false;
                return false;
            }
            
            // Use session ID authentication only
            console.log('Using Instagram session ID authentication');
            
            // Parse session ID cookie
            const sessionData = this.parseSessionId(this.sessionId);
            if (!sessionData) {
                console.error('Instagram Private API: Invalid session ID format');
                console.log('Please provide a valid session ID. Use the session extractor tool in the platform management interface.');
                this.isLoggedIn = false;
                return false;
            }
            
            // Validate session ID length and format
            if (sessionData.sessionid.length < 20) {
                console.error('Instagram Private API: Session ID appears to be too short or invalid');
                console.log('Please extract a fresh session ID from your browser after logging into Instagram');
                this.isLoggedIn = false;
                return false;
            }
            
            try {
                // Generate device ID for consistency
                this.ig.state.generateDevice('session_user');
                
                console.log('Instagram Private API: Setting session cookie...');
                
                // Try multiple approaches to set the session
                
                // Method 1: Direct cookie jar manipulation
                try {
                    const cookieString = `sessionid=${sessionData.sessionid}; Domain=.instagram.com; Path=/; HttpOnly; Secure`;
                    await this.ig.state.cookieJar.setCookie(cookieString, 'https://www.instagram.com/');
                    console.log('Method 1: Cookie set via cookieJar.setCookie');
                } catch (cookieError) {
                    console.log('Method 1 failed:', cookieError.message);
                    
                    // Method 2: State deserialization
                    try {
                        const stateData = {
                            constants: {},
                            cookies: `{"version":"tough-cookie@4.0.0","storeType":"MemoryCookieStore","rejectPublicSuffixes":true,"cookies":[{"key":"sessionid","value":"${sessionData.sessionid}","domain":".instagram.com","path":"/","httpOnly":true,"secure":true,"sameSite":"none"}]}`
                        };
                        await this.ig.state.deserialize(JSON.stringify(stateData));
                        console.log('Method 2: Cookie set via state deserialization');
                    } catch (deserializeError) {
                        console.log('Method 2 failed:', deserializeError.message);
                        throw new Error('Both cookie setting methods failed');
                    }
                }
                
                console.log('Instagram Private API: Session cookie set, attempting to verify...');
                
                // Verify session is valid by getting current user
                this.user = await this.ig.account.currentUser();
                this.isLoggedIn = true;
                
                console.log(`Instagram session authentication successful for user: ${this.user.username}`);
                
            } catch (sessionError) {
                console.error('Instagram Private API: Session validation failed:', sessionError.message);
                
                // Check if it's a 404 error (session expired/invalid)
                if (sessionError.message.includes('404') || sessionError.message.includes('login')) {
                    console.log('❌ Session ID appears to be expired or invalid');
                    console.log('📝 This usually means:');
                    console.log('   • The session ID has expired (Instagram sessions expire periodically)');
                    console.log('   • The session ID format is incorrect');
                    console.log('   • The account was logged out from another device');
                    console.log('');
                    console.log('🔧 To fix this:');
                    console.log('   1. Go to instagram.com in your browser');
                    console.log('   2. Make sure you are logged in');
                    console.log('   3. Extract a fresh session ID using the session extractor tool');
                    console.log('   4. The session ID should be 40+ characters long and contain %3A');
                } else {
                    console.log('❌ Unexpected error during session validation');
                    console.log('🔧 Please check your internet connection and try again');
                }
                
                this.isLoggedIn = false;
                return false;
            }

            // Start listening for direct messages
            this.startDirectMessageListener();
            
            return true;
        } catch (error) {
            console.error('Instagram authentication failed:', error.message);
            this.isLoggedIn = false;
            return false;
        }
    }

    /**
     * Parse session ID from cookie string
     */
    parseSessionId(sessionIdString) {
        try {
            console.log('Parsing session ID:', sessionIdString.substring(0, 20) + '...');
            
            // Handle different session ID formats
            let sessionid;
            
            if (sessionIdString.includes('sessionid=')) {
                // Extract from cookie format: "sessionid=12345678%3A..."
                const match = sessionIdString.match(/sessionid=([^;\s]+)/);
                if (match) {
                    sessionid = match[1]; // Keep URL-encoded format
                }
            } else {
                // Assume it's just the session ID value - keep as-is
                sessionid = sessionIdString.trim();
                
                // If it doesn't contain %3A, it might be already decoded - re-encode it
                if (!sessionid.includes('%3A') && sessionid.includes(':')) {
                    sessionid = encodeURIComponent(sessionid);
                    console.log('Re-encoded session ID to URL format');
                }
            }
            
            if (!sessionid) {
                console.error('No session ID found after parsing');
                return null;
            }
            
            // Validate session ID format
            if (sessionid.length < 20) {
                console.error('Session ID too short:', sessionid.length, 'characters');
                return null;
            }
            
            if (!sessionid.includes('%3A')) {
                console.warn('Session ID may be in wrong format - should contain %3A');
            }
            
            console.log('Parsed session ID successfully, length:', sessionid.length);
            return { sessionid };
        } catch (error) {
            console.error('Error parsing session ID:', error);
            return null;
        }
    }

    /**
     * Start listening for direct messages
     */
    startDirectMessageListener() {
        try {
            console.log('Starting Instagram DM listener...');
            
            // Clear any existing interval
            if (this.messageCheckInterval) {
                clearInterval(this.messageCheckInterval);
            }
            
            // Do an immediate check for messages
            if (this.isLoggedIn) {
                console.log('Doing initial message check...');
                this.checkForNewMessages().catch(error => {
                    console.error('Initial message check failed:', error);
                });
            }
            
            // Check for new messages every 15 seconds (more frequent)
            this.messageCheckInterval = setInterval(async () => {
                if (this.isLoggedIn) {
                    console.log('🔍 Checking for new Instagram messages...');
                    await this.checkForNewMessages();
                } else {
                    console.log('⚠️ Instagram not logged in, skipping message check');
                }
            }, 15000); // Reduced from 30 seconds to 15 seconds

            console.log('✅ Instagram DM listener started (checking every 15 seconds)');
        } catch (error) {
            console.error('❌ Error starting Instagram DM listener:', error);
        }
    }

    /**
     * Check for new direct messages
     */
    async checkForNewMessages() {
        try {
            console.log('📬 Fetching Instagram inbox...');
            const inbox = this.ig.feed.directInbox();
            const threads = await inbox.items();
            
            console.log(`📋 Found ${threads.length} Instagram conversation threads`);
            
            if (threads.length === 0) {
                console.log('📭 No Instagram conversations found. Send a message to your Instagram account to test!');
                return;
            }

            for (const thread of threads) {
                // Check if this is a new message
                const lastMessage = thread.items[0];
                if (lastMessage && lastMessage.user_id !== this.user.pk) {
                    // Check if we've already processed this message
                    const messageId = lastMessage.item_id;
                    const threadId = thread.thread_id;
                    const messageTimestamp = lastMessage.timestamp;
                    
                    console.log(`Raw timestamp for message ${messageId}: ${messageTimestamp} (type: ${typeof messageTimestamp})`);
                    
                    // Handle timestamp conversion safely
                    let timestampStr = 'Unknown';
                    try {
                        // Instagram timestamps might be in seconds or microseconds
                        let timestamp = messageTimestamp;
                        if (timestamp > 1e12) {
                            // Likely microseconds, convert to milliseconds
                            timestamp = Math.floor(timestamp / 1000);
                        } else if (timestamp > 1e9) {
                            // Likely seconds, convert to milliseconds
                            timestamp = timestamp * 1000;
                        }
                        timestampStr = new Date(timestamp).toISOString();
                    } catch (e) {
                        timestampStr = `Invalid timestamp: ${messageTimestamp}`;
                    }
                    
                    console.log(`Thread ${threadId}: Message ${messageId} at ${timestampStr}`);
                    
                    if (this.processedMessages.has(messageId)) {
                        console.log(`Skipping already processed message ${messageId}`);
                        continue; // Skip already processed message
                    }
                    
                    // Check timestamp to ensure it's newer than last processed
                    if (this.lastMessageTimestamp[threadId] && 
                        messageTimestamp <= this.lastMessageTimestamp[threadId]) {
                        console.log(`Skipping old message ${messageId} (timestamp ${messageTimestamp} <= ${this.lastMessageTimestamp[threadId]})`);
                        continue; // Skip old message
                    }
                    
                    // Update last message timestamp for this thread
                    this.lastMessageTimestamp[threadId] = messageTimestamp;
                    
                    console.log(`Processing new message ${messageId} from thread ${threadId}`);
                    await this.handleDirectMessage(thread, lastMessage);
                }
            }
        } catch (error) {
            console.error('Error checking Instagram messages:', error);
        }
    }

    /**
     * Handle incoming direct message
     */
    async handleDirectMessage(thread, message) {
        try {
            const senderId = message.user_id.toString();
            const chatId = `instagram:${senderId}`;
            let messageText = '';

            // Extract message content based on type
            if (message.item_type === 'text') {
                messageText = message.text;
            } else if (message.item_type === 'media') {
                messageText = '[MEDIA]';
            } else if (message.item_type === 'media_share') {
                messageText = '[SHARED_MEDIA]';
            } else if (message.item_type === 'voice_media') {
                console.log('📢 Processing Instagram voice message...');
                
                try {
                    // Create a mock message object for voiceHandler compatibility
                    const mockMessage = {
                        downloadMedia: async () => {
                            // Instagram Private API voice media handling
                            if (message.voice_media && message.voice_media.media) {
                                // Get voice media URL and download
                                const mediaUrl = message.voice_media.media.audio?.audio_src;
                                if (mediaUrl) {
                                    const response = await fetch(mediaUrl);
                                    const buffer = await response.buffer();
                                    return {
                                        data: buffer.toString('base64'),
                                        mimetype: 'audio/mp4'
                                    };
                                }
                            }
                            throw new Error('Voice media not accessible');
                        }
                    };
                    
                    // Extract voice duration (if available)
                    const voiceData = {
                        seconds: message.voice_media?.media?.audio?.duration || 60 // Default to 60s if unknown
                    };
                    
                    // Process voice message with voiceHandler
                    const result = await voiceHandler.processVoiceMessage(voiceData, mockMessage);
                    
                    if (result.text) {
                        messageText = result.text;
                        console.log(`🎤 Instagram voice transcribed: ${result.text}`);
                        
                        // Send transcription confirmation to user
                        try {
                            const threadId = thread.thread_id;
                            await this.sendDirectMessage(threadId, `🎤 *Voice transcribed:* ${result.text}\n\n_Processing your message..._`);
                        } catch (confirmError) {
                            console.error('Error sending transcription confirmation:', confirmError);
                        }
                    } else {
                        messageText = `[VOICE_MESSAGE - Transcription failed: ${result.error || 'Unknown error'}]`;
                        console.error('Instagram voice transcription failed:', result.error);
                    }
                } catch (voiceError) {
                    console.error('Error processing Instagram voice message:', voiceError);
                    messageText = '[VOICE_MESSAGE - Processing failed]';
                }
            } else {
                messageText = `[${message.item_type.toUpperCase()}]`;
            }

            console.log(`Instagram DM from ${senderId}: ${messageText}`);

            // Mark message as processed (deduplication already handled in checkForNewMessages)
            const messageId = message.item_id;
            this.processedMessages.add(messageId);
            
            console.log(`Processing Instagram message ${messageId} from ${senderId}`);

            // Check if chat is blocked (AI disabled)
            const isBlocked = global.chatHandler?.isAIBlocked?.(senderId, 'instagram');
            console.log(`Instagram chat ${chatId} AI blocked status: ${isBlocked}`);
            
            // Always save user message to chat history
            if (global.chatHandler) {
                global.chatHandler.addMessage(senderId, 'user', messageText, 'instagram');
                console.log(`Saved user message to chat history for ${chatId}`);
            } else {
                console.error('ChatHandler not available - cannot save message');
            }

            // Skip AI processing if blocked
            if (isBlocked) {
                console.log(`AI is disabled for Instagram chat ${chatId}, skipping response`);
                return;
            }

            // Get conversation history
            const conversation = global.chatHandler?.getConversation?.(senderId, 'instagram') || [];
            console.log(`Retrieved conversation history for ${chatId}: ${conversation.length} messages`);

            // Process with LLM client (same as other services)
            try {
                // Get current LLM client and settings
                const currentLLMClient = this.getLLMClient();
                
                if (!currentLLMClient) {
                    console.error('LLM client not available - cannot generate response');
                    return;
                }
                
                console.log(`Processing message with LLM client for ${chatId}`);
                
                // Get current settings
                const settings = commandHandler.getCurrentSettings();
                console.log(`[Instagram] Current settings - Provider: ${settings.provider}, Model: ${settings.model}`);
                console.log(`[Instagram] System prompt: ${settings.systemPrompt.substring(0, 100)}...`);
                
                // Convert conversation to format expected by LLM
                let messages = [
                    { role: 'system', content: settings.systemPrompt },
                    ...conversation.map(msg => ({ role: msg.role, content: msg.content }))
                ];
                
                console.log(`[Instagram] Prepared ${messages.length} messages for LLM (including system prompt)`);
                
                // Apply RAG if enabled
                if (settings.ragEnabled && ragProcessor) {
                    const ragResult = await ragProcessor.processQuery(messageText, messages);
                    messages = ragResult.messages;
                    if (ragResult.context) {
                        console.log(`RAG context applied to Instagram query in chat ${chatId}`);
                    }
                }
                
                // Generate response
                let response;
                if (settings.provider === 'mcp') {
                    response = await currentLLMClient.generateResponse(messageText, messages, settings.parameters);
                } else {
                    response = await currentLLMClient.generateResponse(messageText, messages, settings.parameters);
                }

                if (response && response.trim()) {
                    console.log(`Generated response for ${chatId}: ${response.substring(0, 100)}...`);
                    await this.sendDirectMessage(thread.thread_id, response);
                    
                    // Save assistant response
                    if (global.chatHandler) {
                        global.chatHandler.addMessage(senderId, 'assistant', response, 'instagram');
                        console.log(`Saved assistant response to chat history for ${chatId}`);
                    }
                } else {
                    console.log(`No response generated for ${chatId}`);
                }
            } catch (llmError) {
                console.error(`Error generating LLM response for ${chatId}:`, llmError);
                console.error('LLM Error stack:', llmError.stack);
            }
        } catch (error) {
            console.error('Error handling Instagram direct message:', error);
            console.error('Error stack:', error.stack);
            console.error('Error details:', {
                message: error.message,
                name: error.name,
                chatId: chatId,
                senderId: senderId
            });
        }
    }

    /**
     * Send direct message
     */
    async sendDirectMessage(threadId, messageText) {
        try {
            if (!this.isLoggedIn) {
                throw new Error('Not logged in to Instagram');
            }

            const thread = this.ig.entity.directThread(threadId);
            await thread.broadcastText(messageText);
            
            console.log('Instagram DM sent successfully');
            return true;
        } catch (error) {
            console.error('Error sending Instagram DM:', error);
            throw error;
        }
    }

    /**
     * Send direct message by user ID
     */
    async sendDirectMessageToUser(userId, messageText) {
        try {
            if (!this.isLoggedIn) {
                throw new Error('Not logged in to Instagram');
            }

            // Create or get existing thread with user
            const thread = this.ig.entity.directThread([userId]);
            await thread.broadcastText(messageText);
            
            console.log(`Instagram DM sent to user ${userId}`);
            return true;
        } catch (error) {
            console.error('Error sending Instagram DM to user:', error);
            throw error;
        }
    }

    /**
     * Get user information
     */
    async getUserInfo(username) {
        try {
            if (!this.isLoggedIn) {
                throw new Error('Not logged in to Instagram');
            }

            const userId = await this.ig.user.getIdByUsername(username);
            const userInfo = await this.ig.user.info(userId);
            
            return {
                id: userInfo.pk,
                username: userInfo.username,
                full_name: userInfo.full_name,
                profile_pic_url: userInfo.profile_pic_url,
                is_verified: userInfo.is_verified,
                follower_count: userInfo.follower_count,
                following_count: userInfo.following_count
            };
        } catch (error) {
            console.error('Error getting Instagram user info:', error);
            return null;
        }
    }

    /**
     * Search for users
     */
    async searchUsers(query) {
        try {
            if (!this.isLoggedIn) {
                throw new Error('Not logged in to Instagram');
            }

            const results = await this.ig.search.users(query);
            return results.users.map(user => ({
                id: user.pk,
                username: user.username,
                full_name: user.full_name,
                profile_pic_url: user.profile_pic_url,
                is_verified: user.is_verified
            }));
        } catch (error) {
            console.error('Error searching Instagram users:', error);
            return [];
        }
    }

    /**
     * Stop the service and cleanup
     */
    async stop() {
        try {
            if (this.messageCheckInterval) {
                clearInterval(this.messageCheckInterval);
            }
            
            this.isLoggedIn = false;
            console.log('Instagram Private API service stopped');
        } catch (error) {
            console.error('Error stopping Instagram service:', error);
        }
    }

    /**
     * Check if service is ready
     */
    isReady() {
        return this.isLoggedIn;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isLoggedIn: this.isLoggedIn,
            username: this.username,
            user: this.user ? {
                id: this.user.pk,
                username: this.user.username,
                full_name: this.user.full_name
            } : null
        };
    }
}

module.exports = InstagramPrivateService;
