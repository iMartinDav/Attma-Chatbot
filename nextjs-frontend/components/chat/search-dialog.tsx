'use client';

import { CrossIcon, MessageSquareIcon, SearchIcon } from '@/components/icons';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface ChatHistoryItem {
  id: string;
  title: string;
  createdAt: string;
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentChats, setRecentChats] = useState<ChatHistoryItem[]>([]);

  const fetchRecentChats = async () => {
    try {
      const response = await fetch('/api/history');
      if (response.ok) {
        const data = await response.json();
        const chats = (Array.isArray(data) ? data : data.chats || [])
          .slice(0, 5)
          .map((chat: any) => ({
            id: chat.id,
            title: chat.title || 'Untitled Chat',
            createdAt: chat.createdAt,
          }));
        setRecentChats(chats);
      }
    } catch (error) {
      console.error('Failed to fetch recent chats:', error);
    }
  };

  // Fetch recent chats on mount
  useEffect(() => {
    if (open) {
      fetchRecentChats();
    }
  }, [open]);

  // Search chats
  const searchChats = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/history/search?q=${encodeURIComponent(searchQuery)}&limit=10`,
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.chats || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchChats(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchChats]);

  const handleSelect = (chatId: string) => {
    router.push(`/chat/${chatId}`);
    onOpenChange(false);
    setQuery('');
  };

  const handleNewChat = () => {
    router.push('/chat');
    onOpenChange(false);
    setQuery('');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const displayItems = query.trim() ? results : recentChats;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-background border border-border/50 rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
            <SearchIcon className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-muted-foreground"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
              >
                <CrossIcon />
              </button>
            )}
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : displayItems.length > 0 ? (
              <div className="py-2">
                <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {query.trim() ? 'Search Results' : 'Recent Conversations'}
                </div>
                {displayItems.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => handleSelect(chat.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <MessageSquareIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {chat.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(chat.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : query.trim() ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <SearchIcon className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No results found
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try a different search term
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquareIcon className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No recent conversations
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-muted/30">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">
                  ↵
                </kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">
                  esc
                </kbd>
                Close
              </span>
            </div>
            <button
              onClick={handleNewChat}
              className="text-xs px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
            >
              New Chat
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
