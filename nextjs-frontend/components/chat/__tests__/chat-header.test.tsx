import { render, screen } from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/tooltip';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock('../../ui/sidebar', () => ({
  useSidebar: () => ({
    toggleSidebar: jest.fn(),
    isMobile: false,
    setOpenMobile: jest.fn(),
  }),
}));
jest.mock('@/hooks/use-chat-visibility', () => ({
  useChatVisibility: () => ({
    visibilityType: 'private',
    setVisibilityType: jest.fn(),
  }),
}));

import { ChatHeader } from '../chat-header';

function renderHeader(chatId: string, isReadonly = false) {
  render(
    <TooltipProvider>
      <ChatHeader
        chatId={chatId}
        selectedModelId="chat-model"
        selectedVisibilityType="private"
        isReadonly={isReadonly}
      />
    </TooltipProvider>,
  );
}

describe('ChatHeader Private pill', () => {
  it('shows on the welcome screen before the first message', () => {
    renderHeader('new');
    expect(
      screen.getByRole('button', { name: /Private chat is on/ }),
    ).toBeInTheDocument();
  });

  it('is gone once the conversation has started', () => {
    renderHeader('6831d28b-4916-4a26-9933-817437b89fff');
    expect(screen.queryByRole('button', { name: /Private/ })).toBeNull();
  });

  it('never shows to someone viewing a chat they do not own', () => {
    renderHeader('new', true);
    expect(screen.queryByRole('button', { name: /Private/ })).toBeNull();
  });
});
