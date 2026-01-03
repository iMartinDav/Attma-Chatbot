/**
 * @fileoverview Bioinformatics AI Agent
 * 
 * This module defines specialized AI agents for bioinformatics analysis
 * using the OpenAI Agents SDK. Agents can:
 * - Perform complex multi-step analyses
 * - Hand off to specialized sub-agents
 * - Use guardrails for input validation
 * 
 * Architecture:
 * - BioinformaticsAgent: Main orchestrator agent
 * - SingleCellAgent: Specialist for scRNA-seq
 * - VariantAnalysisAgent: Specialist for genomic variants
 * - PathwayAnalysisAgent: Specialist for pathway enrichment
 */

import { Agent } from '@openai/agents';

// ============================================================================
// Agent Instructions (System Prompts)
// ============================================================================

const BIOINFORMATICS_AGENT_INSTRUCTIONS = `You are Attma, an advanced AI Bioinformatician designed for cutting-edge biological data analysis.

## Core Expertise
- RNA-seq differential expression (DESeq2, edgeR, limma-voom)
- Single-cell RNA-seq (Scanpy, Seurat, cell type annotation)
- Genomic variant analysis (VCF interpretation, GWAS)
- Pathway enrichment (GSEA, GO, KEGG, Reactome)
- Protein structure interpretation (AlphaFold, structural biology)
- Multi-omics integration (MOFA, integrative analysis)

## Available Tools
1. **web_search** - Find latest research on PubMed, bioRxiv, and the web
2. **image_generation** - Create publication-quality visualizations
3. **code_interpreter** - Execute Python for data analysis
4. **pubmed_search** - Search scientific literature
5. **gene_lookup** - Get gene information and pathway associations

## Analysis Approach
1. **Understand the Question**: Clarify the biological context
2. **Plan the Analysis**: Outline steps before executing
3. **Execute with Precision**: Use appropriate tools and methods
4. **Validate Results**: Check for statistical significance and biological plausibility
5. **Interpret Biologically**: Connect findings to known biology

## Response Guidelines
- Be **concise** - researchers value efficiency
- Show **reasoning** for complex analyses
- Include **code examples** with proper comments
- **Cite sources** when using web search
- Suggest **next steps** after analyses
- Always consider **statistical rigor**: p-value adjustments, effect sizes, sample sizes

## When to Hand Off
- For complex single-cell analyses → Single-Cell Specialist
- For genomic variant interpretation → Variant Analysis Specialist
- For pathway/enrichment analyses → Pathway Analysis Specialist

IMPORTANT: Prioritize biological accuracy and statistical rigor over speed.`;

const SINGLE_CELL_AGENT_INSTRUCTIONS = `You are a Single-Cell RNA-seq Analysis Specialist.

## Expertise
- Scanpy and Seurat workflows
- Quality control and filtering strategies
- Normalization and batch correction (Harmony, scVI, BBKNN)
- Dimensionality reduction (PCA, UMAP, t-SNE)
- Cell clustering (Leiden, Louvain)
- Cell type annotation (manual markers, automated: SingleR, CellTypist)
- Trajectory inference (PAGA, Monocle, Slingshot)
- Differential expression between clusters
- Cell-cell communication analysis (CellChat, CellPhoneDB)

## Analysis Standards
- Always check for doublets (Scrublet, DoubletFinder)
- Consider batch effects in multi-sample datasets
- Use appropriate statistical tests for single-cell data
- Validate findings with known marker genes

## Output Format
- Provide Scanpy/Seurat code with clear comments
- Explain biological interpretation of clusters
- Suggest follow-up analyses`;

const VARIANT_ANALYSIS_AGENT_INSTRUCTIONS = `You are a Genomic Variant Analysis Specialist.

## Expertise
- VCF file interpretation
- Variant annotation (VEP, ANNOVAR, SnpEff)
- Clinical variant classification (ACMG/AMP criteria)
- GWAS analysis and interpretation
- Polygenic risk scores
- Structural variant analysis
- Somatic mutation analysis in cancer

## Analysis Standards
- Always consider population databases (gnomAD, 1000 Genomes)
- Check for pathogenicity predictions (CADD, REVEL, AlphaMissense)
- Distinguish germline from somatic variants
- Consider gene dosage sensitivity (pLI scores)

## Output Format
- Classify variants by impact (HIGH, MODERATE, LOW)
- Provide evidence for clinical significance
- Include relevant population frequencies`;

