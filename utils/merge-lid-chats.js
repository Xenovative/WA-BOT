#!/usr/bin/env node
/**
 * Utility script to scan for and merge detached LID/phone chat histories
 * 
 * WhatsApp's multi-device system uses LIDs (Linked Device IDs) which can cause
 * the same contact to have messages split between @lid and @c.us formats.
 * 
 * This script:
 * 1. Scans all chat history files for @lid format IDs
 * 2. Attempts to find matching @c.us phone number files
 * 3. Merges the histories into the phone number format
 * 4. Deletes the LID format files
 * 
 * Usage: node utils/merge-lid-chats.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const chatHistoryDir = path.join(__dirname, '..', 'chat_history');
const dryRun = process.argv.includes('--dry-run');

console.log('='.repeat(60));
console.log('LID Chat History Merger');
console.log('='.repeat(60));
console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
console.log(`Chat history directory: ${chatHistoryDir}`);
console.log('');

// Get all chat files
function getChatFiles() {
  try {
    const files = fs.readdirSync(chatHistoryDir);
    return files.filter(f => f.endsWith('.json') && f !== 'chats.json');
  } catch (error) {
    console.error('Error reading chat history directory:', error.message);
    return [];
  }
}

// Parse chat ID from filename
function parseChatId(filename) {
  // Remove .json extension
  const base = filename.replace('.json', '');
  
  // Check for platform prefix
  if (base.startsWith('whatsapp_')) {
    return {
      platform: 'whatsapp',
      id: base.substring(9) // Remove 'whatsapp_'
    };
  }
  
  return { platform: null, id: base };
}

// Check if a chat ID is a LID format
function isLidFormat(id) {
  return id.includes('_lid') || id.endsWith('@lid');
}

// Convert LID filename to potential phone filename patterns
function getLidToPhonePatterns(lidFilename) {
  const parsed = parseChatId(lidFilename);
  const lidId = parsed.id;
  
  // Extract the numeric part of the LID
  const numericPart = lidId.replace('_lid', '').replace('@lid', '').replace(/_/g, '');
  
  // Generate possible phone number patterns
  const patterns = [];
  
  // Pattern 1: Same numeric ID with @c.us
  patterns.push(`whatsapp_${numericPart}_c.us.json`);
  patterns.push(`whatsapp_${numericPart}_c_us.json`);
  
  return patterns;
}

// Load messages from a chat file
function loadMessages(filename) {
  try {
    const filepath = path.join(chatHistoryDir, filename);
    const content = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error.message);
    return [];
  }
}

// Merge two message arrays
function mergeMessages(messages1, messages2) {
  const all = [...messages1, ...messages2];
  
  // Sort by timestamp
  all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Remove duplicates
  const unique = all.filter((msg, index, self) =>
    index === self.findIndex(m => 
      m.timestamp === msg.timestamp && 
      m.content === msg.content && 
      m.role === msg.role
    )
  );
  
  return unique;
}

// Main function
function main() {
  const files = getChatFiles();
  console.log(`Found ${files.length} chat files`);
  console.log('');
  
  // Find LID files
  const lidFiles = files.filter(f => isLidFormat(f));
  console.log(`Found ${lidFiles.length} LID format files:`);
  lidFiles.forEach(f => console.log(`  - ${f}`));
  console.log('');
  
  if (lidFiles.length === 0) {
    console.log('No LID format chat files found. Nothing to merge.');
    return;
  }
  
  let mergedCount = 0;
  let orphanedLids = [];
  
  for (const lidFile of lidFiles) {
    console.log(`Processing: ${lidFile}`);
    
    const patterns = getLidToPhonePatterns(lidFile);
    let matchedPhoneFile = null;
    
    // Look for matching phone file
    for (const pattern of patterns) {
      if (files.includes(pattern)) {
        matchedPhoneFile = pattern;
        break;
      }
    }
    
    if (matchedPhoneFile) {
      console.log(`  Found matching phone file: ${matchedPhoneFile}`);
      
      const lidMessages = loadMessages(lidFile);
      const phoneMessages = loadMessages(matchedPhoneFile);
      
      console.log(`  LID messages: ${lidMessages.length}`);
      console.log(`  Phone messages: ${phoneMessages.length}`);
      
      const merged = mergeMessages(phoneMessages, lidMessages);
      console.log(`  Merged total: ${merged.length}`);
      
      if (!dryRun) {
        // Save merged messages to phone file
        const phonePath = path.join(chatHistoryDir, matchedPhoneFile);
        fs.writeFileSync(phonePath, JSON.stringify(merged, null, 2));
        console.log(`  Saved merged messages to ${matchedPhoneFile}`);
        
        // Delete LID file
        const lidPath = path.join(chatHistoryDir, lidFile);
        fs.unlinkSync(lidPath);
        console.log(`  Deleted LID file: ${lidFile}`);
      } else {
        console.log(`  [DRY RUN] Would merge and delete ${lidFile}`);
      }
      
      mergedCount++;
    } else {
      console.log(`  No matching phone file found`);
      console.log(`  Searched patterns: ${patterns.join(', ')}`);
      orphanedLids.push(lidFile);
    }
    
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  Merged: ${mergedCount} chat histories`);
  console.log(`  Orphaned LIDs: ${orphanedLids.length}`);
  
  if (orphanedLids.length > 0) {
    console.log('');
    console.log('Orphaned LID files (no matching phone file found):');
    orphanedLids.forEach(f => console.log(`  - ${f}`));
    console.log('');
    console.log('These may need manual resolution. The LID-to-phone mapping');
    console.log('will be discovered automatically when the contact messages again.');
  }
  
  if (dryRun && mergedCount > 0) {
    console.log('');
    console.log('Run without --dry-run to apply changes.');
  }
}

main();
