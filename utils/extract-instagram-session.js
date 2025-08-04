const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Instagram Session Extractor
 * Extracts session ID from a local browser or via automated login
 */
class InstagramSessionExtractor {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    /**
     * Extract session ID using automated browser login
     * @param {string} username - Instagram username
     * @param {string} password - Instagram password
     * @param {Object} options - Options for extraction
     * @returns {Promise<string|null>} Session ID or null if failed
     */
    async extractWithLogin(username, password, options = {}) {
        const {
            headless = false, // Show browser for debugging
            timeout = 30000,
            userDataDir = null // Use persistent browser profile
        } = options;

        try {
            console.log('🚀 Starting Instagram session extraction...');
            
            // Launch browser
            const browserOptions = {
                headless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            };

            if (userDataDir) {
                browserOptions.userDataDir = userDataDir;
            }

            this.browser = await puppeteer.launch(browserOptions);
            this.page = await this.browser.newPage();

            // Set realistic user agent
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Set viewport
            await this.page.setViewport({ width: 1366, height: 768 });

            console.log('📱 Navigating to Instagram...');
            await this.page.goto('https://www.instagram.com/accounts/login/', {
                waitUntil: 'networkidle2',
                timeout
            });

            // Wait for login form
            console.log('⏳ Waiting for login form...');
            await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });

            // Fill login form
            console.log('📝 Filling login credentials...');
            await this.page.type('input[name="username"]', username, { delay: 100 });
            await this.page.type('input[name="password"]', password, { delay: 100 });

            // Click login button
            console.log('🔐 Logging in...');
            await Promise.all([
                this.page.click('button[type="submit"]'),
                this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout })
            ]);

            // Check if login was successful
            const currentUrl = this.page.url();
            if (currentUrl.includes('/accounts/login/')) {
                throw new Error('Login failed - still on login page');
            }

            // Handle potential 2FA or security check
            if (currentUrl.includes('/challenge/')) {
                console.log('🛡️ Security challenge detected. Please complete it manually...');
                console.log('Waiting for manual intervention...');
                
                // Wait for user to complete challenge
                await this.page.waitForFunction(
                    () => !window.location.href.includes('/challenge/'),
                    { timeout: 120000 } // 2 minutes
                );
            }

            // Extract session ID from cookies
            console.log('🍪 Extracting session ID...');
            const cookies = await this.page.cookies();
            const sessionCookie = cookies.find(cookie => cookie.name === 'sessionid');

            if (!sessionCookie) {
                throw new Error('Session ID not found in cookies');
            }

            console.log('✅ Session ID extracted successfully!');
            return sessionCookie.value;

        } catch (error) {
            console.error('❌ Failed to extract session ID:', error.message);
            return null;
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    /**
     * Extract session ID from existing browser profile
     * @param {string} profilePath - Path to browser profile
     * @returns {Promise<string|null>} Session ID or null if failed
     */
    async extractFromProfile(profilePath) {
        try {
            console.log('🔍 Extracting session from browser profile...');
            
            this.browser = await puppeteer.launch({
                headless: true,
                userDataDir: profilePath,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            this.page = await this.browser.newPage();
            await this.page.goto('https://www.instagram.com', { waitUntil: 'networkidle2' });

            const cookies = await this.page.cookies();
            const sessionCookie = cookies.find(cookie => cookie.name === 'sessionid');

            if (sessionCookie) {
                console.log('✅ Session ID found in profile!');
                return sessionCookie.value;
            } else {
                console.log('❌ No session ID found in profile');
                return null;
            }

        } catch (error) {
            console.error('❌ Failed to extract from profile:', error.message);
            return null;
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    /**
     * Validate a session ID by testing it
     * @param {string} sessionId - Session ID to validate
     * @returns {Promise<boolean>} True if valid, false otherwise
     */
    async validateSession(sessionId) {
        try {
            console.log('🧪 Validating session ID...');
            
            this.browser = await puppeteer.launch({ headless: true });
            this.page = await this.browser.newPage();

            // Set the session cookie
            await this.page.setCookie({
                name: 'sessionid',
                value: sessionId,
                domain: '.instagram.com',
                path: '/',
                httpOnly: true,
                secure: true
            });

            // Try to access Instagram
            await this.page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });

            // Check if we're logged in (look for profile elements)
            const isLoggedIn = await this.page.evaluate(() => {
                // Look for elements that indicate we're logged in
                return !!(
                    document.querySelector('[aria-label="Home"]') ||
                    document.querySelector('[data-testid="user-avatar"]') ||
                    document.querySelector('a[href="/direct/inbox/"]')
                );
            });

            console.log(isLoggedIn ? '✅ Session is valid!' : '❌ Session is invalid');
            return isLoggedIn;

        } catch (error) {
            console.error('❌ Failed to validate session:', error.message);
            return false;
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    /**
     * Save session ID to environment file
     * @param {string} sessionId - Session ID to save
     * @param {string} envPath - Path to .env file
     */
    saveToEnv(sessionId, envPath = '.env') {
        try {
            let envContent = '';
            
            // Read existing .env file
            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf8');
            }

            // Update or add INSTAGRAM_SESSION_ID
            const sessionLine = `INSTAGRAM_SESSION_ID=${sessionId}`;
            
            if (envContent.includes('INSTAGRAM_SESSION_ID=')) {
                // Replace existing line
                envContent = envContent.replace(/INSTAGRAM_SESSION_ID=.*/, sessionLine);
            } else {
                // Add new line
                envContent += envContent.endsWith('\n') ? sessionLine + '\n' : '\n' + sessionLine + '\n';
            }

            fs.writeFileSync(envPath, envContent);
            console.log('✅ Session ID saved to .env file');
            
        } catch (error) {
            console.error('❌ Failed to save session to .env:', error.message);
        }
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const extractor = new InstagramSessionExtractor();

    if (args.length < 2) {
        console.log(`
🔑 Instagram Session Extractor

Usage:
  node extract-instagram-session.js <username> <password> [options]

Options:
  --headless=false    Show browser window (default: false)
  --timeout=30000     Timeout in milliseconds (default: 30000)
  --save-env          Save session to .env file
  --validate          Validate the extracted session

Examples:
  node extract-instagram-session.js myuser mypass --save-env
  node extract-instagram-session.js myuser mypass --headless=true --validate
        `);
        process.exit(1);
    }

    const [username, password] = args;
    const options = {
        headless: args.includes('--headless=true'),
        timeout: parseInt(args.find(arg => arg.startsWith('--timeout='))?.split('=')[1]) || 30000
    };

    (async () => {
        try {
            const sessionId = await extractor.extractWithLogin(username, password, options);
            
            if (sessionId) {
                console.log('\n🎉 SUCCESS!');
                console.log('Session ID:', sessionId);
                
                if (args.includes('--validate')) {
                    const isValid = await extractor.validateSession(sessionId);
                    console.log('Validation:', isValid ? '✅ Valid' : '❌ Invalid');
                }
                
                if (args.includes('--save-env')) {
                    extractor.saveToEnv(sessionId);
                }
                
            } else {
                console.log('\n❌ FAILED to extract session ID');
                process.exit(1);
            }
            
        } catch (error) {
            console.error('\n💥 ERROR:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = InstagramSessionExtractor;
