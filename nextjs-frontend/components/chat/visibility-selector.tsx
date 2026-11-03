'use client';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { GhostIcon } from '../icons';

export type VisibilityType = 'private' | 'public';

// Like Grok's Private toggle: a ghost pill that reads Private and turns purple while on. The header shows it on the welcome screen only.
export function VisibilitySelector({
  chatId,
  className,
  selectedVisibilityType,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
} & React.ComponentProps<typeof Button>) {
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId,
    initialVisibility: selectedVisibilityType,
  });
  const isPrivate = visibilityType === 'private';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          onClick={() => setVisibilityType(isPrivate ? 'public' : 'private')}
          aria-pressed={isPrivate}
          aria-label={
            isPrivate
              ? 'Private chat is on. Only you can open this chat. Turn off Private'
              : 'Private chat is off. This chat is public. Turn on Private'
          }
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors duration-200',
            isPrivate
              ? 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/15 hover:text-purple-600 dark:text-purple-300 dark:hover:text-purple-300'
              : 'border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            className,
          )}
        >
          <GhostIcon className="size-4 shrink-0" />
          <span>Private</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isPrivate ? 'Switch to Default Chat' : 'Switch to Private Chat'}
      </TooltipContent>
    </Tooltip>
  );
}
