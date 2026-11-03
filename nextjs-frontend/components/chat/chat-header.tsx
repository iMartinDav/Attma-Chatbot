'use client';

import { useRouter } from 'next/navigation';
import { memo } from 'react';

import { MenuIcon, NewChatIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useSidebar } from '../ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { type VisibilityType, VisibilitySelector } from './visibility-selector';

interface ChatHeaderProps {
  chatId: string;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}

function PureChatHeader({
  chatId,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
}: ChatHeaderProps) {
  const router = useRouter();
  const { toggleSidebar, isMobile, setOpenMobile } = useSidebar();

  // On desktop: No toggle buttons in header - the sidebar logo acts as toggle
  // On mobile: Show toggle buttons (sidebar is a drawer)
  const showMobileControls = isMobile;

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center px-2 sm:px-3 gap-1 sm:gap-2 bg-background/95 backdrop-blur-sm border-b border-border/5">
      {/* Mobile only - Toggle & New Chat */}
      {showMobileControls && (
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-9 w-9 shrink-0 hover:bg-muted/60"
              >
                <MenuIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Menu</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  router.push('/chat');
                  router.refresh();
                  setOpenMobile(false);
                }}
                className="h-9 w-9 shrink-0 hover:bg-muted/60"
              >
                <NewChatIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New chat</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* As in Grok, Private is chosen on the welcome screen only; once the first message gets the chat its id, the pill goes and the composer caption carries the state. */}
      {!isReadonly && chatId === 'new' && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
          className="h-8 shrink-0"
        />
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  // chatId matters: the first message swaps 'new' for the real id, and that hides the Private pill.
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedModelId === nextProps.selectedModelId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});

ChatHeader.displayName = 'ChatHeader';
