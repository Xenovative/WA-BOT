# Knowledge Base Upload Troubleshooting Guide

## Issue: Documents Not Persisting After Upload

### Quick Diagnosis

Run the diagnostic script:
```bash
node utils/test-kb-upload.js
```

### Common Causes & Solutions

#### 1. **Knowledge Base Not Enabled**
**Symptom:** Uploads succeed but documents don't appear

**Check:**
```bash
# In your .env file
KB_ENABLED=true
```

**Fix:** Set `KB_ENABLED=true` in your `.env` file and restart the server.

---

#### 2. **Server Not Restarted After Code Changes**
**Symptom:** After updating the code, uploads don't work

**Fix:** Restart the WA-BOT server:
```bash
# Stop the server (Ctrl+C)
# Then restart
npm start
```

---

#### 3. **Embedding Model Download Timeout**
**Symptom:** First upload takes very long or fails silently

**Cause:** The HuggingFace embedding model (`Xenova/all-MiniLM-L6-v2`) needs to download on first use (~90MB)

**Check Server Logs:**
Look for messages like:
```
[KB] Vector store not initialized, initializing now...
[KB] Vector store initialization complete
```

**Fix:** 
- Wait for the first upload to complete (may take 2-5 minutes on first run)
- Check your internet connection
- Subsequent uploads will be fast

---

#### 4. **File Path Issues**
**Symptom:** Upload succeeds but document can't be found later

**Check:**
```bash
# Check if files exist in uploads directory
ls uploads/
```

**What Should Happen:**
- Files are saved to `uploads/` with timestamp prefix: `1762250506751_文档.pdf`
- File paths are stored in `kb_data/vector_store/document_map.json`

**Fix:** Ensure the `uploads/` directory exists and has write permissions.

---

#### 5. **Chinese Character Encoding Issues**
**Symptom:** Chinese filenames appear garbled or as underscores

**Fix:** Already fixed in the latest code! The system now:
- Properly decodes UTF-8 filenames using `Buffer.from(filename, 'latin1').toString('utf8')`
- Preserves Chinese characters in both storage and display
- Uses timestamp prefixes to prevent conflicts

---

#### 6. **File Size Limit Exceeded**
**Symptom:** Upload fails with "File too large" error

**Default Limit:** 100MB per file

**Fix:**
```bash
# In .env file, increase the limit (in MB)
KB_MAX_FILE_SIZE=500  # Allow files up to 500MB
```

**Restart the server** after changing the limit.

**Error Message:**
```
File too large. Maximum file size is 100MB
Your file exceeds the 100MB limit. Please upload a smaller file or increase KB_MAX_FILE_SIZE in your .env file.
```

**Recommendations:**
- **For PDFs**: 100MB is usually sufficient for ~1000 pages
- **For large documents**: Increase to 500MB or 1000MB
- **For very large files**: Consider splitting into smaller documents
- **Memory consideration**: Very large files may require more RAM for processing

---

#### 7. **Vector Store Initialization Failure**
**Symptom:** Error messages in console about vector store

**Check Server Logs:**
```
[KB] Failed to initialize vector store: [error message]
[KB] Vector store is still null after initialization
```

**Common Causes:**
- Missing dependencies (run `npm install`)
- Insufficient disk space
- Permission issues on `kb_data/` directory

**Fix:**
```bash
# Reinstall dependencies
npm install

# Check disk space
df -h

# Fix permissions (Linux/Mac)
chmod -R 755 kb_data/

# Windows: Ensure the folder isn't read-only
```

---

### Verification Steps

After uploading a document, verify persistence:

1. **Check Document Map:**
```bash
cat kb_data/vector_store/document_map.json
```
Should show your document with metadata.

2. **Check Document List:**
```bash
cat kb_data/vector_store/document_list.json
```
Should list all documents.

3. **Check Uploads Directory:**
```bash
ls -la uploads/
```
Should contain your uploaded files with timestamp prefixes.

4. **Check Server Logs:**
Look for these success messages:
```
[KB] ✓ Document "文档.pdf" successfully persisted to knowledge base
[KB] ✓ Total documents in KB: 1
[KB] Saved document map with 2 entries
[KB] Saved vector store to ./kb_data/vector_store
```

---

### Testing Upload Persistence

1. **Upload a test document** through the GUI
2. **Check the server console** for success messages
3. **Refresh the Knowledge Base tab** - document should appear
4. **Restart the server**
5. **Refresh the Knowledge Base tab again** - document should still be there

If the document disappears after restart, check:
- Document map file exists and contains your document
- Vector store files exist (hnswlib.index, docstore.json)
- Server logs for initialization errors

---

### Multi-File Upload

The system now supports uploading multiple files at once:

1. **Select multiple files** in the file picker (Ctrl+Click or Cmd+Click)
2. **Files are queued** and uploaded one at a time
3. **Progress is shown** for each file
4. **Toast notifications** confirm each upload
5. **Document list refreshes** automatically when all uploads complete

---

### Cleanup Duplicate Documents

If you uploaded documents before the fixes and have duplicates:

```bash
node utils/cleanup-kb-duplicates.js
```

This will:
- Detect duplicate documents (same base name)
- Keep the newest version
- Remove older duplicates
- Clean up orphaned files
- Rebuild the document map

---

### Environment Variables

Required settings in `.env`:
```bash
# Enable knowledge base
KB_ENABLED=true

# Storage path (default is fine)
KB_STORAGE_PATH=./kb_data

# File upload limit in MB (default: 100MB)
KB_MAX_FILE_SIZE=100

# Embedding Configuration
# If OPENAI_API_KEY is set, OpenAI embeddings will be used automatically (faster, more accurate)
# Otherwise, falls back to local HuggingFace model (no API key required, but slower on first use)
KB_EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2  # Used when OpenAI key not available
KB_OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # Used when OpenAI key is available

# Chunk settings (adjust for your needs)
KB_CHUNK_SIZE=1000
KB_CHUNK_OVERLAP=200
KB_TOP_K=5
```

**Embedding Provider Selection:**
- **With OpenAI Key**: Uses `text-embedding-3-small` (fast, no download, costs ~$0.00002/1K tokens)
- **Without OpenAI Key**: Uses local HuggingFace model (free, ~90MB download on first use)

---

### Still Having Issues?

1. **Run the diagnostic script:**
   ```bash
   node utils/test-kb-upload.js
   ```

2. **Check server logs** for detailed error messages

3. **Try uploading a simple text file** first to rule out file format issues

4. **Verify the file size** - default limit is 100MB (configurable via `KB_MAX_FILE_SIZE` in .env)
   ```bash
   # In .env file - increase to 500MB if needed
   KB_MAX_FILE_SIZE=500
   ```

5. **Check Node.js version** - requires Node.js 14+ for proper Buffer handling

---

### Success Indicators

When everything is working correctly, you should see:

✓ Upload button accepts multiple files  
✓ Progress indicator shows current file  
✓ Toast notifications for each upload  
✓ Documents appear in the Knowledge Base tab  
✓ Documents persist after server restart  
✓ Chinese characters display correctly  
✓ RAG queries return relevant document chunks  

---

### Getting Help

If you're still experiencing issues:
1. Run `node utils/test-kb-upload.js` and save the output
2. Check server console logs during upload
3. Verify your `.env` configuration
4. Check file permissions on `kb_data/` and `uploads/` directories
