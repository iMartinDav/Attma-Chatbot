'use client';

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUp,
  BookOpen,
  Box,
  ChartScatter,
  ClipboardList,
  CornerDownLeft,
  Dna,
  ListOrdered,
  type LucideIcon,
  Network,
  Paperclip,
} from 'lucide-react';
import type { Locale } from '@/lib/internationalization/config';

interface HeroProps {
  dictionary: {
    title: string;
    subtitle: string;
    introducing?: string;
    ctaExplore?: string;
    promptPlaceholder?: string;
    composer?: {
      attach?: string;
      send?: string;
    };
    suggestionBubbles?: {
      analyzeRna?: string;
      explainSingleCell?: string;
      compareProteins?: string;
      identifyMarkers?: string;
      visualizeGenomic?: string;
      interpretCrispr?: string;
    };
    typingEffectPrompts?: string[];
  };
  locale: Locale;
}

const DEFAULT_SAMPLE_PROMPTS = [
  'Cluster the PBMC 3k dataset and annotate the cell types...',
  'Run pathway enrichment on these B cell markers...',
];

// One icon per suggestion, keyed like the dictionary entries (the key names
// are historical; the icon follows what each label now says).
const SUGGESTION_ICONS: Record<string, LucideIcon> = {
  analyzeRna: ChartScatter,
  explainSingleCell: ListOrdered,
  compareProteins: Box,
  identifyMarkers: ClipboardList,
  visualizeGenomic: Network,
  interpretCrispr: BookOpen,
};

// The chat reads ?query= and sends it as the first message. Text is cut
// before encoding so a %XX escape is never split.
const MAX_QUERY_LENGTH = 2000;
const PROMPT_ROTATION_MS = 4200;
const MAX_TEXTAREA_PX = 208;
const ACCEPTED_FORMATS = 'VCF · h5ad · CSV · PDF';

function chatUrl(text: string) {
  const trimmed = text.trim().slice(0, MAX_QUERY_LENGTH);
  return trimmed ? `/chat?query=${encodeURIComponent(trimmed)}` : '/chat';
}

