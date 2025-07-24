const ChatHandler = require('./handlers/chatHandler');
const fs = require('fs');
const path = require('path');

console.log('Testing chat history functionality...\n');

// Create chat handler
const chatHandler = new ChatHandler();

// Test with two different chats
const chat1 = { id: '123456789', platform: 'whatsapp' };
const chat2 = { id: '987654321', platform: 'telegram' };

console.log('=== Adding messages to different chats ===');

// Add messages to chat 1
chatHandler.addMessage(chat1.id, 'user', 'Hello from WhatsApp!', chat1.platform);
chatHandler.addMessage(chat1.id, 'assistant', 'Hi WhatsApp user!', chat1.platform);

// Add messages to chat 2  
chatHandler.addMessage(chat2.id, 'user', 'Hello from Telegram!', chat2.platform);
chatHandler.addMessage(chat2.id, 'assistant', 'Hi Telegram user!', chat2.platform);

console.log(`Chat 1 messages: ${chatHandler.getConversation(chat1.id, chat1.platform).length}`);
console.log(`Chat 2 messages: ${chatHandler.getConversation(chat2.id, chat2.platform).length}`);

console.log('\n=== Saving conversations ===');
chatHandler.saveConversations();

console.log('\n=== Checking saved files ===');
const chatDir = path.join(__dirname, 'data', 'chatHistory');
if (fs.existsSync(chatDir)) {
  const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.json') && f !== 'chats.json');
  console.log(`Found ${files.length} chat files:`);
  files.forEach(file => {
    const filePath = path.join(chatDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const messages = JSON.parse(content);
    console.log(`  ${file}: ${messages.length} messages`);
  });
}

console.log('\n=== Testing after restart ===');
const newChatHandler = new ChatHandler();
console.log(`Conversations after restart: ${newChatHandler.conversations.size}`);

newChatHandler.conversations.forEach((messages, chatId) => {
  console.log(`Chat ID: ${chatId} - Messages: ${messages.length}`);
});

console.log('\nTest completed!');
