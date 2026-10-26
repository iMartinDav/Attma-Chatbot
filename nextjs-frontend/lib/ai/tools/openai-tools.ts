/**
 * OpenAI Built-in Tools Configuration
 * Web Search, Image Generation, Code Interpreter, File Search
 */

import { openai } from '@ai-sdk/openai';
import { tool } from 'ai';
import { z } from 'zod/v4';

export interface WebSearchConfig {
  enabled: boolean;
  searchContextSize: 'low' | 'medium' | 'high';
  externalWebAccess: boolean;
  userLocation?: {
    type: 'approximate';
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
  };
}

export interface ImageGenerationConfig {
  enabled: boolean;
  outputFormat: 'webp' | 'png' | 'jpeg';
  quality: 'low' | 'medium' | 'high';
  size?: 'auto' | '1024x1024' | '1024x1536' | '1536x1024';
}

export interface CodeInterpreterConfig {
  enabled: boolean;
  fileIds?: string[];
}

export interface ToolsConfig {
  webSearch?: Partial<WebSearchConfig>;
  imageGeneration?: Partial<ImageGenerationConfig>;
  codeInterpreter?: Partial<CodeInterpreterConfig>;
}

const DEFAULT_WEB_SEARCH_CONFIG: WebSearchConfig = {
  enabled: true,
  searchContextSize: 'medium',
  externalWebAccess: true,
};

const DEFAULT_IMAGE_GENERATION_CONFIG: ImageGenerationConfig = {
  enabled: true,
  outputFormat: 'webp',
  quality: 'medium',
};

const DEFAULT_CODE_INTERPRETER_CONFIG: CodeInterpreterConfig = {
  enabled: true,
};

/** Creates OpenAI web search tool */
export function createWebSearchTool(config?: Partial<WebSearchConfig>) {
  const mergedConfig = { ...DEFAULT_WEB_SEARCH_CONFIG, ...config };

  if (!mergedConfig.enabled) return null;

  return openai.tools.webSearch({
    searchContextSize: mergedConfig.searchContextSize,
    externalWebAccess: mergedConfig.externalWebAccess,
    ...(mergedConfig.userLocation && {
      userLocation: mergedConfig.userLocation,
    }),
  });
}

/** Creates OpenAI image generation tool */
export function createImageGenerationTool(
  config?: Partial<ImageGenerationConfig>,
) {
  const mergedConfig = { ...DEFAULT_IMAGE_GENERATION_CONFIG, ...config };

  if (!mergedConfig.enabled) return null;

  return openai.tools.imageGeneration({
    outputFormat: mergedConfig.outputFormat,
    quality: mergedConfig.quality,
    ...(mergedConfig.size && { size: mergedConfig.size }),
  });
}

/** Creates OpenAI code interpreter tool */
export function createCodeInterpreterTool(
  config?: Partial<CodeInterpreterConfig>,
) {
  const mergedConfig = { ...DEFAULT_CODE_INTERPRETER_CONFIG, ...config };

  if (!mergedConfig.enabled) return null;

  return openai.tools.codeInterpreter({
    ...(mergedConfig.fileIds && {
      container: { fileIds: mergedConfig.fileIds },
    }),
  });
}

/** Builds tools object with all configured OpenAI built-in tools */
export function buildOpenAITools(
  config?: ToolsConfig,
): Record<string, ReturnType<typeof openai.tools.webSearch>> {
  const tools: Record<string, ReturnType<typeof openai.tools.webSearch>> = {};

  const webSearch = createWebSearchTool(config?.webSearch);
  if (webSearch) {
    tools.web_search = webSearch;
  }

  const imageGeneration = createImageGenerationTool(config?.imageGeneration);
  if (imageGeneration) {
    tools.image_generation = imageGeneration as unknown as ReturnType<
      typeof openai.tools.webSearch
    >;
  }

  const codeInterpreter = createCodeInterpreterTool(config?.codeInterpreter);
  if (codeInterpreter) {
    tools.code_interpreter = codeInterpreter as unknown as ReturnType<
      typeof openai.tools.webSearch
    >;
  }

  return tools;
}

