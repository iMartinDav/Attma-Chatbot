'use client';

import { ShieldCheck } from 'lucide-react';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import {
  PRIVACY_TYPE_LABELS,
  type PrivacySummary,
  restoreTokens,
} from '@/lib/privacy/tokens';

/**
 * The privacy guard replaces patient identifiers with tokens before any model
 * sees them. The real values come back to this browser only, in the
 * `data-privacy` part of each reply, and are put back for display here.
 */
const PrivacyValuesContext = createContext<Map<string, string>>(new Map());

type MessageLike = { parts?: Array<{ type: string; data?: unknown }> };

export function PrivacyProvider({
  messages,
  children,
}: {
  messages: MessageLike[];
  children: ReactNode;
}) {
  const values = useMemo(() => {
    const map = new Map<string, string>();
    for (const message of messages) {
      for (const part of message.parts ?? []) {
        if (part.type !== 'data-privacy') continue;
        for (const entry of (part.data as PrivacySummary).entries ?? []) {
          map.set(entry.token, entry.value);
        }
      }
    }
    return map;
  }, [messages]);
  return (
    <PrivacyValuesContext.Provider value={values}>
      {children}
    </PrivacyValuesContext.Provider>
  );
}

/** Text with the real values back in place of the tokens. */
export function useRestored(text: string): string {
  const values = useContext(PrivacyValuesContext);
  return useMemo(() => restoreTokens(text, values), [text, values]);
}

function describe(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([type, n]) => {
      const label = PRIVACY_TYPE_LABELS[type] ?? type.toLowerCase();
      return n > 1 ? `${n} ${label}s` : label;
    })
    .join(', ');
}

/** What was kept from the model in this reply: types and counts, never the values. */
export function PrivacyBadge({ summary }: { summary: PrivacySummary }) {
  const total = summary.entries.length;
  return (
    <div className="flex w-fit items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-xs text-muted-foreground">
      <ShieldCheck className="size-3.5 text-primary-ink" aria-hidden="true" />
      {total > 0 ? (
        <span>
          Privacy guard: {total} identifier{total > 1 ? 's' : ''} kept from the
          model ({describe(summary.counts)})
        </span>
      ) : (
        <span>Privacy guard: no identifiers found in text</span>
      )}
      {summary.unscannedFiles > 0 && (
        <span className="text-amber-700 dark:text-amber-300">
          · {summary.unscannedFiles} attachment
          {summary.unscannedFiles > 1 ? 's' : ''} sent unscanned
        </span>
      )}
    </div>
  );
}
