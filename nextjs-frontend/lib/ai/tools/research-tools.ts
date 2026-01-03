/**
 * Research Tools - PubMed, Semantic Scholar, Firecrawl, Gene Lookup
 * with API key rotation and citation formatting.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolResult } from '../agents/types';
import { getApiKey, recordApiUsage } from './api-key-manager';

/** Enhanced PubMed search with date filtering and abstract retrieval */
export const pubmedSearchTool = tool({
  description: `Search PubMed for scientific publications. Use this for:
    - Finding recent research papers
    - Literature reviews
    - Protocol references
    - Gene/disease associations in literature`,
  inputSchema: z.object({
    query: z.string().describe('Search query (e.g., "CRISPR gene editing" or "TP53 cancer")'),
    maxResults: z.number().min(1).max(20).default(5).describe('Number of results to return'),
    dateFilter: z.enum(['all', '1year', '5years', '10years']).default('5years')
      .describe('Filter by publication date'),
    sortBy: z.enum(['relevance', 'date']).default('relevance')
      .describe('Sort order for results'),
  }),
  execute: async ({ query, maxResults, dateFilter, sortBy }): Promise<ToolResult<PubMedResult[]>> => {
    const startTime = Date.now();
    const apiKey = getApiKey('pubmed');
    const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

    // Build date filter
    let dateRange = '';
    if (dateFilter !== 'all') {
      const years = parseInt(dateFilter);
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - years);
      dateRange = `&mindate=${minDate.getFullYear()}&maxdate=${new Date().getFullYear()}`;
    }

    try {
      // Search for IDs
      const searchUrl = `${baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&sort=${sortBy}&retmode=json${dateRange}${apiKey ? `&api_key=${apiKey}` : ''}`;
      
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      const ids = searchData.esearchresult?.idlist || [];

      if (ids.length === 0) {
        recordApiUsage('pubmed', apiKey || '', true);
        return { 
          success: true, 
          data: [], 
          source: 'PubMed',
          executionTime: Date.now() - startTime,
        };
      }

      // Fetch summaries with abstracts
      const summaryUrl = `${baseUrl}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json${apiKey ? `&api_key=${apiKey}` : ''}`;
      const summaryResponse = await fetch(summaryUrl);
      const summaryData = await summaryResponse.json();

      // Fetch abstracts
      const abstractUrl = `${baseUrl}/efetch.fcgi?db=pubmed&id=${ids.join(',')}&rettype=abstract&retmode=text${apiKey ? `&api_key=${apiKey}` : ''}`;
      const abstractResponse = await fetch(abstractUrl);
      const abstractText = await abstractResponse.text();
      const abstracts = parseAbstracts(abstractText, ids);

      const results: PubMedResult[] = ids.map((id: string) => {
        const article = summaryData.result?.[id];
        return {
          pmid: id,
          title: article?.title || 'Unknown',
          authors: article?.authors?.map((a: { name: string }) => a.name) || [],
          journal: article?.source || 'Unknown',
          pubDate: article?.pubdate || 'Unknown',
          abstract: abstracts[id] || '',
          url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
          doi: article?.elocationid?.replace('doi: ', '') || undefined,
        };
      });

      recordApiUsage('pubmed', apiKey || '', true);

      return {
        success: true,
        data: results,
        source: 'PubMed',
        citations: results.map(r => ({
          type: 'paper' as const,
          title: r.title,
          url: r.url,
          pmid: r.pmid,
          doi: r.doi,
          authors: r.authors,
          year: parseInt(r.pubDate.split(' ')[0]) || undefined,
        })),
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      recordApiUsage('pubmed', apiKey || '', false, String(error));
      return {
        success: false,
        error: `PubMed search failed: ${error}`,
        source: 'PubMed',
        executionTime: Date.now() - startTime,
      };
    }
  },
});

interface PubMedResult {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubDate: string;
  abstract: string;
  url: string;
  doi?: string;
}

