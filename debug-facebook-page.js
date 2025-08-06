const FacebookBrowserService = require('./services/facebookBrowserService');

async function debugFacebookPage() {
    console.log('🔍 Debugging Facebook page structure...');
    
    const browserService = new FacebookBrowserService(
        process.env.FACEBOOK_EMAIL,
        process.env.FACEBOOK_PASSWORD,
        process.env.FACEBOOK_APP_STATE
    );
    
    try {
        // Initialize browser
        await browserService.initialize();
        
        // Get current page info
        const currentUrl = await browserService.page.url();
        const title = await browserService.page.title();
        
        console.log('📍 Current URL:', currentUrl);
        console.log('📄 Page title:', title);
        
        // Take a screenshot for debugging
        try {
            await browserService.page.screenshot({ path: 'facebook-debug.png', fullPage: false });
            console.log('📸 Screenshot saved as facebook-debug.png');
        } catch (screenshotError) {
            console.log('⚠️ Could not take screenshot:', screenshotError.message);
        }
        
        // Check what elements are available on the page
        const pageAnalysis = await browserService.page.evaluate(() => {
            const analysis = {
                url: window.location.href,
                title: document.title,
                hasMessenger: window.location.href.includes('messenger') || window.location.href.includes('/messages'),
                conversationElements: [],
                allElements: []
            };
            
            // Look for conversation-related elements
            const conversationSelectors = [
                '[role="gridcell"]',
                '[data-testid="conversation-list-item"]',
                '.conversation-list-item',
                '[data-testid="conversation-list"]',
                'a[href*="/t/"]'
            ];
            
            conversationSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    analysis.conversationElements.push({
                        selector: selector,
                        count: elements.length,
                        samples: Array.from(elements).slice(0, 3).map(el => ({
                            text: el.textContent ? el.textContent.trim().substring(0, 100) : '',
                            href: el.href || (el.querySelector('a') ? el.querySelector('a').href : ''),
                            hasUnread: !!(el.querySelector('[data-testid="unread-count"]') || 
                                         el.querySelector('.unread-count') ||
                                         el.querySelector('[aria-label*="unread"]'))
                        }))
                    });
                }
            });
            
            // Get all elements with text content
            const allTextElements = document.querySelectorAll('*');
            const textElements = [];
            
            allTextElements.forEach(el => {
                const text = el.textContent ? el.textContent.trim() : '';
                if (text && text.length > 2 && text.length < 200 && !text.includes('\\n')) {
                    textElements.push({
                        tag: el.tagName.toLowerCase(),
                        text: text.substring(0, 50),
                        hasDir: el.hasAttribute('dir'),
                        role: el.getAttribute('role'),
                        testId: el.getAttribute('data-testid')
                    });
                }
            });
            
            analysis.allElements = textElements.slice(0, 20); // First 20 text elements
            
            return analysis;
        });
        
        console.log('\\n🔍 PAGE ANALYSIS:');
        console.log('   URL:', pageAnalysis.url);
        console.log('   Title:', pageAnalysis.title);
        console.log('   Is Messenger Page:', pageAnalysis.hasMessenger);
        
        console.log('\\n💬 CONVERSATION ELEMENTS FOUND:');
        if (pageAnalysis.conversationElements.length === 0) {
            console.log('   ❌ No conversation elements found');
        } else {
            pageAnalysis.conversationElements.forEach(element => {
                console.log(`   ✅ ${element.selector}: ${element.count} elements`);
                element.samples.forEach((sample, i) => {
                    console.log(`      ${i + 1}. "${sample.text}" - Unread: ${sample.hasUnread}`);
                });
            });
        }
        
        console.log('\\n📝 SAMPLE TEXT ELEMENTS:');
        pageAnalysis.allElements.forEach((el, i) => {
            console.log(`   ${i + 1}. <${el.tag}> "${el.text}" ${el.role ? `[role="${el.role}"]` : ''} ${el.testId ? `[data-testid="${el.testId}"]` : ''}`);
        });
        
        // Try to navigate to messenger if not already there
        if (!pageAnalysis.hasMessenger) {
            console.log('\\n🔄 Not on messenger page, trying to navigate...');
            
            try {
                await browserService.page.goto('https://www.messenger.com', { waitUntil: 'networkidle0', timeout: 15000 });
                await browserService.page.waitForTimeout(3000);
                
                const newUrl = await browserService.page.url();
                console.log('✅ Navigated to:', newUrl);
                
                // Re-analyze after navigation
                const newAnalysis = await browserService.page.evaluate(() => {
                    const elements = document.querySelectorAll('[role="gridcell"]');
                    return {
                        conversationCount: elements.length,
                        samples: Array.from(elements).slice(0, 3).map(el => el.textContent ? el.textContent.trim().substring(0, 100) : '')
                    };
                });
                
                console.log('🔍 After navigation:');
                console.log('   Conversations found:', newAnalysis.conversationCount);
                newAnalysis.samples.forEach((sample, i) => {
                    console.log(`   ${i + 1}. "${sample}"`);
                });
                
            } catch (navError) {
                console.log('❌ Navigation failed:', navError.message);
            }
        }
        
        // Keep browser open for manual inspection
        console.log('\\n⏳ Browser will stay open for 60 seconds for manual inspection...');
        console.log('   You can manually check the page and send a test message');
        await new Promise(resolve => setTimeout(resolve, 60000));
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    } finally {
        await browserService.stop();
        console.log('✅ Debug completed');
    }
}

// Run the debug
debugFacebookPage().catch(console.error);
