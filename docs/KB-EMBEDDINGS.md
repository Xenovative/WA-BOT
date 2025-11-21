# Knowledge Base Embeddings Configuration

## Overview

The WA-BOT knowledge base now supports **two embedding providers**:

1. **OpenAI Embeddings** (Recommended if you have an API key)
2. **HuggingFace Transformers** (Free, local, no API key required)

The system **automatically selects** the best option based on your configuration.

---

## Automatic Provider Selection

### With OpenAI API Key
```bash
# In your .env file
OPENAI_API_KEY=sk-...your-key...
```

**What happens:**
- ✓ Uses OpenAI's `text-embedding-3-small` model
- ✓ Fast embedding generation (API-based)
- ✓ No model download required
- ✓ High-quality embeddings
- ✓ Consistent performance

**Cost:** ~$0.00002 per 1,000 tokens (~$0.02 per million tokens)

### Without OpenAI API Key
```bash
# In your .env file
# OPENAI_API_KEY not set or empty
```

**What happens:**
- ✓ Uses HuggingFace `Xenova/all-MiniLM-L6-v2` model
- ✓ Completely free
- ✓ Runs locally (no external API calls)
- ⚠️ ~90MB model download on first use
- ⚠️ First upload may take 2-5 minutes

---

## Configuration Options

### OpenAI Embeddings (When API Key Available)

```bash
# .env configuration
OPENAI_API_KEY=sk-...your-key...

# Optional: Customize the OpenAI embedding model
KB_OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

**Available OpenAI Models:**
- `text-embedding-3-small` (default) - 1536 dimensions, best balance
- `text-embedding-3-large` - 3072 dimensions, highest quality
- `text-embedding-ada-002` - 1536 dimensions, legacy model

### HuggingFace Embeddings (Fallback)

```bash
# .env configuration
# No OPENAI_API_KEY required

# Optional: Customize the HuggingFace model
KB_EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
```

**Available HuggingFace Models:**
- `Xenova/all-MiniLM-L6-v2` (default) - 384 dimensions, fast
- `Xenova/all-mpnet-base-v2` - 768 dimensions, more accurate
- `Xenova/paraphrase-multilingual-MiniLM-L12-v2` - Multilingual support

---

## How It Works

### Initialization

```javascript
// In kbManager.js constructor
const useOpenAI = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '';

