/**
 * VPS Environment Detection and Configuration
 */

const os = require('os');
const fs = require('fs');

class VPSDetection {
    /**
     * Detect if running on VPS environment
     */
    static isVPS() {
        const platform = process.platform;
        const hasDisplay = !!process.env.DISPLAY;
        const isSSH = !!process.env.SSH_CONNECTION || !!process.env.SSH_CLIENT;
        const isContainer = fs.existsSync('/.dockerenv');
        
        // Check for common VPS indicators
        const vpsIndicators = [
            !hasDisplay && platform === 'linux',
            isSSH,
            isContainer,
            process.env.USER === 'root',
            process.env.HOME === '/root',
            os.hostname().includes('vps'),
            os.hostname().includes('server'),
            // Check for common VPS providers
            fs.existsSync('/etc/cloud') || fs.existsSync('/var/lib/cloud'),
            // DigitalOcean
            os.hostname().includes('droplet'),
            // AWS
            os.hostname().includes('ec2'),
            // Google Cloud
            os.hostname().includes('gce'),
            // Azure
            os.hostname().includes('azure')
        ];
        
        return vpsIndicators.some(indicator => indicator);
    }
    
    /**
     * Get optimized browser configuration for VPS
     */
    static getBrowserConfig() {
        const isVPS = this.isVPS();
        const platform = process.platform;
        
        const baseConfig = {
            headless: isVPS ? 'new' : false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security'
            ]
        };
        
        if (isVPS) {
            // VPS-optimized settings
            baseConfig.args.push(
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-default-apps',
                '--disable-background-networking',
                '--disable-sync',
                '--metrics-recording-only',
                '--safebrowsing-disable-auto-update',
                '--disable-component-update',
                '--disable-domain-reliability',
                '--disable-features=VizDisplayCompositor,TranslateUI',
                '--memory-pressure-off',
                '--max_old_space_size=4096'
            );
            
            // Memory optimization
            baseConfig.defaultViewport = { width: 1280, height: 720 };
            baseConfig.ignoreDefaultArgs = ['--disable-extensions'];
        }
        
        return { isVPS, platform, config: baseConfig };
    }
    
    /**
     * Check if Chrome/Chromium is available
     */
    static async checkBrowserAvailability() {
        const puppeteer = require('puppeteer');
        
        try {
            // Try to find Chrome executable
            const executablePath = puppeteer.executablePath();
            console.log('🌐 Chrome executable found:', executablePath);
            return true;
        } catch (error) {
            console.log('⚠️ Chrome executable not found:', error.message);
            return false;
        }
    }
    
    /**
     * Get system information for debugging
     */
    static getSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            memory: {
                total: Math.round(os.totalmem() / 1024 / 1024) + 'MB',
                free: Math.round(os.freemem() / 1024 / 1024) + 'MB'
            },
            cpus: os.cpus().length,
            hostname: os.hostname(),
            uptime: Math.round(os.uptime() / 60) + ' minutes',
            environment: {
                display: process.env.DISPLAY || 'none',
                ssh: !!(process.env.SSH_CONNECTION || process.env.SSH_CLIENT),
                user: process.env.USER || process.env.USERNAME,
                home: process.env.HOME || process.env.USERPROFILE
            }
        };
    }
    
    /**
     * Print VPS detection results
     */
    static printDetectionResults() {
        const isVPS = this.isVPS();
        const systemInfo = this.getSystemInfo();
        const browserConfig = this.getBrowserConfig();
        
        console.log('🔍 VPS Detection Results:');
        console.log('   • Is VPS:', isVPS ? '✅ Yes' : '❌ No');
        console.log('   • Platform:', systemInfo.platform);
        console.log('   • Architecture:', systemInfo.arch);
        console.log('   • Memory:', systemInfo.memory.total, '(', systemInfo.memory.free, 'free)');
        console.log('   • CPUs:', systemInfo.cpus);
        console.log('   • Display:', systemInfo.environment.display);
        console.log('   • SSH Connection:', systemInfo.environment.ssh ? '✅ Yes' : '❌ No');
        console.log('   • Browser Mode:', browserConfig.config.headless ? 'Headless' : 'GUI');
        console.log('   • Hostname:', systemInfo.hostname);
        
        return { isVPS, systemInfo, browserConfig };
    }
}

module.exports = VPSDetection;
