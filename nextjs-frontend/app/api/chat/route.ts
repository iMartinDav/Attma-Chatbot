import { auth } from '@/app/(auth)/auth';
import type { VisibilityType } from '@/components/chat/visibility-selector';
import { systemPrompt } from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';
import { getWeather } from '@/lib/ai/tools/get-weather';
import {
    deleteChatById,
    getChatById,
    getMessagesByChatId,
    saveChat,
    saveMessages
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { streamText } from 'ai';
import { generateTitleFromUserMessage } from '../../(chat)/actions';
import { postRequestBodySchema, type PostRequestBody } from './schema';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parseResult = postRequestBodySchema.safeParse(json);

    if (!parseResult.success) {
      return new ChatSDKError('bad_request:api').toResponse();
    }

    const { id, message, selectedChatModel, selectedVisibilityType }: PostRequestBody = parseResult.data;


    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    let chatId = id;
    let isNewChat = id === 'new';

    // For new chats, generate a unique ID
    if (isNewChat) {
      chatId = crypto.randomUUID();
    }

    // Create messages for AI - convert to simple format first, then use convertToModelMessages
    let simpleMessages: Array<{id: string, role: 'user' | 'assistant' | 'system', parts: Array<{type: 'text', text: string}>}> = [];
    
    if (!isNewChat) {
      // Get existing messages for context
      try {
        const existingMessages = await getMessagesByChatId({ id: chatId });

        
        simpleMessages = existingMessages.map((msg: any) => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'system',
          parts: Array.isArray(msg.content) 
            ? msg.content.length > 0 && msg.content[0].type 
              ? msg.content  // Already in parts format
              : [{ type: 'text', text: msg.content.map((c: any) => c.text || c || '').join('') }]
            : [{ type: 'text', text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
        }));
      } catch (error) {

      }
    }

    // Add the new user message in proper format
    const userMessageParts = message.parts && Array.isArray(message.parts) 
      ? message.parts.filter((p: any) => p.type === 'text').map((p: any) => ({type: 'text' as const, text: p.text as string}))  // Only text parts for simplicity
      : [{ type: 'text' as const, text: message.content || '' }];

    simpleMessages.push({
      id: message.id,
      role: message.role as 'user' | 'assistant' | 'system',
      parts: userMessageParts.length > 0 ? userMessageParts : [{ type: 'text' as const, text: message.content || '' }]
    });



    const streamingResult = await streamText({
      model: myProvider.languageModel('chat-model'),
      messages: simpleMessages.map(msg => ({
        role: msg.role,
        content: msg.parts.map(p => p.text).join('')
      })),
      system: systemPrompt({ selectedChatModel }),
      tools: {
        getWeather,
      },
      onFinish: async (result) => {
        if (session?.user?.id) {
          try {
            // For new chats, create the chat first
            if (isNewChat) {
              const title = await generateTitleFromUserMessage({ message });

              
              await saveChat({
                id: chatId,
                title: title,
                userId: session.user.id,
                visibility: selectedVisibilityType as VisibilityType,
              });
            }

            // Save only the new messages (user + assistant)
            const messagesToSave = [
              {
                id: message.id,
                chatId: chatId,
                role: message.role,
                content: message.parts,
                createdAt: new Date(),
              },
              {
                id: crypto.randomUUID(),
                chatId: chatId,
                role: 'assistant' as const,
                content: [{ type: 'text', text: result.text }],
                createdAt: new Date(),
              }
            ];


            await saveMessages({ messages: messagesToSave });
          } catch (error) {
            console.error('❌ Error saving:', error);
          }
        }
      },
    });

    return (streamingResult as any).toUIMessageStreamResponse({
      headers: {
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error) {
    console.error('💥 API Chat: Error occurred:', error);
    
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
