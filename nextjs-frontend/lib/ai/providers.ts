/**
 * AI Provider Configuration
 * Centralized configuration for all AI providers and models.
 */

import { openai, type OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';

export interface ModelCapabilities {
  chat: boolean;
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
  webSearch: boolean;
  imageGeneration: boolean;
  codeInterpreter: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai';
  description: string;
  capabilities: ModelCapabilities;
  icon: string;
  contextWindow: number;
  isDefault?: boolean;
  isReasoning?: boolean;
}

export interface OpenAIProviderConfig {
  reasoningSummary?: 'auto' | 'detailed';
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  textVerbosity?: 'low' | 'medium' | 'high';
  searchContextSize?: 'low' | 'medium' | 'high';
}

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and cost-effective for most tasks',
    icon: '⚡',
    contextWindow: 128000,
    isDefault: true,
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      reasoning: false,
      webSearch: true,
      imageGeneration: true,
      codeInterpreter: true,
    },
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Most capable multimodal model',
    icon: '🧠',
    contextWindow: 128000,
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      reasoning: false,
      webSearch: true,
      imageGeneration: true,
      codeInterpreter: true,
    },
  },
  'o3-mini': {
    id: 'o3-mini',
    name: 'o3-mini',
    provider: 'openai',
    description: 'Fast reasoning for coding and analysis',
    icon: '🔬',
    contextWindow: 128000,
    isReasoning: true,
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      reasoning: true,
      webSearch: false,
      imageGeneration: false,
      codeInterpreter: true,
    },
  },
  o3: {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    description: 'Advanced reasoning powerhouse',
    icon: '🔬',
    contextWindow: 200000,
    isReasoning: true,
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      reasoning: true,
      webSearch: false,
      imageGeneration: false,
      codeInterpreter: true,
    },
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    description: 'Legacy model for unverified accounts',
    icon: '📝',
    contextWindow: 16384,
    capabilities: {
      chat: true,
      tools: false,
      vision: false,
      reasoning: false,
      webSearch: false,
      imageGeneration: false,
      codeInterpreter: false,
    },
  },
} as const;

// Meta Model API (Muse) is OpenAI-compatible. When MODEL_API_KEY is set, Muse
// serves every chat alias; OpenAI stays as the fallback provider.
const meta = createOpenAICompatible({
  name: 'meta',
  baseURL: 'https://api.meta.ai/v1',
  apiKey: process.env.MODEL_API_KEY,
  supportsStructuredOutputs: true,
});
const USE_META = Boolean(process.env.MODEL_API_KEY);
/** OpenAI built-in tools (web search, image generation, code interpreter) only run on OpenAI. */
export const supportsOpenAIBuiltInTools = !USE_META;
const MUSE_FAST = 'muse-spark-1.3';
const MUSE_ADVANCED = 'muse-wonder-1.0';

function createLanguageModel(modelId: string) {
  const config = MODEL_REGISTRY[modelId];
  const baseModel = openai.chat(modelId);

  if (config?.isReasoning) {
    return wrapLanguageModel({
      model: baseModel,
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    });
  }

  return baseModel;
}

const USE_FALLBACK = process.env.USE_FALLBACK_MODEL === 'true';

const FAST_MODEL = USE_FALLBACK ? 'gpt-3.5-turbo' : 'gpt-4o-mini';
const ADVANCED_MODEL = USE_FALLBACK ? 'gpt-3.5-turbo' : 'gpt-4o';
const REASONING_MODEL = USE_FALLBACK ? 'gpt-3.5-turbo' : 'o3-mini';
const REASONING_ADVANCED = USE_FALLBACK ? 'gpt-3.5-turbo' : 'o3';

const fast = () =>
  USE_META ? meta(MUSE_FAST) : createLanguageModel(FAST_MODEL);
const advanced = () =>
  USE_META ? meta(MUSE_ADVANCED) : createLanguageModel(ADVANCED_MODEL);
const reasoning = (openaiModel: string) =>
  USE_META ? meta(MUSE_ADVANCED) : createLanguageModel(openaiModel);

export const myProvider = customProvider({
  languageModels: {
    'chat-model': fast(),
    'chat-model-standard': advanced(),
    'chat-model-advanced': advanced(),
    'chat-model-codex': advanced(),
    'chat-model-research': advanced(),
    'chat-model-reasoning': reasoning(REASONING_MODEL),
    'chat-model-reasoning-advanced': reasoning(REASONING_ADVANCED),
    'title-model': fast(),
    'artifact-model': advanced(),
    'chat-model-small': fast(),
    'chat-model-large': advanced(),
  },
  imageModels: {
    'image-model': openai.image('gpt-image-1'),
    'image-model-dalle': openai.image('dall-e-3'),
  },
});

export function getModelConfig(internalId: string): ModelConfig | undefined {
  const useFallback = process.env.USE_FALLBACK_MODEL === 'true';

  const modelIdMap: Record<string, string> = {
    'chat-model': useFallback ? 'gpt-3.5-turbo' : 'gpt-4o-mini',
    'chat-model-standard': useFallback ? 'gpt-3.5-turbo' : 'gpt-4o',
    'chat-model-advanced': useFallback ? 'gpt-3.5-turbo' : 'gpt-4o',
    'chat-model-codex': useFallback ? 'gpt-3.5-turbo' : 'gpt-4o',
    'chat-model-research': useFallback ? 'gpt-3.5-turbo' : 'gpt-4o',
    'chat-model-reasoning': useFallback ? 'gpt-3.5-turbo' : 'o3-mini',
    'chat-model-reasoning-advanced': useFallback ? 'gpt-3.5-turbo' : 'o3',
    'chat-model-small': useFallback ? 'gpt-3.5-turbo' : 'gpt-4o-mini',
    'chat-model-large': useFallback ? 'gpt-3.5-turbo' : 'gpt-4o',
  };

  return MODEL_REGISTRY[modelIdMap[internalId] ?? internalId];
}

export function getDefaultProviderOptions(
  modelId: string,
  overrides?: Partial<OpenAIProviderConfig>,
): { openai: OpenAIResponsesProviderOptions } {
  const config = getModelConfig(modelId);

  const defaults: OpenAIProviderConfig = {
    textVerbosity: 'medium',
    searchContextSize: 'medium',
  };

  if (config?.isReasoning || config?.capabilities.reasoning) {
    defaults.reasoningSummary = 'detailed';
    defaults.reasoningEffort = 'medium';
  }

  return {
    openai: {
      ...defaults,
      ...overrides,
    } as OpenAIResponsesProviderOptions,
  };
}

export function modelSupports(
  modelId: string,
  capability: keyof ModelCapabilities,
): boolean {
  const config = getModelConfig(modelId);
  return config?.capabilities[capability] ?? false;
}

export function getModelsWithCapability(
  capability: keyof ModelCapabilities,
): ModelConfig[] {
  return Object.values(MODEL_REGISTRY).filter(
    (model) => model.capabilities[capability],
  );
}

export function getDefaultModelId(): string {
  const defaultModel = Object.values(MODEL_REGISTRY).find((m) => m.isDefault);
  return defaultModel?.id ?? 'gpt-4o-mini';
}
