'use client';

import type { Attachment } from '@/lib/types';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import type React from 'react';
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { useFileUpload } from '@/hooks/use-file-upload';
import { useKeyboardVisibility } from '@/hooks/use-keyboard-visibility';
import { getChatUrl } from '@/lib/utils';
import equal from 'fast-deep-equal';
import { DragAndDrop } from '../drag-and-drop';
import { Textarea } from '../ui/textarea';
import { AgentSelector } from './agent-selector';
import { AgentStatus } from './agent-status';
import {
  AttachmentsButton,
  SendButton,
  StopButton,
} from './input-action-buttons';
import { MessageSearch, type SearchMessage } from './message-search';
import { ModelSelector } from './model-selector';
import { PreviewAttachment } from './preview-attachment';
import type { VisibilityType } from './visibility-selector';

type Message = SearchMessage;

export interface MultimodalInputProps {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: 'ready' | 'submitted' | 'processing';
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  sendMessage: (message: any) => void;
  className?: string;
  isFullSize: boolean;
  selectedVisibilityType?: VisibilityType;
  placeholder?: string;
  selectedModelId?: string;
  selectedAgentId?: string;
  onAgentSelect?: (agentId: string) => void;
  onChatIdChange?: (chatId: string) => void;
}

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  isFullSize,
  selectedVisibilityType,
  placeholder,
  selectedModelId,
  selectedAgentId,
  onAgentSelect,
  onChatIdChange,
}: MultimodalInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { width } = useWindowSize();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');

  const [isSearching, setIsSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  const isLoading = status === 'submitted' || status === 'processing';

  // File upload hook
  const { uploadQueue, handleFileChange, handleFileDrop } =
    useFileUpload(setAttachments);

  const { isKeyboardVisible, scrollInputIntoView } = useKeyboardVisibility();

  // Textarea height management
  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  }, []);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  // Initialize with saved input
  useEffect(() => {
    if (textareaRef.current) {
      const finalValue = textareaRef.current.value || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
  }, [adjustHeight, localStorageInput, setInput]);

  useEffect(() => {
    if (isKeyboardVisible && textareaRef.current) {
      scrollInputIntoView(textareaRef.current);
    }
  }, [isKeyboardVisible, scrollInputIntoView]);

  // Persist input to localStorage
  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  // Input handler
  const handleInput = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
      adjustHeight();
    },
    [setInput, adjustHeight],
  );

  // Search functionality
  const { handleSearch, SearchButton } = MessageSearch({
    isSearchMode,
    isSearching,
    setIsSearchMode,
    input,
    setInput,
    resetHeight,
    setMessages,
    disabled: isLoading,
    chatId,
  });

  // Form submission
  const submitForm = useCallback(() => {
    let targetChatId = chatId;

    if (chatId === 'new') {
      const newId = crypto.randomUUID();
      targetChatId = newId;
      onChatIdChange?.(newId);
    }

    window.history.replaceState({}, '', getChatUrl(targetChatId, projectId));

    if (isSearchMode) {
      const queryText = input.trim();
      if (!queryText) {
        toast.error('Please enter a search query');
        return;
      }
      setInput('');
      setLocalStorageInput('');
      resetHeight();
      handleSearch(queryText);
      return;
    }

    sendMessage({
      role: 'user',
      parts: [
        ...attachments.map((attachment) => ({
          type: 'file' as const,
          url: attachment.url,
          filename: attachment.name,
          mediaType: attachment.contentType,
        })),
        { type: 'text' as const, text: input },
      ],
    });

    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();
    setInput('');

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    chatId,
    handleSearch,
    input,
    isSearchMode,
    resetHeight,
    setAttachments,
    setInput,
    setLocalStorageInput,
    width,
    attachments,
    sendMessage,
  ]);

  // Attachment deletion
  const handleDeleteAttachment = useCallback(
    (attachment: Attachment) => {
      setAttachments((current) =>
        current.filter((a) => a.url !== attachment.url),
      );
    },
    [setAttachments],
  );

  // Determine active tool for status indication
  const lastMessage = messages[messages.length - 1];
  const activeTool =
    lastMessage?.role === 'assistant' && lastMessage.toolInvocations
      ? lastMessage.toolInvocations.find(
          (ti) => ti.state === 'call' || ti.state === 'partial-call',
        )?.toolName
      : undefined;

  return (
    <div
      className={cx(
        'relative w-full flex flex-col items-center gap-4',
        isFullSize ? 'h-full' : 'max-w-4xl mx-auto',
      )}
    >
      {/* Private Mode Indicator */}
      {selectedVisibilityType === 'private' && (
        <div className="absolute -top-6 left-0 right-0 flex items-center justify-center">
          <div className="text-[10px] uppercase tracking-wider font-medium text-purple-500/70 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50 animate-pulse" />
            Private Session — Not Saved
          </div>
        </div>
      )}

      {/* Attachment Previews */}
      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div className="flex flex-row gap-2 overflow-x-auto items-end w-full pb-2 px-1">
          {attachments.map((attachment) => (
            <PreviewAttachment
              key={attachment.url}
              attachment={attachment}
              onDelete={handleDeleteAttachment}
            />
          ))}
          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{ url: '', name: filename, contentType: '' }}
              isUploading
            />
          ))}
        </div>
      )}

      {/* Agent Status Indicator */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute -top-12 left-0 right-0 flex justify-center z-20 pointer-events-none"
          >
            <AgentStatus
              isActive={isLoading}
              currentTool={activeTool}
              model={selectedModelId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Pill */}
      <DragAndDrop onDrop={handleFileDrop} isFullSize={isFullSize}>
        <div
          className={cx(
            'relative flex flex-col w-full transition-all duration-300 ease-in-out',
            'rounded-[32px] border shadow-sm group bg-background/50 backdrop-blur-md',
            selectedVisibilityType === 'private'
              ? 'border-purple-500/30 dark:border-purple-500/40 focus-within:ring-2 focus-within:ring-purple-500/10'
              : 'border-zinc-200/80 dark:border-zinc-800/80 focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5',
          )}
        >
          <div className={cx('w-full', input.length > 0 && 'pb-14')}>
            <Textarea
              data-testid="multimodal-input"
              ref={textareaRef}
              placeholder={
                placeholder ||
                (isSearchMode ? 'Search with Attma...' : 'Send a message...')
              }
              value={input}
              onChange={handleInput}
              className={cx(
                'w-full min-h-[44px] max-h-[450px] resize-none bg-transparent border-0 shadow-none',
                'focus-visible:ring-0 focus-visible:ring-offset-0 py-3.5 px-12',
                'text-base md:text-[15px] leading-[1.6] placeholder:text-muted-foreground/40',
                'font-normal transition-all',
                className,
              )}
              rows={1}
              autoFocus
              suppressHydrationWarning
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  if (status !== 'ready') {
                    toast.error(
                      'Please wait for the model to finish its response!',
                    );
                  } else {
                    submitForm();
                  }
                }
                if (event.key === 'Escape' && isSearchMode)
                  setIsSearchMode(false);
              }}
            />
          </div>

          {/* Bottom-anchored action buttons */}
          <div className="absolute left-2.5 bottom-2.5 flex items-center">
            <AttachmentsButton
              fileInputRef={fileInputRef}
              isLoading={isLoading || isSearching}
            />
          </div>

          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
            <div
              className={cx(
                'flex items-center gap-1.5 transition-all duration-300',
                input.length > 0
                  ? 'opacity-100'
                  : 'opacity-0 translate-x-4 pointer-events-none',
              )}
            >
              <SearchButton />
              <div className="h-4 w-px bg-border/40 mx-0.5" />
              {onAgentSelect && (
                <AgentSelector
                  currentAgentId={selectedAgentId}
                  onAgentSelect={onAgentSelect}
                />
              )}
              {selectedModelId && (
                <div className="hidden sm:block">
                  <ModelSelector
                    selectedModelId={selectedModelId}
                    triggerType="pill"
                  />
                </div>
              )}
            </div>

            {status === 'submitted' ? (
              <StopButton stop={stop} setMessages={setMessages} />
            ) : (
              <SendButton
                input={input}
                submitForm={submitForm}
                uploadQueue={uploadQueue}
                isSearchMode={isSearchMode}
              />
            )}
          </div>
        </div>
      </DragAndDrop>

      {/* Hidden file input */}
      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;
    if (prevProps.selectedAgentId !== nextProps.selectedAgentId) return false;
    return true;
  },
);
