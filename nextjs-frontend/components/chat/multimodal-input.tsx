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

import { useDictation } from '@/hooks/use-dictation';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useKeyboardVisibility } from '@/hooks/use-keyboard-visibility';
import { getChatUrl } from '@/lib/utils';
import equal from 'fast-deep-equal';
import { DragAndDrop } from '../drag-and-drop';
import { GhostIcon } from '../icons';
import { Textarea } from '../ui/textarea';
import { AgentStatus } from './agent-status';
import { describeStep, type StepPart } from './step-labels';
import {
  AttachmentsButton,
  DictationButton,
  SendButton,
  StopButton,
} from './input-action-buttons';
import type { SearchMessage } from './message-search';
import { ModelSelector } from './model-selector';
import { PreviewAttachment } from './preview-attachment';
import { SourcesSelector } from './sources-selector';
import {
  DictationBar,
  useMicrophone,
  useVoiceLanguage,
} from './voice-dictation';
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
  onChatIdChange,
}: MultimodalInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { width } = useWindowSize();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');

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

  // Dictated text is appended to whatever is already typed.
  // Text set from outside (starter cards, dictation, a restored draft) resizes too.
  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  const [voiceLanguage] = useVoiceLanguage();
  const [microphone] = useMicrophone();
  const dictation = useDictation(
    (transcript) => {
      setInput((current) =>
        current ? `${current} ${transcript}` : transcript,
      );
      requestAnimationFrame(() => {
        adjustHeight();
        textareaRef.current?.focus();
      });
    },
    voiceLanguage,
    microphone,
  );
  const dictating = dictation.state !== 'idle';

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  // Restore a saved draft once, on mount. Re-running this on every
  // localStorage write made fast typing loop between input and storage.
  const draftRestored = useRef(false);
  useEffect(() => {
    if (draftRestored.current || !textareaRef.current) return;
    draftRestored.current = true;
    const finalValue = textareaRef.current.value || localStorageInput || '';
    setInput(finalValue);
    adjustHeight();
  }, [adjustHeight, localStorageInput, setInput]);

  useEffect(() => {
    if (isKeyboardVisible && textareaRef.current) {
      scrollInputIntoView(textareaRef.current);
    }
  }, [isKeyboardVisible, scrollInputIntoView]);

  // Persist input to localStorage
  // Saved once typing pauses, so each keystroke does not also write storage.
  useEffect(() => {
    const timer = setTimeout(() => setLocalStorageInput(input), 300);
    return () => clearTimeout(timer);
  }, [input, setLocalStorageInput]);

  // Input handler
  const handleInput = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
      adjustHeight();
    },
    [setInput, adjustHeight],
  );

  // Form submission
  const submitForm = useCallback(() => {
    let targetChatId = chatId;

    if (chatId === 'new') {
      const newId = crypto.randomUUID();
      targetChatId = newId;
      onChatIdChange?.(newId);
    }

    window.history.replaceState({}, '', getChatUrl(targetChatId, projectId));

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
    input,
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

  // The running tool step, described in the same words as the timeline.
  const lastMessage = messages[messages.length - 1] as
    { role: string; parts?: StepPart[] } | undefined;
  const activeStep =
    lastMessage?.role === 'assistant'
      ? lastMessage.parts?.findLast(
          (part) =>
            part.type.startsWith('tool-') &&
            (part.state === 'input-streaming' ||
              part.state === 'input-available'),
        )
      : undefined;

  return (
    <div
      className={cx(
        'relative w-full flex flex-col items-center gap-4',
        isFullSize ? 'h-full' : 'max-w-4xl mx-auto',
      )}
    >
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
              currentAction={activeStep ? describeStep(activeStep) : undefined}
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
            'rounded-[32px] border shadow-sm group backdrop-blur-md',
            selectedVisibilityType === 'private'
              ? 'border-purple-500/40 bg-purple-100 focus-within:ring-2 focus-within:ring-purple-500/25 dark:bg-[#251840]'
              : 'border-zinc-200/80 bg-background/50 dark:border-zinc-800/80 focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5',
          )}
        >
          <div className="w-full pb-12">
            {dictating && (
              <DictationBar
                state={dictation.state}
                startedAt={dictation.startedAt}
                stream={dictation.stream}
                onCancel={dictation.cancel}
                onStop={dictation.stop}
              />
            )}
            <Textarea
              data-testid="multimodal-input"
              ref={textareaRef}
              placeholder={
                placeholder || 'Ask, attach data, or describe an analysis…'
              }
              value={input}
              onChange={handleInput}
              className={cx(
                'w-full min-h-[44px] max-h-[450px] resize-none bg-transparent border-0 shadow-none',
                'focus-visible:ring-0 focus-visible:ring-offset-0 py-3.5 px-5',
                dictating && 'hidden',
                'text-base md:text-[15px] leading-[1.6] placeholder:text-muted-foreground',
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
              }}
            />
          </div>

          {/* Bottom-anchored action buttons */}
          <div className="absolute left-2.5 bottom-2.5 flex items-center gap-0.5">
            <AttachmentsButton
              fileInputRef={fileInputRef}
              isLoading={isLoading}
            />
            <DictationButton
              state={dictation.state}
              onStart={dictation.start}
              onStop={dictation.stop}
              disabled={isLoading}
            />
          </div>

          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <SourcesSelector />
              {selectedModelId && (
                <div className="hidden sm:block">
                  <ModelSelector
                    selectedModelId={selectedModelId}
                    triggerType="pill"
                  />
                </div>
              )}
            </div>

            {isLoading ? (
              <StopButton stop={stop} setMessages={setMessages} />
            ) : (
              <SendButton
                input={input}
                submitForm={submitForm}
                uploadQueue={uploadQueue}
              />
            )}
          </div>
        </div>
      </DragAndDrop>

      {/* Private caption under the composer, as in Grok: ghost plus one short line, only while Private is on. */}
      {selectedVisibilityType === 'private' && (
        <p className="-mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <GhostIcon className="size-3.5 shrink-0 text-purple-500" />
          This chat is private. Only you can open it.
        </p>
      )}

      {/* Hidden file input */}
      <input
        id="chat-attachments-input"
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
    // Private can be switched mid-chat, and the composer's colour and caption follow it.
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;
    return true;
  },
);
