const fs = require('fs');
const path = require('path');

const chatHistoryDir = path.join(__dirname, 'chat_history');

console.log('Checking for duplicate chat files...');

if (!fs.existsSync(chatHistoryDir)) {
  console.log('Chat history directory does not exist');
  process.exit(0);
}

const files = fs.readdirSync(chatHistoryDir).filter(
  file => file.endsWith('.json') && file !== 'chats.json'
);

console.log(`Found ${files.length} chat files:`, files);

// Group files by their potential chat ID patterns
const groups = {};

files.forEach(file => {
  const baseName = file.replace('.json', '');
  
  // Check if it's a platform-prefixed chat
  if (baseName.includes(':')) {
    const [platform, chatId] = baseName.split(':', 2);
    const key = chatId;
    if (!groups[key]) groups[key] = [];
    groups[key].push({
      file,
      platform,
      isPlatformPrefixed: true,
      chatId: baseName
    });
  } else {
    // Non-prefixed chat
    const key = baseName;
    if (!groups[key]) groups[key] = [];
    groups[key].push({
      file,
      platform: 'unknown',
      isPlatformPrefixed: false,
      chatId: baseName
    });
  }
});

console.log('\nGrouped by base chat ID:');
Object.entries(groups).forEach(([baseId, fileInfos]) => {
  if (fileInfos.length > 1) {
    console.log(`\n🔥 DUPLICATE FOUND for "${baseId}":`);
    fileInfos.forEach(info => {
      const filePath = path.join(chatHistoryDir, info.file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`  - ${info.file} (${info.platform}) - ${content.length} messages`);
    });
  } else {
    console.log(`✅ "${baseId}" - single file: ${fileInfos[0].file}`);
  }
});

console.log('\nDone!');
