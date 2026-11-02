import { ensureAnalysisPart } from '../ensure-analysis-part';

const analysisData = { status: 'collecting', checklist: [{ id: 'c1' }] };

describe('ensureAnalysisPart', () => {
  it('appends a data-analysis part when none is present and a checklist is set', () => {
    const parts = [{ type: 'text', text: 'hi' }, { type: 'tool-recordFact' }];
    const result = ensureAnalysisPart(parts, true, analysisData);
    expect(result).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'tool-recordFact' },
      { type: 'data-analysis', data: analysisData },
    ]);
    // The caller's array is left alone, because the stream may still hold it.
    expect(parts).toHaveLength(2);
  });

  it('keeps an existing data-analysis part instead of adding a second one', () => {
    const parts = [
      { type: 'text', text: 'hi' },
      { type: 'data-analysis', data: analysisData },
    ];
    expect(ensureAnalysisPart(parts, true, analysisData)).toEqual(parts);
  });

  it('adds nothing when no checklist was set', () => {
    const parts = [{ type: 'text', text: 'hi' }];
    expect(ensureAnalysisPart(parts, false, analysisData)).toEqual(parts);
  });
});
