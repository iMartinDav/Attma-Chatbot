/**
 * @fileoverview Chat API Route Handler
 * 
 * This is the main chat endpoint that handles:
 * - Message streaming with OpenAI models
 * - Tool execution (web search, image generation, code interpreter)
 * - Reasoning/thinking output for supported models
 * - Multi-step agent loops for complex tasks
 * - Auto-model selection based on task type
 * - Source citations from web search
 * - Chat persistence
 * 
 * Architecture:
 * - Uses modular provider configuration from lib/ai/providers
 * - Tools are dynamically loaded based on model capabilities
 * - Task router detects optimal model from prompt
 * - Supports multiple response stream options (reasoning, sources)
 */

import { auth } from '@/app/(auth)/auth';
import type { VisibilityType } from '@/components/chat/visibility-selector';
import {
  detectAgentDomain,
  detectTaskCategory,
  getDomainInstructions,
  routeToOptimalModel,
} from '@/lib/ai/agents/task-router';
import { multiModalProcessor } from '@/lib/ai/multimodal-processor';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  getDefaultProviderOptions,
  getModelConfig,
  modelSupports,
  myProvider
} from '@/lib/ai/providers';
import {
  bioinformaticsTools,
  buildOpenAITools,
  pathwayTools,
  researchTools,
} from '@/lib/ai/tools';
import { createDocument } from '@/lib/ai/tools/create-document';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { updateDocument } from '@/lib/ai/tools/update-document';
import {
  deleteChatById,
  getChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  ToolSet
} from 'ai';
import { generateTitleFromUserMessage } from '../../(chat)/actions';
import { postRequestBodySchema, type PostRequestBody } from './schema';

export const maxDuration = 60;

const MODEL_KEY_MAP: Record<string, string> = {
  'chat-model': 'chat-model',
  'chat-model-standard': 'chat-model-standard',
  'chat-model-reasoning': 'chat-model-reasoning',
  'gpt-4o-mini': 'chat-model',
  'gpt-4o': 'chat-model-standard',
  'gpt-5-mini': 'chat-model',
  'gpt-5': 'chat-model-standard',
  'o3-mini': 'chat-model-reasoning',
} as const;

import type { Session } from 'next-auth';

/** Build tool set based on model capabilities */
function buildToolsForModel(modelId: string, session: Session, dataStream?: { write: (data: any) => void }) {
  const tools: Record<string, unknown> = {};
  
  // Use provided dataStream or a no-op stub
  const streamWriter = dataStream || { write: () => {} };

  // Always include custom tools - these need real dataStream for artifacts to work
  tools.getWeather = getWeather;
  tools.createDocument = createDocument({ session, dataStream: streamWriter as any }); 
  tools.updateDocument = updateDocument({ session, dataStream: streamWriter as any });
  tools.requestSuggestions = requestSuggestions({ session, dataStream: streamWriter as any });
  
  Object.assign(tools, researchTools);
  Object.assign(tools, pathwayTools);
  Object.assign(tools, bioinformaticsTools);
  
  const useChatAPI = process.env.USE_CHAT_API === 'true';
  
  if (!useChatAPI) {
    if (modelSupports(modelId, 'webSearch')) {
      const openaiTools = buildOpenAITools({
        webSearch: { enabled: true, searchContextSize: 'high'
        },
      });
      Object.assign(tools, openaiTools);
    }
    
    if (modelSupports(modelId, 'imageGeneration')) {
      Object.assign(tools, buildOpenAITools({ imageGeneration: { enabled: true, quality: 'medium' } }));
    }
    
    if (modelSupports(modelId, 'codeInterpreter')) {
      Object.assign(tools, buildOpenAITools({ codeInterpreter: { enabled: true } }));
    }
  }
  
  return tools;
}

