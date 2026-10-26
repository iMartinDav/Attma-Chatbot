'use client';

import {
  createSearchMessages,
  executeWebSearch,
} from '@/lib/ai/tools/search-function';
import { generateUUID, getChatUrl } from '@/lib/utils';
import cx from 'classnames';
import { motion } from 'framer-motion';
import { memo, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GlobeIcon, LoaderIcon } from '../icons';
import { Button } from '../ui/button';
import { TextShimmer } from '../ui/text-shimmer';

import { ChatMessage } from '@/lib/types';

// Enhanced Message type with search-specific properties
export type SearchMessage = ChatMessage & {
  sourceType?: string;
  reasoningText?: string;
  isTyping?: boolean;
  annotations?: Array<any>;
  createdAt?: Date;
  experimental_attachments?: Array<any>; // TODO: Update for AI SDK v5
};

interface MessageSearchProps {
  isSearchMode: boolean;
  isSearching: boolean;
  setIsSearchMode: (value: boolean) => void;
  input: string;
  setInput: (value: string) => void;
  resetHeight: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Array<SearchMessage>>>;
  disabled?: boolean;
  chatId?: string;
}

/**
 * Visual component for the searching state
 */
export const SearchingMessage = () => {
  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      data-role="assistant"
    >
      <div
        className={cx('flex gap-4 w-full', {
          'group-data-[role=user]/message:bg-muted': true,
        })}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <GlobeIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            <TextShimmer className="flex items-center" duration={7}>
              Searching the web...
            </TextShimmer>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Process annotations from search results to ensure they're properly formatted
 */
function processAnnotations(annotations: any[] = []): any[] {
  if (!annotations || !Array.isArray(annotations)) {
    console.log('No valid annotations array:', annotations);
    return [];
  }

  // This should return an array of correctly formatted citations
  return annotations
    .filter((a) => a && typeof a === 'object' && a.type === 'url_citation')
    .map((annotation) => {
      if (!annotation.url_citation) {
        return null;
      }

      return {
        type: 'url_citation',
        url_citation: {
          url: annotation.url_citation.url || '',
          title:
            annotation.url_citation.title ||
            getHostnameFromUrl(annotation.url_citation.url),
          start_index: annotation.url_citation.start_index,
          end_index: annotation.url_citation.end_index,
        },
      };
    })
    .filter(Boolean);
}

// Helper to extract hostname from URL
function getHostnameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname;
  } catch (e) {
    return 'Source';
  }
}

/**
 * Core search functionality component
 * Returns search handler and button component for use in parent components
 */
