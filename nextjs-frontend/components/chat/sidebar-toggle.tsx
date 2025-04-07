'use client';

import type { ComponentProps } from 'react';
import { type SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { Button } from '../ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface SidebarToggleProps extends ComponentProps<typeof SidebarTrigger> {
  showInSidebar?: boolean;
}

export function SidebarToggle({
  className,
  showInSidebar = false,
  ...props
}: SidebarToggleProps) {
  const { toggleSidebar, open } = useSidebar();
  const isMobile = useIsMobile();

  // Define the label text once to use in both places
  const labelText = open ? 'Hide sidebar' : 'History and settings';

  // Add specific styling based on location
  const buttonClasses = cn(
    'md:h-fit bg-transparent border-0 hover:bg-muted hover:border-input transition-colors duration-200',
    showInSidebar ? 'ml-auto' : '', // Adjust margin when in sidebar
    className,
  );

  // Simple button for mobile to avoid tooltip triggering dialog
  if (isMobile) {
    return (
      <Button
        onClick={toggleSidebar}
        variant="ghost"
        className={buttonClasses}
        aria-label={labelText}
        suppressHydrationWarning={true}
        {...props}
      >
        {open ? (
          <PanelLeftClose
            size={20}
            className="stroke-[1.5px] transition-transform duration-200"
            suppressHydrationWarning={true}
          />
        ) : (
          <PanelLeft
            size={20}
            className="stroke-[1.5px] transition-transform duration-200"
            suppressHydrationWarning={true}
          />
        )}
      </Button>
    );
  }

  // Regular tooltip-enabled button for desktop
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={toggleSidebar}
          variant="ghost"
          className={buttonClasses}
          aria-label={labelText}
          suppressHydrationWarning={true}
          {...props}
        >
          {open ? (
            <PanelLeftClose
              size={20}
              className="stroke-[1.5px] transition-transform duration-200"
              suppressHydrationWarning={true}
            />
          ) : (
            <PanelLeft
              size={20}
              className="stroke-[1.5px] transition-transform duration-200"
              suppressHydrationWarning={true}
            />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start">
        {labelText}
      </TooltipContent>
    </Tooltip>
  );
}