if (useOpenAI) {
  console.log('[KB] Using OpenAI embeddings (text-embedding-3-small)');
  this.embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: process.env.KB_OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  });
} else {
  console.log('[KB] Using HuggingFace embeddings (Xenova/all-MiniLM-L6-v2)');
  this.embeddings = new HuggingFaceTransformersEmbeddings({
    modelName: this.embeddingModel,
  });
}
```

### Console Output

When the server starts, you'll see:
```
[KB] Using OpenAI embeddings (text-embedding-3-small)
KB storage path: ./kb_data/vector_store
```

Or:
```
[KB] Using HuggingFace embeddings (Xenova/all-MiniLM-L6-v2)
KB storage path: ./kb_data/vector_store
```

---

## Comparison

| Feature | OpenAI | HuggingFace |
|---------|--------|-------------|
| **Cost** | ~$0.02/million tokens | Free |
| **Speed** | Fast (API) | Slower first time |
| **Setup** | API key required | No setup |
| **Download** | None | ~90MB first use |
| **Quality** | Excellent | Very good |
| **Privacy** | Data sent to OpenAI | Fully local |
| **Offline** | ❌ Requires internet | ✓ Works offline (after download) |

---

## Switching Providers

### From HuggingFace to OpenAI

1. Add your OpenAI API key to `.env`:
   ```bash
   OPENAI_API_KEY=sk-...your-key...
   ```

2. **Important:** Delete existing vector store to rebuild with new embeddings:
   ```bash
   rm -rf kb_data/vector_store/*
   ```

3. Restart the server

4. Re-upload your documents

**Why rebuild?** Different embedding models produce incompatible vector representations. Mixing embeddings from different models will cause incorrect search results.

### From OpenAI to HuggingFace

1. Remove or comment out your OpenAI API key in `.env`:
   ```bash
   # OPENAI_API_KEY=sk-...your-key...
   ```

2. **Important:** Delete existing vector store:
   ```bash
   rm -rf kb_data/vector_store/*
   ```

3. Restart the server

4. Re-upload your documents

---

## Best Practices

### Use OpenAI When:
- ✓ You already have an OpenAI API key
- ✓ You want the fastest upload times
- ✓ You're processing many documents
- ✓ You need consistent performance
- ✓ Cost is not a concern (~$0.02/million tokens)

### Use HuggingFace When:
- ✓ You want a completely free solution
- ✓ Privacy is important (all local processing)
- ✓ You need offline capability
- ✓ You have a small number of documents
- ✓ You don't mind the initial model download

---

## Troubleshooting

### Check Which Provider Is Active

Run the diagnostic script:
```bash
node utils/test-kb-upload.js
```

Look for:
```
1. KB_ENABLED: true
   Embedding Provider: OpenAI
   Model: text-embedding-3-small (fast, API-based)
```

Or:
```
1. KB_ENABLED: true
   Embedding Provider: HuggingFace
   Model: Xenova/all-MiniLM-L6-v2 (local, ~90MB download on first use)
```

### OpenAI Embeddings Not Working

**Check:**
1. API key is set correctly in `.env`
2. API key is valid (not expired)
3. You have credits in your OpenAI account
4. Server was restarted after adding the key

**Test:**
```bash
# Check if key is loaded
node -e "require('dotenv').config(); console.log('Key:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set')"
```

### HuggingFace Model Download Stuck

**Symptoms:**
- First upload takes very long
- No progress messages

**Solutions:**
1. Check internet connection
2. Check disk space (need ~200MB free)
3. Wait patiently (can take 2-5 minutes on slow connections)
4. Check server console for download progress

---

## Performance Tips

### For Large Document Collections (100+ documents)

**Recommended:** Use OpenAI embeddings
- Faster upload times
- More consistent performance
- Better search quality

**Cost estimate:**
- 100 documents × 5 pages × 500 words = 250,000 words
- ~333,000 tokens
- Cost: ~$0.007 (less than a penny)

### For Small Document Collections (<10 documents)

**Recommended:** Use HuggingFace embeddings
- Free
- One-time download
- Good enough quality for small collections

---

## Migration Guide

### Migrating Existing Knowledge Base

If you already have documents in your knowledge base and want to switch embedding providers:

1. **Backup your documents:**
   ```bash
   # Your uploaded files are in:
   ls uploads/
   ```

2. **Clear the vector store:**
   ```bash
   rm -rf kb_data/vector_store/*
   ```

3. **Update your `.env` file** (add or remove `OPENAI_API_KEY`)

4. **Restart the server**

5. **Re-upload your documents** through the GUI

The system will automatically use the new embedding provider.

---

## Advanced Configuration

### Custom OpenAI Embedding Model

```bash
# Use the larger, more accurate model
KB_OPENAI_EMBEDDING_MODEL=text-embedding-3-large
```

**Note:** Larger models cost more but provide better search quality.

### Custom HuggingFace Model

```bash
# Use a multilingual model
KB_EMBEDDING_MODEL=Xenova/paraphrase-multilingual-MiniLM-L12-v2
```

**Note:** Different models have different download sizes and performance characteristics.

---

## Summary

The knowledge base now **automatically uses the best embedding provider** based on your configuration:

- **Have OpenAI key?** → Uses OpenAI (fast, accurate)
- **No OpenAI key?** → Uses HuggingFace (free, local)

No manual configuration needed - just set your `OPENAI_API_KEY` if you have one, and the system handles the rest!
