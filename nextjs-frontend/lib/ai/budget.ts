// A runaway loop stops on cost as well as steps, so one chat cannot burn the budget by reasoning forever.
export const RUN_TOKEN_BUDGET = 150_000;

export function budgetStopCondition({
  steps,
}: {
  steps: Array<{ usage?: { totalTokens?: number } }>;
}): boolean {
  const used = steps.reduce(
    (sum, step) => sum + (step.usage?.totalTokens ?? 0),
    0,
  );
  return used >= RUN_TOKEN_BUDGET;
}
