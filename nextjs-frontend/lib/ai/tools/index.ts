/**
 * @fileoverview Tool Index
 *
 * Central export point for all AI tools.
 * Provides clean imports for the rest of the application.
 */

// OpenAI Built-in Tools
export {
  buildOpenAITools,
  createCodeInterpreterTool,
  createImageGenerationTool,
  createWebSearchTool,
  getAllTools,
  type CodeInterpreterConfig,
  type ImageGenerationConfig,
  type ToolsConfig,
  type WebSearchConfig,
} from './openai-tools';

// Bioinformatics Tools (legacy)
export {
  bioinformaticsTools,
  geneLookupTool,
  pubmedSearchTool,
} from './openai-tools';

// Research Tools (new, enhanced)
export {
  geneLookupTool as enhancedGeneLookup,
  pubmedSearchTool as enhancedPubmedSearch,
  firecrawlSearchTool,
  researchTools,
  semanticScholarTool,
} from './research-tools';

// Pathway Analysis Tools
export {
  goEnrichmentTool,
  keggPathwaySearchTool,
  pathwayTools,
  reactomePathwaySearchTool,
  stringInteractionTool,
} from './pathway-tools';

// API Key Management
export {
  ApiKeyManager,
  firecrawlKeyManager,
  getApiKey,
  pubmedKeyManager,
  recordApiUsage,
  semanticScholarKeyManager,
} from './api-key-manager';

// Custom Tools
export { createDocument } from './create-document';
export { getWeather } from './get-weather';
export { requestSuggestions } from './request-suggestions';
export { updateDocument } from './update-document';
