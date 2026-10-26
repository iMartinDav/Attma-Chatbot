/**
 * Model Router - Routes requests to optimal model based on task type.
 * Implements auto-selection for bioinformatics tasks.
 */

export type TaskCategory =
  | 'quick_answer' // Simple questions, definitions
  | 'code_generation' // Python/R code for analysis
  | 'data_analysis' // Statistical analysis, interpretation
  | 'research' // Literature search, deep research
  | 'reasoning' // Complex multi-step problems
  | 'visualization' // Charts, plots, diagrams
  | 'general'; // Default fallback

interface ModelRecommendation {
  modelId: string;
  modelKey: string; // Internal key for myProvider
  reasoning: string;
  suggestedTools: string[];
  providerOptions?: Record<string, unknown>;
}

/**
 * Maps task categories to optimal models and configurations
 */
const TASK_MODEL_MAP: Record<TaskCategory, ModelRecommendation> = {
  quick_answer: {
    modelId: 'gpt-5-mini',
    modelKey: 'chat-model',
    reasoning: 'Fast responses for simple queries',
    suggestedTools: [],
    providerOptions: {
      textVerbosity: 'low',
    },
  },
  code_generation: {
    modelId: 'gpt-5-codex',
    modelKey: 'chat-model-standard',
    reasoning: 'Optimized for Python and R code generation',
    suggestedTools: ['code_interpreter'],
    providerOptions: {
      textVerbosity: 'medium',
    },
  },
  data_analysis: {
    modelId: 'gpt-5',
    modelKey: 'chat-model-standard',
    reasoning: 'Strong analytical capabilities with tool access',
    suggestedTools: ['code_interpreter', 'web_search'],
    providerOptions: {
      textVerbosity: 'medium',
    },
  },
  research: {
    modelId: 'o3-deep-research',
    modelKey: 'chat-model-reasoning-advanced',
    reasoning: 'Specialized for deep research and literature review',
    suggestedTools: ['web_search', 'pubmed_search'],
    providerOptions: {
      reasoningSummary: 'detailed',
      searchContextSize: 'high',
    },
  },
  reasoning: {
    modelId: 'o3',
    modelKey: 'chat-model-reasoning-advanced',
    reasoning: 'Complex multi-step logical reasoning',
    suggestedTools: ['code_interpreter', 'web_search'],
    providerOptions: {
      reasoningSummary: 'detailed',
      reasoningEffort: 'high',
    },
  },
  visualization: {
    modelId: 'gpt-5',
    modelKey: 'chat-model-standard',
    reasoning: 'Image generation and visualization capabilities',
    suggestedTools: ['image_generation', 'code_interpreter'],
    providerOptions: {
      textVerbosity: 'medium',
    },
  },
  general: {
    modelId: 'gpt-5-mini',
    modelKey: 'chat-model',
    reasoning: 'Balanced performance for general tasks',
    suggestedTools: ['web_search', 'gene_lookup'],
    providerOptions: {
      textVerbosity: 'medium',
    },
  },
};

/** Keywords indicating specific task types */
const TASK_KEYWORDS: Record<TaskCategory, string[]> = {
  quick_answer: [
    'what is',
    'what does',
    'define',
    'explain briefly',
    'quick question',
    'simple question',
    'short answer',
  ],
  code_generation: [
    'write code',
    'python script',
    'r script',
    'function',
    'implement',
    'create a script',
    'generate code',
    'scanpy',
    'seurat',
    'deseq2',
    'biopython',
    'pandas',
    'write a function',
    'code for',
    'script for',
  ],
  data_analysis: [
    'analyze',
    'statistical',
    'interpret',
    'calculate',
    'differential expression',
    'fold change',
    'p-value',
    'correlation',
    'regression',
    'normalization',
    'batch effect',
    'clustering result',
  ],
  research: [
    'search pubmed',
    'search literature',
    'find papers',
    'recent research',
    'what does the literature say',
    'systematic review',
    'meta-analysis',
    'state of the art',
    'latest findings',
    'research on',
    'studies show',
  ],
  reasoning: [
    'why',
    'how does',
    'explain the mechanism',
    'step by step',
    'reasoning',
    'logic',
    'complex analysis',
    'multi-step',
    'think through',
    'interpret these results',
    'what could cause',
  ],
  visualization: [
    'plot',
    'graph',
    'chart',
    'heatmap',
    'volcano plot',
    'visualize',
    'diagram',
    'figure',
    'image',
    'umap',
    'pca plot',
    'dotplot',
    'barplot',
  ],
  general: [],
};

/** Detects the task category from user input */
export function detectTaskCategory(query: string): TaskCategory {
  const lowerQuery = query.toLowerCase();

  // Check each category in priority order
  const priorityOrder: TaskCategory[] = [
    'research', // Highest priority - explicit research requests
    'code_generation', // Code-related tasks
    'visualization', // Plot/chart requests
    'reasoning', // Complex reasoning
    'data_analysis', // Statistical analysis
    'quick_answer', // Simple queries
  ];

  for (const category of priorityOrder) {
    const keywords = TASK_KEYWORDS[category];
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      return category;
    }
  }

  return 'general';
}

interface RoutingResult {
  category: TaskCategory;
  recommendation: ModelRecommendation;
  agentId?: string;
}

/** Routes a query to the optimal model and configuration */
export function routeToOptimalModel(
  query: string,
  selectedAgentId?: string,
): RoutingResult {
  const category = detectTaskCategory(query);
  const recommendation = TASK_MODEL_MAP[category];

  let agentId = selectedAgentId;

  if (!agentId || agentId === 'auto') {
    const agentKeywords: Record<string, string[]> = {
      'single-cell': [
        'single-cell',
        'scrna-seq',
        'scanpy',
        'seurat',
        'umap',
        'cluster',
      ],
      'variant-analysis': [
        'variant',
        'vcf',
        'snp',
        'mutation',
        'gwas',
        'pathogenic',
      ],
      'pathway-analysis': [
        'pathway',
        'enrichment',
        'gsea',
        'go term',
        'kegg',
        'reactome',
      ],
    };

    const lowerQuery = query.toLowerCase();
    for (const [id, keywords] of Object.entries(agentKeywords)) {
      if (keywords.some((kw) => lowerQuery.includes(kw))) {
        agentId = id;
        break;
      }
    }
  }

  return { category, recommendation, agentId };
}

/** Get recommended model key */
export function getOptimalModelKey(query: string): string {
  const result = routeToOptimalModel(query);
  return result.recommendation.modelKey;
}

/** Get suggested tools for task type */
export function getSuggestedTools(category: TaskCategory): string[] {
  return TASK_MODEL_MAP[category].suggestedTools;
}

/** Build provider options for task */
export function buildOptimalProviderOptions(
  category: TaskCategory,
): Record<string, unknown> {
  const recommendation = TASK_MODEL_MAP[category];

  const baseOptions: Record<string, unknown> = {
    textVerbosity: 'medium',
    searchContextSize: 'medium',
  };

  return {
    ...baseOptions,
    ...recommendation.providerOptions,
  };
}
