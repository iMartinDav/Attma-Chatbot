/**
 * Task Router - Analyzes prompts to detect task type and domain
 * for automatic model and tool selection.
 */

import type {
  AgentDomain,
  ModelSelection,
  ModelTier,
  TaskCategory,
} from './types';

/** Keywords indicating specific task types (ordered by specificity) */
const TASK_PATTERNS: Record<TaskCategory, RegExp[]> = {
  research: [
    /search\s+(pubmed|literature|papers?)/i,
    /find\s+(papers?|articles?|studies)/i,
    /recent\s+research/i,
    /what\s+does\s+the\s+literature\s+say/i,
    /systematic\s+review/i,
    /state\s+of\s+the\s+art/i,
    /latest\s+(findings?|research|papers?)/i,
  ],
  code_generation: [
    /write\s+(a\s+)?(python|r)\s+(script|code|function)/i,
    /create\s+(a\s+)?(script|function|code)/i,
    /implement/i,
    /scanpy|seurat|deseq2|biopython|pandas/i,
    /```(python|r)/i,
  ],
  file_analysis: [
    /analyze\s+(this|the)\s+(pdf|image|file|document)/i,
    /what\s+does\s+(this|the)\s+(pdf|image|figure)/i,
    /extract\s+(data|information)\s+from/i,
    /summarize\s+(this|the)\s+(paper|pdf|document)/i,
  ],
  gene_lookup: [
    /what\s+(is|does)\s+\w+\s+(gene|protein)/i,
    /tell\s+me\s+about\s+\w+\s+(gene|protein)/i,
    /function\s+of\s+\w+/i,
    /\b[A-Z][A-Z0-9]{1,6}\b.*gene/i, // Gene symbol pattern
  ],
  pathway_analysis: [
    /pathway\s+(analysis|enrichment)/i,
    /go\s+(terms?|enrichment|analysis)/i,
    /kegg|reactome/i,
    /gene\s+set\s+enrichment/i,
    /gsea/i,
  ],
  reasoning: [
    /why\s+(does|is|do|are)/i,
    /explain\s+(the\s+)?mechanism/i,
    /step\s+by\s+step/i,
    /think\s+through/i,
    /what\s+could\s+cause/i,
    /interpret\s+(these|the)\s+results/i,
  ],
  data_analysis: [
    /differential\s+expression/i,
    /statistical(ly)?\s+(signific|test|analys)/i,
    /p-?value|fold\s+change|log2fc/i,
    /correlation|regression/i,
    /normalize|batch\s+effect/i,
  ],
  visualization: [
    /plot|graph|chart|heatmap/i,
    /volcano\s+plot/i,
    /visualize|diagram|figure/i,
    /umap|pca\s+plot|tsne/i,
    /create\s+(a\s+)?(bar|line|scatter)/i,
  ],
  quick_answer: [
    /^what\s+is\s+/i,
    /^define\s+/i,
    /^explain\s+briefly/i,
    /quick\s+question/i,
  ],
  general: [],
};

/** Domain-specific keywords for specialist routing */
const DOMAIN_PATTERNS: Record<AgentDomain, RegExp[]> = {
  rare_disease: [
    /rare\s+disease|undiagnosed|syndrom/i,
    /phenotype|hpo|dysmorph|developmental\s+delay/i,
    /differential\s+diagnos|which\s+(gene|disease)/i,
  ],
  single_cell: [
    /single[\s-]?cell/i,
    /scrna[\s-]?seq/i,
    /scanpy|seurat/i,
    /umap|cluster(ing)?|cell\s+type/i,
    /trajectory|pseudotime/i,
  ],
  variant: [
    /variant|vcf|snp|mutation/i,
    /gwas|pathogenic/i,
    /clinvar|gnomad/i,
    /germline|somatic/i,
  ],
  pathway: [
    /pathway|enrichment/i,
    /go\s+term|kegg|reactome/i,
    /gene\s+set|gsea/i,
    /functional\s+annotation/i,
  ],
  structural: [
    /protein\s+structure/i,
    /alphafold|pdb/i,
    /binding\s+site|domain/i,
    /3d\s+structure|conformation/i,
  ],
  general: [],
};

/** Model tier configurations */
const MODEL_TIER_CONFIG: Record<
  ModelTier,
  { modelKey: string; description: string }
> = {
  fast: {
    modelKey: 'chat-model',
    description: 'Fast responses for simple queries',
  },
  standard: {
    modelKey: 'chat-model-standard',
    description: 'Balanced performance for most tasks',
  },
  advanced: {
    modelKey: 'chat-model-advanced',
    description: 'Maximum capability for complex analysis',
  },
  reasoning: {
    modelKey: 'chat-model-reasoning',
    description: 'Logical reasoning for complex problems',
  },
};

/** Task to model tier mapping */
const TASK_MODEL_MAP: Record<TaskCategory, ModelTier> = {
  quick_answer: 'fast',
  code_generation: 'standard',
  data_analysis: 'standard',
  research: 'standard',
  reasoning: 'reasoning',
  visualization: 'standard',
  file_analysis: 'standard',
  gene_lookup: 'fast',
  pathway_analysis: 'standard',
  general: 'fast',
};

/** Suggested tools for each task type */
const TASK_TOOLS_MAP: Record<TaskCategory, string[]> = {
  research: ['pubmed_search', 'firecrawl_search', 'semantic_scholar'],
  code_generation: ['createDocument'],
  data_analysis: ['createDocument'],
  file_analysis: [],
  gene_lookup: ['gene_lookup'],
  pathway_analysis: ['pathway_search', 'gene_lookup'],
  reasoning: ['pubmed_search', 'gene_lookup'],
  visualization: ['createDocument'],
  quick_answer: ['gene_lookup'],
  general: ['pubmed_search', 'gene_lookup'],
};

/** Detects the task category from a user prompt */
export function detectTaskCategory(query: string): TaskCategory {
  // Check patterns in priority order (most specific first)
  const priorityOrder: TaskCategory[] = [
    'file_analysis',
    'research',
    'code_generation',
    'gene_lookup',
    'pathway_analysis',
    'reasoning',
    'data_analysis',
    'visualization',
    'quick_answer',
  ];

  for (const category of priorityOrder) {
    const patterns = TASK_PATTERNS[category];
    if (patterns.some((pattern) => pattern.test(query))) {
      return category;
    }
  }

  return 'general';
}

/** Detects the specialist domain from a user prompt */
export function detectAgentDomain(query: string): AgentDomain {
  const priorityOrder: AgentDomain[] = [
    'rare_disease',
    'single_cell',
    'variant',
    'pathway',
    'structural',
  ];

  for (const domain of priorityOrder) {
    const patterns = DOMAIN_PATTERNS[domain];
    if (patterns.some((pattern) => pattern.test(query))) {
      return domain;
    }
  }

  return 'general';
}

/** Check if message contains file attachments */
export function hasFileAttachment(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false;

  const msg = message as { parts?: Array<{ type?: string }> };
  return (
    msg.parts?.some((part) => part.type === 'file' || part.type === 'image') ??
    false
  );
}

/** Routes a query to the optimal model and configuration */
export function routeToOptimalModel(
  query: string,
  options?: {
    hasAttachments?: boolean;
    previousSteps?: number;
    forceReasoning?: boolean;
  },
): ModelSelection {
  const { hasAttachments, previousSteps = 0, forceReasoning } = options || {};

  // Detect task type
  let taskCategory = detectTaskCategory(query);

  // Override for file attachments
  if (hasAttachments) {
    taskCategory = 'file_analysis';
  }

  // Force reasoning if explicitly requested
  if (forceReasoning) {
    return {
      tier: 'reasoning',
      modelKey: MODEL_TIER_CONFIG.reasoning.modelKey,
      reasoning: 'Reasoning mode explicitly requested',
      suggestedTools: TASK_TOOLS_MAP[taskCategory],
    };
  }

  // Get base tier
  let tier = TASK_MODEL_MAP[taskCategory];

  // Upgrade to advanced for later steps in multi-step reasoning
  if (previousSteps >= 3 && tier === 'standard') {
    tier = 'advanced';
  }

  const config = MODEL_TIER_CONFIG[tier];

  return {
    tier,
    modelKey: config.modelKey,
    reasoning: `Task: ${taskCategory}. ${config.description}`,
    suggestedTools: TASK_TOOLS_MAP[taskCategory],
  };
}

/** Gets suggested tools for a task category */
export function getSuggestedTools(category: TaskCategory): string[] {
  return TASK_TOOLS_MAP[category] || [];
}

/** Get domain specialist instructions */
export function getDomainInstructions(domain: AgentDomain): string {
  const instructions: Record<AgentDomain, string> = {
    rare_disease: `
      You are a rare disease diagnostic specialist supporting a clinical geneticist.
      Workflow:
      1. Map the patient's findings to HPO terms. Use only findings the patient has;
         list negated or absent findings separately and do not send them to tools.
      2. Call rankDiagnoses with those phenotypes.
      3. If the user gave variants, call prioritizeVariants with the variants and the same phenotypes.
      4. For the leading candidate gene, search PubMed for supporting case reports.
      Call rankDiagnoses and prioritizeVariants in the same step when both apply.
      The results already appear to the user as interactive tables, so do not repeat them.
      Answer in under 250 words: the leading hypothesis and why (which findings and which
      variant evidence support it), what argues against the runners-up, and 2-4 concrete next
      steps (confirmatory testing, segregation in parents, specialist referral). Cite HPO, OMIM or Orphanet,
      ClinVar, gnomAD, AlphaMissense and PubMed inline. This is decision support for research
      use: never state a final diagnosis.
    `,
    single_cell: `
      You are a single-cell RNA-seq specialist. Focus on:
      - Scanpy/Seurat workflows
      - Cell clustering and annotation
      - Trajectory inference
      - Quality control metrics (nGenes, nUMI, mito%)
    `,
    variant: `
      You are a variant analysis specialist. Focus on:
      - VCF interpretation
      - Pathogenicity assessment (ClinVar, CADD)
      - GWAS analysis
      - Population genetics (gnomAD frequencies)
    `,
    pathway: `
      You are a pathway analysis specialist. Focus on:
      - Gene set enrichment (GSEA)
      - GO term analysis
      - KEGG/Reactome pathways
      - Functional annotation
    `,
    structural: `
      You are a structural biology specialist. Focus on:
      - Protein structure (AlphaFold, PDB)
      - Domain architecture
      - Binding sites
      - Structure-function relationships
    `,
    general: `
      You are Attma, an expert bioinformatician with broad knowledge.
    `,
  };

  return instructions[domain];
}
