const FacebookBrowserService = require('./services/facebookBrowserService');

async function debugFacebookDOM() {
    console.log('🔍 Debugging Facebook DOM structure...');
    
    const browserService = new FacebookBrowserService(
        process.env.FACEBOOK_EMAIL,
        process.env.FACEBOOK_PASSWORD,
        process.env.FACEBOOK_APP_STATE
    );
    
    try {
        await browserService.initialize();
        
        const currentUrl = await browserService.page.url();
        console.log('📍 Current URL:', currentUrl);
        
        // Navigate to messages if not already there
        if (!currentUrl.includes('/messages')) {
            console.log('🔄 Navigating to messages...');
            await browserService.page.goto('https://www.facebook.com/messages', { waitUntil: 'networkidle0' });
            await browserService.page.waitForTimeout(3000);
        }
        
        // Analyze the DOM structure
        const domAnalysis = await browserService.page.evaluate(() => {
            const analysis = {
                url: window.location.href,
                title: document.title,
                allSelectors: {},
                textElements: [],
                linkElements: []
            };
            
            // Test all the selectors we're using
            const testSelectors = [
                '[role="gridcell"]',
                '[data-testid="conversation-list-item"]',
                '.conversation-list-item',
                '[data-testid="conversation-list"]',
                'a[href*="/t/"]',
                '[dir="auto"]',
                '[role="main"]',
                '[role="navigation"]',
                '[data-testid]',
                '.x1n2onr6',
                '[aria-label*="conversation"]',
                '[aria-label*="message"]'
            ];
            
            testSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    analysis.allSelectors[selector] = {
                        count: elements.length,
                        samples: Array.from(elements).slice(0, 3).map(el => ({
                            tag: el.tagName.toLowerCase(),
                            text: el.textContent ? el.textContent.trim().substring(0, 100) : '',
                            classes: el.className,
                            id: el.id,
                            href: el.href || '',
                            testId: el.getAttribute('data-testid'),
                            role: el.getAttribute('role'),
                            ariaLabel: el.getAttribute('aria-label')
                        }))
                    };
                } catch (error) {
                    analysis.allSelectors[selector] = { error: error.message };
                }
            });
            
            // Get all elements with meaningful text
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
                const text = el.textContent ? el.textContent.trim() : '';
                if (text && text.length > 3 && text.length < 200 && !text.includes('\\n')) {
                    analysis.textElements.push({
                        tag: el.tagName.toLowerCase(),
                        text: text.substring(0, 80),
                        classes: el.className.substring(0, 50),
                        testId: el.getAttribute('data-testid'),
                        role: el.getAttribute('role'),
                        parent: el.parentElement ? el.parentElement.tagName.toLowerCase() : ''
                    });
                }
            });
            
            // Get all links
            const links = document.querySelectorAll('a[href]');
            links.forEach(link => {
                if (link.href) {
                    analysis.linkElements.push({
                        href: link.href,
                        text: link.textContent ? link.textContent.trim().substring(0, 50) : '',
                        classes: link.className.substring(0, 50)
                    });
                }
            });
            
            // Limit arrays to prevent overwhelming output
            analysis.textElements = analysis.textElements.slice(0, 20);
            analysis.linkElements = analysis.linkElements.slice(0, 15);
            
            return analysis;
        });
        
        console.log('\\n📊 DOM ANALYSIS RESULTS:');
        console.log('URL:', domAnalysis.url);
        console.log('Title:', domAnalysis.title);
        
        console.log('\\n🔍 SELECTOR RESULTS:');
        Object.entries(domAnalysis.allSelectors).forEach(([selector, result]) => {
            if (result.error) {
                console.log(`❌ ${selector}: ERROR - ${result.error}`);
            } else if (result.count > 0) {
                console.log(`✅ ${selector}: ${result.count} elements`);
                result.samples.forEach((sample, i) => {
                    console.log(`   ${i + 1}. <${sample.tag}> "${sample.text}" ${sample.role ? `[role="${sample.role}"]` : ''} ${sample.testId ? `[data-testid="${sample.testId}"]` : ''}`);
                });
            } else {
                console.log(`⚪ ${selector}: 0 elements`);
            }
        });
        
        console.log('\\n📝 TEXT ELEMENTS (first 20):');
        domAnalysis.textElements.forEach((el, i) => {
            console.log(`${i + 1}. <${el.tag}> "${el.text}" ${el.role ? `[role="${el.role}"]` : ''} ${el.testId ? `[data-testid="${el.testId}"]` : ''}`);
        });
        
        console.log('\\n🔗 LINKS (first 15):');
        domAnalysis.linkElements.forEach((link, i) => {
            console.log(`${i + 1}. "${link.text}" -> ${link.href}`);
        });
        
        // Take a screenshot for visual debugging
        try {
            await browserService.page.screenshot({ 
                path: 'facebook-messages-debug.png', 
                fullPage: false,
                clip: { x: 0, y: 0, width: 1200, height: 800 }
            });
            console.log('\\n📸 Screenshot saved as facebook-messages-debug.png');
        } catch (screenshotError) {
            console.log('⚠️ Could not take screenshot:', screenshotError.message);
        }
        
        console.log('\\n⏳ Keeping browser open for 30 seconds for manual inspection...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    } finally {
        await browserService.stop();
        console.log('✅ Debug completed');
    }
}

debugFacebookDOM().catch(console.error);
