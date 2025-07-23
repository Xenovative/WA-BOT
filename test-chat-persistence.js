/**
 * Test script to verify chat history persistence
 */
const fs = require('fs');
const path = require('path');

console.log('=== Testing Chat Handler Persistence ===\n');

// Clear any existing test chat
const testChatId = 'test-persistence-' + Date.now();
const chatHistoryDir = path.join(__dirname, 'chat_history');
const testChatFile = path.join(chatHistoryDir, `${testChatId}.json`);

// Clean up any existing test file
if (fs.existsSync(testChatFile)) {
  fs.unlinkSync(testChatFile);
  console.log('Cleaned up existing test file');
}

// Load chatHandler
const chatHandler = require('./handlers/chatHandler');

console.log('1. Initial state:');
console.log(`   - Total chats: ${chatHandler.getAllChats().length}`);
console.log(`   - Test chat exists: ${fs.existsSync(testChatFile)}`);

console.log('\n2. Adding test messages...');
chatHandler.addMessage(testChatId, 'user', 'Hello, this is a test message');
chatHandler.addMessage(testChatId, 'assistant', 'Hi! This is a test response');
chatHandler.addMessage(testChatId, 'user', 'Another test message');

console.log('\n3. After adding messages:');
const conversation = chatHandler.getConversation(testChatId);
console.log(`   - Messages in conversation: ${conversation.length}`);
console.log(`   - Test chat file exists: ${fs.existsSync(testChatFile)}`);

if (fs.existsSync(testChatFile)) {
  const fileContent = fs.readFileSync(testChatFile, 'utf8');
  const savedMessages = JSON.parse(fileContent);
  console.log(`   - Messages saved to file: ${savedMessages.length}`);
  console.log(`   - File size: ${fileContent.length} bytes`);
} else {
  console.log('   - ERROR: Chat file was not created!');
}

console.log('\n4. Testing persistence by reloading...');
// Simulate restart by creating a new instance
delete require.cache[require.resolve('./handlers/chatHandler')];
const chatHandler2 = require('./handlers/chatHandler');

const reloadedConversation = chatHandler2.getConversation(testChatId);
console.log(`   - Messages after reload: ${reloadedConversation.length}`);

if (reloadedConversation.length === conversation.length) {
  console.log('   ✅ PERSISTENCE TEST PASSED');
} else {
  console.log('   ❌ PERSISTENCE TEST FAILED');
}

console.log('\n5. Cleanup...');
if (fs.existsSync(testChatFile)) {
  fs.unlinkSync(testChatFile);
  console.log('   - Test file cleaned up');
}

console.log('\n=== Test Complete ===');
