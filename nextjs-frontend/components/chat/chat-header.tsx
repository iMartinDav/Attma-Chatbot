'use client';

import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';
import { useSession } from 'next-auth/react';
import { memo } from 'react';

import { ModelSelector } from '@/components/chat/model-selector';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '../icons';
import { SidebarToggle } from './sidebar-toggle';
import { useSidebar } from '../ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '../ui/tooltip';
import { UserAvatar } from '../user-avatar';
import { type VisibilityType, VisibilitySelector } from './visibility-selector';

interface UserInfo {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
}

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
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();
  const { data: session, status } = useSession();

  const userInfo: UserInfo = {
    name: session?.user?.name ?? null,
    email: session?.user?.email ?? null,
    image: session?.user?.image ?? null,
  };

  const formatDisplayName = (user: UserInfo): string => {
    const rawName =
      user.name || (user.email ? user.email.split('@')[0] : 'User');
    return rawName
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="relative">
      {/* Main gradient overlay */}
      <div className="absolute inset-x-0 top-0 h-40 pointer-events-none">
        <div className="h-full bg-linear-to-b from-background via-background/95 to-transparent" />
      </div>

      {/* Header - increased top padding/margin */}
      <header className="relative flex h-14 items-center px-3 md:px-4 gap-3 z-50 mt-2">
        <div className="absolute inset-0 backdrop-blur-[1px] bg-background/[0.01] supports-backdrop-filter:bg-background/[0.01]" />

        <div className="relative flex w-full items-center gap-3">
          {/* Show toggle in header only when sidebar is closed */}
          {(!open || windowWidth < 768) && (
            <SidebarToggle showInSidebar={false} />
          )}

          {(!open || windowWidth < 768) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="order-2 md:order-1 h-7 px-2 ml-auto md:ml-0 
                    transition-colors duration-200
                    text-foreground/70 hover:text-foreground
                    hover:bg-background/[0.015]
                    bg-transparent z-10
                    active:scale-95"
                  onClick={() => {
                    router.push('/chat');
                    router.refresh();
                  }}
                >
                  <div className="text-foreground/70 hover:text-foreground transition-colors">
                    <PlusIcon />
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Chat</TooltipContent>
            </Tooltip>
          )}

          {!isReadonly && (
            <ModelSelector
              selectedModelId={selectedModelId}
              className="order-1 md:order-2 h-7 z-10 text-foreground/80 hover:text-foreground transition-colors"
            />
          )}

          {!isReadonly && (
            <VisibilitySelector
              chatId={chatId}
              selectedVisibilityType={selectedVisibilityType}
              className="order-1 md:order-3 h-7 z-10 text-foreground/80 hover:text-foreground transition-colors"
            />
          )}

          <div className="order-4 md:ml-auto flex items-center gap-2 z-10">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-pointer relative">
                    <UserAvatar
                      email={userInfo.email || ''}
                      name={userInfo.name}
                      image={userInfo.image}
                      size={36} /* Increased size from 32 to 36 */
                      className="hover:opacity-90 transition-opacity"
                    />
                    {status === 'loading' && (
                      <div className="absolute inset-0 bg-background/50 rounded-full animate-pulse" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="end"
                  className="flex flex-col gap-3 p-4 w-[280px] bg-popover border border-border shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      email={userInfo.email || ''}
                      name={userInfo.name}
                      image={userInfo.image}
                      size={48}
                    />
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <p className="font-medium text-sm truncate">
                        {formatDisplayName(userInfo)}
                      </p>
                      {userInfo.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {userInfo.email}
                        </p>
                      )}
                    </div>
                  </div>
                  {status === 'loading' && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <div className="size-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      Loading session...
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      {/* Bottom gradient */}
      <div className="absolute inset-x-0 top-14 pointer-events-none">
        <div className="h-12 bg-linear-to-b from-background/[0.015] to-transparent" />
      </div>
    </div>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.selectedModelId === nextProps.selectedModelId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});

ChatHeader.displayName = 'ChatHeader';
