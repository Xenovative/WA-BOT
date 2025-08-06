/**
 * App State + Browser Emulation Optimizer
 * Combines the best of both approaches for maximum reliability
 */

const fs = require('fs').promises;
const path = require('path');

class AppStateBrowserOptimizer {
    /**
     * Validate and optimize app state for browser emulation
     */
    static validateAppStateForBrowser(appState) {
        try {
            const cookies = JSON.parse(appState);
            
            if (!Array.isArray(cookies)) {
                throw new Error('App state must be an array of cookies');
            }
            
            // Essential cookies for browser emulation
            const essentialCookies = ['c_user', 'xs', 'datr', 'sb'];
            const foundCookies = cookies.map(c => c.key);
            
            const missingCookies = essentialCookies.filter(name => !foundCookies.includes(name));
            
            if (missingCookies.length > 0) {
                console.log('⚠️ Missing essential cookies for browser emulation:', missingCookies);
                console.log('💡 App state may still work, but reliability could be reduced');
            }
            
            // Check for expired cookies
            const now = Date.now() / 1000;
            const expiredCookies = cookies.filter(cookie => {
                return cookie.expirationDate && cookie.expirationDate < now;
            });
            
            if (expiredCookies.length > 0) {
                console.log('⚠️ Found expired cookies:', expiredCookies.map(c => c.key));
                console.log('💡 Consider re-extracting app state from browser');
            }
            
            return {
                valid: true,
                cookieCount: cookies.length,
                essentialCookies: essentialCookies.filter(name => foundCookies.includes(name)),
                missingCookies,
                expiredCookies: expiredCookies.map(c => c.key),
                recommendations: this.getRecommendations(cookies)
            };
            
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                recommendations: ['Check app state format', 'Re-extract from browser']
            };
        }
    }
    
    /**
     * Get recommendations for app state optimization
     */
    static getRecommendations(cookies) {
        const recommendations = [];
        const cookieNames = cookies.map(c => c.key);
        
        // Check for security cookies
        if (!cookieNames.includes('datr')) {
            recommendations.push('Missing datr cookie - may affect login stability');
        }
        
        if (!cookieNames.includes('sb')) {
            recommendations.push('Missing sb cookie - may affect session persistence');
        }
        
        // Check for locale cookies
        if (!cookieNames.includes('locale')) {
            recommendations.push('Consider adding locale cookie for better compatibility');
        }
        
        // Check cookie domains
        const facebookDomains = ['.facebook.com', '.messenger.com'];
        const domainCoverage = facebookDomains.map(domain => {
            return cookies.some(cookie => cookie.domain === domain);
        });
        
        if (!domainCoverage.every(covered => covered)) {
            recommendations.push('Ensure cookies cover both facebook.com and messenger.com domains');
        }
        
        return recommendations;
    }
    
    /**
     * Optimize app state cookies for browser emulation
     */
    static optimizeAppStateForBrowser(appState) {
        try {
            const cookies = JSON.parse(appState);
            
            // Optimize cookies for browser emulation
            const optimizedCookies = cookies.map(cookie => {
                const optimized = { ...cookie };
                
                // Ensure proper domain settings
                if (!optimized.domain) {
                    optimized.domain = '.facebook.com';
                }
                
                // Ensure proper path settings
                if (!optimized.path) {
                    optimized.path = '/';
                }
                
                // Set security flags appropriately for browser emulation
                if (optimized.domain.includes('facebook.com')) {
                    optimized.secure = true;
                    optimized.sameSite = 'None';
                }
                
                return optimized;
            });
            
            // Add messenger.com domain cookies if missing
            const hasMessengerCookies = optimizedCookies.some(c => c.domain.includes('messenger.com'));
            if (!hasMessengerCookies) {
                // Duplicate essential cookies for messenger.com
                const essentialForMessenger = ['c_user', 'xs'];
                const messengerCookies = optimizedCookies
                    .filter(c => essentialForMessenger.includes(c.key))
                    .map(c => ({
                        ...c,
                        domain: '.messenger.com'
                    }));
                
                optimizedCookies.push(...messengerCookies);
            }
            
            return JSON.stringify(optimizedCookies, null, 2);
            
        } catch (error) {
            console.log('⚠️ Failed to optimize app state:', error.message);
            return appState; // Return original if optimization fails
        }
    }
    
    /**
     * Create browser-compatible session from app state
     */
    static async createBrowserSession(appState, userDataDir) {
        try {
            const cookies = JSON.parse(appState);
            const sessionFile = path.join(userDataDir, 'optimized_session.json');
            
            // Create optimized session data
            const sessionData = {
                cookies: cookies,
                timestamp: Date.now(),
                source: 'app_state',
                optimized: true,
                metadata: {
                    cookieCount: cookies.length,
                    domains: [...new Set(cookies.map(c => c.domain))],
                    essentialCookies: cookies.filter(c => ['c_user', 'xs', 'datr'].includes(c.key)).map(c => c.key)
                }
            };
            
            // Ensure directory exists
            await fs.mkdir(userDataDir, { recursive: true });
            
            // Save optimized session
            await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
            
            console.log('💾 Optimized browser session created');
            console.log('   • Cookie count:', sessionData.metadata.cookieCount);
            console.log('   • Domains:', sessionData.metadata.domains.join(', '));
            console.log('   • Essential cookies:', sessionData.metadata.essentialCookies.join(', '));
            
            return sessionFile;
            
        } catch (error) {
            console.log('⚠️ Failed to create browser session:', error.message);
            return null;
        }
    }
    
    /**
     * Test app state validity with browser emulation
     */
    static async testAppStateWithBrowser(appState, browserService) {
        console.log('🧪 Testing app state with browser emulation...');
        
        try {
            // Validate app state format
            const validation = this.validateAppStateForBrowser(appState);
            
            if (!validation.valid) {
                throw new Error(`Invalid app state: ${validation.error}`);
            }
            
            console.log('✅ App state format validation passed');
            console.log('   • Cookies found:', validation.cookieCount);
            console.log('   • Essential cookies:', validation.essentialCookies.join(', '));
            
            if (validation.missingCookies.length > 0) {
                console.log('⚠️ Missing cookies:', validation.missingCookies.join(', '));
            }
            
            // Test with browser (if provided)
            if (browserService && browserService.page) {
                console.log('🌐 Testing cookies in browser...');
                
                const cookies = JSON.parse(appState);
                
                // Navigate to Facebook
                await browserService.navigateWithRetry('https://facebook.com');
                
                // Set cookies
                for (const cookie of cookies) {
                    try {
                        await browserService.page.setCookie({
                            name: cookie.key,
                            value: cookie.value,
                            domain: cookie.domain || '.facebook.com',
                            path: cookie.path || '/',
                            httpOnly: cookie.httpOnly || false,
                            secure: cookie.secure || false
                        });
                    } catch (cookieError) {
                        console.log(`⚠️ Failed to set cookie ${cookie.key}:`, cookieError.message);
                    }
                }
                
                // Test login status
                await browserService.page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
                
                const isLoggedIn = await browserService.page.evaluate(() => {
                    return !document.querySelector('input[name="email"]') && 
                           !document.querySelector('input[name="pass"]');
                });
                
                if (isLoggedIn) {
                    console.log('✅ App state + browser emulation test successful!');
                    return { success: true, loggedIn: true };
                } else {
                    console.log('⚠️ App state cookies did not establish login session');
                    return { success: false, loggedIn: false, reason: 'Cookies did not establish session' };
                }
            }
            
            return { success: true, validation };
            
        } catch (error) {
            console.log('❌ App state + browser test failed:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get configuration for optimal app state + browser combination
     */
    static getOptimalConfiguration() {
        return {
            browserSettings: {
                headless: 'new', // Use new headless mode
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding'
                ],
                defaultViewport: { width: 1366, height: 768 }
            },
            navigationSettings: {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            },
            sessionSettings: {
                saveSession: true,
                sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
                cookieOptimization: true
            },
            recommendations: [
                'Use app state for authentication (most reliable)',
                'Enable session saving for persistence',
                'Use domcontentloaded for faster navigation',
                'Set 60-second timeouts for VPS compatibility',
                'Enable cookie optimization for better compatibility'
            ]
        };
    }
}

module.exports = AppStateBrowserOptimizer;
