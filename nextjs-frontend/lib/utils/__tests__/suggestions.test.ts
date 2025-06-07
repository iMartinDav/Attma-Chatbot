import { formatSuggestionBubbles } from '../suggestions';

describe('formatSuggestionBubbles', () => {
  it('should convert a dictionary to suggestion bubbles array', () => {
    const dict = {
      item1: 'First suggestion',
      item2: 'Second suggestion',
      item3: 'Third suggestion',
    };

    const result = formatSuggestionBubbles(dict);

    expect(result).toEqual([
      { id: 'item1', text: 'First suggestion' },
      { id: 'item2', text: 'Second suggestion' },
      { id: 'item3', text: 'Third suggestion' },
    ]);
  });

  it('should filter out empty or undefined values', () => {
    const dict = {
      item1: 'First suggestion',
      item2: '',
      item3: undefined,
      item4: 'Fourth suggestion',
    };

    const result = formatSuggestionBubbles(dict);

    expect(result).toEqual([
      { id: 'item1', text: 'First suggestion' },
      { id: 'item4', text: 'Fourth suggestion' },
    ]);
  });

  it('should return an empty array for undefined or empty dictionary', () => {
    expect(formatSuggestionBubbles(undefined)).toEqual([]);
    expect(formatSuggestionBubbles({})).toEqual([]);
  });
});
