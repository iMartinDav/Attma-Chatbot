// The AI SDK ships ESM only, which this Jest setup cannot load, so tool() is replaced by the definition it wraps.
jest.mock('ai', () => ({
  tool: (definition: unknown) => definition,
}));

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { withCapture } from '../capture';
import { findLatestAnalysisSnapshot } from '../history';
import { AnalysisSession, type ClaimsCheck } from '../session';
import { analysisStopCondition, analysisTools } from '../tools';
import type { ChecklistItem, Report } from '../types';

const checklist: ChecklistItem[] = [
  {
    id: 'c1',
    question: 'Does the top gene explain the phenotypes?',
    kind: 'phenotype_match',
    evidenceNeeded: 'Phenotype score for the top variant gene.',
  },
  {
    id: 'c2',
    question: 'Is the top variant predicted deleterious?',
    kind: 'variant_evidence',
    evidenceNeeded: 'CADD for the top variant.',
  },
  {
    id: 'c3',
    question: 'Is there counterevidence against the top variant?',
    kind: 'counterevidence',
    evidenceNeeded: 'Conflicting ClinVar or high frequency.',
  },
  {
    id: 'c4',
    question: 'Does the literature support the gene?',
    kind: 'literature',
    evidenceNeeded: 'Published evidence linking gene to phenotype.',
  },
];

const variantOutput = {
  variants: [{ gene: 'SCN1A', cadd: 27.43, phenotypeScore: 0.87 }],
};

function report(): Report {
  return {
    answer: 'The top variant is in SCN1A and fits the phenotype.',
    findings: [
      {
        itemId: 'c1',
        status: 'proven',
        text: 'SCN1A explains the phenotype with a score of 0.87.',
        factIds: ['f1'],
      },
      {
        itemId: 'c2',
        status: 'proven',
        text: 'The variant has CADD 27.4.',
        factIds: ['f2'],
      },
      {
        itemId: 'c3',
        status: 'gap',
        text: 'Searched the candidate result; no counterevidence was recorded.',
        factIds: ['f3'],
      },
      {
        itemId: 'c4',
        status: 'gap',
        text: 'No literature evidence was recorded.',
        factIds: [],
      },
    ],
    gaps: ['No literature evidence was recorded.'],
  };
}

type ToolExecutor = (input: unknown, options: unknown) => Promise<unknown>;

function executor(tools: ToolSet, name: string): ToolExecutor {
  const candidate = tools[name] as { execute?: unknown } | undefined;
  if (typeof candidate?.execute !== 'function') {
    throw new Error(`Tool ${name} has no execute function.`);
  }
  return candidate.execute as ToolExecutor;
}

async function runTool(
  tools: ToolSet,
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  const output: unknown = await executor(tools, name)(input, {
    toolCallId: 'test-call',
    messages: [],
  });
  return output as Record<string, unknown>;
}

