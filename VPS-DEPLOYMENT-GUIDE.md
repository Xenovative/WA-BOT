# 🚀 VPS Deployment Guide for Facebook Browser Emulation

This guide helps you deploy WA-BOT with Facebook Browser Emulation on a VPS (Virtual Private Server) environment.

## 🎯 Overview

The Facebook Browser Emulation feature automatically detects VPS environments and runs in **headless mode** (no GUI required), making it perfect for cloud servers, VPS, and containerized deployments.

## 📋 Prerequisites

- Ubuntu/Debian VPS (16.04+ recommended)
- At least 2GB RAM (4GB recommended)
- Node.js 16+ installed
- SSH access to your VPS

## 🛠️ Quick Setup

### 1. **Upload WA-BOT to Your VPS**

```bash
# Clone or upload your WA-BOT project
git clone <your-wa-bot-repo>
cd WA-BOT

# Or upload via SCP
scp -r ./WA-BOT user@your-vps-ip:/home/user/
```

### 2. **Run VPS Setup Script**

```bash
# Make setup script executable
chmod +x setup-vps-browser.sh

# Run the setup (installs Chrome + dependencies)
./setup-vps-browser.sh
```

### 3. **Install Node.js Dependencies**

```bash
# Install all dependencies including Puppeteer
npm install

# Verify Puppeteer installation
npx puppeteer browsers install chrome
```

### 4. **Configure Environment Variables**

```bash
# Edit your .env file
nano .env

# Add Facebook credentials (choose one method):

# Method 1: App State (Recommended)
FACEBOOK_APP_STATE='[{"key":"c_user","value":"your_user_id"}...]'

# Method 2: Email/Password (Fallback)
FACEBOOK_EMAIL=your_facebook_email
FACEBOOK_PASSWORD=your_facebook_password
```

### 5. **Start WA-BOT**

```bash
# Using PM2 (recommended for VPS)
npm install -g pm2
pm2 start index.js --name "wa-bot"
pm2 save
pm2 startup

# Or direct start
npm start
```

## 🔍 VPS Detection Features

The system automatically detects VPS environments and optimizes accordingly:

### ✅ **Automatic Detection**
- **Linux without DISPLAY** → VPS detected
- **SSH connections** → VPS detected  
- **Docker containers** → VPS detected
- **Cloud provider hostnames** → VPS detected

### ⚡ **VPS Optimizations**
- **Headless Mode**: Runs Chrome without GUI
- **Memory Optimization**: Reduced memory footprint
- **Performance Tuning**: Disabled unnecessary features
- **Stability Improvements**: Enhanced error handling

## 📊 Environment Detection Output

When starting, you'll see detailed environment detection:

```
🔍 VPS Detection Results:
   • Is VPS: ✅ Yes
   • Platform: linux
   • Architecture: x64
   • Memory: 4096MB (2048MB free)
   • CPUs: 2
   • Display: none
   • SSH Connection: ✅ Yes
   • Browser Mode: Headless
   • Hostname: your-vps-hostname
```

## 🌐 Browser Emulation Flow

1. **API Attempt**: Tries facebook-chat-api first
2. **API Fails**: Automatically switches to browser emulation
3. **VPS Detection**: Detects headless environment
4. **Chrome Launch**: Starts Chrome in headless mode
5. **Facebook Login**: Navigates to Facebook/Messenger
6. **Message Monitoring**: Polls for messages every 5 seconds

## 🐛 Troubleshooting

### **Chrome Installation Issues**

```bash
# Manual Chrome installation
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install google-chrome-stable
```

### **Memory Issues**

```bash
# Check memory usage
free -h
pm2 monit

# Optimize PM2 settings
pm2 start index.js --name "wa-bot" --max-memory-restart 1G
```

### **Puppeteer Issues**

```bash
# Install missing dependencies
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

# Test Puppeteer
node -e "const puppeteer = require('puppeteer'); puppeteer.launch({headless: 'new'}).then(browser => { console.log('✅ Puppeteer works!'); browser.close(); });"
```

### **Facebook Login Issues**

```bash
# Check logs
pm2 logs wa-bot

# Common issues:
# 1. Invalid app state → Re-extract from browser
# 2. 2FA enabled → Use app state method
# 3. Account blocked → Wait 24-48 hours
```

## 📈 Performance Monitoring

```bash
# Monitor WA-BOT performance
pm2 monit

# Check browser processes
ps aux | grep chrome

# Monitor memory usage
watch -n 1 'free -h && echo "---" && ps aux --sort=-%mem | head -10'
```

## 🔒 Security Considerations

### **Firewall Configuration**
```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP (if using web GUI)
sudo ufw allow 443   # HTTPS (if using web GUI)
sudo ufw enable
```

### **Process Management**
```bash
# Run as non-root user
sudo adduser wabot
sudo su - wabot
cd /home/wabot/WA-BOT
pm2 start index.js
```

## 🎯 Expected Behavior on VPS

### ✅ **Successful Deployment**
```
🌍 Starting Facebook Browser Service...
🔍 VPS Detection Results:
   • Is VPS: ✅ Yes
   • Browser Mode: Headless
🚀 Launching browser with optimized settings...
✅ Facebook Browser Service initialized successfully
🌍 TRYING BROWSER EMULATION FALLBACK...
✅ Browser emulation successful!
👂 Starting Facebook message monitoring...
```

### 📊 **Resource Usage**
- **Memory**: ~200-400MB per browser instance
- **CPU**: Low usage during idle, higher during message processing
- **Storage**: ~100MB for browser cache/data

## 🆘 Support

If you encounter issues:

1. **Check Logs**: `pm2 logs wa-bot`
2. **Verify Setup**: Run `./setup-vps-browser.sh` again
3. **Test Browser**: Use the Puppeteer test command
4. **Monitor Resources**: Check memory and CPU usage

## 🎉 Success!

Once deployed successfully, your WA-BOT will:
- ✅ Run Facebook Browser Emulation in headless mode
- ✅ Automatically handle VPS environment detection
- ✅ Provide stable Facebook Messenger integration
- ✅ Work reliably on cloud servers and VPS platforms

The browser emulation bypasses Facebook's API blocking by using a real Chrome browser, making it much more reliable than the unofficial API alone! 🚀
