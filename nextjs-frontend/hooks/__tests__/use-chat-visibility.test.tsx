import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

import { updateChatVisibility } from '@/app/(chat)/actions';
import { useChatVisibility } from '../use-chat-visibility';

jest.mock('@/app/(chat)/actions', () => ({
  updateChatVisibility: jest.fn(() => Promise.resolve()),
}));
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));

const updateMock = updateChatVisibility as jest.MockedFunction<
  typeof updateChatVisibility
>;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
  );
}

describe('useChatVisibility', () => {
  it('remembers Private chosen on the welcome screen before any chat exists', () => {
    const { result } = renderHook(
      () => useChatVisibility({ chatId: 'new', initialVisibility: 'public' }),
      { wrapper },
    );
    expect(result.current.visibilityType).toBe('public');
    act(() => result.current.setVisibilityType('private'));
    expect(result.current.visibilityType).toBe('private');
    act(() => result.current.setVisibilityType('public'));
    expect(result.current.visibilityType).toBe('public');
  });

  it('switches Private inside an existing chat and saves it', () => {
    updateMock.mockClear();
    const { result } = renderHook(
      () =>
        useChatVisibility({ chatId: 'chat-1', initialVisibility: 'private' }),
      { wrapper },
    );
    act(() => result.current.setVisibilityType('public'));
    expect(result.current.visibilityType).toBe('public');
    expect(updateMock).toHaveBeenCalledWith({
      chatId: 'chat-1',
      visibility: 'public',
    });
  });

  it('flips back when the server refuses the change', async () => {
    updateMock.mockImplementationOnce(() =>
      Promise.reject(new Error('Only the owner can change this chat.')),
    );
    const { result } = renderHook(
      () =>
        useChatVisibility({ chatId: 'chat-2', initialVisibility: 'private' }),
      { wrapper },
    );
    act(() => result.current.setVisibilityType('public'));
    await waitFor(() => expect(result.current.visibilityType).toBe('private'));
  });
});
