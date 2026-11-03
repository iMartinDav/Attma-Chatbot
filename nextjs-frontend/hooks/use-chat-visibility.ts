'use client';

import { updateChatVisibility } from '@/app/(chat)/actions';
import { VisibilityType } from '@/components/chat/visibility-selector';
import { Chat } from '@/lib/db/schema';
import { useMemo } from 'react';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';

export function useChatVisibility({
  chatId,
  initialVisibility,
}: {
  chatId: string;
  initialVisibility: VisibilityType;
}) {
  const { mutate, cache } = useSWRConfig();
  const history: Array<Chat> = cache.get('/api/history')?.data;

  const isNewChat = chatId === 'new';

  // A new chat shares this key between the header toggle and the composer, so choosing Private on the welcome screen recolours the input before the first message is sent.
  const { data: localVisibility, mutate: setLocalVisibility } = useSWR(
    `${chatId}-visibility`,
    null,
    {
      fallbackData: initialVisibility,
    },
  );

  const visibilityType = useMemo(() => {
    if (isNewChat) return localVisibility ?? initialVisibility;
    if (!history) return localVisibility ?? initialVisibility;
    const chat = history.find((chat) => chat.id === chatId);
    if (!chat) return localVisibility ?? initialVisibility;
    return chat.visibility;
  }, [history, chatId, localVisibility, isNewChat, initialVisibility]);

  const applyLocally = (next: VisibilityType) => {
    setLocalVisibility(next);
    mutate<Array<Chat>>(
      '/api/history',
      (history) =>
        history
          ? history.map((chat) =>
              chat.id === chatId ? { ...chat, visibility: next } : chat,
            )
          : [],
      { revalidate: false },
    );
  };

  // The pill flips at once; if the server refuses, it flips back so it never shows a state that was not saved.
  const setVisibilityType = (updatedVisibilityType: VisibilityType) => {
    const previous = visibilityType;
    applyLocally(updatedVisibilityType);
    updateChatVisibility({ chatId, visibility: updatedVisibilityType }).catch(
      () => {
        applyLocally(previous);
        toast.error('Could not change Private. Try again.');
      },
    );
  };

  return { visibilityType, setVisibilityType };
}
