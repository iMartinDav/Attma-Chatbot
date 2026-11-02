/**
 * Meta Model API Standard prices, shared by the chat run summary and the
 * analysis eval so both report the same estimate.
 *
 * Reasoning is billed as output, so reasoning tokens are not added again on
 * top of the output total. Sub-agent and claims-check Spark calls are not in
 * the agent usage, so the estimate undercounts a full run.
 */

export interface TokenUsage {
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

export interface ModelPrices {
  inputPerMillion: number;
  cachedPerMillion: number;
  outputPerMillion: number;
}

export const WONDER_PRICES: ModelPrices = {
  inputPerMillion: 4.0,
  cachedPerMillion: 0.2,
  outputPerMillion: 20.0,
};

export const SPARK_PRICES: ModelPrices = {
  inputPerMillion: 1.25,
  cachedPerMillion: 0.15,
  outputPerMillion: 4.25,
};

export function estimateCostUsd(
  usage: Pick<TokenUsage, 'inputTokens' | 'cachedTokens' | 'outputTokens'>,
  prices: ModelPrices,
): number {
  const uncached = Math.max(0, usage.inputTokens - usage.cachedTokens);
  return (
    (uncached * prices.inputPerMillion +
      usage.cachedTokens * prices.cachedPerMillion +
      usage.outputTokens * prices.outputPerMillion) /
    1_000_000
  );
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}
