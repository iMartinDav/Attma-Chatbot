import { openai } from '@ai-sdk/openai';
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';

export const myProvider = customProvider({
  languageModels: {
    'chat-model': openai('gpt-4o-mini'), // Default chat model
    'chat-model-reasoning': wrapLanguageModel({
      model: openai('gpt-4o'),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    }),
    // Keep the original ones for backward compatibility
    'chat-model-small': openai('gpt-4o-mini'),
    'chat-model-large': openai('gpt-4o'),
    'title-model': openai('gpt-4o-mini'),
    'artifact-model': openai('gpt-4o'),
  },
});
