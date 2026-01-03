/**
 * @fileoverview Attma Bioinformatics Agent
 * 
 * The main agent class that orchestrates tool usage, model selection,
 * and multi-step reasoning for bioinformatics tasks.
 */

import { openai } from '@ai-sdk/openai';
import {
    stepCountIs,
    streamText,
    tool,
    type ToolSet,
    type UIMessage
} from 'ai';
import { z } from 'zod';

import { researchTools } from '../tools/research-tools';
import {
    detectAgentDomain,
    detectTaskCategory,
    getDomainInstructions,
    hasFileAttachment,
    routeToOptimalModel,
} from './task-router';
import type { AgentDomain, AgentState, TaskCategory } from './types';

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Base system prompt for Attma
 */
const BASE_INSTRUCTIONS = `You are Attma, an advanced AI Bioinformatician designed for cutting-edge biological data analysis.

## Core Expertise
- **RNA-seq Analysis**: DESeq2, edgeR, limma-voom for differential expression
- **Single-cell RNA-seq**: Scanpy, Seurat for clustering, trajectory inference
- **Genomic Variants**: VCF interpretation, variant annotation, GWAS
- **Pathway Analysis**: GSEA, GO enrichment, KEGG, Reactome
- **Protein Structure**: AlphaFold interpretation, structural biology

## Tool Usage Strategy
1. **For literature questions**: Use pubmed_search or semantic_scholar
2. **For gene questions**: Use gene_lookup first, then search if needed
3. **For web/protocol questions**: Use firecrawl_search
4. **For code requests**: Create clear, runnable Python/R code

## Response Guidelines
- Be **concise** - researchers value efficiency
- Include **code examples** with biology-focused comments
- **Cite sources** with links when using search tools
- Suggest **next steps** after each analysis
- Consider **statistical rigor**: multiple testing, effect sizes

## Multi-Step Reasoning
When solving complex problems:
1. Break down the problem into steps
2. Use tools to gather information
3. Synthesize findings
4. Validate conclusions
5. Provide actionable recommendations`;

// ============================================================================
// Model Selection
// ============================================================================

/**
 * Get the appropriate model based on task and step
 */
function getModelForStep(
  taskCategory: TaskCategory,
  stepNumber: number,
  forceReasoning: boolean = false
): string {
  const selection = routeToOptimalModel('', {
    previousSteps: stepNumber,
    forceReasoning,
  });

  // Map tier to actual model IDs
  const modelMap: Record<string, string> = {
    'chat-model': 'gpt-4o-mini',
    'chat-model-standard': 'gpt-4o',
    'chat-model-advanced': 'gpt-4o',
    'chat-model-reasoning': 'o3-mini',
  };

  return modelMap[selection.modelKey] || 'gpt-4o-mini';
}

// ============================================================================
// Agent Tools
// ============================================================================

/**
 * Create the full tool set for the agent
 */
function createAgentTools(): ToolSet {
  return {
    ...researchTools,
    
    // Document creation tool for code artifacts
    create_code_artifact: tool({
      description: 'Create a code artifact (Python or R) to display to the user',
      inputSchema: z.object({
        title: z.string().describe('Title for the code artifact'),
        language: z.enum(['python', 'r']).describe('Programming language'),
        code: z.string().describe('The code content'),
        description: z.string().optional().describe('Brief description of what the code does'),
      }),
      execute: async (input: { title: string; language: 'python' | 'r'; code: string; description?: string }) => {
        return {
          type: 'code_artifact',
          title: input.title,
          language: input.language,
          code: input.code,
          description: input.description,
        };
      },
    }),
  };
}

// ============================================================================
// Agent Execution
// ============================================================================

export interface AgentExecutionOptions {
  messages: UIMessage[];
  selectedModelId?: string;
  selectedAgentId?: string;
  maxSteps?: number;
  onStateChange?: (state: AgentState) => void;
}

/**
 * Execute the bioinformatics agent
 * 
 * @example
 * ```typescript
 * const result = await executeAgent({
 *   messages: userMessages,
 *   maxSteps: 10,
 * });
 * return result.toUIMessageStreamResponse();
 * ```
 */
export async function executeAgent(options: AgentExecutionOptions) {
  const { 
    messages, 
    selectedModelId,
    selectedAgentId,
    maxSteps = 10,
    onStateChange,
  } = options;

  // Get the last user message for task detection
  const lastMessage = messages[messages.length - 1];
  const lastMessageText = extractMessageText(lastMessage);

  // Detect task category and domain
  const taskCategory = detectTaskCategory(lastMessageText);
  const agentDomain = selectedAgentId 
    ? (selectedAgentId.replace('-agent', '') as AgentDomain)
    : detectAgentDomain(lastMessageText);

  // Check for file attachments
  const hasFiles = hasFileAttachment(lastMessage);

  // Get model selection
  const modelSelection = routeToOptimalModel(lastMessageText, {
    hasAttachments: hasFiles,
    forceReasoning: selectedModelId === 'chat-model-reasoning',
  });

  // Build system prompt with domain specialization
  const domainInstructions = getDomainInstructions(agentDomain);
  const systemPrompt = `${BASE_INSTRUCTIONS}\n\n${domainInstructions}`;

  // Determine model to use
  let modelId = 'gpt-4o-mini';
  if (selectedModelId === 'chat-model-standard') {
    modelId = 'gpt-4o';
  } else if (selectedModelId === 'chat-model-reasoning') {
    modelId = 'o3-mini';
  } else {
    // Use auto-selection
    const modelMap: Record<string, string> = {
      'chat-model': 'gpt-4o-mini',
      'chat-model-standard': 'gpt-4o',
      'chat-model-advanced': 'gpt-4o',
      'chat-model-reasoning': 'o3-mini',
    };
    modelId = modelMap[modelSelection.modelKey] || 'gpt-4o-mini';
  }

  // Create tools
  const tools = createAgentTools();

  // Update state
  onStateChange?.({
    isProcessing: true,
    currentStep: `Task: ${taskCategory}, Model: ${modelId}`,
    steps: [],
  });

  // Execute with streaming and multi-step support
  const result = streamText({
    model: openai.chat(modelId),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(maxSteps),
  });

  return result;
}

/**
 * Extract text content from a UI message
 */
function extractMessageText(message: UIMessage): string {
  if (!message) return '';
  
  // UIMessage uses parts, not content
  const parts = message.parts;
  if (Array.isArray(parts)) {
    return parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map(part => part.text)
      .join(' ');
  }

  return '';
}

// ============================================================================
// Agent State Management
// ============================================================================

/**
 * Create initial agent state
 */
export function createInitialAgentState(): AgentState {
  return {
    isProcessing: false,
    currentStep: '',
    steps: [],
  };
}

// ============================================================================
// Export
// ============================================================================

export {
    createAgentTools, detectAgentDomain, detectTaskCategory, getDomainInstructions, routeToOptimalModel
};

/**
 * Helper to convert UI messages to AI SDK CoreMessage format
 */
function convertToModelMessages(messages: UIMessage[]) {
  return messages.map(m => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: extractMessageText(m),
  }));
}
