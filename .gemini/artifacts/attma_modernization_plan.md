# 🧬 Attma Modernization Plan v2 - OpenAI Focused

**Version:** 2.0 (OpenAI-Centric)  
**Date:** December 31, 2024  
**Status:** Completed

---

## Executive Summary

This focused plan leverages **your existing OpenAI API key** to unlock powerful new features:
- **Web Search** with source citations
- **Reasoning/Thinking** visualization  
- **Image Generation** inline in chat
- **Code Interpreter** for Python execution
- **OpenAI Agents SDK** for agentic workflows
- **Artifact modernization**

**No additional API costs** beyond your current OpenAI usage.

---

## Phase 1: OpenAI Provider Upgrade & New Tools

### 1.1 Upgrade Provider Configuration

**Current:** Using `gpt-4o-mini` and `gpt-4o`  
**Target:** Add GPT-5 models with built-in tools support

```typescript
// lib/ai/providers.ts - UPDATED
import { openai } from '@ai-sdk/openai';
import { customProvider, wrapLanguageModel, extractReasoningMiddleware } from 'ai';

export const myProvider = customProvider({
  languageModels: {
    // Default fast model (cost-effective)
    'chat-model': openai('gpt-4o-mini'),
    
    // Standard chat model
    'chat-model-standard': openai('gpt-4o'),
    
    // NEW: Advanced model with all tools
    'chat-model-advanced': openai('gpt-4o'), // or 'gpt-5' when available
    
    // NEW: Reasoning mode with visible thinking
    'chat-model-reasoning': wrapLanguageModel({
      model: openai('o4-mini'), // OpenAI reasoning model
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    }),
    
    // Utility models
    'title-model': openai('gpt-4o-mini'),
    'artifact-model': openai('gpt-4o'),
  },
  
  // NEW: Image model for generation
  imageModels: {
    'image-model': openai.image('gpt-image-1'),
  },
});
```

**Files to Modify:**
- `lib/ai/providers.ts`

---

### 1.2 Implement OpenAI Web Search Tool

**Feature:** Native web search with source citations

```typescript
// app/api/chat/route.ts - Add web search
import { openai } from '@ai-sdk/openai';

const result = await streamText({
  model: openai('gpt-4o'),
  messages,
  system: systemPrompt({ selectedChatModel }),
  tools: {
    // Existing tools
    getWeather,
    
    // NEW: OpenAI Web Search
    web_search: openai.tools.webSearch({
      searchContextSize: 'medium', // 'low' | 'medium' | 'high'
      externalWebAccess: true,
    }),
  },
});

// Forward sources to client
return result.toUIMessageStreamResponse({
  sendSources: true,
});
```

**UI Updates:**
- Add `<SourcePanel />` component to display web sources
- Sources appear as clickable chips under message
- Collapsible detailed source list

---

### 1.3 Implement Reasoning Display

**Feature:** Show model's thinking process (like Grok/Claude)

```typescript
// app/api/chat/route.ts - Enable reasoning
const result = await streamText({
  model: openai('o4-mini'), // or gpt-4o with reasoning
  messages,
  providerOptions: {
    openai: {
      reasoningSummary: 'detailed', // Show full thinking
      reasoningEffort: 'medium',    // Balance speed/depth
    },
  },
});

return result.toUIMessageStreamResponse({
  sendReasoning: true,  // Stream reasoning to client
});
```

**UI Component - `<ReasoningBlock />`:**
```tsx
// components/chat/reasoning-block.tsx
export function ReasoningBlock({ reasoning }: { reasoning: string }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="reasoning-container">
      <button onClick={() => setExpanded(!expanded)} className="reasoning-toggle">
        <Brain className="w-4 h-4 animate-pulse" />
        <span>Thinking...</span>
        <ChevronDown className={cn("transition", expanded && "rotate-180")} />
      </button>
      
      {expanded && (
        <div className="reasoning-content">
          <Markdown>{reasoning}</Markdown>
        </div>
      )}
    </div>
  );
}
```

---

### 1.4 Implement Image Generation Tool

**Feature:** Generate images inline in chat responses

```typescript
// app/api/chat/route.ts - Add image generation
tools: {
  // ... existing tools
  
  image_generation: openai.tools.imageGeneration({
    outputFormat: 'webp',
    quality: 'medium',
  }),
}
```

