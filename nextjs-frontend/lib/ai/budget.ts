import { estimateCostUsd, WONDER_PRICES } from './pricing';

// Cached input is billed far below fresh input on Muse, so the runaway guard measures estimated dollars, not raw tokens.
export const RUN_COST_BUDGET_USD = 1.5;

interface StepUsage {
  inputTokens?: number;
  outputTokens?: number;
  inputTokenDetails?: { cacheReadTokens?: number };
}

export function budgetStopCondition({
  steps,
}: {
  steps: Array<{ usage?: StepUsage }>;
}): boolean {
  const cost = steps.reduce(
    (sum, step) =>
      sum +
      estimateCostUsd(
        {
          inputTokens: step.usage?.inputTokens ?? 0,
          cachedTokens: step.usage?.inputTokenDetails?.cacheReadTokens ?? 0,
          outputTokens: step.usage?.outputTokens ?? 0,
        },
        WONDER_PRICES,
      ),
    0,
  );
  return cost >= RUN_COST_BUDGET_USD;
}
