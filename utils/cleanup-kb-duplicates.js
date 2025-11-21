/**
 * Utility script to detect and remove duplicate documents from the knowledge base
 * Run with: node utils/cleanup-kb-duplicates.js
 */

const fs = require('fs-extra');
const path = require('path');

async function cleanupDuplicates() {
  try {
    const kbDataPath = path.resolve(__dirname, '../kb_data/vector_store');
    const documentMapPath = path.join(kbDataPath, 'document_map.json');
    const documentListPath = path.join(kbDataPath, 'document_list.json');
    
    console.log('Checking for duplicate documents in knowledge base...');
    
    // Load document map
    if (!await fs.pathExists(documentMapPath)) {
      console.log('No document map found. Knowledge base is empty or not initialized.');
      return;
    }
    
    const documentMap = await fs.readJson(documentMapPath);
    const entries = Object.entries(documentMap);
    
    console.log(`Found ${entries.length} total entries in document map`);
    
    // Group documents by their base name (without timestamp prefix)
    const documentGroups = new Map();
    
    for (const [key, value] of entries) {
      if (key === 'init') continue;
      
      // Extract base name (remove timestamp prefix if present)
      let baseName = key;
      const timestampMatch = key.match(/^\d+_(.*)/);
      if (timestampMatch) {
        baseName = timestampMatch[1];
      }
      
      if (!documentGroups.has(baseName)) {
        documentGroups.set(baseName, []);
      }
      
      documentGroups.get(baseName).push({ key, value });
    }
    
    // Find duplicates
    const duplicates = [];
    for (const [baseName, docs] of documentGroups.entries()) {
      if (docs.length > 1) {
        duplicates.push({ baseName, docs });
      }
    }
    
    if (duplicates.length === 0) {
      console.log('✓ No duplicate documents found!');
      return;
    }
    
    console.log(`\nFound ${duplicates.length} sets of duplicate documents:\n`);
    
    for (const { baseName, docs } of duplicates) {
      console.log(`Document: ${baseName}`);
      console.log(`  Duplicates found: ${docs.length}`);
      
      // Sort by timestamp (newest first)
      docs.sort((a, b) => {
        const timeA = new Date(a.value.timestamp || 0).getTime();
        const timeB = new Date(b.value.timestamp || 0).getTime();
        return timeB - timeA;
      });
      
      // Keep the newest, mark others for deletion
      const toKeep = docs[0];
      const toDelete = docs.slice(1);
      
      console.log(`  ✓ Keeping: ${toKeep.key} (${new Date(toKeep.value.timestamp).toLocaleString()})`);
      
      for (const doc of toDelete) {
        console.log(`  ✗ Removing: ${doc.key} (${new Date(doc.value.timestamp).toLocaleString()})`);
        delete documentMap[doc.key];
        
        // Also delete the uploaded file if it exists
        if (doc.value.filePath && await fs.pathExists(doc.value.filePath)) {
          await fs.remove(doc.value.filePath);
          console.log(`    Deleted file: ${doc.value.filePath}`);
        }
      }
      
      console.log('');
    }
    
    // Save updated document map
    await fs.writeJson(documentMapPath, documentMap, { spaces: 2 });
    console.log('✓ Updated document map saved');
    
    // Rebuild document list
    const docList = Object.entries(documentMap)
      .filter(([key]) => key !== 'init')
      .map(([key, value]) => ({
        name: key,
        chunks: value.chunks || 0,
        timestamp: value.timestamp || new Date().toISOString(),
        filePath: value.filePath || '',
        fileSize: value.fileSize || 0,
        fileType: value.fileType || ''
      }));
    
    await fs.writeJson(documentListPath, docList, { spaces: 2 });
    console.log('✓ Updated document list saved');
    
    console.log('\n✓ Cleanup complete! The vector store will be rebuilt on next server start.');
    console.log('  Note: You may need to restart the WA-BOT server for changes to take effect.');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupDuplicates().then(() => {
  console.log('\nDone!');
  process.exit(0);
});
