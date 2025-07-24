const ChatHandler = require('./handlers/chatHandler');
const fs = require('fs');
const path = require('path');

console.log('Testing real chat ID scenarios...\n');

// Clean up existing test files first
const chatDir = path.join(__dirname, 'data', 'chatHistory');
if (fs.existsSync(chatDir)) {
  const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.json') && f !== 'chats.json');
  files.forEach(file => {
    if (file.startsWith('chat_test_') || file === 'chat_chat.json') {
      fs.unlinkSync(path.join(chatDir, file));
      console.log(`Cleaned up test file: ${file}`);
    }
  });
}

// Create chat handler
const chatHandler = new ChatHandler();

// Test realistic chat ID scenarios that might cause chat_chat.json
const testScenarios = [
  { chatId: '85290897701@c.us', platform: 'whatsapp', name: 'WhatsApp with @c.us' },
  { chatId: '119638', platform: 'telegram', name: 'Telegram numeric ID' },
  { chatId: 'whatsapp:85290897701@c.us', platform: 'whatsapp', name: 'WhatsApp with colon prefix' },
  { chatId: 'telegram:119638', platform: 'telegram', name: 'Telegram with colon prefix' },
  { chatId: 'chat', platform: 'whatsapp', name: 'Generic "chat" ID' },
  { chatId: 'test_user', platform: 'telegram', name: 'Test user ID' }
];

console.log('=== Testing chat ID normalization ===');

testScenarios.forEach(({ chatId, platform, name }) => {
  console.log(`\n--- Testing: ${name} ---`);
  console.log(`Original ID: ${chatId}, Platform: ${platform}`);
  
  // Add a message to trigger the normalization
  chatHandler.addMessage(chatId, 'user', `Test message from ${name}`, platform);
  
  // Get the conversation to see what ID was used
  const conversation = chatHandler.getConversation(chatId, platform);
  console.log(`Messages stored: ${conversation.length}`);
});

console.log('\n=== Saving conversations ===');
chatHandler.saveConversations();

console.log('\n=== Checking created files ===');
if (fs.existsSync(chatDir)) {
  const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.json') && f !== 'chats.json');
  console.log(`Found ${files.length} chat files:`);
  files.forEach(file => {
    const filePath = path.join(chatDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const messages = JSON.parse(content);
    console.log(`  ${file}: ${messages.length} messages`);
    
    // Check if we have the problematic chat_chat.json
    if (file === 'chat_chat.json') {
      console.log('    ⚠️  WARNING: Found chat_chat.json file!');
    }
  });
}

console.log('\n=== Checking in-memory conversations ===');
console.log(`Total conversations in memory: ${chatHandler.conversations.size}`);
chatHandler.conversations.forEach((messages, chatId) => {
  console.log(`  Memory: ${chatId} - ${messages.length} messages`);
});

console.log('\nTest completed!');
