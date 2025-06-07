import { truncateText, getResponsiveTruncateLength } from '../text';

describe('truncateText', () => {
  it('should return the original text when shorter than maxLength', () => {
    const text = 'Hello World';
    const result = truncateText({ text, maxLength: 20 });

    expect(result).toBe('Hello World');
  });

  it('should return the original text when equal to maxLength', () => {
    const text = 'Hello World';
    const result = truncateText({ text, maxLength: 11 });

    expect(result).toBe('Hello World');
  });

  it('should truncate text when longer than maxLength', () => {
    const text = 'Hello World';
    const result = truncateText({ text, maxLength: 5 });

    expect(result).toBe('Hello');
  });

  it('should add ellipsis when specified', () => {
    const text = 'Hello World';
    const result = truncateText({ text, maxLength: 6, ellipsis: true });

    expect(result).toBe('Hello…');
  });

  it('should account for ellipsis in maxLength calculation', () => {
    const text = 'Hello World';
    const result = truncateText({ text, maxLength: 6, ellipsis: true });

    expect(result.length).toBe(6); // Including the ellipsis
  });

  it('should handle empty string', () => {
    const text = '';
    const result = truncateText({ text, maxLength: 10 });

    expect(result).toBe('');
  });

  it('should handle null or undefined text', () => {
    // @ts-ignore - Testing edge case
    const result = truncateText({ text: null, maxLength: 10 });
    expect(result).toBeNull();

    // @ts-ignore - Testing edge case
    const result2 = truncateText({ text: undefined, maxLength: 10 });
    expect(result2).toBeUndefined();
  });
});

describe('getResponsiveTruncateLength', () => {
  it('should return default length for large screens', () => {
    const result = getResponsiveTruncateLength(1200);
    expect(result).toBe(100);
  });

  it('should return appropriate length for small phones', () => {
    const result = getResponsiveTruncateLength(360);
    expect(result).toBe(35);
  });

  it('should return appropriate length for medium phones', () => {
    const result = getResponsiveTruncateLength(450);
    expect(result).toBe(45);
  });

  it('should handle fallback for server-side rendering or initialization', () => {
    const result = getResponsiveTruncateLength(0);
    expect(result).toBe(100); // Should return default value
  });
});
