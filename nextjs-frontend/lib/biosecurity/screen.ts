import 'server-only';

import { generateText, Output } from 'ai';
import { z } from 'zod';

import { myProvider } from '@/lib/ai/providers';
import {
  BIOSECURITY_CATEGORIES,
  BIOSECURITY_INSTRUCTIONS,
  BIOSECURITY_POLICY_VERSION,
  type BiosecurityCategory,
} from './policy';

export type BiosecurityCheckpoint = 'intake' | 'code' | 'report';
export type BiosecurityDecision = 'accept' | 'needs_context' | 'refuse';

export interface BiosecurityInput {
  checkpoint: BiosecurityCheckpoint;
  text: string;
  context?: string;
}

export interface BiosecurityVerdict {
  checkpoint: BiosecurityCheckpoint;
  decision: BiosecurityDecision;
  category: BiosecurityCategory | 'screen_unavailable';
  rationale: string;
  model: string;
  policyVersion: string;
  durationMs: number;
}

const verdictSchema = z.object({
  decision: z.enum(['accept', 'needs_context', 'refuse']),
  category: z.enum(BIOSECURITY_CATEGORIES),
  rationale: z.string().max(300),
});

export type BiosecurityGenerate = (
  input: BiosecurityInput,
) => Promise<z.infer<typeof verdictSchema> & { modelId?: string }>;

/**
 * The reviewer is Muse Spark, but while the Meta API refuses calls (billing),
 * providers.ts retries them on OpenAI. The badge names the model that
 * actually answered, so the trust UI never claims a check Spark did not run.
 */
export function reviewerLabel(modelId: string | undefined): string {
  if (!modelId || modelId.startsWith('muse-')) return 'Muse Spark';
  return `${modelId.replace(/-\d{4}-\d{2}-\d{2}$/, '')}, OpenAI fallback`;
}

// Spark judges the checkpoint from the policy text alone, so the screen stays independent of the main agent.
const defaultGenerate: BiosecurityGenerate = async (input) => {
  const { output, response } = await generateText({
    model: myProvider.languageModel('subagent-model'),
    instructions: BIOSECURITY_INSTRUCTIONS,
    prompt: `Checkpoint: ${input.checkpoint}\nContext: ${input.context?.slice(0, 2000) ?? '(none)'}\nText to screen:\n${input.text.slice(0, 20_000)}`,
    output: Output.object({ schema: verdictSchema }),
  });
  return { ...output, modelId: response.modelId };
};

// A failed screen fails closed as needs_context, because an unavailable check must never wave a request through or invent a refusal.
export async function screenBiosecurity(
  input: BiosecurityInput,
  generate: BiosecurityGenerate = defaultGenerate,
): Promise<BiosecurityVerdict> {
  const startedAt = Date.now();
  const capped: BiosecurityInput = {
    checkpoint: input.checkpoint,
    text: input.text.slice(0, 20_000),
    context: input.context?.slice(0, 2000),
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const verdict = await generate(capped);
      return {
        checkpoint: input.checkpoint,
        decision: verdict.decision,
        category: verdict.category,
        rationale: verdict.rationale.slice(0, 300),
        model: reviewerLabel(verdict.modelId),
        policyVersion: BIOSECURITY_POLICY_VERSION,
        durationMs: Date.now() - startedAt,
      };
    } catch {
      // One retry covers a transient Spark failure; the second failure falls through to the unavailable verdict.
    }
  }
  return {
    checkpoint: input.checkpoint,
    decision: 'needs_context',
    category: 'screen_unavailable',
    rationale: 'The biosecurity check is unavailable; try again.',
    model: 'Muse Spark',
    policyVersion: BIOSECURITY_POLICY_VERSION,
    durationMs: Date.now() - startedAt,
  };
}
