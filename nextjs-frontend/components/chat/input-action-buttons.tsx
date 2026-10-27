'use client';

import cx from 'classnames';
import type { DictationState } from '@/hooks/use-dictation';
import { Loader2Icon, MicIcon, SquareIcon } from 'lucide-react';
import { memo, type Dispatch, type SetStateAction } from 'react';
import { ArrowUpIcon, PaperclipIcon, StopIcon } from '../icons';
import { Button } from '../ui/button';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  parts?: any[];
};

export interface AttachmentsButtonProps {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  isLoading: boolean;
}

function PureAttachmentsButton({
  fileInputRef,
  isLoading,
}: AttachmentsButtonProps) {
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

export interface DictationButtonProps {
  state: DictationState;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;
}

function PureDictationButton({
  state,
  onStart,
  onStop,
  disabled,
}: DictationButtonProps) {
  const recording = state === 'recording';
  const label = recording
    ? 'Stop dictation'
    : state === 'transcribing'
      ? 'Transcribing'
      : 'Dictate';
  return (
    <Button
      className={cx('rounded-full size-8 p-0', {
        'bg-red-500/15 text-red-600 hover:bg-red-500/25 dark:text-red-400':
          recording,
      })}
      onClick={(e) => {
        e.preventDefault();
        if (recording) onStop();
        else onStart();
      }}
      disabled={disabled || state === 'transcribing'}
      variant="ghost"
      aria-label={label}
      aria-pressed={recording}
      title={label}
    >
      {state === 'transcribing' ? (
        <Loader2Icon className="size-[18px] animate-spin" />
      ) : recording ? (
        <SquareIcon className="size-4 animate-pulse fill-current" />
      ) : (
        <MicIcon className="size-[18px]" />
      )}
    </Button>
  );
}

export const DictationButton = memo(PureDictationButton);

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
        setMessages((messages) => messages);
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
}

function PureSendButton({ submitForm, input, uploadQueue }: SendButtonProps) {
  const hasInput = input.length > 0;
  const label = 'Send message';

  return (
    <Button
      className={cx(
        'rounded-full size-8 p-0 border transition-all duration-300',
        hasInput
          ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 ring-4 ring-primary/20 scale-105'
          : 'bg-muted text-muted-foreground border-border',
      )}
      onClick={(e) => {
        e.preventDefault();
        submitForm();
      }}
      disabled={!hasInput || uploadQueue.length > 0}
      aria-label={label}
      title={label}
    >
      <ArrowUpIcon size={18} className={hasInput ? 'stroke-[2.5px]' : ''} />
    </Button>
  );
}

export const SendButton = memo(PureSendButton, (prev, next) => {
  if (prev.uploadQueue.length !== next.uploadQueue.length) return false;
  if (prev.input !== next.input) return false;
  return true;
});
