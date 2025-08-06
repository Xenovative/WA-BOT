const FacebookBrowserService = require('./services/facebookBrowserService');

async function testFacebookConversation() {
    console.log('🧪 Testing Facebook Conversation Navigation...');
    
    const browserService = new FacebookBrowserService(
        process.env.FACEBOOK_EMAIL,
        process.env.FACEBOOK_PASSWORD,
        process.env.FACEBOOK_APP_STATE
    );
    
    try {
        // Initialize browser
        await browserService.initialize();
        
        // Check current page
        const currentUrl = await browserService.page.url();
        console.log('📍 Current URL:', currentUrl);
        
        // Get page title
        const title = await browserService.page.title();
        console.log('📄 Page title:', title);
        
        // Check if we're on messenger list page
        if (currentUrl.includes('/messages') || currentUrl.includes('messenger.com')) {
            console.log('✅ We are on Messenger');
            
            // Look for conversation threads
            const conversations = await browserService.page.evaluate(() => {
                // Try different selectors for conversation threads
                const selectors = [
                    '[role="gridcell"] [role="link"]',
                    '[data-testid="conversation-list"] [role="link"]',
                    'a[href*="/t/"]',
                    '[aria-label*="conversation"]'
                ];
                
                let foundConversations = [];
                
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        console.log(`Found ${elements.length} conversations with selector: ${selector}`);
                        
                        elements.forEach((el, i) => {
                            if (i < 5) { // Only check first 5
                                const text = el.textContent ? el.textContent.trim() : '';
                                const href = el.href || '';
                                foundConversations.push({
                                    text: text.substring(0, 50),
                                    href: href,
                                    selector: selector
                                });
                            }
                        });
                        break;
                    }
                }
                
                return foundConversations;
            });
            
            console.log('💬 Found conversations:', conversations.length);
            conversations.forEach((conv, i) => {
                console.log(`   ${i + 1}. "${conv.text}" - ${conv.href}`);
            });
            
            // Try to click on first conversation
            if (conversations.length > 0) {
                console.log('🎯 Clicking on first conversation...');
                
                try {
                    await browserService.page.click(`a[href="${conversations[0].href}"]`);
                    await browserService.page.waitForTimeout(3000);
                    
                    const newUrl = await browserService.page.url();
                    console.log('📍 New URL after click:', newUrl);
                    
                    // Now check for messages in this conversation
                    console.log('🔍 Looking for messages in conversation...');
                    
                    const messages = await browserService.page.evaluate(() => {
                        const messageSelectors = [
                            '[data-testid="message-container"]',
                            '[role="gridcell"] [dir="auto"]',
                            '.message [dir="auto"]',
                            '[data-scope="messages_table"] [dir="auto"]'
                        ];
                        
                        let allMessages = [];
                        
                        for (const selector of messageSelectors) {
                            const elements = document.querySelectorAll(selector);
                            if (elements.length > 0) {
                                console.log(`Found ${elements.length} message elements with: ${selector}`);
                                
                                elements.forEach((el, i) => {
                                    if (i < 10) { // Only check first 10
                                        const text = el.textContent ? el.textContent.trim() : '';
                                        if (text && text.length > 2) {
                                            allMessages.push({
                                                text: text.substring(0, 100),
                                                selector: selector
                                            });
                                        }
                                    }
                                });
                                break;
                            }
                        }
                        
                        return allMessages;
                    });
                    
                    console.log('💬 Messages found in conversation:', messages.length);
                    messages.forEach((msg, i) => {
                        console.log(`   ${i + 1}. "${msg.text}"`);
                    });
                    
                } catch (clickError) {
                    console.log('❌ Failed to click conversation:', clickError.message);
                }
            }
            
        } else {
            console.log('❌ Not on Messenger page');
        }
        
        // Keep browser open for manual inspection
        console.log('🔍 Browser will stay open for 30 seconds for manual inspection...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browserService.stop();
        console.log('✅ Test completed');
    }
}

// Run the test
testFacebookConversation().catch(console.error);
