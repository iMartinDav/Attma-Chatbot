import type { ChecklistItem, Report } from '../types';
import { AnalysisSession, type ClaimsCheck } from '../session';

// This fixture mirrors the prioritizeVariants output shape from lib/rare-disease/rank.ts.
const variantOutput = {
  variants: [
    {
      rank: 1,
      input: '1-166848861-A-G',
      gene: 'SCN1A',
      consequence: 'missense_variant',
      hgvsc: 'NM_001165963.4:c.4573C>T',
      hgvsp: null,
      gnomadAf: 0.000012,
      clinvar: ['Pathogenic'],
      alphaMissense: { score: 0.92, class: 'likely_pathogenic' },
      cadd: 27.43,
      variantScore: 0.92,
      phenotypeScore: 0.87,
      combinedScore: 0.895,
      reasons: ['AlphaMissense 0.920 (likely pathogenic)'],
    },
    {
      rank: 2,
      input: '2-100000-A-T',
      gene: 'DECOY',
      consequence: 'missense_variant',
      hgvsc: null,
      hgvsp: null,
      gnomadAf: 0.032,
      clinvar: ['Benign'],
      alphaMissense: { score: 0.21, class: 'likely_benign' },
      cadd: 12.5,
      variantScore: 0.1,
      phenotypeScore: 0.1,
      combinedScore: 0.2,
      reasons: ['ClinVar: Benign'],
    },
    {
      rank: 3,
      input: '3-200000-C-G',
      gene: 'OTHER',
      consequence: 'missense_variant',
      hgvsc: null,
      hgvsp: null,
      gnomadAf: 0.00004,
      clinvar: ['Conflicting_interpretations_of_pathogenicity'],
      alphaMissense: { score: 0.55, class: 'ambiguous' },
      cadd: 31.2,
      variantScore: 0.55,
      phenotypeScore: 0.3,
      combinedScore: 0.41,
      reasons: ['ClinVar conflicting'],
    },
  ],
  notAnnotated: [] as string[],
  elapsedMs: 42,
};

const validChecklist: ChecklistItem[] = [
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
    evidenceNeeded: 'CADD and gnomAD frequency for the top variant.',
  },
  {
    id: 'c3',
    question: 'Is there counterevidence against the top variant?',
    kind: 'counterevidence',
    evidenceNeeded: 'Conflicting ClinVar, high frequency or benign calls.',
  },
  {
    id: 'c4',
    question: 'Does the literature support the gene?',
    kind: 'literature',
    evidenceNeeded: 'Published evidence linking gene to phenotype.',
  },
];

function validReport(): Report {
  return {
    answer:
      'The top variant is in SCN1A and fits the phenotype. Counterevidence was checked and does not overturn it.',
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
        text: 'The variant has CADD 27.4 and gnomAD frequency 1.2e-5.',
        factIds: ['f2', 'f3'],
      },
      {
        itemId: 'c3',
        status: 'proven',
        text: 'A decoy variant is common at 3.2% in gnomAD, so it is counterevidence for that decoy only.',
        factIds: ['f4'],
      },
      {
        itemId: 'c4',
        status: 'gap',
        text: 'No literature evidence was recorded for this item.',
        factIds: [],
      },
    ],
    gaps: ['No literature evidence was recorded.'],
  };
}

function sessionWithFacts(): AnalysisSession {
  const session = new AnalysisSession();
  const ref = session.captureResult('prioritizeVariants', variantOutput);
  expect(ref).toBe('r1');
  expect(session.setChecklist(validChecklist).ok).toBe(true);
  const facts = [
    { itemId: 'c1', ref, path: 'variants[0].phenotypeScore', value: 0.87 },
    { itemId: 'c2', ref, path: 'variants[0].cadd', value: 27.43 },
    { itemId: 'c2', ref, path: 'variants[0].gnomadAf', value: 0.000012 },
    { itemId: 'c3', ref, path: 'variants[1].gnomadAf', value: 0.032 },
  ];
  for (const fact of facts) {
    const result = session.recordFact(fact);
    if (!result.ok) throw new Error(result.problems.join(' '));
  }
  // The report fixture cites f1 to f4, which the auto ids must match.
  expect(session.facts.map((f) => f.id)).toEqual(['f1', 'f2', 'f3', 'f4']);
  session.runQc(['1-166848861-A-G', '2-100000-A-T', '3-200000-C-G']);
  return session;
}

