const fs = require('fs');
const path = require('path');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data', 'chatHistory');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Test the chat ID normalization directly
function testChatIdNormalization() {
  console.log('Testing chat ID normalization...\n');
  
  const testCases = [
    { input: '123456789', platform: 'whatsapp' },
    { input: '987654321', platform: 'telegram' },
    { input: 'whatsapp_123456789', platform: null },
    { input: 'telegram_987654321', platform: null },
    { input: 'chat_whatsapp_123456789', platform: null },
    { input: 'chat_telegram_987654321', platform: null }
  ];
  
  // Simulate the getChatFilePath logic
  function normalizeChatId(chatId, platform) {
    if (chatId.startsWith('chat_')) {
      return chatId;
    } else if (chatId.match(/^(whatsapp|telegram)_/i)) {
      return `chat_${chatId}`;
    } else if (platform) {
      const cleanId = chatId.replace(/[@].*$/, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      return `chat_${platform}_${cleanId}`;
    } else {
      const cleanId = chatId.replace(/[@].*$/, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      return `chat_${cleanId}`;
    }
  }
  
  testCases.forEach(({ input, platform }) => {
    const normalized = normalizeChatId(input, platform);
    console.log(`Input: ${input} (platform: ${platform}) -> ${normalized}`);
  });
  
  console.log('\n=== Testing file creation ===');
  
  // Create test chat files
  const chatFiles = [
    { id: 'chat_whatsapp_123456789', messages: [
      { role: 'user', content: 'Hello WhatsApp!', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Hi WhatsApp user!', timestamp: new Date().toISOString() }
    ]},
    { id: 'chat_telegram_987654321', messages: [
      { role: 'user', content: 'Hello Telegram!', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Hi Telegram user!', timestamp: new Date().toISOString() }
    ]}
  ];
  
  chatFiles.forEach(({ id, messages }) => {
    const filePath = path.join(dataDir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
    console.log(`Created: ${id}.json with ${messages.length} messages`);
  });
  
  console.log('\n=== Checking files ===');
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'chats.json');
  files.forEach(file => {
    const filePath = path.join(dataDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const messages = JSON.parse(content);
    console.log(`${file}: ${messages.length} messages`);
  });
  
  console.log('\nTest completed successfully!');
}

testChatIdNormalization();
