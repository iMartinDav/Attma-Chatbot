import type { AnalysisSnapshot } from './types';

interface MessageLike {
  parts?: ReadonlyArray<{ type?: string; data?: unknown }>;
}

function asSnapshot(value: unknown): AnalysisSnapshot | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  // A snapshot always carries its captured results and checklist slot, even before either is filled.
  if (!('results' in record) || !('checklist' in record)) return null;
  return value as AnalysisSnapshot;
}

// The newest snapshot wins because each run saves the full trust state again.
export function findLatestAnalysisSnapshot(
  messages: ReadonlyArray<MessageLike>,
): AnalysisSnapshot | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const parts = messages[index]?.parts ?? [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex--) {
      const part = parts[partIndex];
      if (part?.type !== 'data-analysis') continue;
      const data = part.data as Record<string, unknown> | null;
      if (data === null || typeof data !== 'object') continue;
      const nested = asSnapshot(data.snapshot);
      if (nested) return nested;
      const direct = asSnapshot(data);
      if (direct) return direct;
    }
  }
  return null;
}