describe('checklist verification', () => {
  it('refuses a checklist without a counterevidence item', () => {
    const session = new AnalysisSession();
    const items = validChecklist.map((item) =>
      item.id === 'c3' ? { ...item, kind: 'other' as const } : item,
    );
    const result = session.setChecklist(items);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.join(' ')).toMatch(/counterevidence/i);
    }
  });

  it('accepts a valid checklist', () => {
    const session = new AnalysisSession();
    expect(session.setChecklist(validChecklist)).toEqual({
      ok: true,
      checklist: validChecklist,
      droppedFacts: [],
    });
  });

  it('refuses a checklist with 9 items', () => {
    const session = new AnalysisSession();
    const items = [
      ...validChecklist,
      ...[5, 6, 7, 8, 9].map((n) => ({
        id: `c${n}`,
        question: `Extra question ${n}?`,
        kind: 'other' as const,
        evidenceNeeded: 'Extra evidence.',
      })),
    ];
    const result = session.setChecklist(items);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.problems.join(' ')).toMatch(/4 to 8|at most 8/i);
  });

  it('refuses a checklist without a phenotype_match item', () => {
    const session = new AnalysisSession();
    const items = validChecklist.map((item) =>
      item.id === 'c1' ? { ...item, kind: 'other' as const } : item,
    );
    expect(session.setChecklist(items).ok).toBe(false);
  });
});