function sessionWithFacts(): AnalysisSession {
  const session = new AnalysisSession();
  const ref = session.captureResult('prioritizeVariants', variantOutput);
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

const supported: ClaimsCheck = async (input) =>
  input.map((finding) => ({
    itemId: finding.itemId,
    supported: true,
    reason: 'supported',
  }));

describe('analysis tools', () => {
  it('submits a supported report and reports refusals left', async () => {
    const tools = analysisTools(sessionWithFacts(), {
      claimsCheck: supported,
    });
    const result = await runTool(tools, 'submitReport', report());
    expect(result.ok).toBe(true);
    expect(result.status).toBe('awaiting_review');
    expect(result.refusalsLeft).toBe(3);
  });

  it('refuses an unsupported claim with its reason', async () => {
    const tools = analysisTools(sessionWithFacts(), {
      claimsCheck: async () => [
        { itemId: 'c1', supported: false, reason: 'facts do not show this' },
        { itemId: 'c2', supported: true, reason: 'supported' },
      ],
    });
    const result = await runTool(tools, 'submitReport', report());
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(['Finding c1: facts do not show this']);
    expect(result.refusalsLeft).toBe(2);
  });

  it('refuses without counting when the claims check throws', async () => {
    const session = sessionWithFacts();
    const tools = analysisTools(session, {
      claimsCheck: async () => {
        throw new Error('network down');
      },
    });
    const result = await runTool(tools, 'submitReport', report());
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([
      'Claims check unavailable, submit again.',
    ]);
    expect(result.refusalsLeft).toBe(3);
    expect(session.refusals).toBe(0);
  });

  it('returns problems instead of throwing for a bad fact', async () => {
    const tools = analysisTools(sessionWithFacts());
    const result = await runTool(tools, 'recordFact', {
      itemId: 'c2',
      ref: 'r99',
      path: 'variants[0].cadd',
      value: 27.43,
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.problems)).toContain('r99');
  });

  it('sets a checklist and asks for one missing input', async () => {
    const session = new AnalysisSession();
    const tools = analysisTools(session);
    const listed = await runTool(tools, 'setChecklist', { items: checklist });
    expect(listed.ok).toBe(true);
    expect(listed.status).toBe('collecting');
    const asked = await runTool(tools, 'requestInput', {
      missing: 'no phenotypes provided',
    });
    expect(asked.ok).toBe(true);
    expect(asked.status).toBe('needs_input');
  });
});

describe('withCapture', () => {
  it('adds a ref, captures the result and leaves other tools alone', async () => {
    const session = new AnalysisSession();
    const tools: ToolSet = {
      prioritizeVariants: tool({
        description: 'fake evidence tool',
        inputSchema: z.object({}),
        execute: async () => variantOutput,
      }),
      runPython: tool({
        description: 'fake compute tool',
        inputSchema: z.object({}),
        execute: async () => ({ stdout: 'done' }),
      }),
    };
    const wrapped = withCapture(tools, session, ['prioritizeVariants']);
    const captured = (await executor(wrapped, 'prioritizeVariants')(
      {},
      { toolCallId: 'a', messages: [] },
    )) as Record<string, unknown>;
    expect(captured.ref).toBe('r1');
    expect(captured.variants).toEqual(variantOutput.variants);
    expect(session.getCapturedResult('r1')?.toolName).toBe(
      'prioritizeVariants',
    );
    expect(session.getResult('r1')).toEqual(variantOutput);
    const plain = (await executor(wrapped, 'runPython')(
      {},
      { toolCallId: 'b', messages: [] },
    )) as Record<string, unknown>;
    expect(plain).toEqual({ stdout: 'done' });
    expect(session.hasResult('r2')).toBe(false);
  });

  it('leaves non-object outputs untouched and uncaptured', async () => {
    const session = new AnalysisSession();
    const tools: ToolSet = {
      lookupGene: tool({
        description: 'fake text tool',
        inputSchema: z.object({}),
        execute: async () => 'plain text result',
      }),
    };
    const wrapped = withCapture(tools, session, ['lookupGene']);
    const output: unknown = await executor(wrapped, 'lookupGene')(
      {},
      { toolCallId: 'a', messages: [] },
    );
    expect(output).toBe('plain text result');
    expect(session.hasResult('r1')).toBe(false);
  });
});

describe('analysis stop condition', () => {
  function stepsWith(
    toolName: string,
    output: unknown,
  ): Parameters<typeof analysisStopCondition>[0]['steps'] {
    return [
      {
        toolResults: [{ toolName, output, type: 'tool-result' }],
      },
    ] as unknown as Parameters<typeof analysisStopCondition>[0]['steps'];
  }

  it('stops after awaiting_review, escalation and a granted input request', async () => {
    expect(
      await analysisStopCondition({
        steps: stepsWith('submitReport', {
          ok: true,
          status: 'awaiting_review',
        }),
      }),
    ).toBe(true);
    expect(
      await analysisStopCondition({
        steps: stepsWith('submitReport', {
          ok: false,
          status: 'escalated',
        }),
      }),
    ).toBe(true);
    expect(
      await analysisStopCondition({
        steps: stepsWith('requestInput', { ok: true, status: 'needs_input' }),
      }),
    ).toBe(true);
  });

  it('keeps going after refusals and ordinary steps', async () => {
    expect(
      await analysisStopCondition({
        steps: stepsWith('submitReport', {
          ok: false,
          status: 'collecting',
        }),
      }),
    ).toBe(false);
    expect(
      await analysisStopCondition({
        steps: stepsWith('prioritizeVariants', { variants: [] }),
      }),
    ).toBe(false);
    expect(await analysisStopCondition({ steps: [] })).toBe(false);
  });
});

describe('findLatestAnalysisSnapshot', () => {
  it('returns the newest snapshot and null when there is none', () => {
    const first = sessionWithFacts().toSnapshot();
    const secondSession = sessionWithFacts();
    secondSession.captureResult('rankDiagnoses', { diseases: [] });
    const second = secondSession.toSnapshot();
    const messages = [
      { parts: [{ type: 'data-analysis', data: { snapshot: first } }] },
      { parts: [{ type: 'text' }] },
      { parts: [{ type: 'data-analysis', data: { snapshot: second } }] },
    ];
    expect(findLatestAnalysisSnapshot(messages)).toEqual(second);
    expect(
      findLatestAnalysisSnapshot([{ parts: [{ type: 'text' }] }]),
    ).toBeNull();
    expect(findLatestAnalysisSnapshot([])).toBeNull();
  });

  it('restores a session whose facts still verify', () => {
    const snapshot = sessionWithFacts().toSnapshot();
    const restored = AnalysisSession.fromHistory(
      findLatestAnalysisSnapshot([
        { parts: [{ type: 'data-analysis', data: { snapshot } }] },
      ]),
    );
    expect(restored.facts).toHaveLength(3);
    expect(restored.getCapturedResult('r1')?.toolName).toBe(
      'prioritizeVariants',
    );
  });
});
