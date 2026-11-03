'use server';

import { generateText, Output, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { auth } from '@/app/(auth)/auth';
import type { VisibilityType } from '@/components/chat/visibility-selector';
import { myProvider } from '@/lib/ai/providers';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: {
    parts?: Array<{ type: string; text?: string; filename?: string }>;
  };
}) {
  const parts = message.parts ?? [];
  const messageText = parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { text: string }).text)
    .join(' ');

  const attachments = parts
    .filter((part) => part.type === 'file')
    .map((part) => (part as { filename?: string }).filename)
    .filter(Boolean);

  // Structured output makes the model return a title instead of answering
  // the message (it used to reply "I don't see an exome report").
  const { output } = await generateText({
    model: myProvider.languageModel('title-model'),
    instructions: `You name chat conversations. Write a title for the conversation that starts with the user's message below. Never answer or comment on the message.
    - short and descriptive, at most 60 characters
    - if it is a search or research query, focus on the core topic (e.g., "CRISPR gene editing" instead of "Search for CRISPR")
    - for a patient case, name the presentation (e.g., "Infant with febrile seizures and delay")
    - avoid generic titles like "New Chat", "Search", or dates
    - same language as the message; no quotes, colons, or generic prefixes`,
    prompt: attachments.length
      ? `${messageText}\n\nAttached files: ${attachments.join(', ')}`
      : messageText,
    output: Output.object({ schema: z.object({ title: z.string() }) }),
  });

  return output.title.trim().slice(0, 60);
}

// Server actions are public endpoints, so each one that changes a chat checks that the caller owns it.
async function assertChatOwner(chatId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Sign in to change this chat.');
  const chat = await getChatById({ id: chatId });
  if (!chat || chat.userId !== session.user.id) {
    throw new Error('Only the owner can change this chat.');
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });
  if (!message) return;
  await assertChatOwner(message.chatId);

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  if (chatId === 'new') return;
  if (visibility !== 'private' && visibility !== 'public') {
    throw new Error('Unknown visibility.');
  }
  await assertChatOwner(chatId);

  await updateChatVisiblityById({ chatId, visibility });
}