/**
 * Parse abstracts from PubMed efetch text response
 */
function parseAbstracts(text: string, ids: string[]): Record<string, string> {
  const abstracts: Record<string, string> = {};
  const sections = text.split(/\n\d+\.\s+/);
  
  ids.forEach((id, index) => {
    if (sections[index + 1]) {
      // Extract abstract portion
      const section = sections[index + 1];
      const abstractMatch = section.match(/\n\n(.+?)(?:\n\n|$)/s);
      abstracts[id] = abstractMatch?.[1]?.trim() || '';
    }
  });
  
  return abstracts;
}

/** Search Semantic Scholar for papers with citations */
export const semanticScholarTool = tool({
  description: `Search Semantic Scholar for academic papers with citation data. Use for:
    - Finding highly cited papers
    - Citation network analysis
    - Related/similar paper discovery`,
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    maxResults: z.number().min(1).max(10).default(5),
    fields: z.array(z.string()).default(['title', 'abstract', 'citationCount', 'authors', 'year', 'url'])
      .describe('Fields to return'),
  }),
  execute: async ({ query, maxResults, fields }): Promise<ToolResult<SemanticScholarResult[]>> => {
    const startTime = Date.now();
    const apiKey = getApiKey('semantic_scholar');

    try {
      const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${maxResults}&fields=${fields.join(',')}`;
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch(url, { headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Semantic Scholar API error');
      }

      const results: SemanticScholarResult[] = (data.data || []).map((paper: any) => ({
        paperId: paper.paperId,
        title: paper.title,
        abstract: paper.abstract,
        authors: paper.authors?.map((a: any) => a.name) || [],
        year: paper.year,
        citationCount: paper.citationCount,
        url: paper.url,
      }));

      recordApiUsage('semantic_scholar', apiKey || '', true);

      return {
        success: true,
        data: results,
        source: 'Semantic Scholar',
        citations: results.map(r => ({
          type: 'paper' as const,
          title: r.title,
          url: r.url,
          year: r.year,
          authors: r.authors,
        })),
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      recordApiUsage('semantic_scholar', apiKey || '', false, String(error));
      return {
        success: false,
        error: `Semantic Scholar search failed: ${error}`,
        source: 'Semantic Scholar',
        executionTime: Date.now() - startTime,
      };
    }
  },
});

interface SemanticScholarResult {
  paperId: string;
  title: string;
  abstract?: string;
  authors: string[];
  year?: number;
  citationCount?: number;
  url?: string;
}

/** Search the web using Firecrawl for scientific content */
export const firecrawlSearchTool = tool({
  description: `Search the web for scientific content using Firecrawl. Use for:
    - Finding protocols and methods
    - Recent news and preprints
    - Documentation and tutorials
    - When PubMed doesn't have relevant results`,
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    maxResults: z.number().min(1).max(10).default(5),
  }),
  execute: async ({ query, maxResults }): Promise<ToolResult<FirecrawlResult[]>> => {
    const startTime = Date.now();
    const apiKey = getApiKey('firecrawl');

    if (!apiKey) {
      return {
        success: false,
        error: 'Firecrawl API key not configured',
        source: 'Firecrawl',
        executionTime: Date.now() - startTime,
      };
    }

    try {
      const response = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          limit: maxResults,
          scrapeOptions: {
            formats: ['markdown'],
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Firecrawl API error');
      }

      const results: FirecrawlResult[] = (data.data || []).map((item: any) => ({
        title: item.title,
        url: item.url,
        description: item.description,
        content: item.markdown?.slice(0, 1000) || '', // First 1000 chars
      }));

      recordApiUsage('firecrawl', apiKey, true);

      return {
        success: true,
        data: results,
        source: 'Firecrawl',
        citations: results.map(r => ({
          type: 'web' as const,
          title: r.title,
          url: r.url,
        })),
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      recordApiUsage('firecrawl', apiKey || '', false, String(error));
      return {
        success: false,
        error: `Firecrawl search failed: ${error}`,
        source: 'Firecrawl',
        executionTime: Date.now() - startTime,
      };
    }
  },
});

