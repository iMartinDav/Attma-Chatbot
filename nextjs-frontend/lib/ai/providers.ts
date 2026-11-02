/**
 * AI Provider Configuration
 * Centralized configuration for all AI providers and models.
 */

import { createHash } from 'node:crypto';

import {
  createOpenAI,
  openai,
  type OpenAIResponsesProviderOptions,
} from '@ai-sdk/openai';
import {
  customProvider,
  defaultSettingsMiddleware,
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

// Meta Model API (Muse). When META_MODEL_API_KEY is set, Muse serves every alias
// through Meta's Responses API, the only surface that returns reasoning summaries
// and carries reasoning between tool steps. OpenAI stays as the fallback provider.
const meta = createOpenAI({
  name: 'meta',
  baseURL: 'https://api.meta.ai/v1',
  apiKey: process.env.META_MODEL_API_KEY,
});
const USE_META = Boolean(process.env.META_MODEL_API_KEY);
/** OpenAI built-in tools (web search, image generation, code interpreter) only run on OpenAI. */
export const supportsOpenAIBuiltInTools = !USE_META;

type MuseEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * A Muse model with its reasoning settings baked in. `forceReasoning` is needed
 * because the OpenAI provider only recognizes OpenAI reasoning models by name;
 * `store: false` with encrypted reasoning keeps nothing on Meta's side.
 */
function muse(
  modelId: 'muse-spark-1.3' | 'muse-wonder-1.0',
  effort: MuseEffort,
) {
  return wrapLanguageModel({
    model: meta.responses(modelId),
    middleware: defaultSettingsMiddleware({
      settings: {
        providerOptions: {
          openai: {
            forceReasoning: true,
            // A stable cache key lets Meta reuse the shared instruction prefix across runs.
            promptCacheKey: 'attma-agent',
            reasoningEffort: effort,
            reasoningSummary: 'auto',
            store: false,
            include: ['reasoning.encrypted_content'],
          },
        },
      },
    }),
  });
}

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
  USE_META ? muse('muse-spark-1.3', 'low') : createLanguageModel(FAST_MODEL);
const advanced = () =>
  USE_META
    ? muse('muse-wonder-1.0', 'medium')
    : createLanguageModel(ADVANCED_MODEL);
const reasoning = (openaiModel: string) =>
  USE_META ? muse('muse-wonder-1.0', 'high') : createLanguageModel(openaiModel);

export const myProvider = customProvider({
  languageModels: {
    'chat-model': fast(),
    'chat-model-standard': advanced(),
    'chat-model-advanced': advanced(),
    'chat-model-codex': advanced(),
    'chat-model-research': advanced(),
    'chat-model-reasoning': reasoning(REASONING_MODEL),
    'chat-model-reasoning-advanced': reasoning(REASONING_ADVANCED),
    'title-model': USE_META
      ? muse('muse-spark-1.3', 'minimal')
      : createLanguageModel(FAST_MODEL),
    // Agent roles: Muse Wonder plans and decides; Muse Spark runs fast sub-agents.
    'agent-model': advanced(),
    'subagent-model': fast(),
    'artifact-model': advanced(),
    'chat-model-small': fast(),
    'chat-model-large': advanced(),
  },
  imageModels: {
    // Muse Image: $0.01 per image, OpenAI Images API compatible.
    'image-model': USE_META
      ? meta.image('muse-image-1.0')
      : openai.image('gpt-image-1'),
  },
});

/** Muse search grounding: the Responses `web_search` tool, with citations. */
export const webSearchTool = () =>
  (USE_META ? meta : openai).tools.webSearch({ searchContextSize: 'medium' });

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

/** Hashed per-user identifier for Meta safety tooling: stable for a user, never their email or raw id. */
export function safetyIdentifierFor(userId: string): string {
  return createHash('sha256').update(userId).digest('hex');
}