export const Hero = ({ dictionary }: HeroProps) => {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  // Which control started navigation: 'composer' or a suggestion key.
  const [pending, setPending] = useState<string | null>(null);

  const samplePrompts = dictionary.typingEffectPrompts?.length
    ? dictionary.typingEffectPrompts
    : DEFAULT_SAMPLE_PROMPTS;
  const hasText = query.trim().length > 0;
  const placeholder = dictionary.promptPlaceholder || 'Ask Attma...';

  // Example prompts rotate while the box is empty and idle. They hold still
  // once the visitor focuses the box, so the text does not move while they
  // decide what to type.
  useEffect(() => {
    if (query || isFocused || samplePrompts.length < 2) return;
    const id = setInterval(
      () => setPromptIndex((i) => (i + 1) % samplePrompts.length),
      PROMPT_ROTATION_MS,
    );
    return () => clearInterval(id);
  }, [query, isFocused, samplePrompts.length]);

  // Grow with the text up to a cap, then scroll, like the big chat composers.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [query]);

  const go = (text: string, source: string) => {
    if (pending) return;
    setPending(source);
    router.push(chatUrl(text));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (hasText) go(query, 'composer');
  };

  // Enter sends and Shift+Enter breaks the line. Enter that confirms an IME
  // candidate (Chinese, Japanese) must not send a half-typed question.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (hasText) go(query, 'composer');
  };

  const suggestions = Object.entries(dictionary.suggestionBubbles ?? {}).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );

  return (
    <section className="relative overflow-hidden w-full bg-background py-12 md:py-20 lg:py-32">
      {/* Backdrop matches attma.bio: a fine grid fading from the top over one soft mint glow. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_55%_at_50%_0%,#000_65%,transparent_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-24 h-[520px] w-[820px] max-w-none -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative container mx-auto px-4 md:px-6 max-w-7xl">
        <div className="flex flex-col items-center justify-center text-center space-y-5 md:space-y-8 mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5">
            <Dna className="size-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">
              {dictionary.introducing || 'Introducing Attma'}
            </span>
          </div>

          <h1 className="font-heading mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-[4.25rem] max-w-5xl mx-auto px-2">
            {dictionary.title}
          </h1>

          <p className="max-w-[750px] text-base sm:text-lg text-muted-foreground md:text-xl px-3">
            {dictionary.subtitle}
          </p>

          <div className="w-full max-w-3xl mt-5 md:mt-8 px-1 sm:px-0">
            <form
              onSubmit={handleSubmit}
              className="relative w-full rounded-[26px] border border-border bg-card text-left shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_12px_40px_-12px_hsl(var(--foreground)/0.14)] transition-[border-color,box-shadow] duration-200 ease-out focus-within:border-primary/50 focus-within:shadow-[0_0_0_4px_hsl(var(--primary)/0.12),0_12px_40px_-12px_hsl(var(--foreground)/0.14)]"
            >
              <div className="relative">
                <label htmlFor="hero-prompt" className="sr-only">
                  {placeholder}
                </label>
                <textarea
                  id="hero-prompt"
                  ref={textareaRef}
                  rows={1}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  maxLength={MAX_QUERY_LENGTH}
                  autoComplete="off"
                  spellCheck
                  className="block min-h-[3.75rem] w-full resize-none bg-transparent px-5 pb-1 pt-[1.1rem] text-base leading-7 text-foreground outline-none sm:text-[1.0625rem]"
                />
                {!query && (
                  <span
                    key={promptIndex}
                    aria-hidden="true"
                    className="attma-prompt-in pointer-events-none absolute inset-x-5 top-[1.1rem] truncate text-base leading-7 text-muted-foreground sm:text-[1.0625rem]"
                  >
                    {samplePrompts[promptIndex % samplePrompts.length]}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2">
                <button
                  type="button"
                  onClick={() => go(query, 'attach')}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-sm font-medium text-muted-foreground transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <Paperclip className="size-4" aria-hidden="true" />
                  {dictionary.composer?.attach || 'Attach data'}
                  <span className="hidden font-mono text-xs tracking-tight text-muted-foreground md:inline">
                    {ACCEPTED_FORMATS}
                  </span>
                </button>

                <div className="flex items-center gap-2.5">
                  <kbd
                    aria-hidden="true"
                    className={`hidden h-6 items-center rounded-md border border-border px-1.5 font-sans text-xs text-muted-foreground transition-opacity duration-200 sm:inline-flex ${hasText ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <CornerDownLeft className="size-3" />
                  </kbd>
                  <button
                    type="submit"
                    disabled={!hasText || pending !== null}
                    aria-label={dictionary.composer?.send || 'Send'}
                    className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-[background-color,color,transform,box-shadow] duration-150 ease-out hover:brightness-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                  >
                    {pending === 'composer' ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <ArrowUp className="size-[1.125rem]" strokeWidth={2.25} />
                    )}
                  </button>
                </div>
              </div>
            </form>

            {suggestions.length > 0 && (
              <ul className="-mx-4 mt-5 flex snap-x gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide [mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:[mask-image:none]">
                {suggestions.map(([key, text]) => {
                  const Icon = SUGGESTION_ICONS[key] ?? Dna;
                  return (
                    <li key={key} className="shrink-0 snap-start">
                      <button
                        type="button"
                        onClick={() => go(text, key)}
                        disabled={pending !== null}
                        className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-border/80 bg-background/70 px-3.5 text-sm text-muted-foreground backdrop-blur-sm transition-[color,border-color,background-color,transform] duration-150 ease-out hover:border-foreground/20 hover:bg-card hover:text-foreground active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60 touch-manipulation"
                      >
                        {pending === key ? (
                          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Icon
                            className="size-3.5 text-primary-ink"
                            aria-hidden="true"
                          />
                        )}
                        {text}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
