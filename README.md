<div align="center">
  <h1>WhatsXENO</h1>
  <p>
    <strong>Next-Gen Multi-Platform AI Assistant</strong>
  </p>
  <p>
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#documentation">Documentation</a>
  </p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
</div>

## 🤖 About WhatsXENO

WhatsXENO is a powerful, multi-platform AI assistant that brings the power of large language models to your favorite messaging platforms. With support for WhatsApp, Telegram, and more, it offers a seamless AI experience across all your devices.

### 🌟 Key Highlights
- **Multi-Platform**: Works on WhatsApp, Telegram, and more
- **AI-Powered**: Advanced language understanding with state-of-the-art models
- **Voice-Enabled**: Send and receive voice messages with automatic transcription
- **Private & Secure**: Your data stays yours - no shady data collection
- **Open Source**: Transparent, community-driven development

<a id="features"></a>
## 🚀 Features

### Multi-Platform Support
- **WhatsApp** integration using whatsapp-web.js (unofficial API)
- **Telegram** bot integration with full feature parity

### AI Capabilities
- Multiple LLM provider support:
  - OpenAI (GPT models)
  - OpenRouter (access to multiple AI models)
  - Ollama (run models locally)
- Voice message transcription (supports Whisper and Ollama Whisper)
- Conversation history with context awareness
- RAG (Retrieval-Augmented Generation) for knowledge base integration

### User Experience
- Cross-platform command system
- Easy switching between different providers and models
- Configurable trigger words for group chat activation
- Rate limiting and user blocking capabilities
- Web-based management console

### Internationalization (i18n)
- **Multi-language Support**: Full UI internationalization with support for:
  - **English** (en) - Default language
  - **Traditional Chinese** (zh-TW) - 繁體中文
  - **Simplified Chinese** (zh-CN) - 简体中文
- **Dynamic Language Switching**: Change language on-the-fly without page reload
- **Comprehensive Coverage**: All UI elements, buttons, messages, and notifications are translated
- **Toast Notifications**: Multilingual toast messages with branding integration
- **Persistent Settings**: Language preference saved in browser localStorage
- **Auto-Detection**: Automatically detects browser language on first visit
- **Extensible**: Easy to add new languages by extending the translation files

**Supported Areas:**
- Navigation menus and tab titles
- Dashboard and system information
- Chat history and workflow management
- Knowledge base interface
- Settings and configuration panels
- Admin login and system controls
- Error messages and confirmations
- Toast notifications and status updates

<a id="quick-start"></a>
## ⚡ Quick Start

### Prerequisites

- Node.js 18 or higher
- For Ollama: Local Ollama instance running (optional)
- API keys for your chosen providers (OpenAI, OpenRouter, Telegram Bot Token)
- (Optional) Whisper API access for voice transcription

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the `.env.example` file to `.env` and fill in your API keys and settings:
   ```
   cp .env.example .env
   ```
4. Edit the `.env` file with your preferred settings and API keys

### Configuration

Edit the `.env` file to configure your bot:

```
# Platform Configuration
WA_RESTART_ON_AUTH_FAILURE=true
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# LLM Provider Selection ('openai', 'openrouter', 'ollama')
LLM_PROVIDER=openai

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo

# OpenRouter Configuration
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-3.5-turbo

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mannix/llama3.1-8b-abliterated:latest

# Voice Message Configuration
ENABLE_VOICE_MESSAGES=true
WHISPER_MODEL=whisper-1  # or 'large-v2' for local Whisper
MAX_VOICE_DURATION=120  # seconds

# Rate Limiting
RATE_LIMIT_WINDOW=86400000  # 24 hours in milliseconds
```

## 💻 Usage

### Starting the Bot

```bash
# Start the bot
npm start

# For development with auto-restart
npm run dev
```

### Platform-Specific Setup

#### WhatsApp
On first run, scan the QR code that appears in the console to authenticate with WhatsApp Web.

#### Telegram
1. Create a bot using [@BotFather](https://t.me/botfather) on Telegram
2. Copy the bot token and add it to your `.env` file
3. The bot will automatically start responding to messages

### Available Commands

Send these commands in any chat to control the bot:

#### Basic Commands
- `/start` - Start the bot and show welcome message
- `/help` - Show help and available commands
- `/status` - Check bot status and current settings

#### Chat Management
- `!clear` - Clear conversation history
- `!provider [name]` - Get or set LLM provider (openai, openrouter, ollama)
- `!model [name]` - Get or set model for current provider

#### Voice Messages
Simply send a voice message and the bot will:
1. Transcribe it using Whisper
2. Process the text as a normal message
3. Respond with both the transcription and response

### Web Management Console

The bot includes a web-based management console that can be accessed at `http://localhost:3000` (or the port specified in your .env file). The console includes the following features:

#### Triggers Tab

The Triggers tab allows you to configure words or phrases that will activate the bot in group chats. When any of these trigger words appear in a message, the bot will respond.

- **Group Chat Triggers**: These are the primary words that activate the bot in group chats.
- **Custom Triggers**: Additional trigger words for specific use cases.

For each type of trigger, you can:
- Add new triggers
- Edit existing triggers (click the pencil icon)
- Delete triggers (click the trash icon)
- Save changes to persist them

All triggers are case-insensitive. The bot will respond if any configured trigger word appears anywhere in a message.

## 🌐 Web Management Interface

WhatsXENO includes a comprehensive web-based management console accessible at `http://localhost:3000` (or your configured port).

### Language Switching

The web interface supports multiple languages with easy switching:

1. **Automatic Detection**: The interface automatically detects your browser's language preference
2. **Manual Switching**: Use the language selector in the top navigation bar
3. **Persistent Settings**: Your language choice is saved and remembered across sessions
4. **Real-time Updates**: Language changes apply immediately without page reload

### Available Languages

- **English** (en) - Default
- **Traditional Chinese** (zh-TW) - 繁體中文  
- **Simplified Chinese** (zh-CN) - 简体中文

### Web Interface Features

- **Dashboard**: System health monitoring and status overview
- **Chat History**: View and manage conversation history across platforms
- **Settings**: Configure AI providers, models, and system prompts
- **Knowledge Base**: Upload and manage RAG documents
- **Workflows**: Manage Node-RED automation workflows (admin only)
- **System Info**: Monitor server performance and system details (admin only)
- **Triggers**: Configure bot activation triggers for group chats
- **Admin Controls**: Secure admin login for sensitive operations

### Admin Features

Certain features require admin authentication:
- Workflow management
- System information and controls
- Server restart functionality
- Advanced configuration options

Set the `ADMIN_PASSWORD` environment variable to enable admin features.

## Development

For development with auto-restart:

```
npm run dev
```

## License

MIT
