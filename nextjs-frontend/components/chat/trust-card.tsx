'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const DNA_BASES = ['A', 'G', 'C', 'T'];
const LETTER_COUNT = 28;
const STORAGE_KEY = 'attma-trust-card-dismissed';

const MESSAGES = [
  'Every number in a report is checked against a tool output.',
  'Muse Spark screens every request before any tool runs.',
  'A person approves the report before it counts.',
];

// A floating card like Grok's upgrade banner, with the landing banner's floating nucleotide letters instead of star particles.
export function TrustCard() {
  const [visible, setVisible] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    setVisible(window.localStorage.getItem(STORAGE_KEY) !== '1');
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(
      () => setMessageIndex((index) => (index + 1) % MESSAGES.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    window.localStorage.setItem(STORAGE_KEY, '1');
  };

  return (
    <aside
      aria-label="How Attma checks its work"
      className="fixed right-3 bottom-28 z-30 w-[min(88vw,320px)] overflow-hidden rounded-3xl border border-teal-500/25 bg-slate-950/95 shadow-[0_12px_32px_rgba(2,6,23,0.45)] backdrop-blur-sm sm:right-5 sm:bottom-5"
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_40%,rgba(45,212,191,0.16),transparent_42%),radial-gradient(circle_at_85%_60%,rgba(56,189,248,0.14),transparent_44%)]" />
        {Array.from({ length: LETTER_COUNT }, (_, i) => (
          <span
            key={i}
            className={cn(
              'absolute font-mono text-teal-300',
              i % 2 === 0 ? 'animate-dna-float' : 'animate-dna-float-delayed',
            )}
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 23) % 100}%`,
              fontSize: `${4 + (i % 4)}px`,
              opacity: 0.08 + (i % 3) * 0.05,
              animationDelay: `${(i * 0.08) % 5}s`,
              animationDuration: `${6 + (i % 6) * 0.5}s`,
            }}
          >
            {DNA_BASES[i % 4]}
          </span>
        ))}
      </div>

      <div className="relative flex items-start gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            Attma checks its own work
          </p>
          <p
            key={messageIndex}
            className="mt-0.5 text-[13px] text-slate-400"
            aria-live="polite"
          >
            {MESSAGES[messageIndex]}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss this card"
            className="-m-1 p-1 text-slate-400 transition-colors hover:text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
          <Link
            href="/console"
            className="rounded-full bg-white px-3.5 py-1 text-[13px] font-semibold text-slate-950 transition-colors hover:bg-teal-100"
          >
            Review
          </Link>
        </div>
      </div>
    </aside>
  );
}
