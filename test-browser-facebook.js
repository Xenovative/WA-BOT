const FacebookChatService = require('./services/facebookChatService');

async function testBrowserFacebook() {
    console.log('🧪 Testing Facebook Browser Emulation...');
    
    // Get credentials from environment
    const email = process.env.FACEBOOK_EMAIL;
    const password = process.env.FACEBOOK_PASSWORD;
    const appState = process.env.FACEBOOK_APP_STATE;
    
    if (!email && !appState) {
        console.log('❌ No Facebook credentials found in environment variables');
        console.log('   Set FACEBOOK_EMAIL + FACEBOOK_PASSWORD or FACEBOOK_APP_STATE');
        return;
    }
    
    try {
        const facebookService = new FacebookChatService(email, password, appState);
        
        // Add message handler
        facebookService.onMessage((err, message) => {
            if (err) {
                console.log('❌ Message error:', err);
                return;
            }
            
            console.log('📨 Received message:', {
                body: message.body,
                senderID: message.senderID,
                threadID: message.threadID
            });
        });
        
        // Initialize (this will try API first, then browser fallback)
        console.log('🚀 Initializing Facebook service...');
        const success = await facebookService.initialize();
        
        if (success) {
            console.log('✅ Facebook service initialized successfully!');
            console.log('   Mode:', facebookService.useBrowserMode ? 'Browser Emulation' : 'API');
            
            // Keep running for testing
            console.log('👂 Listening for messages... (Press Ctrl+C to stop)');
            
            // Test sending a message after 10 seconds
            setTimeout(async () => {
                try {
                    console.log('📤 Testing message send...');
                    // Note: You'll need to specify a valid threadID
                    // await facebookService.sendMessage('Test message from WA-BOT browser emulation!', 'THREAD_ID_HERE');
                    console.log('💡 To test sending, uncomment the sendMessage line and add a valid threadID');
                } catch (error) {
                    console.log('❌ Send test failed:', error.message);
                }
            }, 10000);
            
        } else {
            console.log('❌ Facebook service initialization failed');
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down test...');
    process.exit(0);
});

// Run test
testBrowserFacebook().catch(console.error);
