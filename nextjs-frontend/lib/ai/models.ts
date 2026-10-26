/**
 * @fileoverview Chat Model Definitions
 *
 * Defines the available models for the UI selector, including their capabilities
 * and display metadata. Updated for 2025 with latest OpenAI models.
 */

export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string; // The ID sent to the API
  name: string; // Display name
  description: string; // Short description
  icon?: string; // Optional icon override
  capabilities: {
    reasoning?: boolean; // Supports reasoning/thinking display
    webSearch?: boolean; // Supports web search tools
    imageGeneration?: boolean; // Supports image generation
    codeInterpreter?: boolean; // Supports code execution
    vision?: boolean; // Supports image inputs
  };
}

/**
 * Models for UI selector
 * Focus on CAPABILITIES not model names - customers shouldn't need to know technical details
 * The actual model used depends on the API configuration (Responses vs Chat Completions)
 */
export const chatModels: Array<ChatModel> = [
  // Default - Fast & capable
  {
    id: 'chat-model', // Maps to gpt-4o-mini or gpt-5-mini depending on API
    name: 'Standard',
    description: 'Muse Spark · fast for everyday tasks',
    capabilities: {
      webSearch: false,
      vision: true,
      reasoning: false,
      imageGeneration: false,
      codeInterpreter: false,
    },
  },
  // Advanced - Most capable
  {
    id: 'chat-model-standard', // Maps to gpt-4o or gpt-5 depending on API
    name: 'Advanced',
    description: 'Muse Wonder · most capable for analysis',
    capabilities: {
      webSearch: false,
      vision: true,
      reasoning: false,
      imageGeneration: false,
      codeInterpreter: false,
    },
  },
  // Reasoning - For complex logic
  {
    id: 'chat-model-reasoning', // Maps to o3-mini
    name: 'Reasoning',
    description: 'Muse Wonder · deep reasoning',
    capabilities: {
      reasoning: true,
      webSearch: false,
      vision: true,
      codeInterpreter: false,
    },
  },
];
