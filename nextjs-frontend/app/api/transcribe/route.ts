import { auth } from '@/app/(auth)/auth';
import { CLINICAL_KEYWORDS } from '@/lib/voice/clinical-keywords';
import { biasFor } from '@/lib/voice/languages';
import { NextResponse } from 'next/server';

/**
 * Dictation: transcribes a recorded WAV with Muse Voice Transcribe. The browser
 * records and converts to 16 kHz mono PCM; this route adds the API key and the
 * clinical vocabulary and the speaker's languages as hints, so the key never
 * reaches the client.
 */

export const maxDuration = 60;

// Vercel caps request bodies at 4.5 MB, about 2 minutes of 16 kHz mono WAV.
const MAX_BYTES = 4 * 1024 * 1024;
const TRANSCRIBE_URL = 'https://api.meta.ai/v1/asr/transcribe';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Sign in to use dictation.' },
      { status: 401 },
    );
  }
  const apiKey = process.env.META_MODEL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Dictation is not configured on this server.' },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const audio = form.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: 'No audio received.' }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Recording is too long. Keep dictation under 2 minutes.' },
      { status: 413 },
    );
  }

  const body = new FormData();
  body.append(
    'request',
    new Blob(
      [
        JSON.stringify({
          model: 'muse-voice-transcribe-1.0',
          audioEncoding: 'WAV',
          mode: 'PUSH_TO_TALK',
          keywords: CLINICAL_KEYWORDS,
          languageBias: biasFor(
            String(form.get('language') ?? 'auto'),
            String(form.get('languages') ?? '').split(',').filter(Boolean),
          ),
        }),
      ],
      { type: 'application/json' },
    ),
  );
  body.append('audio', audio, 'dictation.wav');

  const response = await fetch(TRANSCRIBE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(55_000),
  });
  if (!response.ok) {
    console.error(
      'Muse Voice Transcribe failed',
      response.status,
      await response.text(),
    );
    return NextResponse.json(
      { error: 'Transcription failed. Try again.' },
      { status: 502 },
    );
  }

  const result = (await response.json()) as {
    transcript: string;
    audioDurationMs: number;
  };
  return NextResponse.json({
    transcript: result.transcript.trim(),
    durationMs: result.audioDurationMs,
  });
}
