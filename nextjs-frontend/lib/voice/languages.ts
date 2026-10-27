/**
 * Muse Voice Transcribe recognizes 25 languages, with code-switching, and
 * auto-detects the language when no bias is given. Biasing toward the
 * browser's languages helps short clips; English stays in the bias because
 * gene, drug and method names are mostly English even in other languages.
 */

const MUSE_LANGUAGES: Record<string, string> = {
  ar: 'Arabic',
  bn: 'Bengali',
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fil: 'Tagalog',
  fr: 'French',
  he: 'Hebrew',
  hi: 'Hindi',
  id: 'Indonesian',
  it: 'Italian',
  iw: 'Hebrew',
  ja: 'Japanese',
  kn: 'Kannada',
  ko: 'Korean',
  mr: 'Marathi',
  ms: 'Malay',
  nl: 'Dutch',
  pl: 'Polish',
  pt: 'Portuguese',
  ta: 'Tamil',
  te: 'Telugu',
  th: 'Thai',
  tl: 'Tagalog',
  tr: 'Turkish',
  vi: 'Vietnamese',
  zh: 'Mandarin Chinese',
};

/** The languages Muse Voice Transcribe recognizes, for the language menu. */
export const VOICE_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'he', name: 'Hebrew', native: 'עברית' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'zh', name: 'Mandarin Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'tl', name: 'Tagalog', native: 'Tagalog' },
] as const;

export type VoiceLanguage = 'auto' | (typeof VOICE_LANGUAGES)[number]['code'];

/**
 * The bias for a dictation: the language the user picked (with English, for
 * gene and drug names), or, on auto, the browser's languages.
 */
export function biasFor(choice: string, browserTags: string[]) {
  const picked = VOICE_LANGUAGES.find((l) => l.code === choice);
  if (picked) {
    return picked.name === 'English' ? ['English'] : [picked.name, 'English'];
  }
  return languageBias(browserTags);
}

/**
 * Language names to bias toward, from BCP 47 tags such as "es-MX". Returns
 * undefined (auto-detect) when the browser asks only for English or for
 * languages Muse does not list, so speech in any language is still recognized.
 */
export function languageBias(tags: string[]): string[] | undefined {
  const names = [
    ...new Set(
      tags
        .map((tag) => MUSE_LANGUAGES[tag.toLowerCase().split('-')[0]])
        .filter(Boolean),
    ),
  ];
  if (names.length === 0 || (names.length === 1 && names[0] === 'English')) {
    return undefined;
  }
  return names.includes('English') ? names : [...names, 'English'];
}
