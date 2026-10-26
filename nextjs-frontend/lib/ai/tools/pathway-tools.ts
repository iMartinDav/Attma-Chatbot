/**
 * Pathway Analysis Tools - KEGG, Reactome, GO enrichment, STRING
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolResult } from '../agents/types';

/** Search KEGG pathways by gene or keyword */
export const keggPathwaySearchTool = tool({
  description: `Search KEGG pathways for genes or keywords. Use for:
    - Finding pathways containing a specific gene
    - Discovering pathway relationships
    - Understanding biological processes`,
  inputSchema: z.object({
    query: z.string().describe('Gene symbol or pathway keyword'),
    organism: z
      .enum(['hsa', 'mmu', 'rno'])
      .default('hsa')
      .describe('Organism code (hsa=human, mmu=mouse, rno=rat)'),
    maxResults: z.number().min(1).max(20).default(10),
  }),
  execute: async (input: {
    query: string;
    organism: 'hsa' | 'mmu' | 'rno';
    maxResults: number;
  }): Promise<ToolResult<KEGGPathway[]>> => {
    const { query, organism, maxResults } = input;
    const startTime = Date.now();

    try {
      // Search KEGG API
      const searchUrl = `https://rest.kegg.jp/find/pathway/${query}`;
      const response = await fetch(searchUrl);
      const text = await response.text();

      if (!text.trim()) {
        return {
          success: true,
          data: [],
          source: 'KEGG',
          executionTime: Date.now() - startTime,
        };
      }

      // Parse KEGG response (tab-separated)
      const lines = text.trim().split('\n').slice(0, maxResults);
      const pathways: KEGGPathway[] = lines.map((line) => {
        const [id, name] = line.split('\t');
        const pathwayId = id.replace('path:', '');
        return {
          id: pathwayId,
          name: name || 'Unknown',
          url: `https://www.kegg.jp/pathway/${pathwayId}`,
          organism,
        };
      });

      return {
        success: true,
        data: pathways,
        source: 'KEGG',
        citations: pathways.map((p) => ({
          type: 'database' as const,
          title: `KEGG: ${p.name}`,
          url: p.url,
        })),
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `KEGG search failed: ${error}`,
        source: 'KEGG',
        executionTime: Date.now() - startTime,
      };
    }
  },
});

interface KEGGPathway {
  id: string;
  name: string;
  url: string;
  organism: string;
}

/** Search Reactome pathways */
export const reactomePathwaySearchTool = tool({
  description: `Search Reactome pathways - comprehensive biological pathway database. Use for:
    - Finding metabolic, signaling, and disease pathways
    - Pathway-protein relationships
    - Detailed pathway diagrams`,
  inputSchema: z.object({
    query: z.string().describe('Gene symbol, protein, or pathway name'),
    species: z
      .enum(['Homo sapiens', 'Mus musculus', 'Rattus norvegicus'])
      .default('Homo sapiens'),
    maxResults: z.number().min(1).max(20).default(10),
  }),
  execute: async (input: {
    query: string;
    species: string;
    maxResults: number;
  }): Promise<ToolResult<ReactomePathway[]>> => {
    const { query, species, maxResults } = input;
    const startTime = Date.now();

    try {
      const url = `https://reactome.org/ContentService/search/query?query=${encodeURIComponent(query)}&species=${encodeURIComponent(species)}&types=Pathway&cluster=true`;

      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        return {
          success: true,
          data: [],
          source: 'Reactome',
          executionTime: Date.now() - startTime,
        };
      }

      // Flatten grouped results
      const entries = data.results
        .flatMap((group: any) => group.entries || [])
        .slice(0, maxResults);

      const pathways: ReactomePathway[] = entries.map((entry: any) => ({
        stId: entry.stId,
        name: entry.name,
        summation: entry.summation,
        species: entry.species?.[0] || species,
        url: `https://reactome.org/PathwayBrowser/#/${entry.stId}`,
      }));

      return {
        success: true,
        data: pathways,
        source: 'Reactome',
        citations: pathways.map((p) => ({
          type: 'database' as const,
          title: `Reactome: ${p.name}`,
          url: p.url,
        })),
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `Reactome search failed: ${error}`,
        source: 'Reactome',
        executionTime: Date.now() - startTime,
      };
    }
  },
});

interface ReactomePathway {
  stId: string;
  name: string;
  summation?: string;
  species: string;
  url: string;
}

