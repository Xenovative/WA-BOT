const fs = require('fs');
const path = require('path');

function cleanupChatFiles() {
  console.log('Cleaning up chat files...\n');
  
  const chatDir = path.join(__dirname, 'data', 'chatHistory');
  
  if (!fs.existsSync(chatDir)) {
    console.log('Chat directory does not exist, creating it...');
    fs.mkdirSync(chatDir, { recursive: true });
    return;
  }
  
  // Get all chat files
  const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.json') && f !== 'chats.json');
  
  console.log(`Found ${files.length} chat files:`);
  files.forEach(file => {
    const filePath = path.join(chatDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const messages = JSON.parse(content);
      console.log(`  ${file}: ${messages.length} messages`);
      
      // Remove empty files
      if (!Array.isArray(messages) || messages.length === 0) {
        console.log(`    Removing empty file: ${file}`);
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.log(`    Error reading ${file}:`, error.message);
      console.log(`    Removing corrupted file: ${file}`);
      fs.unlinkSync(filePath);
    }
  });
  
  // Recreate the index file
  const indexFile = path.join(chatDir, 'chats.json');
  const remainingFiles = fs.readdirSync(chatDir).filter(f => f.endsWith('.json') && f !== 'chats.json');
  
  const chatIndex = {};
  remainingFiles.forEach(file => {
    const chatId = path.basename(file, '.json');
    const filePath = path.join(chatDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const messages = JSON.parse(content);
      
      chatIndex[chatId] = {
        lastMessage: messages.length > 0 ? messages[messages.length - 1].content : '',
        messageCount: messages.length,
        lastUpdated: messages.length > 0 ? messages[messages.length - 1].timestamp : new Date().toISOString(),
        platform: chatId.includes('whatsapp') ? 'whatsapp' : chatId.includes('telegram') ? 'telegram' : 'unknown'
      };
    } catch (error) {
      console.error(`Error processing ${file} for index:`, error.message);
    }
  });
  
  fs.writeFileSync(indexFile, JSON.stringify(chatIndex, null, 2));
  console.log(`\nUpdated index file with ${Object.keys(chatIndex).length} chats`);
  
  console.log('\nCleanup completed!');
}

if (require.main === module) {
  cleanupChatFiles();
}
