'use client';

import { User } from 'next-auth';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { SidebarProjects } from '@/components/chat/projects';
import { SearchDialog } from '@/components/chat/search-dialog';
import { SidebarHistory } from '@/components/chat/sidebar-history';
import {
  MicrophoneSubmenu,
  VoiceLanguageSubmenu,
} from '@/components/chat/voice-dictation';
import {
  ChevronUpIcon,
  LogOutIcon,
  NewChatIcon,
  SearchIcon,
  SidebarToggleIcon,
} from '@/components/icons';
import { ThemeSwitcher } from '@/components/theme-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/user-avatar';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile, toggleSidebar, state, isMobile } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);

  const isCollapsed = isMobile ? false : state === 'collapsed';

  const handleCollapsedClick = () => {
    if (isCollapsed) {
      toggleSidebar();
    }
  };

  return (
    <>
      <Sidebar
        collapsible="icon"
        className={`border-r border-sidebar-border ${isCollapsed ? 'cursor-pointer' : ''}`}
        onClick={handleCollapsedClick}
      >
        {/* Header */}
        <SidebarHeader
          className={`h-14 px-2 flex flex-row items-center relative z-20 ${isCollapsed ? 'justify-center' : 'justify-start'}`}
        >
          <Tooltip open={isCollapsed ? undefined : false}>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebar}
                onMouseEnter={() => setLogoHovered(true)}
                onMouseLeave={() => setLogoHovered(false)}
                className={`relative flex items-center w-10 h-10 rounded-lg hover:bg-sidebar-accent transition-all duration-200 ${isCollapsed ? 'justify-center mx-auto' : 'justify-start'}`}
              >
                {/* Logo - fades out on hover */}
                <div
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${logoHovered ? 'opacity-0' : 'opacity-100'}`}
                >
                  <img
                    src="/images/logo.png"
                    alt="Attma"
                    className="w-7 h-7 hidden dark:block"
                  />
                  <img
                    src="/images/attma-logo.webp"
                    alt="Attma"
                    className="w-7 h-7 block dark:hidden"
                  />
                </div>
                {/* Toggle icon - fades in on hover */}
                <div
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${logoHovered ? 'opacity-100' : 'opacity-0'}`}
                >
                  <SidebarToggleIcon />
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? 'Open sidebar' : 'Close sidebar'}
            </TooltipContent>
          </Tooltip>
        </SidebarHeader>

        {/* Content */}
        <SidebarContent className="px-2 relative z-20">
          <SidebarMenu className="gap-1">
            {/* New Chat */}
            <SidebarMenuItem>
              <Tooltip open={isCollapsed ? undefined : false}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (!isCollapsed) {
                        setOpenMobile(false);
                        router.push('/chat');
                        router.refresh();
                      }
                    }}
                    className={`flex items-center gap-3 w-full h-10 rounded-lg hover:bg-sidebar-accent transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                  >
                    <NewChatIcon />
                    {!isCollapsed && <span className="text-sm">New chat</span>}
                  </button>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">New chat</TooltipContent>
                )}
              </Tooltip>
            </SidebarMenuItem>

            {/* Search */}
            <SidebarMenuItem>
              <Tooltip open={isCollapsed ? undefined : false}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (!isCollapsed) {
                        setSearchOpen(true);
                      }
                    }}
                    className={`flex items-center gap-3 w-full h-10 rounded-lg hover:bg-sidebar-accent transition-colors ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                  >
                    <SearchIcon />
                    {!isCollapsed && (
                      <span className="text-sm flex-1 flex items-center justify-between">
                        Search chats
                        <kbd className="hidden md:inline-flex h-5 items-center rounded border border-sidebar-border bg-sidebar-accent px-1.5 font-mono text-[10px] text-muted-foreground">
                          ⌘K
                        </kbd>
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">Search (⌘K)</TooltipContent>
                )}
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* Projects Section */}
          {!isCollapsed && <SidebarProjects isCollapsed={isCollapsed} />}

          {/* Chat History - only when expanded */}
          {!isCollapsed && (
            <SidebarGroup className="mt-4">
              <div className="px-3 text-xs font-medium text-muted-foreground mb-2">
                Your chats
              </div>
              <SidebarHistory user={user} />
            </SidebarGroup>
          )}
        </SidebarContent>

        {/* Footer - User Avatar with Dropdown Menu */}
        <SidebarFooter className="px-2 pb-3 relative z-20">
          {user && (
            <DropdownMenu>
              <Tooltip open={isCollapsed ? undefined : false}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-3 w-full rounded-lg hover:bg-sidebar-accent transition-colors ${
                        isCollapsed
                          ? 'justify-center h-10 w-10 mx-auto p-0'
                          : 'h-14 px-3'
                      }`}
                    >
                      <UserAvatar
                        email={user.email ?? ''}
                        name={user.name}
                        image={user.image}
                        size={isCollapsed ? 32 : 36}
                        className="shrink-0"
                        showBorder={true}
                      />
                      {!isCollapsed && (
                        <>
                          <div className="flex-1 text-left overflow-hidden">
                            <div className="text-sm font-medium truncate">
                              {user.name || user.email?.split('@')[0] || 'User'}
                            </div>
                            {user.email && (
                              <div className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </div>
                            )}
                          </div>
                          <ChevronUpIcon />
                        </>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">
                    {user.name || user.email?.split('@')[0] || 'Account'}
                  </TooltipContent>
                )}
              </Tooltip>

              {/* Dropdown Content - only when expanded */}
              {!isCollapsed && (
                <DropdownMenuContent
                  side="top"
                  align="start"
                  sideOffset={8}
                  className="min-w-[200px] p-1"
                >
                  {/* Theme Switcher */}
                  <DropdownMenuItem className="p-0 focus:bg-transparent hover:bg-transparent">
                    <ThemeSwitcher />
                  </DropdownMenuItem>

                  <VoiceLanguageSubmenu />
                  <MicrophoneSubmenu />

                  <DropdownMenuSeparator className="my-1" />

                  {/* Sign Out */}
                  <DropdownMenuItem
                    onClick={() => signOut({ redirectTo: '/' })}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-destructive focus:text-destructive cursor-pointer"
                  >
                    <LogOutIcon />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              )}
            </DropdownMenu>
          )}
        </SidebarFooter>
      </Sidebar>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
