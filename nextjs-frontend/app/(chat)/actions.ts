'use server';

import { generateText, Output, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import { z } from 'zod';

import type { VisibilityType } from '@/components/chat/visibility-selector';
import { myProvider } from '@/lib/ai/providers';
import {
  deleteMessagesByChatIdAfterTimestamp,
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
  message: UIMessage | any; // Allow both v4 and v5 message formats
}) {
  // Extract text content from either v4 or v5 message format
  let messageText = '';
  if (typeof (message as any).content === 'string') {
    messageText = (message as any).content;
  } else if (Array.isArray((message as any).content)) {
    messageText = (message as any).content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => (part as any).text)
      .join(' ');
  } else if ((message as any).parts) {
    // v5 format with parts
    messageText = (message as any).parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join(' ');
  }

  const attachments = ((message as any).parts ?? [])
    .filter((part: any) => part.type === 'file')
    .map((part: any) => part.filename ?? part.name)
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

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

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

  await updateChatVisiblityById({ chatId, visibility });
}
