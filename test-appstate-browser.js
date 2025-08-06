#!/usr/bin/env node

/**
 * Test App State + Browser Emulation Combination
 * The optimal approach for Facebook Messenger integration
 */

const FacebookBrowserService = require('./services/facebookBrowserService');
const AppStateBrowserOptimizer = require('./utils/appStateBrowserOptimizer');

async function testAppStateBrowser() {
    console.log('🧪 Testing App State + Browser Emulation Combination...\n');
    
    // Get app state from environment
    const appState = process.env.FACEBOOK_APP_STATE;
    
    if (!appState) {
        console.log('❌ No FACEBOOK_APP_STATE found in environment variables');
        console.log('💡 To test app state + browser emulation:');
        console.log('   1. Extract app state using utils/extract-facebook-cookies.ps1');
        console.log('   2. Set FACEBOOK_APP_STATE environment variable');
        console.log('   3. Run this test again');
        return false;
    }
    
    try {
        // Step 1: Validate App State
        console.log('📋 Step 1: App State Validation');
        const validation = AppStateBrowserOptimizer.validateAppStateForBrowser(appState);
        
        if (!validation.valid) {
            console.log('❌ App state validation failed:', validation.error);
            return false;
        }
        
        console.log('✅ App state validation passed:');
        console.log('   • Cookies found:', validation.cookieCount);
        console.log('   • Essential cookies:', validation.essentialCookies.join(', '));
        
        if (validation.missingCookies.length > 0) {
            console.log('⚠️ Missing cookies:', validation.missingCookies.join(', '));
        }
        
        if (validation.expiredCookies.length > 0) {
            console.log('⚠️ Expired cookies:', validation.expiredCookies.join(', '));
            console.log('💡 Consider re-extracting app state from browser');
        }
        
        console.log('');
        
        // Step 2: Optimize App State
        console.log('📋 Step 2: App State Optimization');
        const optimizedAppState = AppStateBrowserOptimizer.optimizeAppStateForBrowser(appState);
        console.log('✅ App state optimized for browser emulation');
        console.log('');
        
        // Step 3: Test Browser Emulation
        console.log('📋 Step 3: Browser Emulation Test');
        const browserService = new FacebookBrowserService(null, null, appState);
        
        console.log('🚀 Initializing browser with app state...');
        await browserService.initialize();
        
        console.log('✅ Browser emulation with app state successful!');
        console.log('');
        
        // Step 4: Test Session Persistence
        console.log('📋 Step 4: Session Persistence Test');
        await browserService.saveSession();
        console.log('✅ Session saved for future use');
        console.log('');
        
        // Step 5: Test Message Monitoring Setup
        console.log('📋 Step 5: Message Monitoring Setup');
        
        // Add test message handler
        browserService.onMessage((message) => {
            console.log('📨 Test message received:', {
                body: message.body,
                senderID: message.senderID,
                threadID: message.threadID
            });
        });
        
        console.log('✅ Message monitoring configured');
        console.log('');
        
        // Step 6: Configuration Summary
        console.log('📋 Step 6: Optimal Configuration Summary');
        const optimalConfig = AppStateBrowserOptimizer.getOptimalConfiguration();
        
        console.log('🎯 Optimal Settings Applied:');
        console.log('   • Browser Mode: Headless (VPS compatible)');
        console.log('   • Navigation: domcontentloaded (faster)');
        console.log('   • Timeout: 60 seconds (VPS optimized)');
        console.log('   • Session Persistence: Enabled');
        console.log('   • Cookie Optimization: Enabled');
        console.log('');
        
        console.log('💡 Key Benefits of App State + Browser Emulation:');
        console.log('   ✅ No login credentials needed (more secure)');
        console.log('   ✅ Bypasses 2FA and login challenges');
        console.log('   ✅ Uses real browser (bypasses API blocking)');
        console.log('   ✅ Session persistence (longer lasting)');
        console.log('   ✅ VPS compatible (headless mode)');
        console.log('   ✅ Automatic optimization and validation');
        console.log('');
        
        // Keep running for testing
        console.log('👂 Browser emulation is now running...');
        console.log('💡 Send a message to your Facebook account to test message monitoring');
        console.log('🛑 Press Ctrl+C to stop');
        
        // Keep alive for testing
        await new Promise(resolve => {
            process.on('SIGINT', async () => {
                console.log('\n🛑 Stopping test...');
                await browserService.stop();
                resolve();
            });
        });
        
        return true;
        
    } catch (error) {
        console.log('❌ App State + Browser Emulation test failed:', error.message);
        console.log('');
        
        // Provide specific troubleshooting
        if (error.message.includes('Navigation timeout')) {
            console.log('🔧 Navigation Timeout Solutions:');
            console.log('   • Increase VPS resources (RAM/CPU)');
            console.log('   • Use VPS with better network connectivity');
            console.log('   • Try running: ./setup-vps-browser.sh');
        } else if (error.message.includes('Chrome')) {
            console.log('🔧 Browser Issues:');
            console.log('   • Run: ./setup-vps-browser.sh');
            console.log('   • Install Chrome manually if needed');
        } else if (error.message.includes('app state')) {
            console.log('🔧 App State Issues:');
            console.log('   • Re-extract app state from browser');
            console.log('   • Ensure you\'re logged into Facebook');
            console.log('   • Use utils/extract-facebook-cookies.ps1');
        }
        
        return false;
    }
}

// Handle command line execution
if (require.main === module) {
    testAppStateBrowser()
        .then((success) => {
            if (success) {
                console.log('\n🎉 App State + Browser Emulation test completed successfully!');
            }
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('\n❌ Test failed with error:', error.message);
            process.exit(1);
        });
}

module.exports = testAppStateBrowser;
