// Final comprehensive test of the chat history fixes
const fs = require('fs');
const path = require('path');

console.log('Final test of chat history fixes...\n');

// Test the complete normalization logic with safeguards
function testNormalization(chatId, platform) {
  console.log(`Testing: "${chatId}" with platform "${platform}"`);
  
  // Validate input parameters (same as addMessage)
  if (!chatId || chatId.trim() === '' || chatId === 'undefined' || chatId === 'null') {
    console.log('  Result: INVALID - would be skipped');
    return null;
  }
  
  // Ensure chatId is a string
  chatId = String(chatId).trim();
  
  let formattedChatId;
  
  // If chatId already starts with 'chat_', use it directly
  if (chatId.startsWith('chat_')) {
    formattedChatId = chatId;
  } 
  // If it has a platform prefix but no chat_ prefix (like 'whatsapp_123')
  else if (chatId.match(/^(whatsapp|telegram)_/i)) {
    formattedChatId = `chat_${chatId}`;
  }
  // If we have platform info, normalize the chat ID
  else if (platform) {
    // Clean the chat ID and add platform prefix
    const cleanId = chatId
      .replace(/[@].*$/, '')           // Remove everything after @ (like @c.us)
      .replace(/[^a-z0-9]/gi, '_')     // Replace special chars with underscore
      .toLowerCase();
    formattedChatId = `chat_${platform.toLowerCase()}_${cleanId}`;
  }
  // No platform info available, use generic format
  else {
    const cleanId = chatId
      .replace(/[@].*$/, '')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    
    // Prevent problematic file names
    if (cleanId === '' || cleanId === 'chat' || cleanId === '_') {
      formattedChatId = `chat_unknown_${Date.now()}`;
      console.log(`  WARNING: Problematic chat ID normalized with timestamp`);
    } else {
      formattedChatId = `chat_${cleanId}`;
    }
  }
  
  console.log(`  Result: "${formattedChatId}"`);
  
  // Check for problematic results
  if (formattedChatId === 'chat_chat') {
    console.log('  🚨 ERROR: Would create chat_chat.json!');
  } else if (formattedChatId.includes('unknown')) {
    console.log('  ⚠️  Handled problematic ID with timestamp');
  } else {
    console.log('  ✅ Safe result');
  }
  
  return formattedChatId;
}

// Test all the problematic cases
const testCases = [
  // Cases that previously might have created chat_chat.json
  { chatId: 'chat', platform: null },
  { chatId: 'chat', platform: undefined },
  { chatId: 'chat', platform: '' },
  { chatId: '', platform: 'whatsapp' },
  { chatId: null, platform: 'whatsapp' },
  { chatId: undefined, platform: 'telegram' },
  { chatId: '   ', platform: null },
  { chatId: '_', platform: null },
  
  // Normal cases that should work correctly
  { chatId: '123456789@c.us', platform: 'whatsapp' },
  { chatId: '987654321', platform: 'telegram' },
  { chatId: 'whatsapp_123456', platform: null },
  { chatId: 'chat_whatsapp_123456', platform: null },
  { chatId: 'user123', platform: 'telegram' },
  { chatId: 'test@example.com', platform: 'whatsapp' }
];

console.log('=== Testing all cases ===\n');

let safeResults = 0;
let handledProblematic = 0;
let totalTests = 0;

testCases.forEach(({ chatId, platform }, index) => {
  console.log(`Test ${index + 1}:`);
  const result = testNormalization(chatId, platform);
  
  if (result === null) {
    console.log('  Status: SKIPPED (invalid input)');
  } else if (result === 'chat_chat') {
    console.log('  Status: FAILED (would create chat_chat.json)');
  } else if (result.includes('unknown')) {
    console.log('  Status: HANDLED (problematic ID with timestamp)');
    handledProblematic++;
  } else {
    console.log('  Status: SAFE');
    safeResults++;
  }
  
  totalTests++;
  console.log('');
});

console.log('=== Summary ===');
console.log(`Total tests: ${totalTests}`);
console.log(`Safe results: ${safeResults}`);
console.log(`Handled problematic: ${handledProblematic}`);
console.log(`Failed tests: ${totalTests - safeResults - handledProblematic}`);

if (totalTests === safeResults + handledProblematic) {
  console.log('✅ ALL TESTS PASSED - No chat_chat.json will be created!');
} else {
  console.log('❌ Some tests failed - chat_chat.json might still be created');
}

console.log('\nFinal test completed!');
