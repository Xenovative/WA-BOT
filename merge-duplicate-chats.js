const fs = require('fs');
const path = require('path');

const chatHistoryDir = path.join(__dirname, 'chat_history');

console.log('🔍 Analyzing and merging duplicate chat files...\n');

if (!fs.existsSync(chatHistoryDir)) {
  console.log('❌ Chat history directory does not exist');
  process.exit(0);
}

const files = fs.readdirSync(chatHistoryDir).filter(
  file => file.endsWith('.json') && file !== 'chats.json'
);

console.log(`📁 Found ${files.length} chat files:`, files);

// Group files by their potential base chat ID
const groups = {};

files.forEach(file => {
  const baseName = file.replace('.json', '');
  
  // Extract the actual chat ID by handling different formats
  let extractedId = baseName;
  let platforms = [];
  
  // Handle platform prefixes
  if (baseName.includes('_')) {
    const parts = baseName.split('_');
    
    // Look for patterns like whatsapp_whatsapp_number or whatsapp_number_c_us
    if (parts[0] === 'whatsapp') {
      platforms.push('whatsapp');
      
      if (parts[1] === 'whatsapp') {
        // Double prefix: whatsapp_whatsapp_number
        platforms.push('whatsapp');
        extractedId = parts.slice(2).join('_');
      } else {
        // Single prefix: whatsapp_number_c_us
        extractedId = parts.slice(1).join('_');
      }
    } else if (parts[0] === 'telegram') {
      platforms.push('telegram');
      extractedId = parts.slice(1).join('_');
    }
  }
  
  // Normalize WhatsApp IDs - remove _c_us suffix for comparison
  let normalizedId = extractedId;
  if (extractedId.endsWith('_c_us')) {
    normalizedId = extractedId.replace('_c_us', '');
  }
  
  // Group by the normalized ID to catch duplicates
  const key = normalizedId;
  if (!groups[key]) groups[key] = [];
  groups[key].push({
    file,
    platforms,
    extractedId,
    originalName: baseName
  });
});

console.log('\n📊 Analysis results:');
let duplicatesFound = 0;
let totalMerged = 0;

Object.entries(groups).forEach(([baseId, fileInfos]) => {
  if (fileInfos.length > 1) {
    duplicatesFound++;
    console.log(`\n🔥 DUPLICATE FOUND for "${baseId}":`);
    
    let allMessages = [];
    let filesToDelete = [];
    let keepFile = null;
    
    fileInfos.forEach(info => {
      const filePath = path.join(chatHistoryDir, info.file);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`  📄 ${info.file} - ${content.length} messages (platforms: ${info.platforms.join(', ') || 'none'})`);
        
        // Add all messages to the combined array
        allMessages = allMessages.concat(content);
        
        // Prefer files with single platform prefix over double prefix
        if (!keepFile || info.platforms.length < keepFile.platforms.length) {
          if (keepFile) filesToDelete.push(keepFile.file);
          keepFile = info;
        } else {
          filesToDelete.push(info.file);
        }
      } catch (error) {
        console.error(`  ❌ Error reading ${info.file}:`, error.message);
      }
    });
    
    if (keepFile && allMessages.length > 0) {
      // Sort messages by timestamp
      allMessages.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeA - timeB;
      });
      
      // Remove duplicate messages (same role, content, and similar timestamp)
      const uniqueMessages = [];
      allMessages.forEach(msg => {
        const isDuplicate = uniqueMessages.some(existing => 
          existing.role === msg.role && 
          existing.content === msg.content &&
          Math.abs(new Date(existing.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 5000 // 5 second tolerance
        );
        
        if (!isDuplicate) {
          uniqueMessages.push(msg);
        }
      });
      
      console.log(`  📝 Merged: ${allMessages.length} total → ${uniqueMessages.length} unique messages`);
      console.log(`  ✅ Keeping: ${keepFile.file}`);
      console.log(`  🗑  Deleting: ${filesToDelete.join(', ')}`);
      
      // Write merged content to the keep file
      const keepFilePath = path.join(chatHistoryDir, keepFile.file);
      fs.writeFileSync(keepFilePath, JSON.stringify(uniqueMessages, null, 2));
      
      // Delete duplicate files
      filesToDelete.forEach(fileToDelete => {
        try {
          const deleteFilePath = path.join(chatHistoryDir, fileToDelete);
          fs.unlinkSync(deleteFilePath);
          console.log(`    🗑  Deleted: ${fileToDelete}`);
          totalMerged++;
        } catch (error) {
          console.error(`    ❌ Error deleting ${fileToDelete}:`, error.message);
        }
      });
    }
  } else {
    console.log(`✅ "${baseId}" - single file: ${fileInfos[0].file}`);
  }
});

console.log('\n📈 Summary:');
console.log(`  Duplicates found: ${duplicatesFound}`);
console.log(`  Files merged/deleted: ${totalMerged}`);
console.log(`  Operation complete! 🎉`);

// Regenerate the chat index
console.log('\n🔄 Regenerating chat index...');
try {
  const ChatHandler = require('./handlers/chatHandler');
  const handler = new ChatHandler();
  handler.updateChatIndex();
  console.log('✅ Chat index updated successfully');
} catch (error) {
  console.error('❌ Error updating chat index:', error.message);
}
