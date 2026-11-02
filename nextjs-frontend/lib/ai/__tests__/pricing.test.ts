import {
  estimateCostUsd,
  formatUsd,
  SPARK_PRICES,
  WONDER_PRICES,
} from '../pricing';

describe('estimateCostUsd', () => {
  it('bills uncached input, cached input and output at Wonder prices', () => {
    // 900k uncached at $4, 100k cached at $0.20, 50k output at $20.
    const cost = estimateCostUsd(
      {
        inputTokens: 1_000_000,
        cachedTokens: 100_000,
        outputTokens: 50_000,
      },
      WONDER_PRICES,
    );
    expect(cost).toBeCloseTo(3.6 + 0.02 + 1.0, 10);
  });

  it('does not bill reasoning twice and clamps cached above input', () => {
    const withoutReasoning = estimateCostUsd(
      { inputTokens: 1000, cachedTokens: 0, outputTokens: 1000 },
      SPARK_PRICES,
    );
    expect(withoutReasoning).toBeCloseTo(
      (1000 * 1.25 + 1000 * 4.25) / 1_000_000,
      12,
    );
    expect(
      estimateCostUsd(
        { inputTokens: 10, cachedTokens: 20, outputTokens: 0 },
        WONDER_PRICES,
      ),
    ).toBeCloseTo((20 * 0.2) / 1_000_000, 12);
    expect(
      estimateCostUsd(
        { inputTokens: 0, cachedTokens: 0, outputTokens: 0 },
        WONDER_PRICES,
      ),
    ).toBe(0);
  });

  it('keeps the eval prices', () => {
    expect(WONDER_PRICES).toEqual({
      inputPerMillion: 4.0,
      cachedPerMillion: 0.2,
      outputPerMillion: 20.0,
    });
    expect(SPARK_PRICES).toEqual({
      inputPerMillion: 1.25,
      cachedPerMillion: 0.15,
      outputPerMillion: 4.25,
    });
    expect(formatUsd(0.123456)).toBe('$0.1235');
  });
});
