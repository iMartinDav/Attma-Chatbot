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
  string_interactions: stringInteractionTool,
};
