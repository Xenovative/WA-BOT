#!/bin/bash

echo "🚀 Setting up VPS environment for Facebook Browser Emulation..."

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Linux detected"
    
    # Update package list
    echo "📦 Updating package list..."
    sudo apt-get update -y
    
    # Install Chrome dependencies
    echo "🌐 Installing Chrome dependencies..."
    sudo apt-get install -y \
        wget \
        gnupg \
        ca-certificates \
        apt-transport-https \
        software-properties-common \
        curl \
        unzip \
        fontconfig \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libatspi2.0-0 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxkbcommon0 \
        libxrandr2 \
        xdg-utils \
        libu2f-udev \
        libvulkan1
    
    # Add Google Chrome repository
    echo "🔑 Adding Google Chrome repository..."
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
    
    # Install Google Chrome
    echo "🌐 Installing Google Chrome..."
    sudo apt-get update -y
    sudo apt-get install -y google-chrome-stable
    
    # Verify Chrome installation
    if command -v google-chrome &> /dev/null; then
        echo "✅ Google Chrome installed successfully"
        google-chrome --version
    else
        echo "❌ Google Chrome installation failed"
        exit 1
    fi
    
    # Install Xvfb for virtual display (backup option)
    echo "🖥️ Installing virtual display support..."
    sudo apt-get install -y xvfb
    
    # Create Chrome wrapper script for VPS
    echo "📝 Creating Chrome wrapper script..."
    sudo tee /usr/local/bin/chrome-headless > /dev/null <<EOF
#!/bin/bash
exec /usr/bin/google-chrome \\
    --headless=new \\
    --no-sandbox \\
    --disable-setuid-sandbox \\
    --disable-dev-shm-usage \\
    --disable-gpu \\
    --remote-debugging-port=9222 \\
    --disable-background-timer-throttling \\
    --disable-backgrounding-occluded-windows \\
    --disable-renderer-backgrounding \\
    --disable-features=TranslateUI \\
    --disable-ipc-flooding-protection \\
    "\$@"
EOF
    
    sudo chmod +x /usr/local/bin/chrome-headless
    
    echo "✅ VPS browser setup completed successfully!"
    echo ""
    echo "🎯 Next steps:"
    echo "   1. Restart your Node.js application"
    echo "   2. Browser emulation will automatically use headless mode"
    echo "   3. Monitor logs for browser initialization messages"
    echo ""
    echo "💡 Tips:"
    echo "   • Browser will run in headless mode (no GUI needed)"
    echo "   • All Facebook interactions happen in background"
    echo "   • Memory usage optimized for VPS environments"
    echo "   • Chrome dependencies installed for stability"
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 macOS detected"
    echo "📦 Installing Chrome via Homebrew..."
    
    # Install Homebrew if not present
    if ! command -v brew &> /dev/null; then
        echo "🍺 Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    # Install Chrome
    brew install --cask google-chrome
    
    echo "✅ macOS browser setup completed!"
    
else
    echo "❓ Unsupported OS: $OSTYPE"
    echo "💡 For Windows VPS, ensure Chrome is installed manually"
    echo "   Download from: https://www.google.com/chrome/"
fi

echo ""
echo "🧪 Testing Puppeteer installation..."
node -e "
const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto('https://www.google.com');
        const title = await page.title();
        console.log('✅ Puppeteer test successful! Page title:', title);
        await browser.close();
    } catch (error) {
        console.log('❌ Puppeteer test failed:', error.message);
        console.log('💡 You may need to install additional dependencies');
    }
})();
"

echo ""
echo "🎉 VPS Browser Emulation setup complete!"
echo "   Your WA-BOT can now use Facebook Browser Emulation on VPS"