describe('fact verification', () => {
  it('refuses a fact whose value differs, naming path and both values', () => {
    const session = new AnalysisSession();
    const ref = session.captureResult('prioritizeVariants', variantOutput);
    session.setChecklist(validChecklist);
    const result = session.recordFact({
      itemId: 'c2',
      ref,
      path: 'variants[0].cadd',
      value: 28.1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const text = result.problems.join(' ');
      expect(text).toContain('variants[0].cadd');
      expect(text).toContain('27.43');
      expect(text).toContain('28.1');
    }
  });

  it('accepts a correct fact and normalises string values', () => {
    const session = new AnalysisSession();
    const ref = session.captureResult('prioritizeVariants', variantOutput);
    session.setChecklist(validChecklist);
    expect(
      session.recordFact({
        itemId: 'c1',
        ref,
        path: 'variants[0].gene',
        value: ' scn1a ',
      }).ok,
    ).toBe(true);
    expect(
      session.recordFact({
        itemId: 'c2',
        ref,
        path: 'variants[0].cadd',
        value: '27.43',
      }).ok,
    ).toBe(true);
  });

  it('allows 4 facts on one item and refuses a 5th', () => {
    const session = new AnalysisSession();
    const ref = session.captureResult('prioritizeVariants', variantOutput);
    session.setChecklist(validChecklist);
    const entries = [
      { path: 'variants[0].cadd', value: 27.43 },
      { path: 'variants[0].gnomadAf', value: 0.000012 },
      { path: 'variants[0].variantScore', value: 0.92 },
      { path: 'variants[0].combinedScore', value: 0.895 },
    ];
    for (const entry of entries) {
      expect(session.recordFact({ itemId: 'c2', ref, ...entry }).ok).toBe(true);
    }
    const result = session.recordFact({
      itemId: 'c2',
      ref,
      path: 'variants[0].gene',
      value: 'SCN1A',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toMatch(/4 facts/);
  });

  it('refuses a fact for an unknown ref', () => {
    const session = new AnalysisSession();
    session.captureResult('prioritizeVariants', variantOutput);
    session.setChecklist(validChecklist);
    const result = session.recordFact({
      itemId: 'c2',
      ref: 'r99',
      path: 'variants[0].cadd',
      value: 27.43,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toContain('r99');
  });

  it('refuses a fact for an unknown checklist item', () => {
    const session = new AnalysisSession();
    const ref = session.captureResult('prioritizeVariants', variantOutput);
    session.setChecklist(validChecklist);
    expect(
      session.recordFact({
        itemId: 'c99',
        ref,
        path: 'variants[0].cadd',
        value: 27.43,
      }).ok,
    ).toBe(false);
  });
});

describe('report verification', () => {
  it('accepts a correct report and moves to awaiting_review', async () => {
    const session = sessionWithFacts();
    const result = await session.submitReport(validReport());
    expect(result).toEqual({ ok: true, report: validReport() });
    expect(session.status).toBe('awaiting_review');
  });

  it('refuses a tampered report, naming the item and the number', async () => {
    const session = sessionWithFacts();
    const report = validReport();
    report.findings[1] = {
      ...report.findings[1],
      text: 'The variant has CADD 28.1 and gnomAD frequency 1.2e-5.',
    };
    const result = await session.submitReport(report);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const text = result.problems.join(' ');
      expect(text).toContain('c2');
      expect(text).toContain('28.1');
    }
    expect(session.status).not.toBe('awaiting_review');
  });

  it('refuses a report missing the counterevidence finding', async () => {
    const session = sessionWithFacts();
    const report = validReport();
    report.findings = report.findings.filter((f) => f.itemId !== 'c3');
    const result = await session.submitReport(report);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toContain('c3');
  });

  it('refuses a proven finding citing a fact from another item', async () => {
    const session = sessionWithFacts();
    const report = validReport();
    report.findings[0] = { ...report.findings[0], factIds: ['f2'] };
    const result = await session.submitReport(report);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const text = result.problems.join(' ');
      expect(text).toContain('f2');
      expect(text).toContain('c1');
    }
  });

  it('does not check integers without a decimal point, percent or exponent', async () => {
    const session = sessionWithFacts();
    const report = validReport();
    report.findings[3] = {
      ...report.findings[3],
      text: 'No literature was recorded across 3 databases.',
    };
    await expect(session.submitReport(report)).resolves.toMatchObject({
      ok: true,
    });
  });

  it('refuses a report while an input request is open', async () => {
    const session = sessionWithFacts();
    expect(session.requestInput('no phenotypes provided').ok).toBe(true);
    expect(session.status).toBe('needs_input');
    await expect(session.submitReport(validReport())).resolves.toMatchObject({
      ok: false,
    });
  });

  it('escalates after 3 refused reports', async () => {
    const session = sessionWithFacts();
    const report = validReport();
    report.findings[1] = {
      ...report.findings[1],
      text: 'The variant has CADD 28.1 and gnomAD frequency 1.2e-5.',
    };
    for (let i = 0; i < 3; i++) {
      await expect(session.submitReport(report)).resolves.toMatchObject({
        ok: false,
      });
    }
    expect(session.refusals).toBe(3);
    expect(session.status).toBe('escalated');
  });
});

describe('answer and gaps numbers', () => {
  it('refuses a wrong number in the answer', async () => {
    const session = sessionWithFacts();
    const report = validReport();
    report.answer = 'The top variant has CADD 28.1 and fits the phenotype.';
    const result = await session.submitReport(report);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toContain('28.1');
  });

  it('refuses a wrong number in a gap', async () => {
    const session = sessionWithFacts();
    const report = validReport();
    report.gaps = ['Literature with CADD 28.1 was not checked.'];
    const result = await session.submitReport(report);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toContain('28.1');
  });
});

describe('checklist replacement', () => {
  it('drops facts whose item left the checklist and says so', () => {
    const session = sessionWithFacts();
    const replacement: ChecklistItem[] = [
      validChecklist[0],
      validChecklist[1],
      validChecklist[2],
      {
        id: 'c5',
        question: 'Is there a second candidate gene?',
        kind: 'other',
        evidenceNeeded: 'Ranking for the second gene.',
      },
    ];
    const result = session.setChecklist(replacement);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.droppedFacts).toEqual([]);
    expect(session.facts.map((fact) => fact.id)).toEqual([
      'f1',
      'f2',
      'f3',
      'f4',
    ]);
    const withLiteratureFact = sessionWithFacts();
    const ref = 'r1';
    expect(
      withLiteratureFact.recordFact({
        itemId: 'c4',
        ref,
        path: 'variants[0].gene',
        value: 'SCN1A',
      }).ok,
    ).toBe(true);
    const dropped = withLiteratureFact.setChecklist(replacement);
    expect(dropped.ok).toBe(true);
    if (dropped.ok) expect(dropped.droppedFacts).toEqual(['f5']);
    expect(withLiteratureFact.facts.some((fact) => fact.itemId === 'c4')).toBe(
      false,
    );
  });
});

describe('escalation and claims check', () => {
  it('refuses submits after escalation without counting them', async () => {
    const session = sessionWithFacts();
    const report = validReport();
    report.findings[1] = {
      ...report.findings[1],
      text: 'The variant has CADD 28.1 and gnomAD frequency 1.2e-5.',
    };
    for (let i = 0; i < 3; i++) await session.submitReport(report);
    expect(session.status).toBe('escalated');
    const result = await session.submitReport(validReport());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toEqual([
        'This analysis is escalated to a person; wait for their reply.',
      ]);
    }
    expect(session.refusals).toBe(3);
  });

  it('passes when the claims check supports every finding', async () => {
    const session = sessionWithFacts();
    const result = await session.submitReport(validReport(), async (input) =>
      input.map((finding) => ({
        itemId: finding.itemId,
        supported: true,
        reason: 'supported',
      })),
    );
    expect(result.ok).toBe(true);
    expect(session.status).toBe('awaiting_review');
  });

  it('refuses an unsupported claim and counts the refusal', async () => {
    const session = sessionWithFacts();
    const result = await session.submitReport(validReport(), async () => [
      { itemId: 'c1', supported: false, reason: 'facts do not show this' },
      { itemId: 'c2', supported: true, reason: 'supported' },
      { itemId: 'c3', supported: true, reason: 'supported' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toEqual(['Finding c1: facts do not show this']);
    }
    expect(session.refusals).toBe(1);
  });

  it('does not count a claims check network failure', async () => {
    const session = sessionWithFacts();
    const result = await session.submitReport(validReport(), async () => {
      throw new Error('network down');
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toEqual([
        'Claims check unavailable, submit again.',
      ]);
    }
    expect(session.refusals).toBe(0);
    expect(session.status).toBe('collecting');
  });

  it('sends only proven findings with their question and cited facts', async () => {
    const session = sessionWithFacts();
    const seenBox: { value: Parameters<ClaimsCheck>[0] | null } = {
      value: null,
    };
    const check: ClaimsCheck = async (input) => {
      seenBox.value = input;
      return input.map((finding) => ({
        itemId: finding.itemId,
        supported: true,
        reason: 'supported',
      }));
    };
    await session.submitReport(validReport(), check);
    const seen = seenBox.value;
    expect(seen?.map((finding) => finding.itemId)).toEqual(['c1', 'c2', 'c3']);
    expect(seen?.[0]?.question).toBe(validChecklist[0]?.question);
    expect(seen?.[1]?.facts).toEqual([
      {
        path: 'variants[0].cadd',
        value: 27.43,
        toolName: 'prioritizeVariants',
        toolMeaning: 'variants ranked by VEP evidence without phenotypes',
      },
      {
        path: 'variants[0].gnomadAf',
        value: 0.000012,
        toolName: 'prioritizeVariants',
        toolMeaning: 'variants ranked by VEP evidence without phenotypes',
      },
    ]);
  });
});

describe('report biosecurity screen', () => {
  it('submits when the screen accepts', async () => {
    const session = sessionWithFacts();
    const result = await session.submitReport(
      validReport(),
      undefined,
      async () => ({
        decision: 'accept',
        category: 'in_scope_research',
      }),
    );
    expect(result.ok).toBe(true);
    expect(session.status).toBe('awaiting_review');
  });

  it('refuses with the readable label and counts the refusal', async () => {
    const session = sessionWithFacts();
    const result = await session.submitReport(
      validReport(),
      undefined,
      async () => ({
        decision: 'refuse',
        category: 'other_out_of_scope',
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toEqual([
        'Blocked by the biosecurity check: Out of scope.',
      ]);
    }
    expect(session.refusals).toBe(1);
  });
});

describe('reopen', () => {
  function badReport(): Report {
    const report = validReport();
    report.findings[1] = {
      ...report.findings[1],
      text: 'The variant has CADD 28.1 and gnomAD frequency 1.2e-5.',
    };
    return report;
  }

  function expectPreserved(session: AnalysisSession) {
    expect(session.checklist).toEqual(validChecklist);
    expect(session.facts.map((fact) => fact.id)).toEqual([
      'f1',
      'f2',
      'f3',
      'f4',
    ]);
    expect(session.getResult('r1')).toEqual(variantOutput);
    expect(session.hasResult('r1')).toBe(true);
  }

  it('reopens from collecting and resets the refusal count', async () => {
    const session = sessionWithFacts();
    await session.submitReport(badReport());
    expect(session.status).toBe('collecting');
    expect(session.refusals).toBe(1);
    expect(session.report).toBeNull();
    expect(session.reopen()).toEqual({ ok: true });
    expect(session.status).toBe('collecting');
    expect(session.refusals).toBe(0);
    expect(session.openInputRequest).toBeNull();
    expect(session.report).toBeNull();
    expectPreserved(session);
  });

  it('reopens from needs_input, clearing the open request', async () => {
    const session = sessionWithFacts();
    await session.submitReport(badReport());
    expect(session.requestInput('no phenotypes provided').ok).toBe(true);
    expect(session.status).toBe('needs_input');
    expect(session.openInputRequest?.question).toBe('no phenotypes provided');
    expect(session.reopen()).toEqual({ ok: true });
    expect(session.status).toBe('collecting');
    expect(session.refusals).toBe(0);
    expect(session.openInputRequest).toBeNull();
    expect(session.report).toBeNull();
    expectPreserved(session);
  });

  it('reopens from awaiting_review and keeps the last report', async () => {
    const session = sessionWithFacts();
    await session.submitReport(badReport());
    const submitted = await session.submitReport(validReport());
    expect(submitted.ok).toBe(true);
    expect(session.status).toBe('awaiting_review');
    expect(session.refusals).toBe(1);
    expect(session.reopen()).toEqual({ ok: true });
    expect(session.status).toBe('collecting');
    expect(session.refusals).toBe(0);
    expect(session.openInputRequest).toBeNull();
    expect(session.report).toEqual(validReport());
    expectPreserved(session);
  });

  it('reopens from escalated and keeps the last report', async () => {
    const session = sessionWithFacts();
    await session.submitReport(validReport());
    expect(session.status).toBe('awaiting_review');
    session.reopen();
    for (let i = 0; i < 3; i++) await session.submitReport(badReport());
    expect(session.status).toBe('escalated');
    expect(session.refusals).toBe(3);
    expect(session.reopen()).toEqual({ ok: true });
    expect(session.status).toBe('collecting');
    expect(session.refusals).toBe(0);
    expect(session.openInputRequest).toBeNull();
    expect(session.report).toEqual(validReport());
    expectPreserved(session);
  });
});

describe('approve', () => {
  it('approves only from awaiting_review and keeps the report', async () => {
    const session = sessionWithFacts();
    await session.submitReport(validReport());
    expect(session.status).toBe('awaiting_review');
    expect(session.approve()).toEqual({ ok: true });
    expect(session.status).toBe('approved');
    expect(session.report).toEqual(validReport());
    expect(session.checklist).toEqual(validChecklist);
  });

  it('refuses from collecting without changing state', () => {
    const session = sessionWithFacts();
    const result = session.approve();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toEqual([
        'Only a report awaiting review can be approved.',
      ]);
    }
    expect(session.status).toBe('collecting');
    expect(session.refusals).toBe(0);
  });

  it('refuses a second approval and after escalation', async () => {
    const session = sessionWithFacts();
    await session.submitReport(validReport());
    expect(session.approve()).toEqual({ ok: true });
    expect(session.approve().ok).toBe(false);
    expect(session.status).toBe('approved');

    const escalated = sessionWithFacts();
    const bad = validReport();
    bad.findings[1] = {
      ...bad.findings[1],
      text: 'The variant has CADD 28.1 and gnomAD frequency 1.2e-5.',
    };
    for (let i = 0; i < 3; i++) await escalated.submitReport(bad);
    expect(escalated.status).toBe('escalated');
    expect(escalated.approve().ok).toBe(false);
    expect(escalated.status).toBe('escalated');
  });

  it('survives a snapshot round-trip', async () => {
    const session = sessionWithFacts();
    await session.submitReport(validReport());
    session.approve();
    const restored = AnalysisSession.fromHistory(session.toSnapshot());
    expect(restored.status).toBe('approved');
    expect(restored.report).toEqual(validReport());
  });
});

describe('snapshot round-trip', () => {
  it('preserves everything and new refs continue numbering', () => {
    const session = sessionWithFacts();
    session.captureResult('rankDiagnoses', {
      diseases: [{ name: 'Dravet syndrome' }],
    });
    const snapshot = session.toSnapshot();
    const restored = AnalysisSession.fromHistory(snapshot);
    expect(restored.toSnapshot()).toEqual(snapshot);
    expect(restored.getCapturedResult('r1')?.toolName).toBe(
      'prioritizeVariants',
    );
    expect(restored.getCapturedResult('r2')?.toolName).toBe('rankDiagnoses');
    expect(snapshot.results.r1).toEqual({
      toolName: 'prioritizeVariants',
      output: variantOutput,
    });
    expect(restored.getResult('r1')).toEqual(variantOutput);
    expect(restored.captureResult('prioritizeVariants', variantOutput)).toBe(
      'r3',
    );
    const fact = restored.recordFact({
      itemId: 'c4',
      ref: 'r2',
      path: 'diseases[0].name',
      value: 'Dravet syndrome',
    });
    expect(fact.ok).toBe(true);
    if (fact.ok) expect(fact.fact.id).toBe('f5');
  });
});

describe('claims verdict coverage', () => {
  it('refuses when a proven finding has no verdict', async () => {
    const session = sessionWithFacts();
    const result = await session.submitReport(validReport(), async () => [
      { itemId: 'c1', supported: true, reason: 'supported' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.join(' ')).toMatch(/c2.*no verdict/);
      expect(result.problems.join(' ')).toMatch(/c3.*no verdict/);
    }
    expect(session.status).toBe('collecting');
  });
});

describe('counterevidence evidence', () => {
  it('refuses a counterevidence gap with no cited fact', async () => {
    const session = sessionWithFacts();
    const report = validReport();
    report.findings[2] = {
      itemId: 'c3',
      status: 'gap',
      text: 'No counterevidence was recorded.',
      factIds: [],
    };
    const result = await session.submitReport(report);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.join(' ')).toMatch(
        /counterevidence needs a cited fact/,
      );
    }
  });

  it('accepts a counterevidence gap that cites the searched result', async () => {
    const session = sessionWithFacts();
    const report = validReport();
    report.findings[2] = {
      itemId: 'c3',
      status: 'gap',
      text: 'The searched decoy result was cited and no conflicting call overturns the top variant.',
      factIds: ['f4'],
    };
    expect((await session.submitReport(report)).ok).toBe(true);
  });
});

describe('approved is frozen', () => {
  it('refuses to reopen an approved session', async () => {
    const session = sessionWithFacts();
    await session.submitReport(validReport());
    session.approve();
    const result = session.reopen();
    expect(result.ok).toBe(false);
    expect(session.status).toBe('approved');
    expect(session.report).toEqual(validReport());
  });
});

describe('variant input QC', () => {
  it('passes GRCh38 coordinates and warns on identifiers only', () => {
    const session = new AnalysisSession();
    expect(session.runQc(['17-43045712-A-G', '1-166848861-A-G']).status).toBe(
      'pass',
    );
    expect(session.runQc(['rs1801133']).status).toBe('warn');
  });

  it('fails empty, oversized and malformed lists', () => {
    const session = new AnalysisSession();
    expect(session.runQc([]).status).toBe('fail');
    expect(
      session.runQc(Array.from({ length: 201 }, (_, i) => `1-${1000 + i}-A-G`))
        .status,
    ).toBe('fail');
    expect(session.runQc(['not a variant!!']).status).toBe('fail');
    expect(session.runQc(['99-100-A-G']).status).toBe('fail');
  });

  it('blocks submit after a QC fail until a corrected list passes', async () => {
    const session = sessionWithFacts();
    session.runQc(['not a variant!!']);
    const blocked = await session.submitReport(validReport());
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.problems.join(' ')).toMatch(/Input QC failed/);
    }
    session.runQc(['1-166848861-A-G']);
    expect((await session.submitReport(validReport())).ok).toBe(true);
  });
});

describe('QC enforcement', () => {
  // Mirrors the rankDiagnoses tool output when only phenotypes were given: no variantRanking at all.
  const phenotypeOnlyOutput = {
    phenotypes: [{ id: 'HP:0002373', label: 'Febrile seizures' }],
    unresolved: [] as string[],
    diseases: [
      {
        rank: 1,
        id: 'OMIM:607208',
        name: 'Dravet syndrome',
        score: 0.91,
        genes: ['SCN1A'],
        url: 'https://omim.org/entry/607208',
      },
    ],
    genes: [
      { symbol: 'SCN1A', phenotypeScore: 0.91, diseases: ['Dravet syndrome'] },
    ],
    hpoVersion: 'test',
    elapsedMs: 5,
    variantRanking: undefined,
  };

  function phenotypeReport(): Report {
    return {
      answer: 'Dravet syndrome fits the phenotypes.',
      findings: [
        {
          itemId: 'c1',
          status: 'proven',
          text: 'Dravet syndrome scores 0.91 for the phenotypes.',
          factIds: ['f1'],
        },
        {
          itemId: 'c2',
          status: 'proven',
          text: 'SCN1A has a phenotype score of 0.91.',
          factIds: ['f2'],
        },
        {
          itemId: 'c3',
          status: 'proven',
          text: 'SCN1A is linked to Dravet syndrome and no conflicting disease fact was recorded.',
          factIds: ['f3'],
        },
        {
          itemId: 'c4',
          status: 'gap',
          text: 'No literature evidence was recorded for this item.',
          factIds: [],
        },
      ],
      gaps: ['No literature evidence was recorded.'],
    };
  }

  function phenotypeOnlySession(): AnalysisSession {
    const session = new AnalysisSession();
    const ref = session.captureResult('rankDiagnoses', phenotypeOnlyOutput);
    expect(session.setChecklist(validChecklist).ok).toBe(true);
    const facts = [
      { itemId: 'c1', ref, path: 'diseases[0].score', value: 0.91 },
      { itemId: 'c2', ref, path: 'genes[0].phenotypeScore', value: 0.91 },
      { itemId: 'c3', ref, path: 'genes[0].symbol', value: 'SCN1A' },
    ];
    for (const fact of facts) {
      const result = session.recordFact(fact);
      if (!result.ok) throw new Error(result.problems.join(' '));
    }
    return session;
  }

  it('submits a phenotype-only rankDiagnoses report without QC', async () => {
    const session = phenotypeOnlySession();
    const result = await session.submitReport(phenotypeReport());
    expect(result.ok).toBe(true);
    expect(session.status).toBe('awaiting_review');
    expect(session.refusals).toBe(0);
  });

  it('still refuses rankDiagnoses with a real variantRanking and no QC', async () => {
    const session = phenotypeOnlySession();
    session.captureResult('rankDiagnoses', {
      ...phenotypeOnlyOutput,
      variantRanking: variantOutput,
    });
    const result = await session.submitReport(phenotypeReport());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.join(' ')).toMatch(/checkVariantInput/);
    }
  });

  it('refuses a submit when variants were ranked but QC never ran', async () => {
    const session = new AnalysisSession();
    const ref = session.captureResult('prioritizeVariants', variantOutput);
    session.setChecklist([
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
    ]);
    void ref;
    const result = await session.submitReport(validReport());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.join(' ')).toMatch(/checkVariantInput/);
    }
  });

  it('refuses when annotation covered none of the variants', async () => {
    const session = sessionWithFacts();
    session.captureResult('prioritizeVariants', {
      variants: [],
      notAnnotated: ['1-166848861-A-G'],
    });
    const result = await session.submitReport(validReport());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.join(' ')).toMatch(/Annotation coverage failed/);
    }
  });

  it('fails free text as an identifier and deduplicates the list', () => {
    const session = new AnalysisSession();
    expect(session.runQc(['foo:bar']).status).toBe('fail');
    expect(session.runQc(['hello.world']).status).toBe('fail');
    const deduped = session.runQc(['1-100-A-G', '1-100-A-G', '1-100-a-g']);
    expect(deduped.total).toBe(1);
    expect(deduped.status).toBe('pass');
    expect(session.runQc(['ENSP00000501589.1:p.Arg1648His']).status).toBe(
      'warn',
    );
    expect(session.runQc(['NM_000546.6:c.215C>G']).status).toBe('warn');
  });
});