**UI Updates:**
- Handle `file` parts in message rendering
- Display generated images with lightbox
- Add download and regenerate buttons

---

### 1.5 Implement Code Interpreter Tool

**Feature:** Execute Python code for data analysis

```typescript
// app/api/chat/route.ts - Add code interpreter
tools: {
  // ... existing tools
  
  code_interpreter: openai.tools.codeInterpreter({
    container: {
      // Can attach uploaded files here
    },
  }),
}
```

**Use Cases for Bioinformatics:**
- Run Python analysis on uploaded data
- Generate plots and visualizations
- Execute statistical tests

---

## Phase 2: OpenAI Agents SDK Integration

### 2.1 Install and Configure

```bash
pnpm add @openai/agents zod@3
```

### 2.2 Create Bioinformatics Agent

```typescript
// lib/ai/agents/bioinformatics-agent.ts
import { Agent, run } from '@openai/agents';

export const bioAgent = new Agent({
  name: 'Attma Bioinformatics Agent',
  instructions: `You are an expert bioinformatician specializing in:
    
## Core Expertise
- RNA-seq differential expression (DESeq2, edgeR, limma)
- Single-cell RNA-seq analysis (Scanpy, Seurat)
- Variant calling and annotation
- Pathway enrichment (GSEA, GO, KEGG)
- Multi-omics integration

## Available Tools
1. web_search - Find latest publications and protocols on PubMed/bioRxiv
2. image_generation - Create visualizations (volcano plots, heatmaps)
3. code_interpreter - Execute Python/R analysis code
4. artifact tools - Create documents, code, and data sheets

## Response Format
- Use concise, action-oriented language
- Include code examples when appropriate
- Cite sources from web searches
- Suggest next steps after each analysis
`,
  tools: [
    // Will be populated with OpenAI built-in tools
  ],
});

// Execute agent
export async function runBioAgent(userMessage: string) {
  const result = await run(bioAgent, userMessage);
  return result.finalOutput;
}
```

### 2.3 Add Specialized Sub-Agents (Handoffs)

```typescript
// Specialist agents for specific domains
export const singleCellAgent = new Agent({
  name: 'Single-Cell Specialist',
  instructions: `Expert in scRNA-seq analysis using Scanpy and Seurat.
    Focus on: clustering, marker identification, trajectory inference, cell type annotation.`,
});

export const variantAgent = new Agent({
  name: 'Variant Analyst',
  instructions: `Expert in genomic variant analysis.
    Focus on: VCF interpretation, variant annotation, GWAS analysis.`,
});

// Main agent can handoff to specialists
const result = await run(bioAgent, userMessage, {
  handoffs: {
    'single-cell': singleCellAgent,
    'variants': variantAgent,
  },
});
```

---

## Phase 3: Artifact Modernization

### 3.1 Current Artifact Types
- `text` - Markdown documents
- `code` - Python/R code blocks
- `sheet` - CSV data tables
- `image` - Generated images

### 3.2 New Artifact Enhancements

**Interactive Code Execution:**
```typescript
// Add "Run" button to code artifacts
// Uses OpenAI code interpreter to execute
async function executeCode(code: string, language: 'python' | 'r') {
  const result = await generateText({
    model: openai('gpt-4o'),
    prompt: `Execute this ${language} code and return the output: ${code}`,
    tools: {
      code_interpreter: openai.tools.codeInterpreter(),
    },
  });
  return result;
}
```

**Enhanced Sheet Editor:**
- Add data preview with charts
- Statistical summary panel
- Export to multiple formats (CSV, TSV, Excel)

**Image Artifact Improvements:**
- Add image editing via OpenAI image editing API
- Regenerate with modified prompt
- Multiple size options

---

## Phase 4: UI/UX Modernization

### 4.1 Message Component Updates

```typescript
// components/chat/message.tsx - Handle new part types
message.parts.map((part, index) => {
  switch (part.type) {
    case 'text':
      return <Markdown>{part.text}</Markdown>;
    
    case 'reasoning':
      return <ReasoningBlock reasoning={part.text} />;
    
    case 'source-url':
      return <SourceChip url={part.url} title={part.title} />;
    
    case 'file':
      if (part.mediaType.startsWith('image/')) {
        return <GeneratedImage src={part.url} />;
      }
      break;
    
    case 'tool-call':
      return <ToolCallIndicator name={part.toolName} />;
    
    case 'tool-result':
      return <ToolResultDisplay result={part} />;
  }
});
```