interface FirecrawlResult {
  title: string;
  url: string;
  description?: string;
  content: string;
}

/** Enhanced gene lookup with multiple databases */
export const geneLookupTool = tool({
  description: `Look up comprehensive information about a gene. Includes:
    - Gene function and description
    - Aliases and alternative names
    - Associated pathways (KEGG)
    - GO terms (biological process, molecular function, cellular component)
    - Associated diseases`,
  inputSchema: z.object({
    geneSymbol: z.string().describe('Gene symbol (e.g., "TP53", "BRCA1")'),
    organism: z.enum(['human', 'mouse', 'rat']).default('human'),
    includeDiseases: z.boolean().default(false).describe('Include associated diseases'),
  }),
  execute: async ({ geneSymbol, organism, includeDiseases }): Promise<ToolResult<GeneInfo>> => {
    const startTime = Date.now();
    const orgMap = { human: '9606', mouse: '10090', rat: '10116' };
    const taxId = orgMap[organism];

    try {
      // MyGene.info API
      const fields = 'symbol,name,summary,alias,pathway.kegg,go,entrezgene,ensembl.gene';
      const url = `https://mygene.info/v3/query?q=symbol:${geneSymbol}&species=${taxId}&fields=${fields}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!data.hits || data.hits.length === 0) {
        return {
          success: false,
          error: `Gene "${geneSymbol}" not found`,
          source: 'MyGene.info',
          executionTime: Date.now() - startTime,
        };
      }

      const gene = data.hits[0];
      
      const geneInfo: GeneInfo = {
        symbol: gene.symbol,
        name: gene.name,
        summary: gene.summary || 'No summary available',
        aliases: Array.isArray(gene.alias) ? gene.alias : (gene.alias ? [gene.alias] : []),
        entrezId: gene.entrezgene,
        ensemblId: gene.ensembl?.gene,
        pathways: gene.pathway?.kegg?.map((p: any) => ({
          id: p.id,
          name: p.name,
        })) || [],
        goTerms: {
          biologicalProcess: (gene.go?.BP || []).slice(0, 5).map((t: any) => ({
            id: t.id,
            term: t.term,
          })),
          molecularFunction: (gene.go?.MF || []).slice(0, 5).map((t: any) => ({
            id: t.id,
            term: t.term,
          })),
          cellularComponent: (gene.go?.CC || []).slice(0, 5).map((t: any) => ({
            id: t.id,
            term: t.term,
          })),
        },
      };

      // Optional: Fetch disease associations from OMIM/ClinVar
      if (includeDiseases) {
        // This could be expanded with additional API calls
        geneInfo.diseases = [];
      }

      return {
        success: true,
        data: geneInfo,
        source: 'MyGene.info',
        citations: [{
          type: 'database',
          title: `MyGene.info - ${geneSymbol}`,
          url: `https://mygene.info/v3/gene/${gene.entrezgene || gene._id}`,
        }],
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `Gene lookup failed: ${error}`,
        source: 'MyGene.info',
        executionTime: Date.now() - startTime,
      };
    }
  },
});

interface GeneInfo {
  symbol: string;
  name: string;
  summary: string;
  aliases: string[];
  entrezId?: string;
  ensemblId?: string;
  pathways: Array<{ id: string; name: string }>;
  goTerms: {
    biologicalProcess: Array<{ id: string; term: string }>;
    molecularFunction: Array<{ id: string; term: string }>;
    cellularComponent: Array<{ id: string; term: string }>;
  };
  diseases?: Array<{ name: string; source: string }>;
}

export const researchTools = {
  pubmed_search: pubmedSearchTool,
  semantic_scholar: semanticScholarTool,
  firecrawl_search: firecrawlSearchTool,
  gene_lookup: geneLookupTool,
};
