'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const themes = [
  {
    id: 'light',
    name: 'Light',
    icon: Sun,
  },
  {
    id: 'dark',
    name: 'Dark',
    icon: Moon,
  },
  {
    id: 'system',
    name: 'System',
    icon: Monitor,
  },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="text-sm font-medium text-muted-foreground/90 px-1.5">
        Switch theme
      </div>
      <TooltipProvider>
        <div className="flex items-center justify-between rounded-xl bg-muted/50 p-2 w-full shadow-sm ring-1 ring-muted/10">
          {themes.map(({ id, name, icon: Icon }) => (
            <Tooltip key={id} delayDuration={300}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-10 w-10 rounded-lg transition-all duration-200',
                    theme === id
                      ? 'bg-background text-foreground scale-110 shadow-lg ring-1 ring-muted/20 hover:scale-110'
                      : 'text-muted-foreground/80 hover:text-foreground hover:bg-muted/70 hover:scale-105 hover:shadow-md',
                  )}
                  onClick={() => setTheme(id)}
                >
                  <Icon className="size-[20px]" />
                  <span className="sr-only">{name}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="capitalize text-xs font-medium py-1.5 px-3.5 shadow-lg rounded-md"
              >
                {name}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