/** PubMed search tool for finding scientific publications */
export const pubmedSearchTool = tool({
  description:
    'Search PubMed for scientific publications on a topic. Use this for finding recent research papers, protocols, and scientific literature.',
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        'Search query for PubMed (e.g., "CRISPR gene editing" or "RNA-seq differential expression")',
      ),
    maxResults: z
      .number()
      .optional()
      .default(5)
      .describe('Maximum number of results to return'),
    sortBy: z
      .enum(['relevance', 'date'])
      .optional()
      .default('relevance')
      .describe('Sort order for results'),
  }),
  execute: async ({ query, maxResults, sortBy }) => {
    // Using NCBI E-utilities API (free, no key required for low volume)
    const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    const searchUrl = `${baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&sort=${sortBy}&retmode=json`;

    try {
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      const ids = searchData.esearchresult?.idlist || [];

      if (ids.length === 0) {
        return {
          success: true,
          results: [],
          message: 'No publications found.',
        };
      }

      // Fetch summaries for found IDs
      const summaryUrl = `${baseUrl}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
      const summaryResponse = await fetch(summaryUrl);
      const summaryData = await summaryResponse.json();

      const results = ids.map((id: string) => {
        const article = summaryData.result?.[id];
        return {
          pmid: id,
          title: article?.title || 'Unknown',
          authors:
            article?.authors?.map((a: { name: string }) => a.name).join(', ') ||
            'Unknown',
          journal: article?.source || 'Unknown',
          pubDate: article?.pubdate || 'Unknown',
          url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        };
      });

      return { success: true, results, count: results.length };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to search PubMed. Please try again.',
        results: [],
      };
    }
  },
});

/** Gene lookup tool for retrieving gene information */
export const geneLookupTool = tool({
  description:
    'Look up information about a gene including its function, aliases, and associated pathways.',
  inputSchema: z.object({
    geneSymbol: z
      .string()
      .describe('Gene symbol to look up (e.g., "TP53", "BRCA1")'),
    organism: z
      .enum(['human', 'mouse', 'rat'])
      .optional()
      .default('human')
      .describe('Organism'),
  }),
  execute: async ({ geneSymbol, organism }) => {
    const orgMap = { human: '9606', mouse: '10090', rat: '10116' };
    const taxId = orgMap[organism];

    const url = `https://mygene.info/v3/query?q=symbol:${geneSymbol}&species=${taxId}&fields=symbol,name,summary,alias,pathway,go`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!data.hits || data.hits.length === 0) {
        return { success: false, error: `Gene "${geneSymbol}" not found.` };
      }

      const gene = data.hits[0];
      return {
        success: true,
        gene: {
          symbol: gene.symbol,
          name: gene.name,
          summary: gene.summary || 'No summary available',
          aliases: gene.alias || [],
          pathways: gene.pathway?.kegg || [],
          goTerms: {
            biologicalProcess: gene.go?.BP?.slice(0, 5) || [],
            molecularFunction: gene.go?.MF?.slice(0, 5) || [],
            cellularComponent: gene.go?.CC?.slice(0, 5) || [],
          },
        },
      };
    } catch (error) {
      return { success: false, error: 'Failed to look up gene information.' };
    }
  },
});

export const bioinformaticsTools = {
  pubmed_search: pubmedSearchTool,
  gene_lookup: geneLookupTool,
};

/** Get all available tools for a chat session */
export function getAllTools(
  options: {
    includeOpenAITools?: boolean;
    includeBioTools?: boolean;
    openAIConfig?: ToolsConfig;
  } = {},
) {
  const {
    includeOpenAITools = true,
    includeBioTools = true,
    openAIConfig,
  } = options;

  let tools: Record<string, unknown> = {};

  if (includeOpenAITools) {
    tools = { ...tools, ...buildOpenAITools(openAIConfig) };
  }

  if (includeBioTools) {
    tools = { ...tools, ...bioinformaticsTools };
  }

  return tools;
}