describe('phenotype-only ranking needs no variant QC', () => {
  it('submits a disease-ranking report without checkVariantInput', async () => {
    const session = new AnalysisSession();
    const ref = session.captureResult('rankDiagnoses', {
      diseases: [{ name: 'Dravet syndrome', score: 0.9849 }],
    });
    session.setChecklist([
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
        evidenceNeeded: 'Genes.',
      },
      {
        id: 'c3',
        question: 'Counterevidence?',
        kind: 'counterevidence',
        evidenceNeeded: 'Other fits.',
      },
      {
        id: 'c4',
        question: 'Literature?',
        kind: 'literature',
        evidenceNeeded: 'Papers.',
      },
    ]);
    session.recordFact({
      itemId: 'c1',
      ref,
      path: 'diseases[0].score',
      value: 0.9849,
    });
    session.recordFact({
      itemId: 'c2',
      ref,
      path: 'diseases[0].name',
      value: 'Dravet syndrome',
    });
    session.recordFact({
      itemId: 'c3',
      ref,
      path: 'diseases[0].name',
      value: 'Dravet syndrome',
    });
    const report = {
      answer: 'Dravet syndrome fits best.',
      findings: [
        {
          itemId: 'c1',
          status: 'proven' as const,
          text: 'Top score is 0.9849.',
          factIds: ['f1'],
        },
        {
          itemId: 'c2',
          status: 'proven' as const,
          text: 'Dravet syndrome leads.',
          factIds: ['f2'],
        },
        {
          itemId: 'c3',
          status: 'gap' as const,
          text: 'Searched the ranking; no stronger fit.',
          factIds: ['f3'],
        },
        {
          itemId: 'c4',
          status: 'gap' as const,
          text: 'No literature recorded.',
          factIds: [],
        },
      ],
      gaps: [],
    };
    expect((await session.submitReport(report)).ok).toBe(true);
  });
});
