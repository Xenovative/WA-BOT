const fs = require('fs');
const path = require('path');

// Simulate the exact conditions that might create chat_chat.json
console.log('Debugging chat_chat.json creation...\n');

const chatDir = path.join(__dirname, 'data', 'chatHistory');

// Function to simulate addMessage behavior
function simulateAddMessage(chatId, platform, content) {
  console.log(`\n=== Simulating addMessage ===`);
  console.log(`Input chatId: "${chatId}"`);
  console.log(`Platform: "${platform}"`);
  
  // This is the exact logic from our fixed addMessage method
  let formattedChatId;
  
  // If chatId already starts with 'chat_', use it directly
  if (chatId.startsWith('chat_')) {
    formattedChatId = chatId;
    console.log(`Branch: Already has chat_ prefix`);
  } 
  // If it has a platform prefix but no chat_ prefix (like 'whatsapp_123')
  else if (chatId.match(/^(whatsapp|telegram)_/i)) {
    formattedChatId = `chat_${chatId}`;
    console.log(`Branch: Has platform prefix, adding chat_`);
  }
  // If we have platform info, normalize the chat ID
  else if (platform) {
    // Clean the chat ID and add platform prefix
    const cleanId = chatId
      .replace(/[@].*$/, '')           // Remove everything after @ (like @c.us)
      .replace(/[^a-z0-9]/gi, '_')     // Replace special chars with underscore
      .toLowerCase();
    formattedChatId = `chat_${platform.toLowerCase()}_${cleanId}`;
    console.log(`Branch: Using platform info, cleanId: "${cleanId}"`);
  }
  // No platform info available, use generic format
  else {
    const cleanId = chatId
      .replace(/[@].*$/, '')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    formattedChatId = `chat_${cleanId}`;
    console.log(`Branch: No platform info, cleanId: "${cleanId}"`);
  }
  
  console.log(`Result: "${formattedChatId}"`);
  
  if (formattedChatId === 'chat_chat') {
    console.log('🚨 WARNING: This would create chat_chat.json!');
  }
  
  return formattedChatId;
}

// Test various scenarios that might create chat_chat.json
const testScenarios = [
  // Scenarios that might create chat_chat.json
  { chatId: 'chat', platform: null, description: 'Generic "chat" with no platform' },
  { chatId: 'chat', platform: '', description: 'Generic "chat" with empty platform' },
  { chatId: 'chat', platform: undefined, description: 'Generic "chat" with undefined platform' },
  { chatId: 'chat_', platform: null, description: 'Malformed chat_ prefix' },
  { chatId: '', platform: 'whatsapp', description: 'Empty chatId' },
  { chatId: null, platform: 'whatsapp', description: 'Null chatId' },
  { chatId: undefined, platform: 'whatsapp', description: 'Undefined chatId' },
  
  // Normal scenarios that should work correctly
  { chatId: '123456789@c.us', platform: 'whatsapp', description: 'Normal WhatsApp ID' },
  { chatId: '987654321', platform: 'telegram', description: 'Normal Telegram ID' },
  { chatId: 'whatsapp_123456', platform: null, description: 'Pre-formatted WhatsApp ID' },
  { chatId: 'chat_whatsapp_123456', platform: null, description: 'Fully formatted ID' },
];

console.log('Testing scenarios that might create chat_chat.json:\n');

testScenarios.forEach(({ chatId, platform, description }) => {
  console.log(`--- ${description} ---`);
  try {
    if (chatId === null || chatId === undefined) {
      console.log(`Skipping null/undefined chatId`);
    } else {
      const result = simulateAddMessage(chatId, platform, 'test message');
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
  console.log('');
});

// Check for any existing problematic files
console.log('=== Checking for existing problematic files ===');
if (fs.existsSync(chatDir)) {
  const files = fs.readdirSync(chatDir);
  const problematicFiles = files.filter(f => 
    f === 'chat_chat.json' || 
    f === 'chat_.json' || 
    f === 'chat_undefined.json' ||
    f === 'chat_null.json'
  );
  
  if (problematicFiles.length > 0) {
    console.log('Found problematic files:');
    problematicFiles.forEach(file => {
      console.log(`  - ${file}`);
      const filePath = path.join(chatDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const messages = JSON.parse(content);
        console.log(`    Messages: ${messages.length}`);
      } catch (error) {
        console.log(`    Error reading file: ${error.message}`);
      }
    });
  } else {
    console.log('No problematic files found.');
  }
} else {
  console.log('Chat directory does not exist.');
}

console.log('\nDebugging completed!');
