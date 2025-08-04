#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();

/**
 * Facebook Cookie Extractor for WA-BOT
 * Extracts Facebook session cookies from local browser databases
 */

class FacebookCookieExtractor {
    constructor() {
        this.requiredCookies = ['c_user', 'xs', 'datr', 'sb'];
        this.browsers = {
            chrome: this.getChromeProfile(),
            edge: this.getEdgeProfile(),
            firefox: this.getFirefoxProfile()
        };
    }

    getChromeProfile() {
        const platform = os.platform();
        let profilePath;
        
        if (platform === 'win32') {
            profilePath = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default');
        } else if (platform === 'darwin') {
            profilePath = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Default');
        } else {
            profilePath = path.join(os.homedir(), '.config', 'google-chrome', 'Default');
        }
        
        return {
            name: 'Chrome',
            cookiesPath: path.join(profilePath, 'Cookies'),
            query: `SELECT name, value, host_key, path, expires_utc, is_secure, is_httponly 
                   FROM cookies 
                   WHERE host_key LIKE '%facebook.com' 
                   AND name IN ('c_user', 'xs', 'datr', 'sb')`
        };
    }

    getEdgeProfile() {
        const platform = os.platform();
        let profilePath;
        
        if (platform === 'win32') {
            profilePath = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default');
        } else if (platform === 'darwin') {
            profilePath = path.join(os.homedir(), 'Library', 'Application Support', 'Microsoft Edge', 'Default');
        } else {
            profilePath = path.join(os.homedir(), '.config', 'microsoft-edge', 'Default');
        }
        
        return {
            name: 'Edge',
            cookiesPath: path.join(profilePath, 'Cookies'),
            query: `SELECT name, value, host_key, path, expires_utc, is_secure, is_httponly 
                   FROM cookies 
                   WHERE host_key LIKE '%facebook.com' 
                   AND name IN ('c_user', 'xs', 'datr', 'sb')`
        };
    }

    getFirefoxProfile() {
        const platform = os.platform();
        let profilesPath;
        
        if (platform === 'win32') {
            profilesPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
        } else if (platform === 'darwin') {
            profilesPath = path.join(os.homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles');
        } else {
            profilesPath = path.join(os.homedir(), '.mozilla', 'firefox');
        }
        
        return {
            name: 'Firefox',
            profilesPath: profilesPath,
            query: `SELECT name, value, host, path, expiry, isSecure, isHttpOnly 
                   FROM moz_cookies 
                   WHERE host LIKE '%facebook.com' 
                   AND name IN ('c_user', 'xs', 'datr', 'sb')`
        };
    }

    async extractFromChrome() {
        return this.extractFromChromiumBrowser(this.browsers.chrome);
    }

    async extractFromEdge() {
        return this.extractFromChromiumBrowser(this.browsers.edge);
    }

    async extractFromChromiumBrowser(browser) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(browser.cookiesPath)) {
                resolve({ success: false, error: `${browser.name} cookies database not found` });
                return;
            }

            // Copy the cookies file to avoid locking issues
            const tempPath = browser.cookiesPath + '.temp';
            try {
                fs.copyFileSync(browser.cookiesPath, tempPath);
            } catch (error) {
                resolve({ success: false, error: `Cannot access ${browser.name} cookies (browser may be open)` });
                return;
            }

            const db = new sqlite3.Database(tempPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    resolve({ success: false, error: `Cannot open ${browser.name} database: ${err.message}` });
                    return;
                }

