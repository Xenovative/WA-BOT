# Knowledge Base File Size Limits

## Quick Reference

**Default Limit:** 100MB per file  
**Configurable:** Yes, via environment variable  
**Maximum Recommended:** 1000MB (1GB)

---

## Configuration

### Set Custom File Size Limit

Add to your `.env` file:

```bash
# Set maximum file size in MB
KB_MAX_FILE_SIZE=500  # Allow files up to 500MB
```

**After changing:** Restart the WA-BOT server

---

## Common Limits

| Use Case | Recommended Limit | Reason |
|----------|------------------|---------|
| **Small documents** | 10-50MB | Text files, small PDFs |
| **Standard documents** | 100MB (default) | Most PDFs, Word docs |
| **Large PDFs** | 200-500MB | Technical manuals, books |
| **Very large files** | 500-1000MB | Scanned documents, image-heavy PDFs |
| **Extreme cases** | 1000MB+ | Not recommended - consider splitting |

---

## File Size Examples

### What fits in 100MB?

- **Text files**: ~50 million words
- **PDF documents**: ~1000 pages (text-based)
- **PDF with images**: ~200-500 pages
- **Word documents**: ~500-1000 pages
- **Scanned PDFs**: ~50-200 pages (depends on quality)

### What needs more than 100MB?

- Large technical manuals (500+ pages with images)
- Scanned books or documents
- High-resolution PDF exports
- Multiple embedded images/diagrams
- Uncompressed/unoptimized PDFs

---

## Error Messages

### File Too Large Error

**Error:**
```json
{
  "success": false,
  "error": "File too large. Maximum file size is 100MB",
  "details": "Your file exceeds the 100MB limit. Please upload a smaller file or increase KB_MAX_FILE_SIZE in your .env file.",
  "maxSizeMB": 100
}
```

**Solutions:**
1. **Increase the limit** in `.env`:
   ```bash
   KB_MAX_FILE_SIZE=500
   ```

2. **Compress the PDF**:
   - Use PDF compression tools
   - Reduce image quality
   - Remove unnecessary pages

3. **Split the document**:
   - Upload in multiple parts
   - Each part will be searchable independently

---

## Server Configuration

### How It Works

```javascript
// In guiServer.js
const maxFileSizeMB = parseInt(process.env.KB_MAX_FILE_SIZE || '100');
const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

const upload = multer({
  limits: { fileSize: maxFileSizeBytes }
});
```

### Console Output

When the server starts:
```
[Upload] Maximum file size: 100MB
```

When a file is too large:
```
[Upload] Multer error: LIMIT_FILE_SIZE File too large
```

---

## Performance Considerations

### Memory Usage

Large files require more RAM for processing:

| File Size | Estimated RAM Usage | Notes |
|-----------|-------------------|--------|
| 10MB | ~50MB | Minimal impact |
| 100MB | ~500MB | Default, safe for most systems |
| 500MB | ~2-3GB | Ensure adequate RAM |
| 1000MB | ~5-8GB | May cause issues on low-memory systems |

### Processing Time

Larger files take longer to process:

| File Size | Text Extraction | Embedding Generation |
|-----------|----------------|---------------------|
| 10MB | ~5 seconds | ~10 seconds |
| 100MB | ~30 seconds | ~1-2 minutes |
| 500MB | ~2-3 minutes | ~5-10 minutes |
| 1000MB | ~5-10 minutes | ~15-30 minutes |

**Note:** Times vary based on:
- Document type (text vs scanned)
- Embedding provider (OpenAI is faster)
- Server hardware
- Network speed (for OpenAI)

---

## Best Practices

### 1. Start with Default (100MB)

Most documents fit within 100MB. Only increase if needed.

### 2. Monitor Server Resources

```bash
# Check available memory
free -h  # Linux/Mac
Get-ComputerInfo | Select-Object CsPhysicallyInstalledMemory  # Windows
```

### 3. Optimize PDFs Before Upload

**Tools:**
- Adobe Acrobat (Reduce File Size)
- Online: smallpdf.com, ilovepdf.com
- Command line: `gs` (Ghostscript)

**Example compression:**
```bash
# Using Ghostscript
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook \
   -dNOPAUSE -dQUIET -dBATCH \
   -sOutputFile=output.pdf input.pdf
```

### 4. Split Very Large Documents

Instead of one 500MB file:
- Split into 5 × 100MB files
- Each part is searchable
- Faster processing
- Better error recovery

### 5. Consider Document Type

**Text-heavy PDFs:**
- Usually small file size
- Fast processing
- High quality embeddings

**Scanned PDFs:**
- Large file size
- Slower OCR processing
- May need higher limits

---

## Troubleshooting

### Upload Fails Silently

**Check:**
1. Browser console for errors
2. Server logs for multer errors
3. File size vs configured limit

### Server Crashes on Large Files

**Symptoms:**
- Server stops responding
- Out of memory errors
- Process killed

**Solutions:**
1. Reduce `KB_MAX_FILE_SIZE`
2. Increase server RAM
3. Split large documents
4. Process files during off-peak hours

### Slow Upload Performance

**Causes:**
- Large file size
- Slow network
- Server processing

**Solutions:**
1. Use OpenAI embeddings (faster)
2. Compress files before upload
3. Upload during off-peak hours
4. Increase server resources

---

## Advanced Configuration

### Different Limits for Different File Types

Currently not supported, but you can:

1. **Pre-process files** before upload
2. **Use external tools** to validate size
3. **Split large files** automatically

### Nginx/Reverse Proxy Limits

If using Nginx, also set:

```nginx
# In nginx.conf
client_max_body_size 500M;
```

### Express Body Parser Limits

Already configured in WA-BOT:
```javascript
app.use(express.json({ limit: '50mb' }));
```

---

## FAQ

### Q: What's the absolute maximum file size?

**A:** Theoretically unlimited, but practical limits:
- **Recommended max:** 1000MB (1GB)
- **Technical limit:** Node.js buffer size (~2GB)
- **Practical limit:** Server RAM and processing time

### Q: Can I upload multiple large files at once?

**A:** Yes! The multi-file upload queue processes files sequentially, so each file is processed within the limit.

### Q: Does the limit apply to all uploads?

**A:** Yes, the `KB_MAX_FILE_SIZE` applies to:
- Knowledge base document uploads
- Any file uploaded through the GUI
- Workflow file uploads (separate limit)

### Q: What happens if I exceed the limit?

**A:** You'll receive a clear error message:
```
File too large. Maximum file size is 100MB
```

The upload will be rejected before processing begins.

### Q: Can I set different limits for different users?

**A:** Not currently supported. The limit is global for all uploads.

---

## Summary

- **Default:** 100MB per file
- **Configure:** `KB_MAX_FILE_SIZE` in `.env`
- **Restart:** Required after changing limit
- **Monitor:** Server resources when using large limits
- **Optimize:** Compress PDFs before upload
- **Split:** Very large documents for better performance

For most use cases, the default 100MB limit is sufficient. Only increase if you regularly work with large technical documents or scanned PDFs.
