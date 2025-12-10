#!/usr/bin/env node
/**
 * Utility script to scan WhatsApp chats and discover LID-to-phone mappings
 * 
 * This script requires the WhatsApp client to be running and connected.
 * It will scan all chats and contacts to find LID-to-phone number mappings.
 * 
 * Usage: 
 *   - Run this while the main bot is running
 *   - Or call the API endpoint: GET /api/lid-mappings
 * 
 * The mappings are automatically saved to data/lid_mapping.json
 */

const fs = require('fs');
const path = require('path');

const mappingFile = path.join(__dirname, '..', 'data', 'lid_mapping.json');
const chatHistoryDir = path.join(__dirname, '..', 'chat_history');

console.log('='.repeat(60));
console.log('LID Mapping Scanner');
console.log('='.repeat(60));
console.log('');

// Load existing mappings
function loadMappings() {
  try {
    if (fs.existsSync(mappingFile)) {
      const data = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
      return data.mappings || {};
    }
  } catch (error) {
    console.error('Error loading mappings:', error.message);
  }
  return {};
}

// Get all LID chat files
function getLidChatFiles() {
  try {
    const files = fs.readdirSync(chatHistoryDir);
    return files.filter(f => 
      f.endsWith('.json') && 
      f !== 'chats.json' && 
      (f.includes('_lid') || f.includes('@lid'))
    );
  } catch (error) {
    console.error('Error reading chat history:', error.message);
    return [];
  }
}

// Extract LID from filename
function extractLidFromFilename(filename) {
  // whatsapp_147867301863524_lid.json -> 147867301863524@lid
  const match = filename.match(/whatsapp_(\d+)_lid\.json/);
  if (match) {
    return `${match[1]}@lid`;
  }
  return null;
}

// Main
function main() {
  const mappings = loadMappings();
  const lidFiles = getLidChatFiles();
  
  console.log(`Existing mappings: ${Object.keys(mappings).length}`);
  console.log(`LID chat files: ${lidFiles.length}`);
  console.log('');
  
  if (Object.keys(mappings).length > 0) {
    console.log('Known LID-to-Phone mappings:');
    for (const [lid, phone] of Object.entries(mappings)) {
      console.log(`  ${lid} -> ${phone}`);
    }
    console.log('');
  }
  
  // Check which LIDs are unmapped
  const unmappedLids = [];
  for (const file of lidFiles) {
    const lid = extractLidFromFilename(file);
    if (lid && !mappings[lid]) {
      unmappedLids.push({ file, lid });
    }
  }
  
  if (unmappedLids.length > 0) {
    console.log('Unmapped LID chat files:');
    for (const { file, lid } of unmappedLids) {
      console.log(`  ${file}`);
      console.log(`    LID: ${lid}`);
      console.log(`    Status: Waiting for contact to message again for auto-discovery`);
    }
    console.log('');
    console.log('To manually add a mapping, use the API:');
    console.log('  curl -X POST http://localhost:3000/api/chats/merge-lid \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"lid": "123456@lid", "phone": "85290897701@c.us"}\'');
  } else if (lidFiles.length > 0) {
    console.log('All LID files have known phone mappings!');
  } else {
    console.log('No LID chat files found.');
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('How LID resolution works:');
  console.log('='.repeat(60));
  console.log('');
  console.log('1. When the bot starts, it scans all WhatsApp chats to find');
  console.log('   contacts that have both LID and phone number.');
  console.log('');
  console.log('2. When a message arrives from an @lid contact, the resolver');
  console.log('   tries to find the phone number from:');
  console.log('   - Cached mappings (data/lid_mapping.json)');
  console.log('   - WhatsApp client getContactById()');
  console.log('   - Message properties');
  console.log('');
  console.log('3. Once a mapping is discovered, chat histories are automatically');
  console.log('   merged into the phone number format.');
  console.log('');
  console.log('4. For unmapped LIDs, the mapping will be discovered when the');
  console.log('   contact messages again, or you can add it manually via API.');
}

main();
