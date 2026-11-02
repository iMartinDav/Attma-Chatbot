import { describeStep, refusalProblemsOf, runnerOf } from '../step-labels';

type Part = Parameters<typeof describeStep>[0];

function part(partial: Partial<Part> & { type: string }): Part {
  return partial as Part;
}

describe('describeStep analysis labels', () => {
  it('labels a set checklist and its refusal', () => {
    expect(
      describeStep(
        part({
          type: 'tool-setChecklist',
          state: 'output-available',
          input: { items: [{}, {}, {}, {}] },
          output: { ok: true, checklist: [{}, {}, {}, {}] },
        }),
      ),
    ).toBe('Set a checklist of 4 questions');
    expect(
      describeStep(
        part({
          type: 'tool-setChecklist',
          state: 'output-available',
          input: { items: [{}, {}, {}, {}] },
          output: { ok: false, problems: ['Add a counterevidence item.'] },
        }),
      ),
    ).toBe('Checklist refused');
  });

  it('labels a recorded fact and its refusal', () => {
    expect(
      describeStep(
        part({
          type: 'tool-recordFact',
          state: 'output-available',
          input: {
            itemId: 'c2',
            ref: 'r1',
            path: 'variants[0].cadd',
            value: 27.43,
          },
          output: {
            ok: true,
            fact: {
              itemId: 'c2',
              ref: 'r1',
              path: 'variants[0].cadd',
              value: 27.43,
            },
          },
        }),
      ),
    ).toBe('Recorded variants[0].cadd = 27.43 for c2');
    expect(
      describeStep(
        part({
          type: 'tool-recordFact',
          state: 'output-available',
          input: { itemId: 'c2', path: 'variants[0].cadd', value: 28.1 },
          output: { ok: false, problems: ['Value differs.'] },
        }),
      ),
    ).toBe('Fact refused');
    expect(
      describeStep(
        part({
          type: 'tool-recordFact',
          state: 'output-available',
          count: 6,
          input: {},
          output: { ok: true },
        }),
      ),
    ).toBe('Recorded 6 facts');
  });

  it('labels a checked report, refusals and their problems', () => {
    expect(
      describeStep(
        part({
          type: 'tool-submitReport',
          state: 'output-available',
          input: {},
          output: { ok: true, status: 'awaiting_review', refusalsLeft: 3 },
        }),
      ),
    ).toBe('Report checked: passed');
    const refused = part({
      type: 'tool-submitReport',
      state: 'output-available',
      input: {},
      output: {
        ok: false,
        status: 'collecting',
        refusalsLeft: 1,
        problems: ['Finding c2: number 28.1 has no cited fact.'],
      },
    });
    expect(describeStep(refused)).toBe('Report refused (2 of 3)');
    expect(refusalProblemsOf(refused)).toEqual([
      'Finding c2: number 28.1 has no cited fact.',
    ]);
  });

  it('labels an input request', () => {
    expect(
      describeStep(
        part({
          type: 'tool-requestInput',
          state: 'output-available',
          input: { missing: 'no phenotypes provided' },
          output: {
            ok: true,
            status: 'needs_input',
            request: { question: 'no phenotypes provided' },
          },
        }),
      ),
    ).toBe('Asked for: no phenotypes provided');
  });
});

describe('runnerOf analysis badges', () => {
  it('labels code checks and the Spark claims check', () => {
    expect(runnerOf(part({ type: 'tool-setChecklist' }))).toEqual({
      label: 'Attma checks',
      muse: false,
    });
    expect(runnerOf(part({ type: 'tool-recordFact' }))).toEqual({
      label: 'Attma checks',
      muse: false,
    });
    expect(runnerOf(part({ type: 'tool-requestInput' }))).toEqual({
      label: 'Attma checks',
      muse: false,
    });
    expect(runnerOf(part({ type: 'tool-submitReport' }))).toEqual({
      label: 'Code + Muse Spark',
      muse: true,
    });
  });
});
