const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { promisify } = require('util');
const stream = require('stream');
const fetch = require('node-fetch');
const FormData = require('form-data');
const pipeline = promisify(stream.pipeline);

// LLM provider types
const PROVIDER_OPENAI = 'openai';
const PROVIDER_OLLAMA = 'ollama';

class VoiceHandler {
  constructor() {
    this.enabled = process.env.ENABLE_VOICE_MESSAGES === 'true';
    this.maxDuration = parseInt(process.env.MAX_VOICE_DURATION || '120');
    this.tempDir = path.join(__dirname, '../temp');
    
    // Initialize providers
    this.providers = {
      [PROVIDER_OPENAI]: {
        enabled: !!process.env.OPENAI_API_KEY,
        client: process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null,
        model: process.env.WHISPER_MODEL || 'whisper-1'
      },
      [PROVIDER_OLLAMA]: {
        enabled: process.env.LLM_PROVIDER === 'ollama',
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'whisper:latest'
      }
    };
    
    // Set active provider based on LLM_PROVIDER
    this.activeProvider = process.env.LLM_PROVIDER === 'ollama' ? PROVIDER_OLLAMA : PROVIDER_OPENAI;
    
    if (!this.providers[this.activeProvider]?.enabled) {
      console.warn(`[Voice] Warning: Active provider '${this.activeProvider}' is not properly configured`);
      this.enabled = false;
      return;
    }
    
    console.log(`[Voice] Using ${this.activeProvider} for voice transcription`);
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    // Set ffmpeg path
    ffmpeg.setFfmpegPath(ffmpegPath);
  }

  async processVoiceMessage(voiceData, message) {
    if (!this.enabled) {
      console.log('[Voice] Voice messages are disabled');
      return { text: null, error: 'Voice messages are disabled' };
    }

    try {
      console.log(`[Voice] Processing voice message from ${message.from}`);
      
      // Check duration
      if (voiceData.seconds > this.maxDuration) {
        return { 
          text: null, 
          error: `Voice message too long. Maximum duration is ${this.maxDuration} seconds.` 
        };
      }

      // Check if downloadMedia method exists
      if (typeof message.downloadMedia !== 'function') {
        throw new Error('message.downloadMedia is not a function');
      }
      
      // Download the voice message
      const media = await message.downloadMedia();
      if (!media) {
        throw new Error('Failed to download voice message');
      }

      // Generate a unique filename
      const timestamp = Date.now();
      const inputPath = path.join(this.tempDir, `voice-${timestamp}.ogg`);
      const outputPath = path.join(this.tempDir, `voice-${timestamp}.mp3`);

      // Save the media file
      fs.writeFileSync(inputPath, media.data, 'base64');
      
      // Convert to MP3 using ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .toFormat('mp3')
          .on('end', () => {
            console.log('[Voice] Audio conversion finished');
            resolve();
          })
          .on('error', (err) => {
            console.error('[Voice] Error converting audio:', err);
            reject(err);
          })
          .save(outputPath);
      });

      // Clean up the original file
      fs.unlinkSync(inputPath);

      // Transcribe using Whisper
      const transcription = await this.transcribeAudio(outputPath);
      
      // Clean up the converted file
      fs.unlinkSync(outputPath);

      console.log(`[Voice] Transcription: ${transcription.text}`);
      return { text: transcription.text, error: null };
      
    } catch (error) {
      console.error('[Voice] Error processing voice message:', error);
      return { text: null, error: error.message };
    }
  }

  async transcribeAudio(filePath) {
    try {
      if (this.activeProvider === PROVIDER_OPENAI) {
        return await this.transcribeWithOpenAI(filePath);
      } else if (this.activeProvider === PROVIDER_OLLAMA) {
        return await this.transcribeWithOllama(filePath);
      } else {
        throw new Error(`Unsupported provider: ${this.activeProvider}`);
      }
    } catch (error) {
      console.error(`[Voice] Error in ${this.activeProvider} transcription:`, error);
      throw new Error('Failed to transcribe audio');
    }
  }
  
  async transcribeWithOpenAI(filePath) {
    // Don't force English - let Whisper auto-detect the language
    const transcription = await this.providers[PROVIDER_OPENAI].client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: this.providers[PROVIDER_OPENAI].model,
      response_format: 'json'
      // Removed language parameter to allow auto-detection
    });
    
    return {
      text: transcription.text,
      language: transcription.language
    };
  }
  
  async transcribeWithOllama(filePath) {
    try {
      // Read the audio file as base64
      const audioData = fs.readFileSync(filePath);
      const base64Audio = audioData.toString('base64');
      
      const response = await fetch(`${this.providers[PROVIDER_OLLAMA].baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.providers[PROVIDER_OLLAMA].model,
          prompt: `[INST] Transcribe the following audio file: ${base64Audio} [/INST]`,
          stream: false
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${error}`);
      }
      
      const result = await response.json();
      
      // Extract the transcription from the response
      // The response might be in the format "[INST] Transcribed text...[/INST]"
      let transcription = result.response || '';
      transcription = transcription.replace(/\[INST\].*?\[\/INST\]/g, '').trim();
      
      return {
        text: transcription,
        language: 'en' // Default to English, adjust if needed
      };
    } catch (error) {
      console.error('[Voice] Error in Ollama transcription:', error);
      throw new Error(`Ollama transcription failed: ${error.message}`);
    }
  }
}

module.exports = new VoiceHandler();
