import { lastAnalysisMessageId } from '../step-labels';

describe('lastAnalysisMessageId', () => {
  it('returns null when no message has an analysis part', () => {
    expect(lastAnalysisMessageId([])).toBeNull();
    expect(
      lastAnalysisMessageId([
        { id: 'm1', parts: [{ type: 'text' }] },
        { id: 'm2', parts: [{ type: 'tool-submitReport' }] },
        { id: 'm3' },
      ]),
    ).toBeNull();
  });

  it('returns the later id when two messages have an analysis part', () => {
    expect(
      lastAnalysisMessageId([
        { id: 'm1', parts: [{ type: 'data-analysis' }] },
        { id: 'm2', parts: [{ type: 'text' }] },
        { id: 'm3', parts: [{ type: 'text' }, { type: 'data-analysis' }] },
      ]),
    ).toBe('m3');
  });

  it('is unchanged by a user message after the last analysis', () => {
    expect(
      lastAnalysisMessageId([
        { id: 'm1', parts: [{ type: 'data-analysis' }] },
        { id: 'm2', parts: [{ type: 'text' }] },
      ]),
    ).toBe('m1');
  });
});
