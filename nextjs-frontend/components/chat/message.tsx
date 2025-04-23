'use client';

import type { ChatRequestOptions } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState, useEffect, useMemo } from 'react';

import type { Vote } from '@/lib/db/schema';

import { DocumentToolCall, DocumentToolResult } from './document';
import { PencilEditIcon, SparklesIcon, GlobeIcon } from '../icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import { CopyIcon, CheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { SearchingMessage, type SearchMessage } from './message-search';
import { SourceLinks } from './source-links';
import { TextShimmer } from '../ui/text-shimmer';

// Use the extended message type that includes sourceType
type Message = SearchMessage;

// Define a more specific type for the url_citation annotation
interface UrlCitation {
  type: string;
  url_citation?: {
    url: string;
    title?: string;
    start_index?: number;
    end_index?: number;
  };
}

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[]),
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [copying, setCopying] = useState(false);
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  // Extract source links from annotations with proper type checking
  const sourceLinks = useMemo(() => {
    if (!message.annotations || message.sourceType !== 'web-search') return [];

    console.log(
      'Extracting source links from annotations:',
      message.annotations,
    );

    try {
      // Use a safer approach with stronger type guards
      return Array.isArray(message.annotations)
        ? message.annotations
            .filter((annotation): annotation is any => {
              return (
                annotation !== null &&
                typeof annotation === 'object' &&
                'type' in annotation &&
                annotation.type === 'url_citation' &&
                'url_citation' in annotation &&
                annotation.url_citation !== null &&
                typeof annotation.url_citation === 'object'
              );
            })
            .map((annotation) => {
              // After our type guard, we can safely access these properties
              const url = annotation?.url_citation?.url;
              const title = annotation?.url_citation?.title;

              // Only return valid entries
              if (url && typeof url === 'string') {
                return {
                  url,
                  title: title || getHostnameFromUrl(url),
                };
              }
              return null;
            })
            .filter(
              (link): link is { url: string; title: string } =>
                link !== null &&
                typeof link.url === 'string' &&
                link.url.startsWith('http'),
            )
        : [];
    } catch (err) {
      console.error('Error processing annotations:', err);
      return [];
    }
  }, [message.annotations, message.sourceType]);

  // Helper function to extract hostname from URL
  function getHostnameFromUrl(url: string): string {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      return hostname;
    } catch (e) {
      return 'Source';
    }
  }

  // Handle typing animation effect for search messages
  useEffect(() => {
    // If this is a typing message, animate the content
    if (
      message.isTyping &&
      message.content &&
      message.sourceType === 'web-search'
    ) {
      // Display the message content character by character
      let i = 0;
      const typingSpeed = 15; // milliseconds per character
      const content = message.content as string;

      setDisplayedContent('');
      setIsTypingComplete(false);

      const typingInterval = setInterval(() => {
        if (i < content.length) {
          setDisplayedContent((prev) => prev + content.charAt(i));
          i++;
        } else {
          clearInterval(typingInterval);
          setIsTypingComplete(true);

          // When typing is complete, remove the typing flag
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === message.id ? { ...msg, isTyping: false } : msg,
            ),
          );
        }
      }, typingSpeed);

      return () => clearInterval(typingInterval);
    } else {
      // For regular messages, display content immediately
      setDisplayedContent(message.content as string);
      setIsTypingComplete(true);
    }
  }, [
    message.content,
    message.isTyping,
    message.id,
    message.sourceType,
    setMessages,
  ]);

  // If this is a temporary searching message, show the SearchingMessage component
  if (message.sourceType === 'searching') {
    return <SearchingMessage />;
  }

  const copyToClipboard = async (text: string) => {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard', {
        duration: 2000,
      });
      setTimeout(() => setCopying(false), 1500);
    } catch (err) {
      toast.error('Failed to copy', {
        duration: 2000,
      });
      setCopying(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="w-full group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:justify-end',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >
          <div
            className={cn(
              'flex gap-4 max-w-2xl',
              message.role === 'assistant' ? 'w-full' : 'w-fit',
            )}
          >
            {message.role === 'assistant' && (
              <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
                <div className="translate-y-px">
                  {/* Show a different icon for search results */}
                  {message.sourceType === 'web-search' ? (
                    <GlobeIcon size={14} />
                  ) : (
                    <SparklesIcon size={14} />
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 w-full">
              {message.experimental_attachments && (
                <div className="flex flex-row justify-end gap-2">
                  {message.experimental_attachments.map((attachment, index) => (
                    <PreviewAttachment
                      key={attachment.url || `attachment-${index}`}
                      attachment={attachment}
                    />
                  ))}
                </div>
              )}

              {message.reasoning && (
                <MessageReasoning
                  isLoading={isLoading}
                  reasoning={message.reasoning}
                />
              )}

              {(displayedContent || message.reasoning) && mode === 'view' && (
                <div className="flex flex-row gap-2 items-start">
                  {message.role === 'user' && !isReadonly && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                            onClick={() =>
                              copyToClipboard(message.content as string)
                            }
                            disabled={copying}
                          >
                            {copying ? (
                              <CheckIcon className="size-4 text-green-500" />
                            ) : (
                              <CopyIcon className="size-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {copying ? 'Copied!' : 'Copy'}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                            onClick={() => {
                              setMode('edit');
                            }}
                          >
                            <PencilEditIcon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit message</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  {message.role === 'assistant' && (
                    <div className="grow overflow-hidden" />
                  )}

                  <div
                    className={cn('flex flex-col gap-4', {
                      'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                        message.role === 'user',
                    })}
                  >
                    <Markdown>{displayedContent}</Markdown>
                    {message.isTyping && !isTypingComplete && (
                      <span className="inline-block h-4 w-2 bg-current animate-pulse ml-1" />
                    )}
                  </div>
                </div>
              )}

              {/* Only display source links if they exist and we're in web-search mode */}
              {message.sourceType === 'web-search' &&
                sourceLinks.length > 0 && (
                  <motion.div
                    className="pl-12 mt-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <SourceLinks sources={sourceLinks} />
                  </motion.div>
                )}

              {message.content && mode === 'edit' && (
                <div className="flex flex-row gap-2 items-start">
                  <div className="size-8" />

                  <MessageEditor
                    key={message.id}
                    message={message}
                    setMode={setMode}
                    setMessages={setMessages}
                    reload={reload}
                  />
                </div>
              )}

              {message.toolInvocations &&
                message.toolInvocations.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {message.toolInvocations.map((toolInvocation) => {
                      const { toolName, toolCallId, state, args } =
                        toolInvocation;

                      if (state === 'result') {
                        const { result } = toolInvocation;

                        return (
                          <div key={toolCallId}>
                            {toolName === 'getWeather' ? (
                              <Weather weatherAtLocation={result} />
                            ) : toolName === 'createDocument' ? (
                              <DocumentPreview
                                isReadonly={isReadonly}
                                result={result}
                              />
                            ) : toolName === 'updateDocument' ? (
                              <DocumentToolResult
                                type="update"
                                result={result}
                                isReadonly={isReadonly}
                              />
                            ) : toolName === 'requestSuggestions' ? (
                              <DocumentToolResult
                                type="request-suggestions"
                                result={result}
                                isReadonly={isReadonly}
                              />
                            ) : (
                              <pre>{JSON.stringify(result, null, 2)}</pre>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div
                          key={toolCallId}
                          className={cx({
                            skeleton: ['getWeather'].includes(toolName),
                          })}
                        >
                          {toolName === 'getWeather' ? (
                            <Weather />
                          ) : toolName === 'createDocument' ? (
                            <DocumentPreview
                              isReadonly={isReadonly}
                              args={args}
                            />
                          ) : toolName === 'updateDocument' ? (
                            <DocumentToolCall
                              type="update"
                              args={args}
                              isReadonly={isReadonly}
                            />
                          ) : toolName === 'requestSuggestions' ? (
                            <DocumentToolCall
                              type="request-suggestions"
                              args={args}
                              isReadonly={isReadonly}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

              {!isReadonly && (
                <MessageActions
                  key={`action-${message.id}`}
                  chatId={chatId}
                  message={message}
                  vote={vote}
                  isLoading={isLoading}
                />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.reasoning !== nextProps.message.reasoning)
      return false;
    if (prevProps.message.content !== nextProps.message.content) return false;
    if (
      !equal(
        prevProps.message.toolInvocations,
        nextProps.message.toolInvocations,
      )
    )
      return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <TextShimmer
            duration={7}
            className="flex flex-col gap-4 text-muted-foreground"
          >
            Thinking...
          </TextShimmer>
        </div>
      </div>
    </motion.div>
  );
};
