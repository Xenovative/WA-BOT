# WhatsApp LLM Bot

A WhatsApp chatbot powered by various LLM providers (OpenAI, OpenRouter, Ollama) using the unofficial WhatsApp Web API.

## Features

- WhatsApp integration using whatsapp-web.js (unofficial API)
- Support for multiple LLM providers:
  - OpenAI (GPT models)
  - OpenRouter (access to multiple AI models)
  - Ollama (run models locally)
- Conversation history for contextual responses
- Command system to control the bot
- Easy switching between different providers and models

## Prerequisites

- Node.js 18 or higher
- For Ollama: Local Ollama instance running (optional)
- API keys for OpenAI and/or OpenRouter (depending on which providers you want to use)

## Installation

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

## Configuration

Edit the `.env` file to configure your bot:

```
# WhatsApp Web Configuration
WA_RESTART_ON_AUTH_FAILURE=true

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
```

## Usage

Start the bot:

```
npm start
```

The first time you run the bot, you'll need to authenticate with WhatsApp by scanning a QR code that will appear in the console.

### Available Commands

Send these commands in a WhatsApp chat to control the bot:

- `!help` - Show help and current settings
- `!clear` - Clear conversation history
- `!provider [name]` - Get or set LLM provider (openai, openrouter, ollama)
- `!model [name]` - Get or set model for current provider

## Development

For development with auto-restart:

```
npm run dev
```

## License

MIT