                db.all(browser.query, [], (err, rows) => {
                    if (err) {
                        resolve({ success: false, error: `Database query failed: ${err.message}` });
                        return;
                    }

                    const cookies = rows.map(row => ({
                        key: row.name,
                        value: row.value,
                        domain: row.host_key.startsWith('.') ? row.host_key : '.facebook.com'
                    }));

                    db.close();
                    
                    // Clean up temp file
                    try {
                        fs.unlinkSync(tempPath);
                    } catch (e) {}

                    resolve({ success: true, cookies, browser: browser.name });
                });
            });
        });
    }

    async extractFromFirefox() {
        return new Promise((resolve, reject) => {
            const browser = this.browsers.firefox;
            
            if (!fs.existsSync(browser.profilesPath)) {
                resolve({ success: false, error: 'Firefox profiles directory not found' });
                return;
            }

            // Find default profile
            let profilePath = null;
            const profiles = fs.readdirSync(browser.profilesPath);
            
            for (const profile of profiles) {
                if (profile.includes('default') || profile.endsWith('.default-release')) {
                    profilePath = path.join(browser.profilesPath, profile);
                    break;
                }
            }

            if (!profilePath) {
                resolve({ success: false, error: 'Firefox default profile not found' });
                return;
            }

            const cookiesPath = path.join(profilePath, 'cookies.sqlite');
            if (!fs.existsSync(cookiesPath)) {
                resolve({ success: false, error: 'Firefox cookies database not found' });
                return;
            }

            // Copy the cookies file to avoid locking issues
            const tempPath = cookiesPath + '.temp';
            try {
                fs.copyFileSync(cookiesPath, tempPath);
            } catch (error) {
                resolve({ success: false, error: 'Cannot access Firefox cookies (browser may be open)' });
                return;
            }

            const db = new sqlite3.Database(tempPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    resolve({ success: false, error: `Cannot open Firefox database: ${err.message}` });
                    return;
                }

                db.all(browser.query, [], (err, rows) => {
                    if (err) {
                        resolve({ success: false, error: `Database query failed: ${err.message}` });
                        return;
                    }

                    const cookies = rows.map(row => ({
                        key: row.name,
                        value: row.value,
                        domain: row.host.startsWith('.') ? row.host : '.facebook.com'
                    }));

                    db.close();
                    
                    // Clean up temp file
                    try {
                        fs.unlinkSync(tempPath);
                    } catch (e) {}

                    resolve({ success: true, cookies, browser: 'Firefox' });
                });
            });
        });
    }

    validateCookies(cookies) {
        const foundCookies = cookies.map(c => c.key);
        const missing = this.requiredCookies.filter(required => !foundCookies.includes(required));
        
        return {
            isValid: missing.length === 0,
            missing: missing,
            found: foundCookies
        };
    }

    formatAppState(cookies) {
        return JSON.stringify(cookies);
    }

    async extractAll() {
        console.log('🔍 Facebook Cookie Extractor for WA-BOT');
        console.log('=====================================\n');

        const results = [];
        
        // Try Chrome
        console.log('📱 Checking Chrome...');
        const chromeResult = await this.extractFromChrome();
        results.push(chromeResult);
        
        if (chromeResult.success) {
            const validation = this.validateCookies(chromeResult.cookies);
            console.log(`✅ Found ${chromeResult.cookies.length} Facebook cookies in Chrome`);
            if (!validation.isValid) {
                console.log(`⚠️  Missing cookies: ${validation.missing.join(', ')}`);
            }
        } else {
            console.log(`❌ Chrome: ${chromeResult.error}`);
        }

        // Try Edge
        console.log('\n🌐 Checking Edge...');
        const edgeResult = await this.extractFromEdge();
        results.push(edgeResult);
        
        if (edgeResult.success) {
            const validation = this.validateCookies(edgeResult.cookies);
            console.log(`✅ Found ${edgeResult.cookies.length} Facebook cookies in Edge`);
            if (!validation.isValid) {
                console.log(`⚠️  Missing cookies: ${validation.missing.join(', ')}`);
            }
        } else {
            console.log(`❌ Edge: ${edgeResult.error}`);
        }

        // Try Firefox
        console.log('\n🦊 Checking Firefox...');
        const firefoxResult = await this.extractFromFirefox();
        results.push(firefoxResult);
        
        if (firefoxResult.success) {
            const validation = this.validateCookies(firefoxResult.cookies);
            console.log(`✅ Found ${firefoxResult.cookies.length} Facebook cookies in Firefox`);
            if (!validation.isValid) {
                console.log(`⚠️  Missing cookies: ${validation.missing.join(', ')}`);
            }
        } else {
            console.log(`❌ Firefox: ${firefoxResult.error}`);
        }

        // Find best result
        const validResults = results.filter(r => {
            if (!r.success) return false;
            const validation = this.validateCookies(r.cookies);
            return validation.isValid;
        });

        if (validResults.length === 0) {
            console.log('\n❌ No complete Facebook sessions found in any browser');
            console.log('\n💡 Make sure you:');
            console.log('   1. Are logged into Facebook in your browser');
            console.log('   2. Have closed your browser completely');
            console.log('   3. Run this script as administrator (if needed)');
            return null;
        }

        // Use the first valid result
        const bestResult = validResults[0];
        const appState = this.formatAppState(bestResult.cookies);

        console.log(`\n🎉 Successfully extracted Facebook App State from ${bestResult.browser}!`);
        console.log('\n📋 Your Facebook App State:');
        console.log('=' .repeat(50));
        console.log(appState);
        console.log('=' .repeat(50));

        console.log('\n📝 Add this to your .env file:');
        console.log(`FACEBOOK_APP_STATE=${appState}`);

        // Optionally write to file
        const envPath = path.join(__dirname, '..', '.env');
        if (fs.existsSync(envPath)) {
            console.log('\n💾 Would you like to automatically add this to your .env file? (y/n)');
            // For now, just show the instruction
            console.log('   Copy the line above and paste it into your .env file');
        }

        return appState;
    }
}

// Run the extractor
if (require.main === module) {
    const extractor = new FacebookCookieExtractor();
    extractor.extractAll().catch(console.error);
}

module.exports = FacebookCookieExtractor;
