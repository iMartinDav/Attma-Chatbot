import type { ChatRequestOptions, UIMessage } from 'ai';
import { useScrollToBottom } from '../use-scroll-to-bottom';
import { PreviewMessage, ThinkingMessage } from './message';
import { SearchMessage } from './message-search';

import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import { memo } from 'react';
import { ChatOverview } from './overview';

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
}

function PureMessages({
  chatId,
  isLoading,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll py-4 md:pb-6"
    >
      {messages.length === 0 && <ChatOverview />}

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
            setMessages={setMessages as unknown as (messages: SearchMessage[] | ((messages: SearchMessage[]) => SearchMessage[])) => void}
            regenerate={reload}
            isReadonly={isReadonly}
          />
        ))}

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

        <div
          ref={messagesEndRef}
          className="shrink-0 min-w-[24px] min-h-[24px]"
        />
      </div>
    </div>
  );
}

const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isArtifactVisible !== nextProps.isArtifactVisible) return false;
  if (prevProps.isReadonly !== nextProps.isReadonly) return false;
  
  return equal(prevProps.messages, nextProps.messages) && equal(prevProps.votes, nextProps.votes);
});

export { Messages };
