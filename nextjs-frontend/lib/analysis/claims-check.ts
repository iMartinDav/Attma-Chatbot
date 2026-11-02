import { myProvider } from '@/lib/ai/providers';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import {
  buildClaimsCheckPrompt,
  CLAIMS_CHECK_INSTRUCTIONS,
} from './claims-prompt';
import type { ClaimsCheck } from './session';

export { buildClaimsCheckPrompt, CLAIMS_CHECK_INSTRUCTIONS };
export { TOOL_MEANINGS, toolMeaningFor } from './claims-prompt';

const verdictsSchema = z.object({
  results: z.array(
    z.object({
      itemId: z.string(),
      supported: z.boolean(),
      reason: z.string(),
    }),
  ),
});

// Muse Spark judges support only, because the numbers have already been checked in code.
export const claimsCheck: ClaimsCheck = async (findings) => {
  if (findings.length === 0) return [];
  const { output } = await generateText({
    model: myProvider.languageModel('subagent-model'),
    instructions: CLAIMS_CHECK_INSTRUCTIONS,
    prompt: buildClaimsCheckPrompt(findings),
    output: Output.object({ schema: verdictsSchema }),
    providerOptions: { openai: { reasoningEffort: 'low' } },
  });
  return output.results;
};
