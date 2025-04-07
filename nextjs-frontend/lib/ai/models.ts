import { openai } from '@ai-sdk/openai';
import { fireworks } from '@ai-sdk/fireworks';
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
  type LanguageModelV1,
} from 'ai';

export const DEFAULT_CHAT_MODEL = 'chat-model-small';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model-small',
    name: 'Small model',
    description: 'Small model for fast, lightweight tasks',
  },
  {
    id: 'chat-model-large',
    name: 'Large model',
    description: 'Large model for complex, multi-step tasks',
  },
  {
    id: 'chat-model-reasoning',
    name: 'Reasoning model',
    description: 'Uses advanced reasoning',
  },
];

const fireworksModel = fireworks(
  'accounts/fireworks/models/deepseek-r1',
) as unknown as LanguageModelV1;

export const myProvider = customProvider({
  languageModels: {
    // Chat models
    'chat-model-small': openai('gpt-4o-mini'),
    'chat-model-large': openai('gpt-4o'),
    'chat-model-reasoning': wrapLanguageModel({
      model: fireworksModel,
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    }),
    // Utility models
    'title-model': openai('gpt-4-turbo'),
    'artifact-model': openai('gpt-4o-mini'),
    // Search model - using the dedicated model for web search
    'search-model': openai('gpt-4o-search-preview'),
  },
  imageModels: {
    'small-model': openai.image('dall-e-2'),
    'large-model': openai.image('dall-e-3'),
  },
});

export function getModelById(modelId: string) {
  return chatModels.find((model) => model.id === modelId) || chatModels[0];
}