export function MessageSearch({
  isSearchMode,
  isSearching,
  setIsSearchMode,
  input,
  setInput,
  resetHeight,
  setMessages,
  disabled = false,
  chatId,
}: MessageSearchProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | undefined>(chatId);

  // Update activeChatId if the prop changes
  useEffect(() => {
    setActiveChatId(chatId);
  }, [chatId]);

  /**
   * Saves search messages to the database with proper date handling
   */
  const saveSearchMessage = async (
    message: SearchMessage,
  ): Promise<string | undefined> => {
    const currentId = activeChatId || chatId;
    if (!currentId) return undefined;

    try {
      // Format the message - keep parts if available for rich database content
      // Include reasoning and annotations as specialized parts for persistence
      const messageParts = Array.isArray(message.parts)
        ? [...message.parts]
        : [];

      // Add reasoning as a part if it exists
      if (
        message.reasoningText &&
        !messageParts.some((p) => p.type === 'reasoning')
      ) {
        messageParts.push({
          type: 'reasoning',
          reasoningText: message.reasoningText,
        });
      }

      // Add annotations as source parts if they exist
      if (Array.isArray(message.annotations)) {
        for (const annotation of message.annotations) {
          if (annotation.type === 'url_citation' && annotation.url_citation) {
            messageParts.push({
              type: 'source',
              source: {
                url: annotation.url_citation.url,
                title: annotation.url_citation.title,
              },
            });
          }
        }
      }

      const formattedMessage = {
        id: message.id,
        role: message.role,
        content: messageParts.length > 0 ? messageParts : message.content || '',
        createdAt:
          message.createdAt instanceof Date
            ? message.createdAt.toISOString()
            : new Date().toISOString(),
      };

      // Use search API (not chat API) for saving search messages
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentId,
          messages: [formattedMessage],
          saveOnly: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to save search message:', errorText);
        return undefined;
      }

      // If server minted a new id (when client had "new" or invalid), adopt it
      try {
        const data = await response.json();
        if (data?.id && typeof window !== 'undefined') {
          // Update URL in place so subsequent saves use the valid id
          // Preserve project param if present
          const currentParams = new URLSearchParams(window.location.search);
          const projectId = currentParams.get('project');
          window.history.replaceState({}, '', getChatUrl(data.id, projectId));
          setActiveChatId(data.id);
          return data.id;
        }
      } catch {}
      return currentId;
    } catch (error) {
      console.error('Error saving search message:', error);
      return undefined;
    }
  };

  /**
   * Main search handler with comprehensive error handling
   */
  const handleSearch = async (searchQuery?: string) => {
    const query = searchQuery || input;

    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setIsLoading(true);

    try {
      // Create messages with explicit Date objects
      const { userMessage, pendingMessage } = createSearchMessages(query);

      // Save user message to database first - this creates the chat with proper title
      // Capture the ID (might be minted by server) for the assistant response save
      const usedId = await saveSearchMessage(userMessage);

      // Update UI with user message and pending indicator
      setMessages((prevMessages) => [
        ...prevMessages,
        userMessage,
        pendingMessage,
      ]);

      // Execute the search query
      const searchResult = await executeWebSearch(query, {
        contextSize: 'medium',
      });

      // Remove the pending message
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== pendingMessage.id),
      );

      if (searchResult.success) {
        try {
          // Create response message with properly processed annotations
          const responseMessage: SearchMessage = {
            id: generateUUID(),
            role: 'assistant',
            parts: [{ type: 'text', text: searchResult.content }],
            createdAt: new Date(),
            sourceType: 'web-search',
            reasoningText: 'Information retrieved from web search',
            annotations: processAnnotations(searchResult.annotations),
          };

          // Debug the final message we're creating
          console.log('Created search response message:', {
            id: responseMessage.id,
            hasAnnotations: !!responseMessage.annotations,
            annotationCount: responseMessage.annotations?.length || 0,
          });

          // Save response to database before showing in UI
          if (chatId) {
            const saved = await saveSearchMessage(responseMessage);
            if (!saved) {
              // Retry once if the save fails
              setTimeout(async () => {
                await saveSearchMessage(responseMessage);
              }, 500);
            }
          }

          // Update UI with the response
          setMessages((prevMessages) => [...prevMessages, responseMessage]);
        } catch (error) {
          console.error('Error processing search result:', error);
        }
      } else {
        // Handle error case
        const errorMessage: SearchMessage = {
          id: generateUUID(),
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Sorry, I encountered an error while searching. Please try again.',
            },
          ],
          content:
            'Sorry, I encountered an error while searching. Please try again.',
          createdAt: new Date(),
          sourceType: 'error',
        };

        if (chatId) {
          await saveSearchMessage(errorMessage);
        }

        setMessages((prevMessages) => [...prevMessages, errorMessage]);
        toast.error('Search failed. Please try again.');
      }
    } catch (error) {
      console.error('Search execution error:', error);

      // Clean up any pending messages
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.sourceType !== 'searching'),
      );

      // Show error message
      const errorMessage: SearchMessage = {
        id: generateUUID(),
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Sorry, I encountered an error while searching. Please try again.',
          },
        ],
        content:
          'Sorry, I encountered an error while searching. Please try again.',
        createdAt: new Date(),
        sourceType: 'error',
      };

      if (chatId) {
        await saveSearchMessage(errorMessage);
      }

      setMessages((prevMessages) => [...prevMessages, errorMessage]);
      toast.error('Failed to perform search');
    } finally {
      // Reset UI state
      setIsLoading(false);
      setIsSearchMode(false);
    }
  };

  /**
   * Search button component with loading indicator
   */
  const SearchButton = memo(function SearchButton() {
    return (
      <Button
        className={cx(
          'rounded-full size-8 p-0 flex items-center justify-center border transition-all duration-300',
          isSearchMode
            ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/20'
            : 'dark:border-zinc-800 bg-transparent hover:bg-muted',
        )}
        onClick={(event) => {
          event.preventDefault();
          setIsSearchMode(!isSearchMode);
        }}
        disabled={disabled || isSearching || isLoading}
        variant={isSearchMode ? 'default' : 'ghost'}
        title={isSearchMode ? 'Exit search mode' : 'Search the web'}
        aria-label={isSearchMode ? 'Exit search mode' : 'Search the web'}
      >
        {isSearching || isLoading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'linear',
            }}
          >
            <LoaderIcon size={18} />
          </motion.div>
        ) : (
          <GlobeIcon size={18} />
        )}
      </Button>
    );
  });

  // Return handler and button for parent component to use
  return { handleSearch, SearchButton };
}
