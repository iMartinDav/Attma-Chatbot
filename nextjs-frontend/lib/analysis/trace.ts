import { createHash } from 'node:crypto';

// A trace answers which model ran which step at what cost, so a reviewed report can be audited step by step.
export interface StepTrace {
  step: number;
  tools: string[];
  model: string;
  promptHash: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export interface RunTrace {
  model: string;
  promptHash: string;
  durationMs: number;
  steps: StepTrace[];
}

export function promptHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

interface StepLike {
  toolCalls?: Array<{ toolName?: string }>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    inputTokenDetails?: { cacheReadTokens?: number };
  };
}

// Steps come from the AI SDK result, so this builder stays pure and testable without a live run.
export function buildTrace(
  steps: StepLike[],
  meta: { model: string; promptHash: string; durationMs: number },
): RunTrace {
  return {
    model: meta.model,
    promptHash: meta.promptHash,
    durationMs: meta.durationMs,
    steps: steps.map((step, index) => ({
      step: index + 1,
      tools: (step.toolCalls ?? [])
        .map((call) => call.toolName ?? 'unknown')
        .filter((name) => name !== ''),
      model: meta.model,
      promptHash: meta.promptHash,
      inputTokens: step.usage?.inputTokens ?? 0,
      outputTokens: step.usage?.outputTokens ?? 0,
      cachedTokens: step.usage?.inputTokenDetails?.cacheReadTokens ?? 0,
    })),
  };
}
