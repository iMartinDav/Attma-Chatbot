'use server';

import type { UIMessage } from 'ai';
import { generateText } from 'ai';
import { cookies } from 'next/headers';

import type { VisibilityType } from '@/components/chat/visibility-selector';
import { chatModels } from '@/lib/ai/models';
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

  const { text: title } = await generateText({
    model: myProvider.languageModel(chatModels[0].id), // Use the first/primary chat model for title generation
    instructions: `
    - you will generate a short, descriptive title based on the user's first message
    - if it is a search or research query, focus on the core topic (e.g., "CRISPR gene editing" instead of "Search for CRISPR")
    - ensure it is not more than 60 characters long
    - avoid generic titles like "New Chat", "Search", or dates
    - ensure it is in the same language as the first message
    - do not use quotes, colons, or generic prefixes`,
    prompt: messageText,
  });

  return title;
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
