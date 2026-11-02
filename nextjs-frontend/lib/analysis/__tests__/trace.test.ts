import { AnalysisSession } from '../session';
import { buildTrace, promptHash } from '../trace';
import type { ChecklistItem, Report } from '../types';

describe('run trace', () => {
  it('records model, prompt hash and tokens per step', () => {
    const trace = buildTrace(
      [
        {
          toolCalls: [{ toolName: 'setChecklist' }],
          usage: {
            inputTokens: 100,
            outputTokens: 20,
            inputTokenDetails: { cacheReadTokens: 10 },
          },
        },
        { toolCalls: [], usage: { inputTokens: 50, outputTokens: 5 } },
      ],
      { model: 'Muse Wonder', promptHash: 'abc123', durationMs: 1200 },
    );
    expect(trace.steps).toHaveLength(2);
    expect(trace.steps[0]).toMatchObject({
      step: 1,
      tools: ['setChecklist'],
      inputTokens: 100,
      cachedTokens: 10,
    });
    expect(trace.steps[1].tools).toEqual([]);
    expect(promptHash('same prompt')).toBe(promptHash('same prompt'));
    expect(promptHash('same prompt')).not.toBe(promptHash('other prompt'));
  });
});

const checklist: ChecklistItem[] = [
  {
    id: 'c1',
    question: 'Phenotype match?',
    kind: 'phenotype_match',
    evidenceNeeded: 'Score.',
  },
  {
    id: 'c2',
    question: 'Variant evidence?',
    kind: 'variant_evidence',
    evidenceNeeded: 'CADD.',
  },
  {
    id: 'c3',
    question: 'Counterevidence?',
    kind: 'counterevidence',
    evidenceNeeded: 'ClinVar.',
  },
  {
    id: 'c4',
    question: 'Literature?',
    kind: 'literature',
    evidenceNeeded: 'Papers.',
  },
];

function sessionWithFacts(): AnalysisSession {
  const session = new AnalysisSession();
  const ref = session.captureResult('prioritizeVariants', {
    variants: [{ gene: 'SCN1A', cadd: 27.43, phenotypeScore: 0.87 }],
  });
  session.setChecklist(checklist);
  session.recordFact({
    itemId: 'c1',
    ref,
    path: 'variants[0].phenotypeScore',
    value: 0.87,
  });
  session.recordFact({
    itemId: 'c2',
    ref,
    path: 'variants[0].cadd',
    value: 27.43,
  });
  session.recordFact({
    itemId: 'c3',
    ref,
    path: 'variants[0].gene',
    value: 'SCN1A',
  });
  session.runQc(['1-166848861-A-G']);
  return session;
}

describe('snapshot restore re-verification', () => {
  it('drops a fact whose value no longer matches the captured result', () => {
    const session = sessionWithFacts();
    const snapshot = session.toSnapshot();
    const facts = snapshot.facts as Array<{ value: unknown }>;
    facts[1].value = 99.9;
    const restored = AnalysisSession.fromHistory(snapshot);
    expect(restored.droppedOnRestore).toEqual(['f2']);
    expect(restored.facts.map((f) => f.id)).toEqual(['f1', 'f3']);
  });
});

describe('integer checks', () => {
  it('refuses a bare integer with no cited fact', async () => {
    const session = sessionWithFacts();
    const report: Report = {
      answer: 'The top variant fits the phenotype.',
      findings: [
        {
          itemId: 'c1',
          status: 'proven',
          text: 'Score is 0.87 across 42 cases.',
          factIds: ['f1'],
        },
        {
          itemId: 'c2',
          status: 'proven',
          text: 'CADD is 27.4.',
          factIds: ['f2'],
        },
        {
          itemId: 'c3',
          status: 'gap',
          text: 'Searched the result; no counterevidence.',
          factIds: ['f3'],
        },
        {
          itemId: 'c4',
          status: 'gap',
          text: 'No literature recorded.',
          factIds: [],
        },
      ],
      gaps: [],
    };
    const result = await session.submitReport(report);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.join(' ')).toMatch(/number 42 has no cited fact/);
    }
  });
});
