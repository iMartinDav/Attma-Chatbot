'use client';

import { ChevronUp, LogOut } from 'lucide-react';
import type { User } from 'next-auth';
import { signOut } from 'next-auth/react';
import { memo } from 'react';

import { ThemeSwitcher } from '@/components/theme-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { UserAvatar } from '../user-avatar';

interface SidebarUserNavProps {
  user: User;
}

function SidebarUserNavComponent({ user }: SidebarUserNavProps) {
  // Format display name nicely
  const formatDisplayName = (name: string) => {
    return name
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  };

  // Get display name from user data
  const rawName = user.name || (user.email ? user.email.split('@')[0] : 'User');
  const displayName = formatDisplayName(rawName);

  // Truncate email function for display
  const formatEmail = (email: string | null | undefined): string => {
    if (!email) return '';
    if (email.length > 20) {
      return email.substring(0, 20) + '...';
    }
    return email;
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="flex h-[52px] w-full items-center gap-3 rounded-md bg-background/50 px-3 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent/80 data-[state=open]:text-sidebar-accent-foreground transition-colors group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:mx-auto"
              aria-label="User menu"
            >
              <UserAvatar
                email={user.email ?? ''}
                name={user.name}
                image={user.image}
                size={32}
                className="shrink-0"
                showBorder={true}
              />
              <div className="truncate flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <div className="font-medium truncate">{displayName}</div>
                <div className="text-xs text-muted-foreground/80 truncate">
                  {user.email && <span>{formatEmail(user.email)}</span>}
                </div>
              </div>
              <ChevronUp className="ml-auto size-4 shrink-0 transition-transform duration-200 ease-in-out group-data-[state=open]:rotate-180 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-(--radix-popper-anchor-width) min-w-[200px] animate-in slide-in-from-top-2 fade-in-0 z-50 p-1"
          >
            <DropdownMenuItem className="px-1.5 py-1 focus:bg-transparent w-full hover:bg-transparent">
              <ThemeSwitcher />
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              className="text-muted-foreground hover:text-destructive focus:text-destructive cursor-pointer px-3 py-2 h-8 text-sm flex items-center gap-2 rounded-sm transition-colors"
              onClick={() => signOut({ redirectTo: '/' })}
            >
              <LogOut className="size-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export const SidebarUserNav = memo(SidebarUserNavComponent);
SidebarUserNav.displayName = 'SidebarUserNav';