/** Perform GO term analysis on a gene list */
export const goEnrichmentTool = tool({
  description: `Perform Gene Ontology (GO) enrichment analysis. Use for:
    - Finding enriched biological processes in a gene list
    - Molecular function analysis
    - Cellular component localization`,
  inputSchema: z.object({
    genes: z.array(z.string()).describe('List of gene symbols'),
    ontology: z
      .enum(['BP', 'MF', 'CC', 'ALL'])
      .default('ALL')
      .describe(
        'BP=Biological Process, MF=Molecular Function, CC=Cellular Component',
      ),
    organism: z.enum(['human', 'mouse', 'rat']).default('human'),
    pValueCutoff: z.number().default(0.05),
  }),
  execute: async (input: {
    genes: string[];
    ontology: string;
    organism: string;
    pValueCutoff: number;
  }): Promise<ToolResult<GOEnrichmentResult[]>> => {
    const { genes, ontology, organism, pValueCutoff } = input;
    const startTime = Date.now();

    // For now, use PANTHER API (free, no key required)
    // In production, consider g:Profiler or Enrichr

    try {
      const orgMap: Record<string, number> = {
        human: 9606,
        mouse: 10090,
        rat: 10116,
      };
      const taxId = orgMap[organism];

      // Use PANTHER overrepresentation API
      const url = 'https://pantherdb.org/services/oai/pantherdb/enrich/overrep';

      const formData = new URLSearchParams();
      formData.append('geneInputList', genes.join(','));
      formData.append('organism', taxId.toString());
      formData.append('annotDataSet', `GO:0008150,GO:0003674,GO:0005575`); // All three ontologies
      formData.append('enrichmentTestType', 'FISHER');
      formData.append('correction', 'FDR');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      const data = await response.json();

      if (!data.results?.result) {
        return {
          success: true,
          data: [],
          source: 'PANTHER',
          executionTime: Date.now() - startTime,
        };
      }

      const results: GOEnrichmentResult[] = data.results.result
        .filter((r: any) => (r.pValue || 1) < pValueCutoff)
        .slice(0, 20)
        .map((r: any) => ({
          goId: r.term?.id || 'Unknown',
          term: r.term?.label || 'Unknown',
          ontology: detectOntology(r.term?.id),
          pValue: r.pValue,
          fdr: r.fdr,
          foldEnrichment: r.fold_enrichment,
          genesInTerm: r.number_in_list,
          totalGenesInTerm: r.number_in_reference,
        }));

      return {
        success: true,
        data: results,
        source: 'PANTHER',
        citations: [
          {
            type: 'database' as const,
            title: 'PANTHER Classification System',
            url: 'https://pantherdb.org/',
          },
        ],
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `GO enrichment failed: ${error}`,
        source: 'PANTHER',
        executionTime: Date.now() - startTime,
      };
    }
  },
});

interface GOEnrichmentResult {
  goId: string;
  term: string;
  ontology: 'BP' | 'MF' | 'CC' | 'Unknown';
  pValue: number;
  fdr?: number;
  foldEnrichment?: number;
  genesInTerm: number;
  totalGenesInTerm: number;
}

function detectOntology(goId: string): 'BP' | 'MF' | 'CC' | 'Unknown' {
  // Simple heuristic based on GO ID ranges (not perfect but works for display)
  if (!goId) return 'Unknown';
  const num = parseInt(goId.replace('GO:', ''));
  if (num >= 8150 && num < 10000) return 'BP';
  if (num >= 3674 && num < 8150) return 'MF';
  if (num >= 5575 && num < 6000) return 'CC';
  return 'Unknown';
}

/** Search STRING database for protein-protein interactions */
export const stringInteractionTool = tool({
  description: `Search STRING database for protein-protein interactions. Use for:
    - Finding protein interaction partners
    - Network analysis
    - Functional associations`,
  inputSchema: z.object({
    geneSymbol: z.string().describe('Gene/protein symbol'),
    organism: z
      .number()
      .default(9606)
      .describe('NCBI taxonomy ID (9606=human)'),
    scoreThreshold: z
      .number()
      .min(0)
      .max(1000)
      .default(400)
      .describe('Minimum interaction score (0-1000)'),
    maxInteractions: z.number().min(1).max(50).default(10),
  }),
  execute: async (input: {
    geneSymbol: string;
    organism: number;
    scoreThreshold: number;
    maxInteractions: number;
  }): Promise<ToolResult<STRINGInteraction[]>> => {
    const { geneSymbol, organism, scoreThreshold, maxInteractions } = input;
    const startTime = Date.now();

    try {
      const url = `https://string-db.org/api/json/network?identifiers=${encodeURIComponent(geneSymbol)}&species=${organism}&required_score=${scoreThreshold}&limit=${maxInteractions}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        return {
          success: true,
          data: [],
          source: 'STRING',
          executionTime: Date.now() - startTime,
        };
      }

      const interactions: STRINGInteraction[] = data.map((item: any) => ({
        proteinA: item.preferredName_A || item.stringId_A,
        proteinB: item.preferredName_B || item.stringId_B,
        score: item.score,
        experimentalScore: item.escore,
        databaseScore: item.dscore,
        textminingScore: item.tscore,
        coexpressionScore: item.ascore,
      }));

      return {
        success: true,
        data: interactions,
        source: 'STRING',
        citations: [
          {
            type: 'database' as const,
            title: 'STRING Database',
            url: `https://string-db.org/network/${geneSymbol}`,
          },
        ],
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `STRING search failed: ${error}`,
        source: 'STRING',
        executionTime: Date.now() - startTime,
      };
    }
  },
});

interface STRINGInteraction {
  proteinA: string;
  proteinB: string;
  score: number;
  experimentalScore?: number;
  databaseScore?: number;
  textminingScore?: number;
  coexpressionScore?: number;
}

export const pathwayTools = {
  kegg_pathway_search: keggPathwaySearchTool,
  reactome_pathway_search: reactomePathwaySearchTool,
  go_enrichment: goEnrichmentTool,
  string_interactions: stringInteractionTool,
};