/** Converts database messages to AI SDK format */
function convertMessagesToAIFormat(
  messages: Array<{ id: string; role: string; content: unknown }>
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  return messages.map(msg => {
    let textContent = '';
    
    if (Array.isArray(msg.content)) {
      textContent = msg.content
        .map((c: { text?: string; type?: string }) => c.text || '')
        .join('');
    } else if (typeof msg.content === 'string') {
      textContent = msg.content;
    } else {
      textContent = JSON.stringify(msg.content);
    }
    
    return {
      role: msg.role as 'user' | 'assistant' | 'system',
      content: textContent,
    };
  });
}

/** Extracts text from message parts */
function extractTextFromParts(parts: unknown[]): string {
  if (!Array.isArray(parts)) return '';
  
  return parts
    .filter((p: unknown): p is { type: string; text: string } => 
      typeof p === 'object' && p !== null && 'type' in p && (p as { type: string }).type === 'text'
    )
    .map(p => p.text)
    .join('');
}


export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parseResult = postRequestBodySchema.safeParse(json);

    if (!parseResult.success) {
      return new ChatSDKError('bad_request:api').toResponse();
    }

    const { 
      id, 
      message, 
      selectedChatModel, 
      selectedVisibilityType,
      selectedAgentId 
    }: PostRequestBody & { selectedAgentId?: string } = parseResult.data;

    // ... (rest of authentication and chat ID setup)

    // ... (Authentication check)
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    // Chat ID management
    let chatId = id;
    const isNewChat = id === 'new';
    if (isNewChat) {
      chatId = crypto.randomUUID();
    }

    // Load existing messages for context
    let existingMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
    
    if (!isNewChat) {
      try {
        const dbMessages = await getMessagesByChatId({ id: chatId });
        existingMessages = convertMessagesToAIFormat(dbMessages);
      } catch {
        // Continue with empty history if messages can't be loaded
      }
    }

    // Build current message
    // Build current message with multi-modal support
    const userMessageText = message.parts && Array.isArray(message.parts)
      ? extractTextFromParts(message.parts)
      : message.content || '';

    // Handle file attachments for the current message
    let currentUserMessageContent: string | Array<{ type: string; [key: string]: unknown }> = userMessageText;
    
    // Check for experimental_attachments in the request body
    const attachments = (message as any).experimental_attachments;
    if (attachments && attachments.length > 0) {
      // Process attachments using multiModalProcessor
      currentUserMessageContent = await multiModalProcessor.prepareMessageWithFiles(
        userMessageText,
        attachments.map((a: any) => ({
          base64: a.content || '', 
          mimeType: a.contentType,
          filename: a.name
        }))
      );
    }

    const allMessages = [
      ...existingMessages,
      { role: 'user' as const, content: currentUserMessageContent as any }, // Cast as any to satisfy CoreMessage type
    ];

    // Determine model configuration
    const modelKey = MODEL_KEY_MAP[selectedChatModel] || 'chat-model';
    const modelConfig = getModelConfig(selectedChatModel);
    const isReasoningModel = modelConfig?.isReasoning ?? false;

    // Build provider options
    const providerOptions = getDefaultProviderOptions(selectedChatModel, {
      reasoningSummary: isReasoningModel ? 'detailed' : undefined,
      reasoningEffort: isReasoningModel ? 'medium' : undefined,
    });

    // Build tools
    const tools = buildToolsForModel(selectedChatModel, session);

    // Agent selection & instructions
    let domain: any = 'general';
    if (selectedAgentId && selectedAgentId !== 'auto') {
      // Map UI IDs to AgentDomain
      const idMap: Record<string, any> = {
        'single-cell': 'single_cell',
        'variant-analysis': 'variant',
        'pathway-analysis': 'pathway',
        'bioinformatics': 'general',
      };
      domain = idMap[selectedAgentId] || 'general';
    } else {
      domain = detectAgentDomain(userMessageText);
    }
    
    const domainInstructions = getDomainInstructions(domain);
    let system = systemPrompt({ selectedChatModel });
    
    if (domain !== 'general') {
      system = `ACTING AS SPECIALIST: ${domain.replace('_', ' ')}\n\n${domainInstructions}\n\n${system}`;
    }

    // Task detection for auto-model selection
    const detectedTask = detectTaskCategory(userMessageText);
    const modelRouting = routeToOptimalModel(userMessageText, {
      hasAttachments: false,
      forceReasoning: selectedChatModel === 'chat-model-reasoning',
    });
    
    // File attachment detection for model upgrade
    const hasAttachments = message.parts?.some((part: any) => 
      part.type === 'image' || part.type === 'file' ||
      (part.type === 'text' && part.experimental_attachments?.length > 0)
    ) || (message as any).experimental_attachments?.length > 0;
    
    let finalModelKey = modelKey;
    if (selectedChatModel === 'chat-model' && detectedTask !== 'general') {
      finalModelKey = modelRouting.modelKey;
    }
    
    if (hasAttachments && finalModelKey === 'chat-model') {
      finalModelKey = 'chat-model-standard';
    }
    
    const maxSteps = detectedTask === 'research' ? 10 
      : detectedTask === 'reasoning' ? 8 : detectedTask === 'data_analysis' ? 6 : 5;

    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer }) => {
        const toolsWithWriter = buildToolsForModel(selectedChatModel, session, writer as any);
        const finalTools = { ...tools, ...toolsWithWriter };

        const streamingResult = streamText({
          model: myProvider.languageModel(finalModelKey),
          messages: allMessages,
          system,
          tools: Object.keys(finalTools).length > 0 ? (finalTools as ToolSet) : undefined,
          providerOptions,
          stopWhen: stepCountIs(maxSteps),
          onFinish: async (result) => {
            if (session?.user?.id) {
              try {
                // Create chat for new conversations
                if (isNewChat) {
                  const title = await generateTitleFromUserMessage({ message });
                  await saveChat({
                    id: chatId,
                    title: title,
                    userId: session.user.id,
                    visibility: selectedVisibilityType as VisibilityType,
                  });
                }

                const assistantParts: Array<{type: string; [key: string]: unknown}> = [];
                
                if (result.text) {
                  assistantParts.push({ type: 'text', text: result.text });
                }
                
                if (result.steps && result.steps.length > 0) {
                  for (const step of result.steps) {
                    if (step.toolCalls?.length) {
                      for (const tc of step.toolCalls as any[]) {
                        assistantParts.push({
                          type: 'tool-call', toolCallId: tc.toolCallId,
                          toolName: tc.toolName, args: tc.args || tc.input,
                        });
                      }
                    }
                    if (step.toolResults?.length) {
                      for (const tr of step.toolResults as any[]) {
                        assistantParts.push({
                          type: 'tool-result', toolCallId: tr.toolCallId,
                          toolName: tr.toolName, result: tr.result || tr.output,
                        });
                      }
                    }
                  }
                }
                if (assistantParts.length === 0) {
                  assistantParts.push({ type: 'text', text: result.text || '' });
                }

                const messagesToSave = [
                  {
                    id: message.id,
                    chatId: chatId,
                    role: message.role,
                    content: message.parts || [{ type: 'text', text: userMessageText }],
                    createdAt: new Date(),
                  },
                  {
                    id: crypto.randomUUID(),
                    chatId: chatId,
                    role: 'assistant' as const,
                    content: assistantParts,
                    createdAt: new Date(),
                  }
                ];

                await saveMessages({ messages: messagesToSave });
              } catch (error) {
                console.error('Error saving chat messages:', error);
              }
            }
          },
        });

        const uiStream = streamingResult.toUIMessageStream({ sendReasoning: isReasoningModel });
        const reader = uiStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            writer.write(value);
          }
        } finally {
          reader.releaseLock();
        }
      },
    });

    return createUIMessageStreamResponse({
      stream,
      headers: { 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });
  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });
  return Response.json(deletedChat, { status: 200 });
}
