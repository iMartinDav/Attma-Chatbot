import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { ChatRequestOptions, UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { SearchMessage } from './message-search';
import { lastAnalysisMessageId } from './step-labels';

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
  onReview?: (decision: 'approve' | 'changes', notes?: string) => void;
}

function PureMessages({
  chatId,
  isLoading,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  onReview,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();
  // Only the newest analysis in the chat may offer review actions.
  const reviewMessageId = lastAnalysisMessageId(messages);

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll overflow-x-hidden pt-4"
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

      <div className="flex min-w-0 flex-col gap-6 w-full max-w-2xl mx-auto px-4">
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
            onReview={message.id === reviewMessageId ? onReview : undefined}
            isLatestAnalysis={message.id === reviewMessageId}
          />
        ))}

        {/* One working row for every mode: the turning helix and an elapsed timer, as in Grok. */}
        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

        <div
          ref={messagesEndRef}
          className="shrink-0 min-w-[24px] min-h-[1px]"
          style={{ minHeight: '1px' }}
        />
      </div>
    </div>
  );
}

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
