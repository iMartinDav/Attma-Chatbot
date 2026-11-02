'use client';

import { Rocket, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import {
  BANNER_DISMISSED_EVENT,
  useScrollState,
} from '@/hooks/use-scroll-state';
import type { Locale } from '@/lib/internationalization/config';

const DNA_BASES = ['A', 'G', 'C', 'T'];
const PARTICLE_COUNT = 120;

// The promo banner is the same chrome as attma.bio, so the two apps read as one product before a word is read.
export function PromoBanner({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: { label: string; text: string; dismiss: string };
}) {
  const [isVisible, setIsVisible] = useState(true);
  const { bannerHidden } = useScrollState();

  if (!isVisible) return null;

  const dismiss = () => {
    setIsVisible(false);
    window.dispatchEvent(new Event(BANNER_DISMISSED_EVENT));
  };

  return (
    <div
      className={`group fixed top-2 left-3 right-3 sm:left-5 sm:right-5 z-40 isolate flex items-center justify-between gap-x-4 overflow-hidden rounded-2xl border border-teal-500/25 bg-gradient-to-r from-slate-950 via-gray-950 to-slate-950 px-3 py-2 shadow-[0_12px_32px_rgba(2,6,23,0.45)] backdrop-blur-sm will-change-transform motion-reduce:transition-none transition-[transform,opacity] ${bannerHidden ? '-translate-y-[calc(100%+16px)] opacity-0 pointer-events-none duration-[320ms] ease-[cubic-bezier(0.3,0,0.2,1)]' : 'translate-y-0 opacity-100 duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]'}`}
    >
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_40%,rgba(45,212,191,0.16),transparent_42%),radial-gradient(circle_at_85%_60%,rgba(56,189,248,0.14),transparent_44%)]" />
        {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
          const base = DNA_BASES[i % 4];
          const color = ['text-teal-300', 'text-cyan-300'][i % 2];
          const isLeftEdge = i < 60;
          const left = isLeftEdge ? (i * 2.5) % 22 : 78 + ((i * 2.5) % 22);
          const verticalRandom = (i * 17) % 100;
          const top =
            verticalRandom > 50
              ? 65 + (verticalRandom % 35)
              : 8 + (verticalRandom % 57);
          const baseOpacity = top > 65 ? 10 + (i % 3) * 2 : 5 + (i % 3) * 2;
          const size = ['text-[4px]', 'text-[5px]', 'text-[5px]', 'text-[6px]'][
            i % 4
          ];
          const animation = ['animate-dna-float', 'animate-dna-float-delayed'][
            i % 2
          ];
          return (
            <span
              key={`${base}-${left.toFixed(1)}-${top}-${i}`}
              className={`absolute font-mono ${color}/${baseOpacity} ${size} ${animation} group-hover:font-bold group-hover:text-cyan-200 transition-all duration-300`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                animationDelay: `${(i * 0.08) % 5}s`,
                animationDuration: `${6 + (i % 6) * 0.5}s`,
              }}
            >
              {base}
            </span>
          );
        })}
      </div>

      <div className="flex-1" />
      <div className="min-w-0 shrink">
        <p className="truncate text-sm sm:text-base leading-6 text-slate-200/90 font-medium">
          <Link
            href="/chat"
            className="flex min-w-0 items-center gap-2 sm:gap-3 hover:text-cyan-200 transition-colors"
          >
            <Rocket className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-teal-500" />
            <span className="truncate">
              <strong className="font-semibold text-white">
                {dictionary.label}
              </strong>{' '}
              {dictionary.text}
            </span>
            <svg
              className="ml-1 sm:ml-2 h-4 w-4 flex-none text-teal-500 dark:text-teal-400 transition-transform duration-300 group-hover:translate-x-1"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </p>
      </div>
      <div className="flex-1 flex justify-end">
        <button
          type="button"
          className="-m-2 p-2 focus-visible:outline-offset-[-4px] transition-all duration-200 hover:scale-110 active:scale-95 text-slate-400 hover:text-white"
          onClick={dismiss}
        >
          <span className="sr-only">{dictionary.dismiss}</span>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
