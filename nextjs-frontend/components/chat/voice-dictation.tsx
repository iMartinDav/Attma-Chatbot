'use client';

/**
 * Dictation UI for Muse Voice Transcribe: a language menu next to the mic
 * (auto-detect, or one of the 25 languages Muse recognizes, with code
 * switching), and a live waveform that takes the composer's place while the
 * user speaks, like dictation in ChatGPT or ElevenLabs' speech input.
 */

import { LiveWaveform } from '@/components/elevenlabs/live-waveform';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DictationState } from '@/hooks/use-dictation';
import { VOICE_LANGUAGES, type VoiceLanguage } from '@/lib/voice/languages';
import { cn } from '@/lib/utils';
import { CheckIcon, LanguagesIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocalStorage } from 'usehooks-ts';

// Read after hydration, so the server's render ('auto') matches the first
// client render.
export function useVoiceLanguage() {
  return useLocalStorage<VoiceLanguage>('attma-voice-language', 'auto', {
    initializeWithValue: false,
  });
}

const languageLabel = (code: VoiceLanguage) =>
  code === 'auto'
    ? 'Any language'
    : (VOICE_LANGUAGES.find((l) => l.code === code)?.native ?? code);

export function VoiceLanguageMenu({ disabled }: { disabled?: boolean }) {
  const [language, setLanguage] = useVoiceLanguage();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          className="h-8 gap-1 rounded-full px-2 text-xs text-muted-foreground"
          aria-label={`Dictation language: ${languageLabel(language)}`}
          title={`Dictation language: ${languageLabel(language)}`}
        >
          <LanguagesIcon className="size-4" />
          <span className="uppercase">
            {language === 'auto' ? 'Auto' : language}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-56 overflow-y-auto"
      >
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Muse Voice understands 25 languages and switches between them mid
          sentence.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={language}
          onValueChange={(value) => setLanguage(value as VoiceLanguage)}
        >
          <DropdownMenuRadioItem value="auto">
            Detect automatically
          </DropdownMenuRadioItem>
          {VOICE_LANGUAGES.map((l) => (
            <DropdownMenuRadioItem key={l.code} value={l.code}>
              <span>{l.native}</span>
              {l.native !== l.name && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {l.name}
                </span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <span className="tabular-nums">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </span>
  );
}

/** Takes the composer's place while recording or transcribing. */
export function DictationBar({
  state,
  startedAt,
  onCancel,
  onStop,
}: {
  state: DictationState;
  startedAt: number | null;
  onCancel: () => void;
  onStop: () => void;
}) {
  const [language] = useVoiceLanguage();
  const recording = state === 'recording';
  return (
    <div className="flex h-[52px] items-center gap-3 px-4">
      <span
        className={cn(
          'size-2 shrink-0 rounded-full',
          recording ? 'animate-pulse bg-red-500' : 'bg-primary',
        )}
      />
      <LiveWaveform
        active={recording}
        processing={!recording}
        mode="scrolling"
        height={36}
        barWidth={3}
        barGap={2}
        className="min-w-0 flex-1 text-primary"
      />
      <span className="shrink-0 text-xs text-muted-foreground">
        {recording ? (
          <>
            {languageLabel(language)} ·{' '}
            {startedAt && <Elapsed since={startedAt} />}
          </>
        ) : (
          'Muse Voice is transcribing…'
        )}
      </span>
      {recording && (
        <>
          <Button
            variant="ghost"
            className="size-8 shrink-0 rounded-full p-0"
            onClick={(e) => {
              e.preventDefault();
              onCancel();
            }}
            aria-label="Discard recording"
            title="Discard"
          >
            <XIcon className="size-4" />
          </Button>
          <Button
            className="size-8 shrink-0 rounded-full p-0"
            onClick={(e) => {
              e.preventDefault();
              onStop();
            }}
            aria-label="Stop and transcribe"
            title="Transcribe"
          >
            <CheckIcon className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}
