import { auth } from '@/app/(auth)/auth';
import { getChatsByUserId } from '@/lib/db/queries';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session || !session.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '20');

  // Get all chats for the user
  const allChats = await getChatsByUserId({ id: session.user.id! });

  // Filter by search query (case-insensitive title search)
  let filteredChats = allChats;
  if (query.trim()) {
    const lowerQuery = query.toLowerCase();
    filteredChats = allChats.filter((chat: any) => 
      chat.title?.toLowerCase().includes(lowerQuery) ||
      // Also search in the first message content if available
      chat.messages?.[0]?.content?.toLowerCase().includes(lowerQuery)
    );
  }

  // Apply limit
  const chats = filteredChats.slice(0, limit).map((chat: any) => ({
    id: chat.id,
    title: chat.title || 'Untitled Chat',
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  }));

  return Response.json({ chats, total: filteredChats.length });
}
