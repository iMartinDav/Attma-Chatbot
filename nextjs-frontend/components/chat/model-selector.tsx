'use client';

import { startTransition, useMemo, useOptimistic, useState } from 'react';

import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { chatModels } from '@/lib/ai/models';
import { cn } from '@/lib/utils';

import { Brain, Code, Globe, Image as ImageIcon } from 'lucide-react';
import { CheckCircleFillIcon, ChevronDownIcon } from '../icons';

export type ModelSelectorTriggerType = 'header' | 'pill';

export function ModelSelector({
  selectedModelId,
  className,
  triggerType = 'header',
}: {
  selectedModelId: string;
  triggerType?: ModelSelectorTriggerType;
} & Omit<React.ComponentProps<typeof Button>, 'variant'>) {
  const [open, setOpen] = useState(false);
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);

  const selectedChatModel = useMemo(
    () => chatModels.find((chatModel) => chatModel.id === optimisticModelId),
    [optimisticModelId],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        {triggerType === 'header' ? (
          <Button
            variant="ghost"
            className="md:px-2 md:h-[34px] opacity-50 hover:opacity-100 transition-all duration-200 hover:bg-accent/10"
          >
            {selectedChatModel?.name}
            <ChevronDownIcon />
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="h-8 rounded-full px-3 gap-1.5 border border-transparent hover:border-border/50 bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            <span className="text-sm font-medium">{selectedChatModel?.name}</span>
            <ChevronDownIcon className="size-3 opacity-50" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[340px] bg-background/95 backdrop-blur-md border-border/40 p-1"
      >
        {chatModels.map((chatModel) => {
          const { id, capabilities } = chatModel;
          const isActive = id === optimisticModelId;

          return (
            <DropdownMenuItem
              key={id}
              onSelect={() => {
                setOpen(false);

                startTransition(() => {
                  setOptimisticModelId(id);
                  saveChatModelAsCookie(id);
                });
              }}
              className={cn(
                "gap-4 group/item flex flex-row justify-between items-start py-3 cursor-pointer",
                "focus:bg-accent/10 hover:bg-accent/10 transition-all duration-200"
              )}
              data-active={isActive}
            >
              <div className="flex flex-col gap-1.5 items-start flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {chatModel.name}
                  {capabilities.reasoning && (
                    <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-semibold">
                      Think
                    </span>
                  )}
                </div>
                
                <div className="text-xs text-muted-foreground leading-snug">
                  {chatModel.description}
                </div>

                {/* Capabilities badges */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                 {capabilities.webSearch && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded">
                      <Globe size={10} />
                      <span>Search</span>
                    </div>
                  )}
                  {capabilities.imageGeneration && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded">
                      <ImageIcon size={10} />
                      <span>Image</span>
                    </div>
                  )}
                  {capabilities.codeInterpreter && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded">
                      <Code size={10} />
                      <span>Code</span>
                    </div>
                  )}
                  {capabilities.reasoning && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded">
                      <Brain size={10} />
                      <span>Reason</span>
                    </div>
                  )}
                </div>
              </div>

              {isActive && (
                 <div className="text-primary mt-1">
                  <CheckCircleFillIcon />
                </div>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
