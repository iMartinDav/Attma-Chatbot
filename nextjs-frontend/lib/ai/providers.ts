/**
 * @fileoverview AI Provider Configuration
 * 
 * This module provides a centralized configuration for all AI providers and models.
 * It follows a layered architecture pattern for maximum flexibility and testability.
 * 
 * Architecture:
 * - ModelRegistry: Defines available models and their capabilities
 * - ProviderFactory: Creates provider instances with proper configuration
 * - CustomProvider: Aggregates all models into a unified interface
 */

import { openai, type OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import {
    customProvider,
    extractReasoningMiddleware,
    wrapLanguageModel
} from 'ai';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Model capability flags
 */
export interface ModelCapabilities {
  chat: boolean;
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
  webSearch: boolean;
  imageGeneration: boolean;
  codeInterpreter: boolean;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'deepseek' | 'anthropic';
  description: string;
  capabilities: ModelCapabilities;
  icon: string;
  contextWindow: number;
  isDefault?: boolean;
  isReasoning?: boolean;
}

/**
 * OpenAI provider options for streamText/generateText
 */
export interface OpenAIProviderConfig {
  reasoningSummary?: 'auto' | 'detailed';
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  textVerbosity?: 'low' | 'medium' | 'high';
  searchContextSize?: 'low' | 'medium' | 'high';
}

// ============================================================================
// Model Registry
// ============================================================================

/**
 * Registry of all available models with their configurations
 * Updated for 2025 with latest OpenAI models
 */
export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // ========== GPT-5 Series (Latest) ==========
  'gpt-5': {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'openai',
    description: 'Most capable model with advanced reasoning',
    icon: '🧠',
    contextWindow: 256000,
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      reasoning: true,
      webSearch: true,
      imageGeneration: true,
      codeInterpreter: true,
    },
  },
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    description: 'Fast and efficient for everyday tasks',
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
  // ========== O-Series (Reasoning Models) ==========
  'o3': {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    description: 'Logic powerhouse for complex reasoning',
    icon: '🔬',
    contextWindow: 200000,
    isReasoning: true,
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      reasoning: true,
      webSearch: true,
      imageGeneration: false,
      codeInterpreter: true,
    },
  },
  'o4-mini': {
    id: 'o4-mini',
    name: 'o4-mini',
    provider: 'openai',
    description: 'Fast reasoning for coding and analysis',
    icon: '⚡',
    contextWindow: 128000,
    isReasoning: true,
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      reasoning: true,
      webSearch: false,
      imageGeneration: true,
      codeInterpreter: true,
    },
  },
  // ========== Specialized Models ==========
  'gpt-5-codex': {
    id: 'gpt-5-codex',
    name: 'GPT-5 Codex',
    provider: 'openai',
    description: 'Optimized for Python/R code generation',
    icon: '💻',
    contextWindow: 128000,
    capabilities: {
      chat: true,
      tools: true,
      vision: false,
      reasoning: false,
      webSearch: false,
      imageGeneration: false,
      codeInterpreter: true,
    },
  },
  'o3-deep-research': {
    id: 'o3-deep-research',
    name: 'o3 Deep Research',
    provider: 'openai',
    description: 'Deep literature and research analysis',
    icon: '📚',
    contextWindow: 200000,
    isReasoning: true,
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      reasoning: true,
      webSearch: true,
      imageGeneration: false,
      codeInterpreter: false,
    },
  },
  // ========== GPT-4 Series (Legacy but Stable) ==========
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and cost-effective for most tasks',
    icon: '⚡',
    contextWindow: 128000,
    capabilities: {
      chat: true,
      tools: true,
      vision: true,
      reasoning: false,
      webSearch: true,
      imageGeneration: false,
      codeInterpreter: true,
    },
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Multimodal model with strong capabilities',
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
  // ========== Fallback (For Unverified Accounts) ==========
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo (Fallback)',
    provider: 'openai',
    description: 'Legacy model for unverified accounts',
    icon: '📝',
    contextWindow: 16384,
    capabilities: {
      chat: true,
      tools: false, // Limited tool support
      vision: false,
      reasoning: false,
      webSearch: false,
      imageGeneration: false,
      codeInterpreter: false,
    },
  },
} as const;

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Creates a language model instance with optional reasoning middleware
 * 
 * Per official AI SDK docs (https://ai-sdk.dev/cookbook/guides/gpt-5):
 * - Use openai('gpt-5') for Responses API (default, recommended)
 * - Use openai.responses('gpt-5') for explicit Responses API with reasoning
 * - Use openai.chat('gpt-5') for Chat Completions API (legacy)
 * 
 * Set USE_CHAT_API=true to use legacy Chat Completions API if Responses API fails.
 */
function createLanguageModel(modelId: string) {
  const config = MODEL_REGISTRY[modelId];
  const useChatAPI = process.env.USE_CHAT_API === 'true';
  
  // Use Responses API (default) or Chat Completions API (fallback)
  const baseModel = useChatAPI ? openai.chat(modelId) : openai(modelId);

  // Apply reasoning middleware for reasoning models
  if (config?.isReasoning) {
    return wrapLanguageModel({
      model: baseModel,
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    });
  }

  return baseModel;
}

// ============================================================================
// Custom Provider Export
// ============================================================================

/**
 * Main AI provider with all configured models
 * 
 * API Selection:
 * - Responses API (default): Requires org verification, supports GPT-5, o3, web search, etc.
 * - Chat Completions API (USE_CHAT_API=true): Works without verification, uses GPT-4o
 * 
 * Model Selection:
 * - With Responses API: gpt-5-mini, gpt-5, o3-mini, o3
 * - With Chat Completions API: gpt-4o-mini, gpt-4o, o3-mini, o3
 */
const USE_FALLBACK = process.env.USE_FALLBACK_MODEL === 'true';
const USE_CHAT_API = process.env.USE_CHAT_API === 'true';

// Select best model based on API being used
const FAST_MODEL = USE_FALLBACK ? 'gpt-3.5-turbo' : (USE_CHAT_API ? 'gpt-4o-mini' : 'gpt-5-mini');
const ADVANCED_MODEL = USE_FALLBACK ? 'gpt-3.5-turbo' : (USE_CHAT_API ? 'gpt-4o' : 'gpt-5');
const UTILITY_MODEL = USE_FALLBACK ? 'gpt-3.5-turbo' : (USE_CHAT_API ? 'gpt-4o-mini' : 'gpt-5-nano');

export const myProvider = customProvider({
  languageModels: {
    // ========== Primary Chat Models ==========
    'chat-model': createLanguageModel(FAST_MODEL),
    'chat-model-standard': createLanguageModel(ADVANCED_MODEL),
    'chat-model-advanced': createLanguageModel(ADVANCED_MODEL),
    
    // ========== Specialized Models ==========
    'chat-model-codex': createLanguageModel(ADVANCED_MODEL),
    'chat-model-research': createLanguageModel(ADVANCED_MODEL),
    
    // ========== Reasoning Models ==========
    'chat-model-reasoning': createLanguageModel(USE_FALLBACK ? 'gpt-3.5-turbo' : 'o3-mini'),
    'chat-model-reasoning-advanced': createLanguageModel(USE_FALLBACK ? 'gpt-3.5-turbo' : 'o3'),
    
    // ========== Utility Models ==========
    'title-model': createLanguageModel(UTILITY_MODEL),
    'artifact-model': createLanguageModel(ADVANCED_MODEL),
    
    // ========== Legacy Aliases ==========
    'chat-model-small': createLanguageModel(FAST_MODEL),
    'chat-model-large': createLanguageModel(ADVANCED_MODEL),
  },
  
  imageModels: {
    'image-model': openai.image('gpt-image-1'),
    'image-model-dalle': openai.image('dall-e-3'),
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get model configuration by internal ID
 * Returns the actual model based on API configuration
 */
export function getModelConfig(internalId: string): ModelConfig | undefined {
  const useChatAPI = process.env.USE_CHAT_API === 'true';
  const useFallback = process.env.USE_FALLBACK_MODEL === 'true';
  
  // Determine which model to use based on config
  const fastModel = useFallback ? 'gpt-3.5-turbo' : (useChatAPI ? 'gpt-4o-mini' : 'gpt-5-mini');
  const advancedModel = useFallback ? 'gpt-3.5-turbo' : (useChatAPI ? 'gpt-4o' : 'gpt-5');
  
  const modelIdMap: Record<string, string> = {
    // Primary mappings
    'chat-model': fastModel,
    'chat-model-standard': advancedModel,
    'chat-model-advanced': advancedModel,
    // Specialized mappings
    'chat-model-codex': advancedModel,
    'chat-model-research': advancedModel,
    // Reasoning mappings
    'chat-model-reasoning': useFallback ? 'gpt-3.5-turbo' : 'o3-mini',
    'chat-model-reasoning-advanced': useFallback ? 'gpt-3.5-turbo' : 'o3',
    // Legacy mappings
    'chat-model-small': fastModel,
    'chat-model-large': advancedModel,
  };
  
  return MODEL_REGISTRY[modelIdMap[internalId] ?? internalId];
}

/**
 * Get default provider options for a model
 */
export function getDefaultProviderOptions(
  modelId: string,
  overrides?: Partial<OpenAIProviderConfig>
): { openai: OpenAIResponsesProviderOptions } {
  const config = getModelConfig(modelId);
  
  const defaults: OpenAIProviderConfig = {
    textVerbosity: 'medium',
    searchContextSize: 'medium',
  };
  
  // Add reasoning options for reasoning models
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

/**
 * Check if a model supports a specific capability
 */
export function modelSupports(
  modelId: string,
  capability: keyof ModelCapabilities
): boolean {
  const config = getModelConfig(modelId);
  return config?.capabilities[capability] ?? false;
}

/**
 * Get all models that support a specific capability
 */
export function getModelsWithCapability(
  capability: keyof ModelCapabilities
): ModelConfig[] {
  return Object.values(MODEL_REGISTRY).filter(
    model => model.capabilities[capability]
  );
}

/**
 * Get the default model ID
 */
export function getDefaultModelId(): string {
  const defaultModel = Object.values(MODEL_REGISTRY).find(m => m.isDefault);
  return defaultModel?.id ?? 'gpt-4o-mini';
}
