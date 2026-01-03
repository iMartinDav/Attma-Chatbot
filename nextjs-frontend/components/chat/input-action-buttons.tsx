'use client';

import cx from 'classnames';
import { memo, type Dispatch, type SetStateAction } from 'react';
import { ArrowUpIcon, PaperclipIcon, StopIcon } from '../icons';
import { Button } from '../ui/button';

type Message = { id: string; role: 'user' | 'assistant' | 'system'; content?: string; parts?: any[] };

export interface AttachmentsButtonProps {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  isLoading: boolean;
}

function PureAttachmentsButton({ fileInputRef, isLoading }: AttachmentsButtonProps) {
  return (
    <Button
      className="rounded-full size-8 p-0"
      onClick={(e) => {
        e.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={isLoading}
      variant="ghost"
      aria-label="Add attachment"
      title="Add attachment"
    >
      <PaperclipIcon size={18} />
    </Button>
  );
}

export const AttachmentsButton = memo(PureAttachmentsButton);

export interface StopButtonProps {
  stop: () => void;
  setMessages: Dispatch<SetStateAction<any[]>>;
}

function PureStopButton({ stop, setMessages }: StopButtonProps) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-full size-8 p-0 border dark:border-zinc-800"
      onClick={(e) => {
        e.preventDefault();
        stop();
        setMessages(messages => messages);
      }}
      aria-label="Stop generating"
      title="Stop generating"
    >
      <StopIcon size={18} />
    </Button>
  );
}

export const StopButton = memo(PureStopButton);

export interface SendButtonProps {
  submitForm: () => void;
  input: string;
  uploadQueue: string[];
  isSearchMode: boolean;
}

function PureSendButton({ submitForm, input, uploadQueue, isSearchMode }: SendButtonProps) {
  const hasInput = input.length > 0;
  const label = isSearchMode ? 'Search' : 'Send message';

  return (
    <Button
      className={cx(
        "rounded-full size-8 p-0 border transition-all duration-300",
        hasInput
          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 ring-4 ring-primary/20 scale-105"
          : "bg-muted text-muted-foreground border-border"
      )}
      onClick={(e) => {
        e.preventDefault();
        submitForm();
      }}
      disabled={!hasInput || uploadQueue.length > 0}
      aria-label={label}
      title={label}
    >
      <ArrowUpIcon size={18} className={hasInput ? "stroke-[2.5px]" : ""} />
    </Button>
  );
}

export const SendButton = memo(PureSendButton, (prev, next) => {
  if (prev.uploadQueue.length !== next.uploadQueue.length) return false;
  if (prev.input !== next.input) return false;
  if (prev.isSearchMode !== next.isSearchMode) return false;
  return true;
});
