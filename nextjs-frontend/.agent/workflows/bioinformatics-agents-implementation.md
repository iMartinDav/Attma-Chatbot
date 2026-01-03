---
description: Implementation plan for advanced bioinformatics AI agents with auto-model selection, RAG, and self-verification
---

# 🧬 Attma Bioinformatics AI Agent System - Implementation Plan

## ✅ Implementation Status

| Phase | Feature | Status | Files Created |
|-------|---------|--------|---------------|
| 1 | Core Agent Infrastructure | ✅ DONE | `lib/ai/agents/types.ts`, `attma-agent.ts`, `task-router.ts` |
| 1 | Auto-Model Selection | ✅ DONE | `lib/ai/agents/task-router.ts` |
| 2 | Multi-Modal (PDF, Images) | 🟡 PARTIAL | Already supported via AI SDK |
| 3 | Enhanced Research Tools | ✅ DONE | `lib/ai/tools/research-tools.ts` |
| 3 | API Key Rotation | ✅ DONE | `lib/ai/tools/api-key-manager.ts` |
| 3 | Pathway Analysis Tools | ✅ DONE | `lib/ai/tools/pathway-tools.ts` |
| 4 | RAG System | 🔴 TODO | Needs pgvector setup |
| 5 | Self-Verifying Agents | ✅ DONE | `lib/ai/agents/self-verification.ts` |
| 6 | Agent Status UI | ✅ DONE | `components/chat/agent-status.tsx` |

---

## 🛠️ Files Created/Modified

### New Files:
1. **`lib/ai/agents/types.ts`** - Type definitions for tasks, models, citations
2. **`lib/ai/agents/task-router.ts`** - Auto-detection and model routing
3. **`lib/ai/agents/attma-agent.ts`** - Main agent orchestration
4. **`lib/ai/agents/self-verification.ts`** - Generate→Critique→Fix pattern
5. **`lib/ai/tools/api-key-manager.ts`** - API key rotation
6. **`lib/ai/tools/research-tools.ts`** - Enhanced PubMed, Semantic Scholar, Firecrawl, Gene Lookup
7. **`lib/ai/tools/pathway-tools.ts`** - KEGG, Reactome, GO enrichment, STRING
8. **`components/chat/agent-status.tsx`** - Beautiful animated status component

### Modified Files:
1. **`app/api/chat/route.ts`** - Added auto-model selection, multi-step execution
2. **`lib/ai/tools/index.ts`** - Added new tool exports
3. **`lib/ai/agents/index.ts`** - Added new agent exports
4. **`.env.local`** - Added API key configuration

---

## 🔑 Required API Keys

### Currently Configured:
- ✅ **OpenAI** - Already configured

### Optional (Add to `.env.local`):

```bash
# NCBI/PubMed (increases rate limit 3x)
# Get from: https://www.ncbi.nlm.nih.gov/account/settings/
NCBI_API_KEY=your_key_here
NCBI_API_KEY_2=optional_second_key

# Firecrawl (web search)
# Get from: https://firecrawl.dev/
FIRECRAWL_API_KEY=your_key_here

# Semantic Scholar (better paper search)
# Get from: https://www.semanticscholar.org/product/api
SEMANTIC_SCHOLAR_API_KEY=your_key_here
```

---

## 🚀 Quick Feature Summary

### Auto-Model Selection
The system automatically detects task type from the user's prompt and routes to the optimal model:

| Task | Keywords | Model |
|------|----------|-------|
| Quick Answer | "what is", "define" | gpt-4o-mini |
| Research | "pubmed", "papers", "literature" | gpt-4o |
| Code | "write code", "python", "scanpy" | gpt-4o |
| Reasoning | "why", "mechanism", "step by step" | o3-mini |
| Gene Lookup | gene symbols | gpt-4o-mini |
| Pathway | "kegg", "reactome", "go terms" | gpt-4o |

### Available Tools (12 Total)

**Research Tools:**
- `pubmed_search` - Enhanced with date filtering, abstracts
- `semantic_scholar` - Citation network analysis
- `firecrawl_search` - Web search for protocols
- `gene_lookup` - MyGene.info with GO terms

**Pathway Tools:**
- `kegg_pathway_search` - KEGG pathway lookup
- `reactome_pathway_search` - Reactome pathways
- `go_enrichment` - GO term enrichment (PANTHER)
- `string_interactions` - Protein interactions

**Document Tools:**
- `createDocument` - Create code/text artifacts
- `updateDocument` - Edit existing documents
- `requestSuggestions` - Get AI suggestions

### Self-Verification Pattern
For critical bioinformatics answers, the system can:
1. **Generate** - Create initial answer (gpt-4o-mini)
2. **Critique** - Review for accuracy (gpt-4o)
3. **Validate** - Check facts against APIs
4. **Fix** - Correct any errors (gpt-4o)

---

## 🧪 Testing Commands

After restarting the dev server, test with:

### Research Query
```
Search PubMed for recent CRISPR-Cas9 gene editing papers
```

### Gene Lookup
```
What is the function of TP53 and its associated pathways?
```

### Pathway Analysis
```
Find KEGG pathways related to apoptosis
```

### Code Generation
```
Write a Python script using Scanpy to cluster single-cell RNA-seq data
```

### Complex Reasoning
```
Why would a gene have low expression but high statistical significance in differential expression analysis?
```

---

## 📋 Remaining TODO

### Phase 4: RAG System
- [ ] Enable pgvector extension in Neon Postgres
- [ ] Create embeddings table schema
- [ ] Build embedding pipeline for papers
- [ ] Create RAG search tool
- [ ] Index gene/pathway annotations

### Future Enhancements
- [ ] BLAST sequence search tool
- [ ] ClinVar/gnomAD variant tools
- [ ] AlphaFold structure lookup
- [ ] Expression data from GTEx
- [ ] Integration with local databases

---

## 🎯 To Test Now

1. **Restart your dev server**:
   ```bash
   cd nextjs-frontend && npm run dev
   ```

2. **Add your API keys** (optional but recommended):
   - Firecrawl for web search
   - NCBI for higher PubMed rate limits

3. **Try the test queries** above to verify tools work

4. **Check console logs** for:
   - `[Agent] Auto-routing: Task=research, Model=chat-model-standard`
   - `[Agent] Detected domain: single_cell`

---

Ready to test! 🚀
