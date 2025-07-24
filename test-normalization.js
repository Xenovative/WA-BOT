// Test the chat ID normalization logic directly
function normalizeChatId(chatId, platform) {
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
    formattedChatId = `chat_${cleanId}`;
  }
  
  return formattedChatId;
}

console.log('Testing chat ID normalization...\n');

const testCases = [
  { chatId: '85290897701@c.us', platform: 'whatsapp', expected: 'chat_whatsapp_85290897701' },
  { chatId: '119638', platform: 'telegram', expected: 'chat_telegram_119638' },
  { chatId: 'whatsapp:85290897701@c.us', platform: 'whatsapp', expected: 'chat_whatsapp_whatsapp_85290897701' },
  { chatId: 'telegram:119638', platform: 'telegram', expected: 'chat_telegram_telegram_119638' },
  { chatId: 'chat', platform: 'whatsapp', expected: 'chat_whatsapp_chat' },
  { chatId: 'test_user', platform: 'telegram', expected: 'chat_telegram_test_user' },
  { chatId: 'whatsapp_123456', platform: null, expected: 'chat_whatsapp_123456' },
  { chatId: 'chat_whatsapp_123456', platform: null, expected: 'chat_whatsapp_123456' },
  { chatId: 'generic_id', platform: null, expected: 'chat_generic_id' }
];

let allPassed = true;

testCases.forEach(({ chatId, platform, expected }) => {
  const result = normalizeChatId(chatId, platform);
  const passed = result === expected;
  
  console.log(`Input: "${chatId}" (platform: ${platform})`);
  console.log(`Expected: ${expected}`);
  console.log(`Got:      ${result}`);
  console.log(`Status:   ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  
  if (!passed) {
    allPassed = false;
  }
});

console.log(`Overall result: ${allPassed ? '✅ All tests passed!' : '❌ Some tests failed!'}`);

// Check for the problematic "chat_chat" scenario
console.log('\n=== Checking for chat_chat scenario ===');
const problematicCases = [
  { chatId: 'chat', platform: null },
  { chatId: 'chat', platform: 'whatsapp' },
  { chatId: 'chat', platform: 'telegram' }
];

problematicCases.forEach(({ chatId, platform }) => {
  const result = normalizeChatId(chatId, platform);
  console.log(`"${chatId}" + platform "${platform}" -> "${result}"`);
  if (result === 'chat_chat') {
    console.log('  ⚠️  WARNING: This would create chat_chat.json!');
  }
});
