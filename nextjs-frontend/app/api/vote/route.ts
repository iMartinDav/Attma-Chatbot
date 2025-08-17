import { auth } from '@/app/(auth)/auth';
import { getVotesByChatId, voteMessage } from '@/lib/db/queries';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new Response('chatId is required', { status: 400 });
  }

  // Handle the case when chatId is "new" (for new chats that haven't been saved yet)
  if (chatId === 'new') {
    return Response.json([], { status: 200 });
  }

  const session = await auth();

  if (!session || !session.user || !session.user.email) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const votes = await getVotesByChatId({ id: chatId });
    return Response.json(votes, { status: 200 });
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    return Response.json([], { status: 200 });
  }
}

export async function PATCH(request: Request) {
  const {
    chatId,
    messageId,
    type,
  }: { chatId: string; messageId: string; type: 'up' | 'down' } =
    await request.json();

  if (!chatId || !messageId || !type) {
    return new Response('messageId and type are required', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user || !session.user.email) {
    return new Response('Unauthorized', { status: 401 });
  }

  await voteMessage({
    chatId,
    messageId,
    type: type,
  });

  return new Response('Message voted', { status: 200 });
}
