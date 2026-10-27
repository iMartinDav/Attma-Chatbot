import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import Chat from '@/components/chat/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const id = 'new';
  const session = await auth();

  // A question asked on the landing page survives the trip through sign-in.
  if (!session) {
    const { query } = await searchParams;
    redirect(
      query
        ? `/login?callbackUrl=${encodeURIComponent(`/chat?query=${encodeURIComponent(query)}`)}`
        : '/login',
    );
  }

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');

  // Use the model from cookie or default
  const selectedChatModel = modelIdFromCookie?.value || DEFAULT_CHAT_MODEL;

  return (
    <Chat
      key={id}
      id={id}
      initialMessages={[]}
      initialChatModel={selectedChatModel}
      initialVisibilityType="public"
      isReadonly={false}
      session={session}
      autoResume={false}
    />
  );
}
