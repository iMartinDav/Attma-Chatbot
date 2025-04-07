import {
  type Message,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';

import { auth } from '@/app/(auth)/auth';
import { myProvider } from '@/lib/ai/models';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
  getMessageById,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';

import { generateTitleFromUserMessage } from '../../actions';

// Add custom type definition for messages with annotations
interface ExtendedMessage extends Message {
  annotations?: any[];
  sourceType?: string;
  reasoning?: string;
}

export const maxDuration = 60;

/**
 * Handles direct search requests using the OpenAI Search API
 */
async function handleDirectSearchRequest(query: string, options: any = {}) {
  try {
    console.log('Processing direct search request');

    // Configure search request according to the latest OpenAI documentation
    const requestBody: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      web_search_options: {
        user_location?: {
          type: string;
          approximate: {
            country?: string;
            city?: string;
            region?: string;
            timezone?: string;
          };
        };
        search_context_size?: string;
      };
    } = {
      model: 'gpt-4o-search-preview',
      messages: [{ role: 'user', content: query }],
      web_search_options: {},
    };

    // Add user location if provided
    if (options.userLocation) {
      requestBody.web_search_options.user_location = {
        type: 'approximate',
        approximate: {
          country: options.userLocation.country,
          city: options.userLocation.city,
          region: options.userLocation.region,
          timezone: options.userLocation.timezone,
        },
      };
    }

    // Add search context size if provided
    if (options.contextSize) {
      requestBody.web_search_options.search_context_size = options.contextSize;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Search API error:', errorText);
      return Response.json(
        {
          success: false,
          content: 'Search service unavailable',
          error: errorText,
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    const content = data.choices[0]?.message?.content || 'No results found';
    const annotations = data.choices[0]?.message?.annotations || [];

    // Log annotations for debugging
    console.log(
      `Search annotations: ${JSON.stringify(annotations).substring(0, 200)}...`,
    );

    return Response.json({
      success: true,
      content,
      annotations,
    });
  } catch (error) {
    console.error('Search error:', error);
    return Response.json(
      {
        success: false,
        content: 'An error occurred while searching',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * Creates a new chat for search requests with a proper descriptive title
 */
async function createSearchChat(
  userId: string,
  message: Message,
  chatId: string,
) {
  // Create a meaningful default title based on the search query
  let title = `Search: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`;

  try {
    // Generate a better title using AI
    const generatedTitle = await generateTitleFromUserMessage({ message });

    // Validate the generated title
    if (generatedTitle && generatedTitle.length > 3) {
      title = generatedTitle;
    }
  } catch (error) {
    console.warn('Title generation failed, using default search title');
  }

  await saveChat({ id: chatId, userId, title });
  return await getChatById({ id: chatId });
}

/**
 * Add search-specific system prompt to messages
 */
function addSearchSystemPrompt(messages: Message[]): Message[] {
  return [
    {
      id: 'search-system',
      role: 'system',
      content:
        "You are a helpful assistant with web search capabilities. Return concise and accurate information relevant to the user's query. Include sources where appropriate.",
    },
    ...messages,
  ];
}

/**
 * Ensures Date objects are correctly formatted for database operations
 */
function ensureProperDateObjects(messages: any[]): any[] {
  return messages.map((msg) => ({
    ...msg,
    createdAt:
      msg.createdAt instanceof Date
        ? msg.createdAt
        : typeof msg.createdAt === 'string'
          ? new Date(msg.createdAt)
          : new Date(),
  }));
}

/**
 * Verifies a message exists in the database - useful for debugging foreign key issues
 */
async function ensureMessageExists(messageId: string): Promise<boolean> {
  try {
    const message = await getMessageById({ id: messageId });
    return message && message.length > 0;
  } catch (error) {
    console.error('Error checking message existence:', error);
    return false;
  }
}

/**
 * Properly preserve annotations from search responses
 */
function processAnnotations(annotations: any): any[] {
  if (!annotations || !Array.isArray(annotations)) {
    return [];
  }

  return annotations
    .map((annotation) => {
      if (
        annotation &&
        typeof annotation === 'object' &&
        annotation.type === 'url_citation'
      ) {
        return {
          type: 'url_citation',
          url_citation: {
            url: annotation.url_citation?.url || '',
            title: annotation.url_citation?.title || '',
            start_index: annotation.url_citation?.start_index,
            end_index: annotation.url_citation?.end_index,
          },
        };
      }
      return annotation;
    })
    .filter((a) => a && a.type === 'url_citation' && a.url_citation?.url);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Direct search endpoint - used by client-side search function
    if (body.query && typeof body.query === 'string') {
      return handleDirectSearchRequest(body.query, body.options || {});
    }

    // Chat-integrated search flow - handles both saving and streaming
    const {
      id,
      messages,
      selectedChatModel = 'search-model',
      saveOnly = false,
    } = body;

    const session = await auth();

    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Handle direct message saving mode (used by client to save search messages)
    if (saveOnly && Array.isArray(messages) && messages.length > 0) {
      try {
        // Create or get chat
        const chat = await getChatById({ id });

        if (!chat) {
          const userMessage = messages.find((m) => m.role === 'user');
          if (userMessage) {
            await createSearchChat(session.user.id, userMessage, id);
          } else {
            await saveChat({
              id,
              userId: session.user.id,
              title: `Search ${new Date().toLocaleTimeString()}`,
            });
          }
        } else if (chat.userId !== session.user.id) {
          return new Response('Unauthorized', { status: 401 });
        }

        // Format messages properly for database storage
        const messagesToSave = ensureProperDateObjects(messages).map((msg) => {
          // Process annotations if they exist
          const processedAnnotations = msg.annotations
            ? processAnnotations(msg.annotations)
            : undefined;

          return {
            id: msg.id,
            chatId: id, // Essential for foreign key relationships
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
            sourceType: msg.sourceType || undefined,
            reasoning: msg.reasoning || undefined,
            annotations: processedAnnotations,
          };
        });

        // Log what's being saved for debugging
        if (messagesToSave[0]?.annotations) {
          console.log(
            `Saving message with ${messagesToSave[0].annotations.length} annotations`,
          );
        }

        // Save messages to database
        await saveMessages({ messages: messagesToSave });

        // Return success response
        return Response.json({ success: true }, { status: 200 });
      } catch (error) {
        console.error('Failed to save search messages:', error);
        return Response.json(
          {
            success: false,
            error: String(error),
          },
          { status: 500 },
        );
      }
    }

    // Standard streaming search flow
    const userMessage = getMostRecentUserMessage(messages);
    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    // Create/get chat and save user message
    const chat = await getChatById({ id });
    if (!chat) {
      await createSearchChat(session.user.id, userMessage, id);
    } else if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Save user message
    await saveMessages({
      messages: [
        {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: new Date(),
          chatId: id,
        },
      ],
    });

    // Add system prompt and stream search response
    const searchMessages = addSearchSystemPrompt(messages);

    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          messages: searchMessages,
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          onFinish: async ({ response, reasoning }) => {
            if (session.user?.id) {
              try {
                const sanitizedMessages = sanitizeResponseMessages({
                  messages: response.messages,
                  reasoning,
                });

                // Preserve annotations from assistant messages
                const messagesToSave = sanitizedMessages.map((message) => {
                  // Extract annotations from the original response message
                  // Type assertion to access annotations property
                  const originalMessage = response.messages.find(
                    (m) => m.id === message.id,
                  ) as ExtendedMessage | undefined;
                  const annotations = originalMessage?.annotations;

                  return {
                    id: message.id,
                    chatId: id,
                    role: message.role,
                    content: message.content,
                    createdAt: new Date(),
                    sourceType: 'web-search',
                    reasoning: reasoning || 'Web search results',
                    annotations: annotations
                      ? processAnnotations(annotations)
                      : undefined,
                  };
                });

                await saveMessages({ messages: messagesToSave });

                console.log(
                  `Saved ${messagesToSave.length} search messages with annotations`,
                );
              } catch (error) {
                console.error('Failed to save search results:', error);
              }
            }
          },
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'stream-search',
          },
        });

        result.consumeStream();
        result.mergeIntoDataStream(dataStream, { sendReasoning: true });
      },
      onError: (error) => {
        console.error('Search error:', error);
        return 'Search failed. Please try again.';
      },
    });
  } catch (error) {
    console.error('Unhandled error in search API:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (!chat || chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    console.error('Delete error:', error);
    return new Response('Failed to delete chat', { status: 500 });
  }
}
