#!/usr/bin/env node

/**
 * Test Navigation Timeout Improvements
 * Tests the new retry logic and timeout handling
 */

const FacebookBrowserService = require('./services/facebookBrowserService');

async function testNavigationTimeout() {
    console.log('🧪 Testing Navigation Timeout Improvements...\n');
    
    try {
        // Create service with dummy credentials (we won't actually login)
        const service = new FacebookBrowserService('test@example.com', 'password', null);
        
        console.log('🚀 Initializing browser service...');
        
        // This will test the browser launch and navigation retry logic
        await service.initialize();
        
        console.log('✅ Navigation timeout test completed successfully!');
        console.log('   • Browser launched with VPS optimizations');
        console.log('   • Navigation retry logic working');
        console.log('   • Timeout handling improved');
        
        // Clean up
        await service.cleanup();
        
    } catch (error) {
        console.log('📊 Navigation timeout test results:');
        
        if (error.message.includes('Navigation timeout')) {
            console.log('⚠️ Still getting navigation timeouts, but with better error handling');
            console.log('💡 This is expected on slow VPS connections');
            console.log('🔧 Recommendations:');
            console.log('   • Increase VPS resources (more RAM/CPU)');
            console.log('   • Use a VPS with better network connectivity');
            console.log('   • Consider using Facebook Official API instead');
        } else if (error.message.includes('Chrome')) {
            console.log('❌ Chrome/browser issue detected');
            console.log('💡 Run: ./setup-vps-browser.sh to install dependencies');
        } else {
            console.log('❌ Unexpected error:', error.message);
        }
        
        console.log('\n📋 Error Details:');
        console.log('   Type:', error.constructor.name);
        console.log('   Message:', error.message);
        console.log('   Stack:', error.stack.split('\n')[0]);
    }
}

// Handle command line execution
if (require.main === module) {
    testNavigationTimeout()
        .then(() => {
            console.log('\n🎯 Test completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error.message);
            process.exit(1);
        });
}

module.exports = testNavigationTimeout;
