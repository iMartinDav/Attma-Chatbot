'use client';

/**
 * Dictation UI for Muse Voice Transcribe: a live waveform that takes the
 * composer's place while the user speaks, like dictation in ChatGPT or
 * ElevenLabs' speech input, and the dictation language setting for the user
 * menu (auto-detect by default, or one of the 25 languages Muse recognizes).
 */

import { LiveWaveform } from '@/components/elevenlabs/live-waveform';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import type { DictationState } from '@/hooks/use-dictation';
import { VOICE_LANGUAGES, type VoiceLanguage } from '@/lib/voice/languages';
import { cn } from '@/lib/utils';
import { CheckIcon, LanguagesIcon, MicIcon, XIcon } from 'lucide-react';
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
    ? 'Auto-detect'
    : (VOICE_LANGUAGES.find((l) => l.code === code)?.native ?? code);

/**
 * The dictation language setting, in the user menu: auto-detect by default,
 * or one language to bias toward when auto-detect misses short clips.
 */
export function VoiceLanguageSubmenu() {
  const [language, setLanguage] = useVoiceLanguage();
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="h-8 gap-2 px-3 text-sm">
        <LanguagesIcon className="size-4 text-muted-foreground" />
        <span>Dictation language</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {language === 'auto' ? 'Auto' : languageLabel(language)}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-60 overflow-y-auto">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Attma detects 25 languages and follows switches mid sentence. Pick one
          only if short clips come out in the wrong language.
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
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function useMicrophone() {
  return useLocalStorage<string>('attma-microphone', 'default', {
    initializeWithValue: false,
  });
}

/**
 * The input device for dictation, in the user menu. Device names are only
 * visible once the site may use the microphone, so the list asks for access
 * the first time if needed.
 */
export function MicrophoneSubmenu() {
  const [microphone, setMicrophone] = useMicrophone();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const list = async () => {
    let inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === 'audioinput',
    );
    if (inputs.every((d) => !d.label)) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === 'audioinput',
      );
    }
    setDevices(inputs);
  };

  const systemDefault = devices.find((d) => d.deviceId === 'default');
  const others = devices.filter(
    (d) => d.deviceId !== 'default' && d.deviceId !== 'communications',
  );
  const current =
    microphone === 'default'
      ? 'Default'
      : (devices.find((d) => d.deviceId === microphone)?.label ?? 'Custom');

  return (
    <DropdownMenuSub
      onOpenChange={(open) => {
        if (open) list().catch(() => setDevices([]));
      }}
    >
      <DropdownMenuSubTrigger className="h-8 gap-2 px-3 text-sm">
        <MicIcon className="size-4 text-muted-foreground" />
        <span>Microphone</span>
        <span className="ml-auto max-w-24 truncate text-xs text-muted-foreground">
          {current}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-72">
        <DropdownMenuRadioGroup
          value={microphone}
          onValueChange={setMicrophone}
        >
          <DropdownMenuRadioItem value="default">
            <span className="truncate">
              System default
              {systemDefault
                ? ` (${systemDefault.label.replace(/^Default - /, '')})`
                : ''}
            </span>
          </DropdownMenuRadioItem>
          {others.map((d) => (
            <DropdownMenuRadioItem key={d.deviceId} value={d.deviceId}>
              <span className="truncate">{d.label || 'Microphone'}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
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
  stream,
  onCancel,
  onStop,
}: {
  state: DictationState;
  startedAt: number | null;
  stream: MediaStream | null;
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
        active={recording && Boolean(stream)}
        stream={stream}
        processing={!recording}
        mode="scrolling"
        height={36}
        barWidth={3}
        barGap={2}
        className="min-w-0 flex-1 text-primary-ink"
      />
      <span className="shrink-0 text-xs text-muted-foreground">
        {recording ? (
          <>
            {languageLabel(language)} ·{' '}
            {startedAt && <Elapsed since={startedAt} />}
          </>
        ) : (
          'Transcribing…'
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
