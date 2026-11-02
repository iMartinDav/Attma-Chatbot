'use client';

import { useArtifactSelector } from '@/hooks/use-artifact';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import type { Vote } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import type { Attachment, ChatMessage } from '@/lib/types';
import {
  fetcher,
  fetchWithErrorHandlers,
  generateUUID,
  getChatUrl,
} from '@/lib/utils';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';
import { unstable_serialize } from 'swr/infinite';
import { Artifact } from './artifact';
import { ChatHeader } from './chat-header';
import { Greeting, WorkflowCards } from './empty-state';
import { useDataStream } from './data-stream-provider';
import { Messages } from './messages';
import { useSources } from './sources-selector';
import { MultimodalInput } from './multimodal-input';
import { getChatHistoryPaginationKey } from './sidebar-history';
import type { VisibilityType } from './visibility-selector';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibility: initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();
  const [input, setInput] = useState<string>('');
  const [activeChatId, setActiveChatId] = useState(id);
  // The transport reads the id from a ref: a new chat gets its UUID in the
  // same click that sends the first message, before React re-renders, and the
  // server must save the chat under that UUID or the URL points nowhere.
  const activeChatIdRef = useRef(id);
  const changeChatId = useCallback((newId: string) => {
    activeChatIdRef.current = newId;
    setActiveChatId(newId);
  }, []);

  useEffect(() => {
    activeChatIdRef.current = id;
    setActiveChatId(id);
  }, [id]);

  // Use ref for dynamic values in v5 transport
  const visibilityTypeRef = useRef(visibilityType);
  visibilityTypeRef.current = visibilityType;

  const searchParams = useSearchParams();
  const projectParam = searchParams.get('project');
  const projectIdRef = useRef(projectParam);
  projectIdRef.current = projectParam;

  // The sources the agent may connect to, from the Sources menu.
  const { enabled: enabledSources } = useSources();
  const sourcesRef = useRef(enabledSources);
  sourcesRef.current = enabledSources;

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages, id: hookId, body }: any) {
        return {
          body: {
            id: activeChatIdRef.current,
            message: messages.at(-1),
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityTypeRef.current,
            connectors: sourcesRef.current,
            projectId: projectIdRef.current,
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) =>
        ds ? [...ds, dataPart as any] : [dataPart as any],
      );
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      // Also refresh project chats if this chat belongs to a project
      if (projectParam) {
        mutate(`/api/projects/${projectParam}/chats`);
      }
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast.error(error.message);
      }
    },
  });

  // Review decisions travel as a request body field; the route approves without calling the model.
  const handleReview = useCallback(
    (decision: 'approve' | 'changes', notes?: string) => {
      if (decision === 'approve') {
        void sendMessage(
          {
            role: 'user' as const,
            parts: [{ type: 'text' as const, text: 'Approved the report.' }],
          },
          { body: { review: { decision: 'approve' } } },
        );
      } else {
        void sendMessage(
          {
            role: 'user' as const,
            parts: [
              {
                type: 'text' as const,
                text: `Requested changes: ${notes ?? ''}`,
              },
            ],
          },
          { body: { review: { decision: 'changes', notes } } },
        );
      }
    },
    [sendMessage],
  );

  const query = searchParams.get('query');
  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: 'user' as const,
        parts: [{ type: 'text', text: query }],
      });
      setHasAppendedQuery(true);
      window.history.replaceState({}, '', getChatUrl(id, projectParam));
    }
  }, [query, sendMessage, hasAppendedQuery, id, projectParam]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const userName = session?.user?.name?.split(' ')[0] || 'there';

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={activeChatId}
          selectedModelId={initialChatModel}
          selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
        />

        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center px-4 relative pb-16 overflow-y-auto">
            <Greeting name={userName} />

            {/* Premium Input Container */}
            <div className="w-full max-w-2xl px-4">
              <div className="relative">
                <form className="w-full">
                  {!isReadonly && (
                    <MultimodalInput
                      chatId={activeChatId}
                      onChatIdChange={changeChatId}
                      input={input}
                      setInput={setInput}
                      status={
                        status === 'streaming' || status === 'submitted'
                          ? 'processing'
                          : 'ready'
                      }
                      stop={stop}
                      attachments={attachments}
                      setAttachments={setAttachments}
                      messages={messages as any}
                      setMessages={setMessages as any}
                      sendMessage={sendMessage as any}
                      selectedVisibilityType={visibilityType}
                      isFullSize={true}
                      placeholder="Ask, attach data, or describe an analysis…"
                      selectedModelId={initialChatModel}
                    />
                  )}
                </form>
              </div>
            </div>

            <WorkflowCards
              onSelect={(text: string) => {
                setInput(text);
                document.querySelector('textarea')?.focus();
              }}
              onUpload={() =>
                document.getElementById('chat-attachments-input')?.click()
              }
            />

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted-foreground">
              Powered by Attma
            </div>
          </div>
        ) : (
          <>
            <Messages
              chatId={activeChatId}
              votes={votes}
              messages={messages as any}
              setMessages={setMessages as any}
              isReadonly={isReadonly}
              isArtifactVisible={isArtifactVisible}
              isLoading={status === 'streaming'}
              isReasoningMode={false}
              onReview={handleReview}
              reload={async () => {
                await regenerate();
                return null;
              }}
            />

            <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
              {!isReadonly && (
                <MultimodalInput
                  chatId={activeChatId}
                  onChatIdChange={changeChatId}
                  input={input}
                  setInput={setInput}
                  status={
                    status === 'streaming' || status === 'submitted'
                      ? 'processing'
                      : 'ready'
                  }
                  stop={stop}
                  attachments={attachments}
                  selectedModelId={initialChatModel}
                  setAttachments={setAttachments}
                  messages={messages as any}
                  setMessages={setMessages as any}
                  sendMessage={sendMessage as any}
                  selectedVisibilityType={visibilityType}
                  isFullSize={false}
                />
              )}
            </form>
          </>
        )}
      </div>

      <Artifact
        chatId={activeChatId}
        input={input}
        setInput={setInput}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        sendMessage={sendMessage as any}
        messages={messages as any}
        setMessages={setMessages as any}
        regenerate={regenerate}
        votes={votes}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />
    </>
  );
}

export default React.memo(Chat);
