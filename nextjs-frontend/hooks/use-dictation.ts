'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * Dictation with Muse Voice Transcribe. Records with MediaRecorder, converts the
 * recording to the 16 kHz mono 16-bit WAV the API requires, and posts it to
 * /api/transcribe, which holds the API key.
 */

const SAMPLE_RATE = 16_000;
const MAX_SECONDS = 120;

export type DictationState = 'idle' | 'recording' | 'transcribing';

export function useDictation(
  onTranscript: (text: string) => void,
  /** A VOICE_LANGUAGES code, or 'auto' to let Muse detect the language. */
  language = 'auto',
  /**
   * An input deviceId, or 'default' for the system default. Asked for
   * explicitly because the browser's own pick can be a silent virtual device
   * (audio apps such as Boom install aggregate inputs).
   */
  microphone = 'default',
) {
  const [state, setState] = useState<DictationState>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // The live capture, shared with the waveform so the mic is opened once.
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const cancelledRef = useRef(false);
  const limitRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onTranscriptRef = useRef(onTranscript);
  const languageRef = useRef(language);
  const microphoneRef = useRef(microphone);
  const deviceLabelRef = useRef('');

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    languageRef.current = language;
    microphoneRef.current = microphone;
  }, [onTranscript, language, microphone]);

  const transcribe = useCallback(async (recording: Blob) => {
    setState('transcribing');
    try {
      const wav = await toWav(recording, deviceLabelRef.current);
      const form = new FormData();
      form.append('audio', wav, 'dictation.wav');
      form.append('language', languageRef.current);
      form.append('languages', navigator.languages.join(','));
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: form,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? 'Transcription failed.');
      if (result.transcript) onTranscriptRef.current(result.transcript);
      else toast.info('No speech was detected.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Transcription failed.',
      );
    } finally {
      setState('idle');
    }
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: await audioConstraints(microphoneRef.current),
      });
      deviceLabelRef.current = stream.getAudioTracks()[0]?.label ?? '';
      setStream(stream);
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        clearTimeout(limitRef.current);
        setStartedAt(null);
        setStream(null);
        for (const track of stream.getTracks()) track.stop();
        if (cancelledRef.current) {
          setState('idle');
          return;
        }
        void transcribe(new Blob(chunks, { type: recorder.mimeType }));
      };
      cancelledRef.current = false;
      recorder.start();
      setStartedAt(Date.now());
      recorderRef.current = recorder;
      limitRef.current = setTimeout(() => recorder.stop(), MAX_SECONDS * 1000);
      setState('recording');
    } catch {
      toast.error('Microphone access was denied.');
    }
  }, [transcribe]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  /** Stops recording and discards the audio. */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
  }, [stop]);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      recorderRef.current?.stop();
    },
    [],
  );

  return {
    state,
    startedAt,
    stream,
    start,
    stop,
    cancel,
    maxSeconds: MAX_SECONDS,
  };
}

/**
 * Chrome ignores a preferred device given as `ideal` and keeps its own pick,
 * so the device is asked for exactly when it exists. 'default' is the system
 * default in Chrome; browsers without that entry get their usual device.
 */
async function audioConstraints(
  deviceId: string,
): Promise<MediaTrackConstraints | true> {
  const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'audioinput',
  );
  return inputs.some((d) => d.deviceId === deviceId)
    ? { deviceId: { exact: deviceId } }
    : true;
}

/** Decodes any browser recording and re-encodes it as 16 kHz mono PCM WAV. */
async function toWav(recording: Blob, deviceLabel: string): Promise<Blob> {
  const context = new AudioContext();
  const decoded = await context.decodeAudioData(await recording.arrayBuffer());
  await context.close();

  const offline = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * SAMPLE_RATE),
    SAMPLE_RATE,
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  // A muted or wrong input device records flat silence; say so instead of
  // sending it and reporting that no speech was found.
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak < 0.003) {
    throw new Error(
      `${deviceLabel || 'The microphone'} recorded only silence. Choose another microphone in your account menu (Microphone).`,
    );
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
