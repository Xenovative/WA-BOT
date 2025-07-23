/**
 * Script to fix corrupted chat history files and rebuild the index
 */
const fs = require('fs');
const path = require('path');

console.log('=== Fixing Chat History ===\n');

const chatHistoryDir = path.join(__dirname, 'chat_history');
const indexFile = path.join(chatHistoryDir, 'chats.json');

if (!fs.existsSync(chatHistoryDir)) {
  console.log('Chat history directory does not exist. Nothing to fix.');
  process.exit(0);
}

// Get all chat files
const chatFiles = fs.readdirSync(chatHistoryDir).filter(
  file => file.endsWith('.json') && file !== 'chats.json'
);

console.log(`Found ${chatFiles.length} chat files to examine...\n`);

let emptyFiles = [];
let validFiles = [];
let corruptedFiles = [];

// Examine each file
chatFiles.forEach(file => {
  const filePath = path.join(chatHistoryDir, file);
  const chatId = path.basename(file, '.json');
  
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    
    if (content === '[]' || content === '') {
      emptyFiles.push({ file, chatId, filePath });
    } else {
      try {
        const messages = JSON.parse(content);
        if (Array.isArray(messages) && messages.length > 0) {
          validFiles.push({ file, chatId, filePath, messageCount: messages.length });
        } else {
          emptyFiles.push({ file, chatId, filePath });
        }
      } catch (parseError) {
        corruptedFiles.push({ file, chatId, filePath, error: parseError.message });
      }
    }
  } catch (readError) {
    corruptedFiles.push({ file, chatId, filePath, error: readError.message });
  }
});

console.log(`Analysis Results:`);
console.log(`  - Valid files with messages: ${validFiles.length}`);
console.log(`  - Empty files: ${emptyFiles.length}`);
console.log(`  - Corrupted files: ${corruptedFiles.length}\n`);

// Show valid files
if (validFiles.length > 0) {
  console.log('Valid chat files:');
  validFiles.forEach(({ file, messageCount }) => {
    console.log(`  ✅ ${file} (${messageCount} messages)`);
  });
  console.log();
}

// Show corrupted files
if (corruptedFiles.length > 0) {
  console.log('Corrupted chat files:');
  corruptedFiles.forEach(({ file, error }) => {
    console.log(`  ❌ ${file} - ${error}`);
  });
  console.log();
}

// Clean up empty files
if (emptyFiles.length > 0) {
  console.log(`Cleaning up ${emptyFiles.length} empty chat files...`);
  emptyFiles.forEach(({ file, filePath }) => {
    try {
      fs.unlinkSync(filePath);
      console.log(`  🗑️  Deleted ${file}`);
    } catch (error) {
      console.log(`  ❌ Failed to delete ${file}: ${error.message}`);
    }
  });
  console.log();
}

// Rebuild the index file
console.log('Rebuilding chat index...');
const chatHandler = require('./handlers/chatHandler');

// Force reload conversations from disk
delete require.cache[require.resolve('./handlers/chatHandler')];
const freshChatHandler = require('./handlers/chatHandler');

const allChats = freshChatHandler.getAllChats();
console.log(`Rebuilt index with ${allChats.length} valid chats\n`);

if (allChats.length > 0) {
  console.log('Current valid chats:');
  allChats.forEach(chat => {
    console.log(`  📱 ${chat.id} (${chat.messageCount} messages) - ${chat.preview.substring(0, 50)}...`);
  });
}

console.log('\n=== Chat History Fix Complete ===');
