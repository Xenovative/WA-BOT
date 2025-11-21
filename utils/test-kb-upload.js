/**
 * Test script to diagnose KB upload persistence issues
 * Run with: node utils/test-kb-upload.js
 */

const fs = require('fs-extra');
const path = require('path');

async function testKBPersistence() {
  console.log('=== Knowledge Base Persistence Test ===\n');
  
  // Check if KB is enabled
  require('dotenv').config();
  const kbEnabled = process.env.KB_ENABLED === 'true';
  console.log(`1. KB_ENABLED: ${kbEnabled}`);
  
  if (!kbEnabled) {
    console.log('   ❌ Knowledge base is disabled in .env file');
    console.log('   Fix: Set KB_ENABLED=true in your .env file');
    return;
  }
  
  // Check embedding provider
  const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '';
  const embeddingProvider = hasOpenAIKey ? 'OpenAI' : 'HuggingFace';
  console.log(`   Embedding Provider: ${embeddingProvider}`);
  if (hasOpenAIKey) {
    const model = process.env.KB_OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    console.log(`   Model: ${model} (fast, API-based)`);
  } else {
    const model = process.env.KB_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
    console.log(`   Model: ${model} (local, ~90MB download on first use)`);
  }
  
  // Check vector store directory
  const kbDataPath = path.resolve(__dirname, '../kb_data/vector_store');
  const exists = await fs.pathExists(kbDataPath);
  console.log(`\n2. Vector store directory exists: ${exists}`);
  console.log(`   Path: ${kbDataPath}`);
  
  if (!exists) {
    console.log('   ⚠️  Directory will be created on first upload');
  }
  
  // Check document map
  const docMapPath = path.join(kbDataPath, 'document_map.json');
  const mapExists = await fs.pathExists(docMapPath);
  console.log(`\n3. Document map exists: ${mapExists}`);
  
  if (mapExists) {
    const docMap = await fs.readJson(docMapPath);
    const docCount = Object.keys(docMap).filter(k => k !== 'init').length;
    console.log(`   Documents in map: ${docCount}`);
    
    if (docCount > 0) {
      console.log('   Documents:');
      for (const [name, info] of Object.entries(docMap)) {
        if (name === 'init') continue;
        console.log(`   - ${name} (${info.chunks} chunks, ${new Date(info.timestamp).toLocaleString()})`);
        
        // Check if file still exists
        if (info.filePath) {
          const fileExists = await fs.pathExists(info.filePath);
          console.log(`     File exists: ${fileExists} (${info.filePath})`);
        }
      }
    }
  }
  
  // Check uploads directory
  const uploadsPath = path.resolve(__dirname, '../uploads');
  const uploadsExists = await fs.pathExists(uploadsPath);
  console.log(`\n4. Uploads directory exists: ${uploadsExists}`);
  
  if (uploadsExists) {
    const files = await fs.readdir(uploadsPath);
    console.log(`   Files in uploads: ${files.length}`);
    if (files.length > 0) {
      files.forEach(f => console.log(`   - ${f}`));
    }
  }
  
  // Check vector store files
  console.log(`\n5. Vector store files:`);
  const indexPath = path.join(kbDataPath, 'hnswlib.index');
  const docstorePath = path.join(kbDataPath, 'docstore.json');
  const argsPath = path.join(kbDataPath, 'args.json');
  
  const indexExists = await fs.pathExists(indexPath);
  const docstoreExists = await fs.pathExists(docstorePath);
  const argsExists = await fs.pathExists(argsPath);
  
  console.log(`   - hnswlib.index: ${indexExists}`);
  console.log(`   - docstore.json: ${docstoreExists}`);
  console.log(`   - args.json: ${argsExists}`);
  
  if (docstoreExists) {
    const docstore = await fs.readFile(docstorePath, 'utf-8');
    const docs = JSON.parse(docstore);
    console.log(`   - Documents in docstore: ${docs.length}`);
  }
  
  // Test KB Manager initialization
  console.log(`\n6. Testing KB Manager initialization...`);
  try {
    const kbManager = require('../kb/kbManager');
    await kbManager.initialize();
    console.log('   ✓ KB Manager initialized successfully');
    
    const docs = await kbManager.listDocuments();
    console.log(`   ✓ Listed ${docs.length} documents`);
    
    if (docs.length > 0) {
      console.log('   Documents:');
      docs.forEach(doc => {
        console.log(`   - ${doc.name} (${doc.chunks} chunks, ${doc.fileSize} bytes)`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  }
  
  console.log('\n=== Test Complete ===');
  console.log('\nIf documents are not persisting:');
  console.log('1. Check that KB_ENABLED=true in .env');
  console.log('2. Restart the WA-BOT server after uploading');
  console.log('3. Check server console for upload errors');
  console.log('4. Ensure the embedding model downloads successfully (first upload may take time)');
}

testKBPersistence().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
