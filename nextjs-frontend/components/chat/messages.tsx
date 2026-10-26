import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { ChatRequestOptions, UIMessage } from 'ai';
import cx from 'classnames';
import { motion } from 'framer-motion';
import { SparklesIcon } from '../icons';
import { PreviewMessage, ThinkingMessage } from './message';
import { SearchMessage } from './message-search';

import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import { memo } from 'react';

interface MessagesProps {
  chatId: string;
  isLoading: boolean;
  votes: Array<Vote> | undefined;
  messages: Array<UIMessage>;
  setMessages: (
    messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
  isArtifactVisible: boolean;
  isReasoningMode: boolean;
}

function PureMessages({
  chatId,
  isLoading,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  isReasoningMode,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
      style={{
        // Tie padding to the actual composer height measured by MultimodalInput
        // Fallback to 120px if the CSS var isn't set yet
        scrollPaddingBottom:
          'calc(var(--composer-height, 120px) + env(safe-area-inset-bottom))',
        paddingBottom:
          'calc(var(--composer-height, 120px) + env(safe-area-inset-bottom))',
      }}
    >
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col justify-center items-center">
          {/* Empty state handles are now in chat.tsx */}
        </div>
      )}

      <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto px-4">
        {messages.map((message, index) => (
          <PreviewMessage
            key={message.id}
            chatId={chatId}
            message={message as unknown as SearchMessage}
            isLoading={isLoading && messages.length - 1 === index}
            vote={
              votes
                ? votes.find((vote) => vote.messageId === message.id)
                : undefined
            }
            setMessages={
              setMessages as unknown as (
                messages:
                  | SearchMessage[]
                  | ((messages: SearchMessage[]) => SearchMessage[]),
              ) => void
            }
            regenerate={reload}
            isReadonly={isReadonly}
          />
        ))}

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === 'user' &&
          (() => {
            return isReasoningMode ? (
              <ReasoningThinkingMessage />
            ) : (
              <ThinkingMessage />
            );
          })()}

        <div
          ref={messagesEndRef}
          className="shrink-0 min-w-[24px] min-h-[1px]"
          style={{ minHeight: '1px' }}
        />
      </div>
    </div>
  );
}

// Create a reasoning-specific thinking message component similar to Grok
const ReasoningThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-reasoning"
      className="w-full group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 0.2 } }}
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
          <div className="flex items-center gap-2 text-primary/70 animate-pulse text-xs">
            <SparklesIcon size={12} />
            <span>Thinking...</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isArtifactVisible !== nextProps.isArtifactVisible) return false;
  if (prevProps.isReadonly !== nextProps.isReadonly) return false;
  if (prevProps.isReasoningMode !== nextProps.isReasoningMode) return false;

  return (
    equal(prevProps.messages, nextProps.messages) &&
    equal(prevProps.votes, nextProps.votes)
  );
});

export { Messages };
