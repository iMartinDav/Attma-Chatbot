import { detectPhi, type PhiSpan, type PhiType } from './detect';
import {
  formatToken,
  type PrivacyEntry,
  type PrivacySummary,
  TOKEN_PATTERN,
} from './tokens';

export const DETECTION_METHOD = 'rules-v1';

/** Shorter values (initials, two-digit numbers) are too common to search for safely. */
const MIN_SEARCHABLE_LENGTH = 3;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(type: PhiType, value: string): string {
  switch (type) {
    case 'PERSON':
    case 'ADDRESS':
    case 'EMAIL':
      return value.toLowerCase().replace(/\s+/g, ' ').trim();
    case 'PHONE':
    case 'NATIONAL_ID':
    case 'IBAN':
    case 'MRN':
    case 'SAMPLE_ID':
    case 'INSURANCE_ID':
      return value.replace(/[\s-]/g, '').toUpperCase();
    default:
      return value.trim();
  }
}

/**
 * Reversible pseudonymization for one chat request: each identifier gets one
 * token, the same every time it appears, numbered in order of first
 * appearance. The history is replayed in the same order on every turn, so the
 * numbering is stable across turns without storing anything new.
 */
export class PrivacyVault {
  private readonly byKey = new Map<string, PrivacyEntry>();
  /** Name components (a surname said alone later) that point at a full name's token. */
  private readonly nameParts = new Map<string, string>();
  private readonly counters = new Map<string, number>();
  private readonly unscanned = new Set<string>();

  /** A file sent to a model as bytes; counted once, however many steps replay it. */
  noteUnscannedFile(key: string): void {
    this.unscanned.add(key);
  }

  get unscannedFiles(): number {
    return this.unscanned.size;
  }

  private tokenFor(type: PhiType, value: string): string {
    const key = `${type}:${normalize(type, value)}`;
    const existing = this.byKey.get(key);
    if (existing) return existing.token;

    if (type === 'PERSON' && !/\s/.test(value)) {
      const linked = this.nameParts.get(value.toLowerCase());
      if (linked) return linked;
    }

    const index = (this.counters.get(type) ?? 0) + 1;
    this.counters.set(type, index);
    const token = formatToken(type, index);
    this.byKey.set(key, { token, type, value });
    if (type === 'PERSON') {
      for (const part of value.split(/[\s,]+/)) {
        if (part.length >= MIN_SEARCHABLE_LENGTH) {
          this.nameParts.set(part.toLowerCase(), token);
        }
      }
    }
    return token;
  }

  /**
   * Replace identifiers in `text`. With `detect`, the rules look for new
   * identifiers; either way, every value the vault already holds is replaced,
   * so a name found in the question is also masked in a tool result.
   */
  mask(text: string, { detect = true }: { detect?: boolean } = {}): string {
    if (!text) return text;
    let output = text;
    if (detect) {
      const spans: PhiSpan[] = detectPhi(text);
      for (const span of [...spans].reverse()) {
        output =
          output.slice(0, span.start) +
          this.tokenFor(span.type, span.value) +
          output.slice(span.end);
      }
    }
    return this.maskKnown(output);
  }

  private knownValues(): Array<{
    value: string;
    token: string;
    caseSensitive: boolean;
  }> {
    const known: Array<{
      value: string;
      token: string;
      caseSensitive: boolean;
    }> = [];
    for (const entry of this.byKey.values()) {
      if (entry.value.length >= MIN_SEARCHABLE_LENGTH) {
        // Case-insensitive, like the outbound check, so a re-cased copy is masked rather than blocked.
        known.push({
          value: entry.value,
          token: entry.token,
          caseSensitive: false,
        });
      }
    }
    // A surname or given name alone, but only capitalised, so ordinary words stay.
    for (const [part, token] of this.nameParts) {
      known.push({ value: part, token, caseSensitive: false });
    }
    // Longest first, so "Maria Lopez" is replaced before "Lopez".
    return known.sort((a, b) => b.value.length - a.value.length);
  }

  private maskKnown(text: string): string {
    let output = text;
    for (const { value, token, caseSensitive } of this.knownValues()) {
      const isNamePart =
        !value.includes(' ') && this.nameParts.get(value) === token;
      const pattern = new RegExp(
        `(?<![\\p{L}\\d_])${escapeRegExp(value)}(?![\\p{L}\\d_])`,
        caseSensitive ? 'gu' : 'giu',
      );
      output = output.replace(pattern, (match) =>
        // A name part only counts when written as a name (capitalised).
        isNamePart && match[0] === match[0].toLowerCase() ? match : token,
      );
    }
    return output;
  }

  /** Values the vault holds that still appear in `text`: the outbound check. */
  leaks(text: string): PrivacyEntry[] {
    if (!text) return [];
    const withoutTokens = text.replace(TOKEN_PATTERN, ' ');
    return [...this.byKey.values()].filter((entry) => {
      if (entry.value.length < MIN_SEARCHABLE_LENGTH) return false;
      return new RegExp(
        `(?<![\\p{L}\\d_])${escapeRegExp(entry.value)}(?![\\p{L}\\d_])`,
        'iu',
      ).test(withoutTokens);
    });
  }

  /** Real values back in place of tokens, for tools that run inside Attma. */
  restore(text: string): string {
    const values = new Map(
      [...this.byKey.values()].map((e) => [e.token, e.value]),
    );
    return text.replace(TOKEN_PATTERN, (token) => values.get(token) ?? token);
  }

  restoreDeep<T>(value: T): T {
    if (typeof value === 'string') return this.restore(value) as T;
    if (Array.isArray(value))
      return value.map((item) => this.restoreDeep(item)) as T;
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.restoreDeep(item),
        ]),
      ) as T;
    }
    return value;
  }

  get size(): number {
    return this.byKey.size;
  }

  summary(): PrivacySummary {
    const entries = [...this.byKey.values()];
    const counts: Record<string, number> = {};
    for (const entry of entries)
      counts[entry.type] = (counts[entry.type] ?? 0) + 1;
    return {
      method: DETECTION_METHOD,
      entries,
      counts,
      unscannedFiles: this.unscannedFiles,
    };
  }
}
