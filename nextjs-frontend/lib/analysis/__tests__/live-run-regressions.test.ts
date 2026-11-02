import liveRun from './fixtures/live-run.json';
import { buildClaimsCheckPrompt } from '../claims-prompt';
import { AnalysisSession, type ClaimsCheck } from '../session';
import type { ChecklistItem, Report } from '../types';
import { formatValue, valuesEqual } from '../verify';

// Real values copied from the 2026-11-02 live runs are in the fixture, so these tests replay the exact false refusals without importing the results folder.
const genitalOutput = liveRun.genitalRankDiagnoses;
const genitalProtein = liveRun.genitalProteinStructure;

const checklist: ChecklistItem[] = [
  {
    id: 'c1',
    question: 'Does the top gene explain the phenotypes?',
    kind: 'phenotype_match',
    evidenceNeeded: 'Top disease and gene.',
  },
  {
    id: 'c2',
    question: 'Is the top variant predicted deleterious?',
    kind: 'variant_evidence',
    evidenceNeeded: 'CADD and gnomAD frequency.',
  },
  {
    id: 'c3',
    question: 'Is there counterevidence?',
    kind: 'counterevidence',
    evidenceNeeded: 'ClinVar and frequency.',
  },
  {
    id: 'c4',
    question: 'Does the literature support the gene?',
    kind: 'literature',
    evidenceNeeded: 'Published evidence.',
  },
];

function genitalSession(): { session: AnalysisSession; ref: string } {
  const session = new AnalysisSession();
  const ref = session.captureResult('rankDiagnoses', genitalOutput);
  const proteinRef = session.captureResult('proteinStructure', genitalProtein);
  void proteinRef;
  expect(session.setChecklist(checklist).ok).toBe(true);
  return { session, ref };
}

