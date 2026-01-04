'use client';

import { useArtifactSelector } from '@/hooks/use-artifact';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import type { Vote } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import type { Attachment, ChatMessage } from '@/lib/types';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';
import { unstable_serialize } from 'swr/infinite';
import { Artifact } from './artifact';
import { ChatHeader } from './chat-header';
import { useDataStream } from './data-stream-provider';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { ChatSuggestions } from './chat-suggestions';
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

  // Use ref for dynamic values in v5 transport
  const visibilityTypeRef = useRef(visibilityType);
  visibilityTypeRef.current = visibilityType;

  // Read agent from URL
  const searchParams = useSearchParams();
  const agentParam = searchParams.get('agent');
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(agentParam || undefined);
  
  const selectedAgentIdRef = useRef(selectedAgentId);
  selectedAgentIdRef.current = selectedAgentId;

  useEffect(() => {
    if (agentParam) {
      setSelectedAgentId(agentParam);
    }
  }, [agentParam]);

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
      prepareSendMessagesRequest({ messages, id, body }: any) {
        return {
          body: {
            id,
            message: messages.at(-1),
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityTypeRef.current,
            selectedAgentId: selectedAgentIdRef.current, // Use ref here
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart as any] : [dataPart as any]));
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast.error(error.message);
      }
    },
  });

  const query = searchParams.get('query');
  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: 'user' as const,
        parts: [{ type: 'text', text: query }],
      });
      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

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


  const isBioAgent = selectedAgentId === 'bioinformatics' || selectedAgentId === 'single-cell' || selectedAgentId === 'variant-analysis' || selectedAgentId === 'pathway-analysis';

  // Time-based greeting like Claude/ChatGPT
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const userName = session?.user?.name?.split(' ')[0] || 'there';

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={initialChatModel}
          selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
        />

        {messages.length === 0 ? (
           <div className="flex-1 flex flex-col justify-center items-center px-4 relative pb-20">
              {/* Personalized Greeting - Logo Centered like Grok */}
              <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="flex items-center justify-center gap-3 mb-4">
                    <img 
                       src="/images/logo.png" 
                       alt="Attma" 
                       className="h-8 hidden dark:block"
                    />
                    <img 
                       src="/images/attma-logo.webp" 
                       alt="Attma" 
                       className="h-8 block dark:hidden"
                    />
                    
                    <h1 className="text-3xl md:text-4xl font-light text-foreground/90">
                       {getGreeting()}, <span className="font-normal">{userName}</span>
                    </h1>
                 </div>
                 
                 <p className="text-muted-foreground text-base">
                    How can I help with your research today?
                 </p>
              </div>

              {/* Suggestion Chips to promote Agent features */}
              <ChatSuggestions 
                onSelect={(text: string) => {
                  setInput(text);
                  // Optional: auto-focus input
                  const textarea = document.querySelector('textarea');
                  if (textarea) textarea.focus();
                }}
              />

              {/* Premium Input Container */}
              <div className="w-full max-w-2xl px-4">
                 <div className="relative">
                    <form className="w-full">
                      {!isReadonly && (
                        <MultimodalInput
                          chatId={id}
                          input={input}
                          setInput={setInput}
                          status={status === 'streaming' ? 'processing' : status === 'error' ? 'ready' : 'ready'}
                          stop={stop}
                          attachments={attachments}
                          setAttachments={setAttachments}
                          messages={messages as any}
                          setMessages={setMessages as any}
                          sendMessage={sendMessage as any}
                          selectedVisibilityType={visibilityType}
                          isFullSize={true}
                          placeholder="What do you want to know?"
                          selectedModelId={initialChatModel}
                          selectedAgentId={selectedAgentId || 'auto'}
                          onAgentSelect={(agentId) => setSelectedAgentId(agentId === 'auto' || agentId === 'general' ? undefined : agentId)}
                        />
                      )}
                    </form>
                 </div>
              </div>

              
              {/* Minimal Footer */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                 <span className="text-xs text-muted-foreground/50">Powered by Attma AI</span>
              </div>
           </div>
        ) : (
          <>
            <Messages
              chatId={id}
              votes={votes}
              messages={messages as any}
              setMessages={setMessages as any}
              isReadonly={isReadonly}
              isArtifactVisible={isArtifactVisible}
              isLoading={status === 'streaming'}
              isReasoningMode={false}
              reload={async () => { await regenerate(); return null; }}
            />

            <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
              {!isReadonly && (
                <MultimodalInput
                  chatId={id}
                  input={input}
                  setInput={setInput}
                  status={status === 'streaming' ? 'processing' : status === 'error' ? 'ready' : 'ready'}
                  stop={stop}
                  attachments={attachments}
                  selectedModelId={initialChatModel}
                  selectedAgentId={selectedAgentId || 'auto'}
                  onAgentSelect={(agentId) => setSelectedAgentId(agentId === 'auto' || agentId === 'general' ? undefined : agentId)}
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
        chatId={id}
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
