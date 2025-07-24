const ChatHandler = require('./handlers/chatHandler');

async function testChatHistory() {
  console.log('Testing chat history functionality...\n');
  
  // Create a new chat handler instance
  const chatHandler = new ChatHandler();
  
  // Wait a moment for initialization
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test different chat ID formats
  const testChats = [
    { chatId: '123456789', platform: 'whatsapp', name: 'WhatsApp Chat 1' },
    { chatId: '987654321', platform: 'telegram', name: 'Telegram Chat 1' },
    { chatId: 'whatsapp_123456789', platform: null, name: 'WhatsApp with prefix' },
    { chatId: 'telegram_987654321', platform: null, name: 'Telegram with prefix' },
    { chatId: 'chat_whatsapp_123456789', platform: null, name: 'Already formatted WhatsApp' },
    { chatId: 'chat_telegram_987654321', platform: null, name: 'Already formatted Telegram' }
  ];
  
  console.log('=== Adding test messages ===');
  
  // Add different messages to each chat
  testChats.forEach(({ chatId, platform, name }) => {
    console.log(`\n--- Testing ${name} ---`);
    
    // Add a few messages
    chatHandler.addMessage(chatId, 'user', `Hello from ${name}`, platform);
    chatHandler.addMessage(chatId, 'assistant', `Hi! I'm responding to ${name}`, platform);
    chatHandler.addMessage(chatId, 'user', `Another message for ${name}`, platform);
    
    // Get conversation
    const conversation = chatHandler.getConversation(chatId, platform);
    console.log(`Messages in ${name}: ${conversation.length}`);
  });
  
  console.log('\n=== Checking loaded conversations ===');
  console.log(`Total conversations loaded: ${chatHandler.conversations.size}`);
  
  // List all conversations
  chatHandler.conversations.forEach((messages, chatId) => {
    console.log(`Chat ID: ${chatId} - Messages: ${messages.length}`);
  });
  
  console.log('\n=== Saving conversations ===');
  chatHandler.saveConversations();
  
  console.log('\n=== Checking saved files ===');
  const fs = require('fs');
  const path = require('path');
  
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
  
  // Create a new instance to simulate restart
  const newChatHandler = new ChatHandler();
  console.log(`Conversations after restart: ${newChatHandler.conversations.size}`);
  
  newChatHandler.conversations.forEach((messages, chatId) => {
    console.log(`Chat ID: ${chatId} - Messages: ${messages.length}`);
  });
  
  console.log('\n=== Test completed ===');
}

// Run the test
if (require.main === module) {
  testChatHistory().catch(console.error);
}

module.exports = testChatHistory;
