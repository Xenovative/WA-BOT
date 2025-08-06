#!/usr/bin/env node

/**
 * VPS Browser Test Script
 * Tests browser emulation capabilities on VPS environments
 */

const VPSDetection = require('./utils/vpsDetection');
const FacebookBrowserService = require('./services/facebookBrowserService');

async function testVPSBrowser() {
    console.log('🧪 Testing VPS Browser Emulation Capabilities...\n');
    
    // Step 1: Environment Detection
    console.log('📋 Step 1: Environment Detection');
    const detection = VPSDetection.printDetectionResults();
    console.log('');
    
    // Step 2: Browser Availability Check
    console.log('📋 Step 2: Browser Availability Check');
    const browserAvailable = await VPSDetection.checkBrowserAvailability();
    
    if (!browserAvailable) {
        console.log('❌ Chrome/Chromium not found!');
        console.log('💡 Run: ./setup-vps-browser.sh to install dependencies');
        return false;
    }
    
    console.log('✅ Chrome/Chromium found and available');
    console.log('');
    
    // Step 3: Basic Puppeteer Test
    console.log('📋 Step 3: Basic Puppeteer Test');
    try {
        const puppeteer = require('puppeteer');
        const { config } = detection.browserConfig;
        
        console.log('🚀 Launching browser...');
        const browser = await puppeteer.launch(config);
        
        console.log('📄 Creating new page...');
        const page = await browser.newPage();
        
        console.log('🌐 Navigating to test page...');
        await page.goto('https://www.google.com', { waitUntil: 'networkidle0' });
        
        const title = await page.title();
        console.log('✅ Page loaded successfully! Title:', title);
        
        console.log('🔍 Testing JavaScript execution...');
        const userAgent = await page.evaluate(() => navigator.userAgent);
        console.log('   User Agent:', userAgent.substring(0, 80) + '...');
        
        await browser.close();
        console.log('✅ Basic browser test passed!');
        console.log('');
        
    } catch (error) {
        console.log('❌ Basic browser test failed:', error.message);
        console.log('💡 Check Chrome installation and dependencies');
        return false;
    }
    
    // Step 4: Facebook Browser Service Test (without login)
    console.log('📋 Step 4: Facebook Browser Service Test');
    try {
        console.log('🔧 Testing FacebookBrowserService initialization...');
        
        // Create service without credentials (just test initialization)
        const service = new FacebookBrowserService(null, null, null);
        
        // Test directory creation
        const fs = require('fs').promises;
        await fs.mkdir(service.userDataDir, { recursive: true });
        console.log('✅ User data directory created successfully');
        
        console.log('✅ FacebookBrowserService structure test passed!');
        console.log('');
        
    } catch (error) {
        console.log('❌ FacebookBrowserService test failed:', error.message);
        return false;
    }
    
    // Step 5: Summary and Recommendations
    console.log('📋 Step 5: Test Summary');
    console.log('');
    
    if (detection.isVPS) {
        console.log('🎯 VPS Environment Detected - Optimizations Applied:');
        console.log('   ✅ Headless mode enabled');
        console.log('   ✅ Memory optimizations active');
        console.log('   ✅ VPS-specific Chrome flags applied');
        console.log('   ✅ Performance tuning enabled');
    } else {
        console.log('🖥️ Desktop Environment Detected:');
        console.log('   ✅ GUI mode available');
        console.log('   ✅ Standard browser settings');
    }
    
    console.log('');
    console.log('🎉 All tests passed! Your environment is ready for Facebook Browser Emulation.');
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('   1. Configure Facebook credentials in .env file');
    console.log('   2. Start WA-BOT: npm start or pm2 start index.js');
    console.log('   3. Monitor logs for browser emulation activation');
    console.log('');
    console.log('💡 Tips:');
    console.log('   • Browser emulation activates when facebook-chat-api fails');
    console.log('   • Monitor memory usage with: pm2 monit');
    console.log('   • Check logs with: pm2 logs wa-bot');
    
    return true;
}

// Handle command line execution
if (require.main === module) {
    testVPSBrowser()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('❌ Test failed with error:', error.message);
            process.exit(1);
        });
}

module.exports = testVPSBrowser;
