import { auth } from '@/app/(auth)/auth';
import { deleteChatById, getChatById, saveChat, saveMessages } from '@/lib/db/queries';
import { generateTitleFromUserMessage } from '../../(chat)/actions';

// Minimal UIMessage-like type to keep this route self-contained
interface UIMessageLike {
  id: string;
  role: 'user' | 'assistant' | 'system' | string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
  createdAt?: string | Date;
  sourceType?: string;
  reasoningText?: string;
  annotations?: any[];
}

export const maxDuration = 60;

async function handleDirectSearchRequest(query: string, options: any = {}) {
  try {
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
        { success: false, content: 'Search service unavailable', error: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No results found';
    const annotations = data.choices?.[0]?.message?.annotations || [];

    return Response.json({ success: true, content, annotations });
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

async function createSearchChat(userId: string, message: UIMessageLike, chatId: string) {
  const partsText = Array.isArray(message.parts)
    ? message.parts.filter((p) => p.type === 'text' && p.text).map((p) => p.text).join(' ')
    : '';
  const baseText = (partsText || message.content || 'Search query').trim();
  let title = `Search: ${baseText.substring(0, 50)}${baseText.length > 50 ? '...' : ''}`;

  try {
    const generatedTitle = await generateTitleFromUserMessage({ message: message as any });
    if (generatedTitle && generatedTitle.length > 3) title = generatedTitle;
  } catch {}

  await saveChat({ id: chatId, userId, title });
  return await getChatById({ id: chatId });
}

function processAnnotations(annotations: any): any[] {
  if (!annotations || !Array.isArray(annotations)) return [];
  return annotations
    .map((annotation) => {
      if (annotation && typeof annotation === 'object' && annotation.type === 'url_citation') {
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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.query && typeof body.query === 'string') {
      return handleDirectSearchRequest(body.query, body.options || {});
    }

  const { id, messages, saveOnly = false } = body;

    if (!saveOnly || !Array.isArray(messages) || messages.length === 0) {
      return new Response('Bad Request', { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      // Normalize/validate incoming chat id; if not a UUID, mint a new one
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const usedId = uuidRegex.test(id) ? id : crypto.randomUUID();

      const chat = await getChatById({ id: usedId });

      if (!chat) {
        const userMessage = (messages as UIMessageLike[]).find((m) => m.role === 'user');
        if (userMessage) {
          await createSearchChat(session.user.id, userMessage, usedId);
        } else {
          await saveChat({ id: usedId, userId: session.user.id, title: `Search ${new Date().toLocaleTimeString()}` });
        }
      } else if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }

      const messagesToSave = ensureProperDateObjects(messages).map((msg: UIMessageLike) => ({
        id: msg.id,
        chatId: usedId as string,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.createdAt as any),
        // Preserve extra metadata if the DB layer supports it; otherwise it's ignored
        sourceType: msg.sourceType || undefined,
        reasoningText: msg.reasoningText || undefined,
        annotations: msg.annotations ? processAnnotations(msg.annotations) : undefined,
      }));

      await saveMessages({ messages: messagesToSave });
      return Response.json({ success: true, id: usedId }, { status: 200 });
    } catch (error) {
      console.error('Failed to save search messages:', error);
      return Response.json({ success: false, error: String(error) }, { status: 500 });
    }
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
