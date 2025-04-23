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
    'chat-model-small': openai('gpt-4.1-mini'),
    'chat-model-large': openai('gpt-4.1'),
    'chat-model-reasoning': wrapLanguageModel({
      model: openai('gpt-4.1'),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    }),
    'title-model': openai('gpt-4.1-mini'),
    'artifact-model': openai('gpt-4.1'),
    'search-model': openai('gpt-4.1-search'),
  },
  imageModels: {
    'small-model': openai.image('dall-e-2'),
    'large-model': openai.image('dall-e-3'),
  },
});

export function getModelById(modelId: string) {
  return chatModels.find((model) => model.id === modelId) || chatModels[0];
}
