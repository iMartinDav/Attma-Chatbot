// The AI SDK ships ESM only, which this Jest setup cannot load, so its entry points are replaced with stubs.
jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: { object: (value: unknown) => value },
}));
jest.mock('@/lib/ai/providers', () => ({
  myProvider: { languageModel: () => 'spark-stub' },
}));

import { screenBiosecurity } from '../screen';

describe('screenBiosecurity', () => {
  it('maps an accept verdict', async () => {
    const verdict = await screenBiosecurity(
      { checkpoint: 'intake', text: 'test request' },
      async () => ({
        decision: 'accept',
        category: 'in_scope_research',
        rationale: 'Human genetics research.',
      }),
    );
    expect(verdict.decision).toBe('accept');
    expect(verdict.category).toBe('in_scope_research');
    expect(verdict.model).toBe('Muse Spark');
    expect(verdict.policyVersion).toBe('biosec-v1');
  });

  it('maps refuse and needs_context verdicts', async () => {
    const refused = await screenBiosecurity(
      { checkpoint: 'intake', text: 'test request' },
      async () => ({
        decision: 'refuse',
        category: 'harm_uplift',
        rationale: 'Out of scope.',
      }),
    );
    expect(refused.decision).toBe('refuse');
    const needsContext = await screenBiosecurity(
      { checkpoint: 'code', text: 'test request' },
      async () => ({
        decision: 'needs_context',
        category: 'dual_use_unclear',
        rationale: 'What is the research purpose?',
      }),
    );
    expect(needsContext.decision).toBe('needs_context');
    expect(needsContext.rationale).toMatch(/research purpose/);
  });

  it('retries once on error, then fails closed as unavailable', async () => {
    let calls = 0;
    const verdict = await screenBiosecurity(
      { checkpoint: 'intake', text: 'test request' },
      async () => {
        calls += 1;
        throw new Error('spark down');
      },
    );
    expect(calls).toBe(2);
    expect(verdict.decision).toBe('needs_context');
    expect(verdict.category).toBe('screen_unavailable');
    expect(verdict.rationale).toMatch(/unavailable; try again/);
  });

  it('caps the screened text at 20,000 chars', async () => {
    let seen = 0;
    await screenBiosecurity(
      { checkpoint: 'report', text: 'x'.repeat(25_000) },
      async (input) => {
        seen = input.text.length;
        return {
          decision: 'accept',
          category: 'in_scope_research',
          rationale: 'Fine.',
        };
      },
    );
    expect(seen).toBe(20_000);
  });
});
