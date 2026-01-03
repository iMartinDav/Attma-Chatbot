/**
 * Core types for the Bioinformatics Agent System
 */

/** Task categories the agent can perform */
export type TaskCategory = 
  | 'quick_answer'      // Simple questions, definitions
  | 'code_generation'   // Python/R code for analysis
  | 'data_analysis'     // Statistical analysis, interpretation
  | 'research'          // Literature search, paper analysis
  | 'reasoning'         // Complex multi-step problems
  | 'visualization'     // Charts, plots, diagrams
  | 'file_analysis'     // Analyze uploaded files (PDF, images)
  | 'gene_lookup'       // Gene/protein information
  | 'pathway_analysis'  // Pathway enrichment, GO terms
  | 'general';          // Default fallback

/** Specialist agent domains */
export type AgentDomain = 
  | 'general'
  | 'single_cell'
  | 'variant'
  | 'pathway'
  | 'structural';

/** Model tier based on capability and cost */
export type ModelTier = 'fast' | 'standard' | 'advanced' | 'reasoning';

/**
 * Model selection result from auto-routing
 */
export interface ModelSelection {
  tier: ModelTier;
  modelKey: string;
  reasoning: string;
  suggestedTools: string[];
}

/** Information passed to each agent step */
export interface AgentStepInfo {
  stepNumber: number;
  totalSteps: number;
  currentTask: TaskCategory;
  toolsUsed: string[];
  tokensUsed: number;
}

/**
 * Agent execution state
 */
export interface AgentState {
  isProcessing: boolean;
  currentStep: string;
  steps: AgentStepInfo[];
  error?: string;
}

/** Tool execution result with metadata */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  source?: string;
  citations?: Citation[];
  executionTime?: number;
}

/**
 * Citation for source tracking
 */
export interface Citation {
  type: 'paper' | 'database' | 'web' | 'api';
  title: string;
  url?: string;
  pmid?: string;
  doi?: string;
  authors?: string[];
  year?: number;
}

/** Embedding document types */
export type EmbeddingType = 
  | 'paper'       // Scientific paper
  | 'gene'        // Gene information
  | 'pathway'     // Pathway data
  | 'experiment'  // Experiment metadata
  | 'protocol';   // Lab protocol

/**
 * Vector search result
 */
export interface VectorSearchResult {
  id: string;
  content: string;
  type: EmbeddingType;
  score: number;
  metadata: Record<string, unknown>;
}

/** Verification step in self-verifying agent pattern */
export interface VerificationStep {
  type: 'generate' | 'critique' | 'validate' | 'fix';
  input: string;
  output: string;
  confidence: number;
  issues?: string[];
}

/**
 * Validation result for fact-checking
 */
export interface ValidationResult {
  claim: string;
  isValid: boolean;
  confidence: number;
  evidence?: string;
  source?: Citation;
}
