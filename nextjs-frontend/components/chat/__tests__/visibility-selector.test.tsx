import { fireEvent, render, screen } from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/tooltip';

const setVisibilityType = jest.fn();
let currentVisibility: 'private' | 'public' = 'private';

jest.mock('@/hooks/use-chat-visibility', () => ({
  useChatVisibility: () => ({
    visibilityType: currentVisibility,
    setVisibilityType,
  }),
}));

import { VisibilitySelector } from '../visibility-selector';

describe('VisibilitySelector', () => {
  it('always reads Private with the ghost, purple while private is on', () => {
    currentVisibility = 'private';
    render(
      <TooltipProvider>
        <VisibilitySelector chatId="chat-1" selectedVisibilityType="private" />
      </TooltipProvider>,
    );
    const button = screen.getByRole('button', { name: /Private chat is on/ });
    expect(button).toHaveTextContent('Private');
    expect(button).not.toHaveTextContent('Public');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.className).toContain('text-purple-600');
  });

  it('toggles on the welcome screen before a chat starts', () => {
    setVisibilityType.mockClear();
    currentVisibility = 'public';
    render(
      <TooltipProvider>
        <VisibilitySelector chatId="new" selectedVisibilityType="public" />
      </TooltipProvider>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Private chat is off/ }),
    );
    expect(setVisibilityType).toHaveBeenCalledWith('private');
  });

  it('switches Private off when clicked while on', () => {
    setVisibilityType.mockClear();
    currentVisibility = 'private';
    render(
      <TooltipProvider>
        <VisibilitySelector chatId="new" selectedVisibilityType="private" />
      </TooltipProvider>,
    );
    const button = screen.getByRole('button', { name: /Private chat is on/ });
    expect(button).not.toHaveAttribute('aria-disabled');
    fireEvent.click(button);
    expect(setVisibilityType).toHaveBeenCalledWith('public');
  });

  it('stays Private and goes quiet while private is off, never a Public button', () => {
    currentVisibility = 'public';
    render(
      <TooltipProvider>
        <VisibilitySelector chatId="chat-1" selectedVisibilityType="public" />
      </TooltipProvider>,
    );
    const button = screen.getByRole('button', { name: /Private chat is off/ });
    expect(button).toHaveTextContent('Private');
    expect(button).not.toHaveTextContent('Public');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button.className).not.toContain('text-purple-600');
  });
});
