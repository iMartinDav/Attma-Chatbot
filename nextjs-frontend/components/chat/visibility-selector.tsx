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

  const toggleVisibility = () => {
    setVisibilityType(visibilityType === 'private' ? 'public' : 'private');
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          onClick={toggleVisibility}
          className={cn(
            'hidden md:flex md:px-3 md:h-[32px] transition-all duration-200 gap-2 text-sm font-medium rounded-full',
            visibilityType === 'private'
              ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/20',
            className,
          )}
        >
          <GhostIcon className="size-4" />
          <span>Private</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {visibilityType === 'private'
          ? 'Switch to Default Chat'
          : 'Switch to Private Chat'}
      </TooltipContent>
    </Tooltip>
  );
}