### 4.2 Model Selector Redesign

```typescript
const AVAILABLE_MODELS = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast, cost-effective',
    capabilities: ['chat', 'tools'],
    icon: '⚡',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Balanced performance',
    capabilities: ['chat', 'tools', 'vision', 'web-search'],
    icon: '🧠',
  },
  {
    id: 'o4-mini',
    name: 'O4 Mini (Reasoning)',
    description: 'Extended thinking',
    capabilities: ['reasoning', 'code', 'math'],
    icon: '💭',
  },
];
```

### 4.3 New Chat Features

1. **Typing Indicator** - Animated with model name
2. **Message Timestamps** - Relative time ("2m ago")
3. **Copy/Share Buttons** - Per message
4. **Regenerate** - Re-run with same prompt
5. **Edit Prompt** - Modify and resend

---

## Phase 5: Enhanced Prompts

### 5.1 Updated System Prompt

```typescript
// lib/ai/prompts.ts - UPDATED
export const INIT = `You are Attma, an advanced AI Bioinformatician designed for cutting-edge biological data analysis.

## Core Capabilities
1. **Web Search** - Find latest research, protocols, and publications
2. **Code Generation** - Python (Scanpy, pandas) and R (Bioconductor, tidyverse)
3. **Image Generation** - Create visualizations and diagrams
4. **Code Execution** - Run Python for data analysis
5. **Reasoning** - Step-by-step analysis for complex problems

## Expertise Areas
- RNA-seq differential expression analysis
- Single-cell RNA-seq clustering and annotation
- Genomic variant analysis and interpretation
- Pathway and GO enrichment analysis
- Protein structure interpretation
- Multi-omics data integration

## Tool Usage
- **Web Search**: Use for recent publications, protocols, current best practices
- **Code Interpreter**: Execute Python for calculations, plotting, data manipulation
- **Image Generation**: Create publication-quality visualizations when requested

## Response Guidelines
- Be concise - researchers value efficiency
- Show reasoning for complex analyses
- Include code examples with proper comments
- Cite sources when using web search
- Suggest next steps after analyses

IMPORTANT: Prioritize biological accuracy and statistical rigor.`;
```

---

## Implementation Checklist

### Phase 1: Provider & Tools (~4 hours)
- [ ] Update `lib/ai/providers.ts` with new models
- [ ] Add `openai.tools.webSearch` to chat route
- [ ] Add `openai.tools.imageGeneration` to chat route
- [ ] Add `openai.tools.codeInterpreter` to chat route
- [ ] Enable `sendSources` and `sendReasoning` in response

### Phase 2: Agents SDK (~3 hours)
- [ ] Install `@openai/agents`
- [ ] Create `lib/ai/agents/bioinformatics-agent.ts`
- [ ] Add specialist sub-agents
- [ ] Integrate with existing chat flow

### Phase 3: Artifacts (~2 hours)
- [ ] Add "Run Code" button to code artifacts
- [ ] Enhance sheet editor with charts
- [ ] Add image editing capabilities

### Phase 4: UI/UX (~3 hours)
- [ ] Create `<ReasoningBlock />` component
- [ ] Create `<SourceChip />` and `<SourcePanel />` components
- [ ] Update message rendering for new part types
- [ ] Redesign model selector

### Phase 5: Prompts (~1 hour)
- [ ] Update `INIT` prompt
- [ ] Add tool usage guidelines
- [ ] Update artifact prompts

---

## Total Estimated Time: ~13 hours

---

## Required Environment Variables

```env
# Already have
OPENAI_API_KEY=sk-...

# Optional - for DeepSeek if you want to add it later
DEEPSEEK_API_KEY=...
```

---

## Optional: Add DeepSeek Later

If you want to add DeepSeek for comparison/fallback:

```typescript
import { createDeepSeek } from '@ai-sdk/deepseek';

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// Add to provider
'chat-model-deepseek': deepseek('deepseek-reasoner'),
```

---

## Approval Checklist

- [ ] Phase 1: Provider & OpenAI Tools
- [ ] Phase 2: Agents SDK
- [ ] Phase 3: Artifact Modernization
- [ ] Phase 4: UI/UX Updates
- [ ] Phase 5: Prompt Updates

**Ready to begin implementation when you approve!** 🚀