describe('valuesEqual live-run regressions (item 1)', () => {
  it('treats a one-element array as its element', () => {
    expect(
      valuesEqual(
        liveRun.recordedFactValues.diseasesGenesAsScalar,
        genitalOutput.diseases[0].genes,
      ),
    ).toBe(true);
    expect(valuesEqual('DHCR7', ['DHCR7'])).toBe(true);
    expect(valuesEqual(['DHCR7'], 'DHCR7')).toBe(true);
  });

  it('treats an array as a comma-separated string in any order and spacing', () => {
    expect(
      valuesEqual(
        liveRun.recordedFactValues.clinvarAsCommaString,
        genitalOutput.variantRanking.variants[0].clinvar,
      ),
    ).toBe(true);
    expect(
      valuesEqual('pathogenic,uncertain_significance, likely_pathogenic', [
        'uncertain_significance',
        'likely_pathogenic',
        'pathogenic',
      ]),
    ).toBe(true);
    expect(
      valuesEqual(
        ['pathogenic', 'uncertain_significance'],
        ['uncertain_significance', 'pathogenic'],
      ),
    ).toBe(true);
    expect(valuesEqual(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('treats null, "null", "", [] and "none" as the same absent value', () => {
    expect(valuesEqual('null', null)).toBe(true);
    expect(valuesEqual(null, 'null')).toBe(true);
    expect(
      valuesEqual(
        liveRun.recordedFactValues.residueFeaturesAsNullString,
        genitalProtein.residueFeatures,
      ),
    ).toBe(true);
    expect(valuesEqual('', null)).toBe(true);
    expect(valuesEqual('none', [])).toBe(true);
    expect(valuesEqual([], null)).toBe(true);
    expect(valuesEqual('none', 'DHCR7')).toBe(false);
    expect(valuesEqual(null, 0)).toBe(false);
  });

  it('prints arrays as JSON in refusal messages', () => {
    expect(formatValue(['DHCR7'])).toBe('["DHCR7"]');
    expect(formatValue([])).toBe('[]');
    const { session, ref } = genitalSession();
    const result = session.recordFact({
      itemId: 'c1',
      ref,
      path: 'diseases[0].genes',
      value: 'OTHER',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.join(' ')).toContain('["DHCR7"]');
    }
  });

  it('accepts the real genital facts that were falsely refused', () => {
    const { session, ref } = genitalSession();
    expect(
      session.recordFact({
        itemId: 'c1',
        ref,
        path: 'diseases[0].genes',
        value: liveRun.recordedFactValues.diseasesGenesAsScalar,
      }).ok,
    ).toBe(true);
    expect(
      session.recordFact({
        itemId: 'c3',
        ref,
        path: 'variantRanking.variants[0].clinvar',
        value: liveRun.recordedFactValues.clinvarAsCommaString,
      }).ok,
    ).toBe(true);
    expect(
      session.recordFact({
        itemId: 'c3',
        ref,
        path: 'variantRanking.variants[1].gnomadAf',
        value: liveRun.recordedFactValues.gnomadAfAsNullString,
      }).ok,
    ).toBe(true);
    const proteinRef = 'r2';
    expect(
      session.recordFact({
        itemId: 'c2',
        ref: proteinRef,
        path: 'residueFeatures',
        value: liveRun.recordedFactValues.residueFeaturesAsNullString,
      }).ok,
    ).toBe(true);
  });
});

describe('writtenNumbers live-run regressions (item 2)', () => {
  function sessionWithCadd(): AnalysisSession {
    const session = new AnalysisSession();
    const ref = session.captureResult('prioritizeVariants', {
      variants: [{ gene: 'SCN1A', cadd: 27.43, score: 0.9849 }],
    });
    expect(session.setChecklist(checklist).ok).toBe(true);
    expect(
      session.recordFact({
        itemId: 'c1',
        ref,
        path: 'variants[0].score',
        value: 0.9849,
      }).ok,
    ).toBe(true);
    expect(
      session.recordFact({
        itemId: 'c2',
        ref,
        path: 'variants[0].cadd',
        value: 27.43,
      }).ok,
    ).toBe(true);
    expect(
      session.recordFact({
        itemId: 'c3',
        ref,
        path: 'variants[0].gene',
        value: 'SCN1A',
      }).ok,
    ).toBe(true);
    return session;
  }

  function reportWithFindingText(text: string): Report {
    return {
      answer: 'Top candidate fits the phenotype.',
      findings: [
        { itemId: 'c1', status: 'proven', text, factIds: ['f1'] },
        {
          itemId: 'c2',
          status: 'proven',
          text: 'The variant has CADD 27.4.',
          factIds: ['f2'],
        },
        {
          itemId: 'c3',
          status: 'gap',
          text: 'Searched the candidate result; no counterevidence recorded.',
          factIds: ['f3'],
        },
        {
          itemId: 'c4',
          status: 'gap',
          text: 'No literature recorded.',
          factIds: [],
        },
      ],
      gaps: ['No literature recorded.'],
    };
  }

  it.each(liveRun.identifierTexts)(
    'does not count numbers inside identifier %s',
    async (identifier) => {
      const session = sessionWithCadd();
      const result = await session.submitReport(
        reportWithFindingText(`Candidate ${identifier} ranks first.`),
      );
      expect(result.ok).toBe(true);
    },
  );

  it('does not count the Ensembl id or Nav1.1 from the real dravet texts', async () => {
    const session = sessionWithCadd();
    const report = reportWithFindingText(liveRun.genitalFindingWithEnsp);
    report.answer = liveRun.dravetAnswer;
    report.gaps = [liveRun.dravetGap];
    // The dravet answer carries real scores with no cited facts in this small fixture, so only check the identifier-specific refusals are absent.
    const result = await session.submitReport(report);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const text = result.problems.join(' ');
      expect(text).not.toContain('00000501589.1');
      expect(text).not.toContain('00000347717.4');
      expect(text).not.toContain('number 1.1');
    }
  });

  it.each(liveRun.keptNumberTexts)(
    'still checks a standalone number in %s when no fact matches',
    async (text) => {
      const session = sessionWithCadd();
      const report = reportWithFindingText(`Finding with ${text} noted.`);
      const result = await session.submitReport(report);
      // 0.9849 matches f1, the others do not match the cited f1 in this finding.
      if (text.includes('0.9849')) {
        expect(result.ok).toBe(true);
      } else {
        expect(result.ok).toBe(false);
      }
    },
  );

  it('still refuses a genuine unmatched standalone number', async () => {
    const session = sessionWithCadd();
    const result = await session.submitReport(
      reportWithFindingText('Candidate has score 9.9999.'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.join(' ')).toContain('9.9999');
  });
});

describe('fact and citation caps (item 4)', () => {
  it('allows 4 facts per item and refuses a 5th', () => {
    const session = new AnalysisSession();
    const ref = session.captureResult('rankDiagnoses', {
      diseases: [{ name: 'Smith-Lemli-Opitz syndrome', score: 3.98 }],
      variantRanking: {
        variants: [
          { gene: 'DHCR7', cadd: 34, combinedScore: 0.999, gnomadAf: 0.1 },
        ],
      },
    });
    expect(session.setChecklist(checklist).ok).toBe(true);
    const entries = [
      { path: 'variantRanking.variants[0].gene', value: 'DHCR7' },
      { path: 'variantRanking.variants[0].cadd', value: 34 },
      { path: 'variantRanking.variants[0].combinedScore', value: 0.999 },
      { path: 'variantRanking.variants[0].gnomadAf', value: 0.1 },
    ];
    for (const entry of entries) {
      expect(session.recordFact({ itemId: 'c2', ref, ...entry }).ok).toBe(true);
    }
    const fifth = session.recordFact({
      itemId: 'c2',
      ref,
      path: 'diseases[0].name',
      value: 'Smith-Lemli-Opitz syndrome',
    });
    expect(fifth.ok).toBe(false);
    if (!fifth.ok) expect(fifth.problems.join(' ')).toMatch(/4 facts/);
  });

  it('allows a proven finding citing 4 facts', async () => {
    const session = new AnalysisSession();
    const ref = session.captureResult('prioritizeVariants', {
      variants: [
        { gene: 'SCN1A', cadd: 27.43, score: 0.9849, extra: 0.5, other: 0.25 },
      ],
    });
    expect(session.setChecklist(checklist).ok).toBe(true);
    const defs: Array<{
      itemId: string;
      path: string;
      value: number | string;
    }> = [
      { itemId: 'c1', path: 'variants[0].score', value: 0.9849 },
      { itemId: 'c2', path: 'variants[0].cadd', value: 27.43 },
      { itemId: 'c2', path: 'variants[0].gene', value: 'SCN1A' },
      { itemId: 'c2', path: 'variants[0].extra', value: 0.5 },
      { itemId: 'c2', path: 'variants[0].other', value: 0.25 },
    ];
    for (const def of defs) {
      expect(session.recordFact({ ref, ...def }).ok).toBe(true);
    }
    expect(
      session.recordFact({
        itemId: 'c3',
        ref,
        path: 'variants[0].gene',
        value: 'SCN1A',
      }).ok,
    ).toBe(true);
    const report: Report = {
      answer: 'Top candidate fits.',
      findings: [
        {
          itemId: 'c1',
          status: 'proven',
          text: 'Score is 0.9849.',
          factIds: ['f1'],
        },
        {
          itemId: 'c2',
          status: 'proven',
          text: 'SCN1A has CADD 27.4.',
          factIds: ['f2', 'f3', 'f4', 'f5'],
        },
        {
          itemId: 'c3',
          status: 'gap',
          text: 'Searched the candidate result; no counterevidence.',
          factIds: ['f6'],
        },
        { itemId: 'c4', status: 'gap', text: 'No literature.', factIds: [] },
      ],
      gaps: [],
    };
    await expect(session.submitReport(report)).resolves.toMatchObject({
      ok: true,
    });
  });
});

describe('claims-check prompt builder (item 3)', () => {
  it('includes tool names and meanings per cited fact', () => {
    const prompt = buildClaimsCheckPrompt([
      {
        itemId: 'c1',
        question: 'Does the top gene explain the phenotypes?',
        text: 'Smith-Lemli-Opitz syndrome ranks first with score 3.98.',
        facts: [
          {
            path: 'diseases[0].name',
            value: 'Smith-Lemli-Opitz syndrome',
            toolName: 'rankDiagnoses',
            toolMeaning:
              "diseases ranked by HPO similarity to the patient's phenotypes, plus variants ranked by combined phenotype and variant evidence",
          },
          {
            path: 'variants[0].gene',
            value: 'DHCR7',
            toolName: 'prioritizeVariants',
            toolMeaning: 'variants ranked by VEP evidence without phenotypes',
          },
        ],
      },
    ]);
    expect(prompt).toContain('rankDiagnoses');
    expect(prompt).toContain('HPO similarity');
    expect(prompt).toContain('prioritizeVariants');
    expect(prompt).toContain('VEP evidence without phenotypes');
    expect(prompt).toContain('diseases[0].name');
  });

  it('passes tool name and meaning from the captured result through submitReport', async () => {
    const session = new AnalysisSession();
    const ref = session.captureResult('rankDiagnoses', genitalOutput);
    expect(session.setChecklist(checklist).ok).toBe(true);
    expect(
      session.recordFact({
        itemId: 'c1',
        ref,
        path: 'diseases[0].name',
        value: 'Smith-Lemli-Opitz syndrome',
      }).ok,
    ).toBe(true);
    expect(
      session.recordFact({
        itemId: 'c2',
        ref,
        path: 'variantRanking.variants[0].cadd',
        value: 34,
      }).ok,
    ).toBe(true);
    expect(
      session.recordFact({
        itemId: 'c3',
        ref,
        path: 'diseases[0].name',
        value: 'Smith-Lemli-Opitz syndrome',
      }).ok,
    ).toBe(true);
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
    const report: Report = {
      answer: 'Top candidate fits.',
      findings: [
        {
          itemId: 'c1',
          status: 'proven',
          text: 'Smith-Lemli-Opitz syndrome ranks first.',
          factIds: ['f1'],
        },
        {
          itemId: 'c2',
          status: 'proven',
          text: 'Variant has CADD 34.0.',
          factIds: ['f2'],
        },
        {
          itemId: 'c3',
          status: 'gap',
          text: 'Searched the ranked result; no counterevidence.',
          factIds: ['f3'],
        },
        { itemId: 'c4', status: 'gap', text: 'No literature.', factIds: [] },
      ],
      gaps: [],
    };
    await session.submitReport(report, check);
    expect(seenBox.value?.[0]?.facts[0]?.toolName).toBe('rankDiagnoses');
    expect(seenBox.value?.[0]?.facts[0]?.toolMeaning).toContain(
      'HPO similarity',
    );
  });
});