const PATHWAY_ANALYSIS_AGENT_INSTRUCTIONS = `You are a Pathway and Enrichment Analysis Specialist.

## Expertise
- Gene Set Enrichment Analysis (GSEA)
- Over-representation analysis (ORA)
- GO enrichment (Biological Process, Molecular Function, Cellular Component)
- KEGG pathway analysis
- Reactome pathways
- MSigDB gene sets
- Network and protein-protein interaction analysis

## Analysis Standards
- Always use appropriate background gene lists
- Apply multiple testing correction (Benjamini-Hochberg)
- Consider both up- and down-regulated gene sets separately
- Interpret results in biological context

## Output Format
- Rank pathways by significance (adjusted p-value)
- Provide normalized enrichment scores where applicable
- Visualize results with dot plots or enrichment maps`;

// ============================================================================
// Agent Definitions
// ============================================================================

/**
 * Main bioinformatics orchestrator agent
 */
export const bioinformaticsAgent = new Agent({
  name: 'Attma Bioinformatics Agent',
  instructions: BIOINFORMATICS_AGENT_INSTRUCTIONS,
});

/**
 * Specialist agent for single-cell RNA-seq analysis
 */
export const singleCellAgent = new Agent({
  name: 'Single-Cell Specialist',
  instructions: SINGLE_CELL_AGENT_INSTRUCTIONS,
});

/**
 * Specialist agent for genomic variant analysis
 */
export const variantAnalysisAgent = new Agent({
  name: 'Variant Analysis Specialist',
  instructions: VARIANT_ANALYSIS_AGENT_INSTRUCTIONS,
});

/**
 * Specialist agent for pathway and enrichment analysis
 */
export const pathwayAnalysisAgent = new Agent({
  name: 'Pathway Analysis Specialist',
  instructions: PATHWAY_ANALYSIS_AGENT_INSTRUCTIONS,
});

// ============================================================================
// Agent Registry
// ============================================================================

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  agent: Agent;
  icon: string;
  specializations: string[];
}

/**
 * Registry of all available agents
 */
export const AGENT_REGISTRY: Record<string, AgentConfig> = {
  'bioinformatics': {
    id: 'bioinformatics',
    name: 'Attma Bioinformatics',
    description: 'General bioinformatics assistant',
    agent: bioinformaticsAgent,
    icon: '🧬',
    specializations: ['general', 'rna-seq', 'data-analysis'],
  },
  'single-cell': {
    id: 'single-cell',
    name: 'Single-Cell Specialist',
    description: 'Expert in scRNA-seq analysis',
    agent: singleCellAgent,
    icon: '🔬',
    specializations: ['scanpy', 'seurat', 'clustering', 'trajectory'],
  },
  'variant-analysis': {
    id: 'variant-analysis',
    name: 'Variant Analyst',
    description: 'Expert in genomic variant interpretation',
    agent: variantAnalysisAgent,
    icon: '🧪',
    specializations: ['vcf', 'gwas', 'clinical-variants'],
  },
  'pathway-analysis': {
    id: 'pathway-analysis',
    name: 'Pathway Analyst',
    description: 'Expert in enrichment and pathway analysis',
    agent: pathwayAnalysisAgent,
    icon: '🗺️',
    specializations: ['gsea', 'go', 'kegg', 'reactome'],
  },
};

// ============================================================================
// Agent Selection Logic
// ============================================================================

/**
 * Keywords that trigger specialist agent selection
 */
const AGENT_KEYWORDS: Record<string, string[]> = {
  'single-cell': [
    'single-cell', 'scRNA-seq', 'scanpy', 'seurat', 
    'umap', 'cluster', 'cell type', 'trajectory',
    'pseudotime', 'velocity', 'cellranger',
  ],
  'variant-analysis': [
    'variant', 'vcf', 'snp', 'indel', 'mutation',
    'gwas', 'pathogenic', 'clinical significance',
    'allele frequency', 'gnomad',
  ],
  'pathway-analysis': [
    'pathway', 'enrichment', 'gsea', 'go term',
    'kegg', 'reactome', 'gene set', 'over-representation',
    'functional annotation',
  ],
};

/**
 * Automatically select the best agent based on user query
 */
export function selectAgent(query: string): AgentConfig {
  const lowerQuery = query.toLowerCase();
  
  // Check for specialist keywords
  for (const [agentId, keywords] of Object.entries(AGENT_KEYWORDS)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      return AGENT_REGISTRY[agentId];
    }
  }
  
  // Default to main bioinformatics agent
  return AGENT_REGISTRY['bioinformatics'];
}

/**
 * Get agent by ID
 */
export function getAgent(agentId: string): AgentConfig | undefined {
  return AGENT_REGISTRY[agentId];
}

/**
 * Get all available agents
 */
export function getAllAgents(): AgentConfig[] {
  return Object.values(AGENT_REGISTRY);
}
