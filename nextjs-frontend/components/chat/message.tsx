'use client';

import type { Vote } from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import cx from 'classnames';
import equal from 'fast-deep-equal';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { GlobeIcon, PencilEditIcon, SparklesIcon } from '../icons';
import { Button } from '../ui/button';
import { TextShimmer } from '../ui/text-shimmer';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { DocumentToolCall, DocumentToolResult } from './document';
import { DocumentPreview } from './document-preview';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { MessageEditor } from './message-editor';
import { MessageReasoning } from './message-reasoning';
import { SearchingMessage, type SearchMessage } from './message-search';
import { PreviewAttachment } from './preview-attachment';
import { SourceLinks } from './source-links';
import { Weather } from './weather';

// AI SDK v5 utilities
import {
  getMessageFiles,
  getMessageReasoning,
  getMessageText
} from '@/lib/ai/message-utils';

// Extended message type that includes sourceType and custom properties
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
  regenerate,
  isReadonly,
  requiresScrollPadding = false,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[]),
  ) => void;
  regenerate: () => Promise<string | null | undefined>;
  isReadonly: boolean;
  requiresScrollPadding?: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [copying, setCopying] = useState(false);
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  // Create a wrapper function that matches the expected regenerate signature
  const wrappedRegenerate = async (options?: { messageId?: string }) => {
    await regenerate();
  };

  // Extract source links from annotations with proper type checking
  const sourceLinks = useMemo(() => {
    if (!message.annotations || message.sourceType !== 'web-search') return [];

    try {
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
              const url = annotation?.url_citation?.url;
              const title = annotation?.url_citation?.title;

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
    const textContent = getMessageText(message);
    
    if (
      message.isTyping &&
      textContent &&
      message.sourceType === 'web-search'
    ) {
      let i = 0;
      const typingSpeed = 15;

      setDisplayedContent('');
      setIsTypingComplete(false);

      const typingInterval = setInterval(() => {
        if (i < textContent.length) {
          setDisplayedContent((prev) => prev + textContent.charAt(i));
          i++;
        } else {
          clearInterval(typingInterval);
          setIsTypingComplete(true);

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === message.id ? { ...msg, isTyping: false } : msg,
            ),
          );
        }
      }, typingSpeed);

      return () => clearInterval(typingInterval);
    } else {
      setDisplayedContent(textContent);
      setIsTypingComplete(true);
    }
  }, [message, setMessages]);

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
        data-testid={`message-${message.role}`}
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
              {
                'min-h-96': message.role === 'assistant' && requiresScrollPadding,
              }
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
              {/* Handle v5 UIMessage file parts and v4 experimental_attachments */}
              {(() => {
                const fileParts = getMessageFiles(message);
                const v4Attachments = message.experimental_attachments || [];
                
                return (fileParts.length > 0 || v4Attachments.length > 0) ? (
                  <div className="flex flex-row justify-end gap-2">
                    {fileParts.map((filePart: any, index: number) => (
                      <PreviewAttachment
                        key={filePart.url || `file-part-${index}`}
                        attachment={{
                          name: filePart.filename ?? filePart.name ?? 'file',
                          contentType: filePart.mediaType,
                          url: filePart.url,
                        }}
                      />
                    ))}
                    {v4Attachments.map((attachment, index) => (
                      <PreviewAttachment
                        key={attachment.url || `attachment-${index}`}
                        attachment={attachment}
                      />
                    ))}
                  </div>
                ) : null;
              })()}

              {getMessageReasoning(message) && (
                <MessageReasoning
                  isLoading={isLoading}
                  reasoningText={getMessageReasoning(message)}
                />
              )}

              {/* Handle v5 UIMessage parts structure */}
              {(message as any).parts?.map((part: any, index: number) => {
                const { type } = part;
                const key = `message-${message.id}-part-${index}`;

                if (type === 'reasoning') {
                  return (
                    <MessageReasoning
                      key={key}
                      isLoading={isLoading}
                      reasoningText={part.text}
                    />
                  );
                }

                if (type === 'text') {
                  if (mode === 'view') {
                    return (
                      <div key={key} className="flex flex-row gap-2 items-start">
                        {message.role === 'user' && !isReadonly && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                                  onClick={() =>
                                    copyToClipboard(part.text)
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
                                  data-testid="message-edit-button"
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
                          data-testid="message-content"
                          className={cn('flex flex-col gap-4', {
                            'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                              message.role === 'user',
                          })}
                        >
                          {/* Use displayedContent for typing animation, otherwise use part.text */}
                          <Markdown>{
                            message.isTyping && message.sourceType === 'web-search' 
                              ? displayedContent 
                              : part.text
                          }</Markdown>
                          {message.isTyping && !isTypingComplete && (
                            <span className="inline-block h-4 w-2 bg-current animate-pulse ml-1" />
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (mode === 'edit') {
                    return (
                      <div key={key} className="flex flex-row gap-2 items-start">
                        <div className="size-8" />

                        <MessageEditor
                          key={message.id}
                          message={message}
                          setMode={setMode}
                          setMessages={setMessages}
                          regenerate={async () => { await regenerate(); }}
                        />
                      </div>
                    );
                  }
                }

                // Handle tool calls in v5 format
                if (type?.startsWith('tool-')) {
                  const toolName = type.replace('tool-', '');
                  const { toolCallId, state } = part;

                  if (toolName === 'getWeather') {
                    if (state === 'input-available') {
                      return (
                        <div key={toolCallId} className="skeleton">
                          <Weather />
                        </div>
                      );
                    }

                    if (state === 'output-available') {
                      const { output } = part;
                      return (
                        <div key={toolCallId}>
                          <Weather weatherAtLocation={output} />
                        </div>
                      );
                    }
                  }

                  if (toolName === 'createDocument') {
                    if (state === 'input-available') {
                      const { input } = part;
                      return (
                        <div key={toolCallId}>
                          <DocumentPreview isReadonly={isReadonly} args={input} />
                        </div>
                      );
                    }

                    if (state === 'output-available') {
                      const { output } = part;

                      if ('error' in output) {
                        return (
                          <div
                            key={toolCallId}
                            className="text-red-500 p-2 border rounded"
                          >
                            Error: {String(output.error)}
                          </div>
                        );
                      }

                      return (
                        <div key={toolCallId}>
                          <DocumentPreview
                            isReadonly={isReadonly}
                            result={output}
                          />
                        </div>
                      );
                    }
                  }

                  if (toolName === 'updateDocument') {
                    if (state === 'input-available') {
                      const { input } = part;

                      return (
                        <div key={toolCallId}>
                          <DocumentToolCall
                            type="update"
                            args={input}
                            isReadonly={isReadonly}
                          />
                        </div>
                      );
                    }

                    if (state === 'output-available') {
                      const { output } = part;

                      if ('error' in output) {
                        return (
                          <div
                            key={toolCallId}
                            className="text-red-500 p-2 border rounded"
                          >
                            Error: {String(output.error)}
                          </div>
                        );
                      }

                      return (
                        <div key={toolCallId}>
                          <DocumentToolResult
                            type="update"
                            result={output}
                            isReadonly={isReadonly}
                          />
                        </div>
                      );
                    }
                  }

                  if (toolName === 'requestSuggestions') {
                    if (state === 'input-available') {
                      const { input } = part;
                      return (
                        <div key={toolCallId}>
                          <DocumentToolCall
                            type="request-suggestions"
                            args={input}
                            isReadonly={isReadonly}
                          />
                        </div>
                      );
                    }

                    if (state === 'output-available') {
                      const { output } = part;

                      if ('error' in output) {
                        return (
                          <div
                            key={toolCallId}
                            className="text-red-500 p-2 border rounded"
                          >
                            Error: {String(output.error)}
                          </div>
                        );
                      }

                      return (
                        <div key={toolCallId}>
                          <DocumentToolResult
                            type="request-suggestions"
                            result={output}
                            isReadonly={isReadonly}
                          />
                        </div>
                      );
                    }
                  }
                }

                return null;
              })}

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
                  message={message as any}
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
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (prevProps.message.reasoningText !== nextProps.message.reasoningText)
      return false;
    
    // Compare text content using v5-compatible helper
    if (getMessageText(prevProps.message) !== getMessageText(nextProps.message)) 
      return false;
    
    // Check v5 parts if available
    if (!equal((prevProps.message as any).parts, (nextProps.message as any).parts)) return false;
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
      data-testid="message-assistant-loading"
      className="w-full group/message min-h-96"
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
