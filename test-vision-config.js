require('dotenv').config();

console.log('=== Vision Configuration Test ===\n');

console.log('Environment Variables:');
console.log('  ENABLE_VISION:', process.env.ENABLE_VISION);
console.log('  MAX_IMAGE_SIZE_MB:', process.env.MAX_IMAGE_SIZE_MB);
console.log('  OPENAI_VISION_MODEL:', process.env.OPENAI_VISION_MODEL);
console.log('  OPENAI_VISION_DETAIL:', process.env.OPENAI_VISION_DETAIL);
console.log('  OPENAI_VISION_MAX_TOKENS:', process.env.OPENAI_VISION_MAX_TOKENS);
console.log('  LLM_PROVIDER:', process.env.LLM_PROVIDER);
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '***' + process.env.OPENAI_API_KEY.slice(-4) : 'NOT SET');

console.log('\nVision Handler Initialization:');
const visionHandler = require('./utils/visionHandler');
console.log('  Vision enabled:', visionHandler.enabled);
console.log('  Max image size:', visionHandler.maxImageSize / 1024 / 1024, 'MB');
console.log('  Vision prompt:', visionHandler.visionPrompt.substring(0, 80) + '...');

console.log('\nLLM Client Check:');
const LLMFactory = require('./llm/llmFactory');
const llmClient = LLMFactory.createClient();
console.log('  LLM Client type:', llmClient.constructor.name);
console.log('  Has analyzeImage method:', typeof llmClient.analyzeImage === 'function');

if (visionHandler.enabled && typeof llmClient.analyzeImage === 'function') {
  console.log('\n✅ Vision is properly configured and ready to use!');
} else {
  console.log('\n❌ Vision is NOT properly configured:');
  if (!visionHandler.enabled) {
    console.log('   - ENABLE_VISION is not set to "true"');
  }
  if (typeof llmClient.analyzeImage !== 'function') {
    console.log('   - LLM client does not support vision (analyzeImage method missing)');
    console.log('   - Make sure you are using OpenAI with a vision model or Ollama with a vision model like llava');
  }
}

console.log('\n=== End of Test ===');
