import { resolvePath } from '../paths';

const variantOutput = {
  variants: [
    {
      gene: 'SCN1A',
      hgvsp: null,
      alphaMissense: { score: 0.92, class: 'likely_pathogenic' },
      cadd: 27.43,
    },
    { gene: 'DECOY', hgvsp: null, alphaMissense: null, cadd: 12.5 },
    {
      gene: 'OTHER',
      hgvsp: null,
      clinvar: ['Conflicting_interpretations_of_pathogenicity'],
      alphaMissense: null,
      cadd: 31.2,
    },
  ],
  elapsedMs: 42,
};

describe('resolvePath', () => {
  it('resolves nested objects and array indexes', () => {
    expect(resolvePath(variantOutput, 'variants[0].gene')).toEqual({
      found: true,
      value: 'SCN1A',
    });
    expect(
      resolvePath(variantOutput, 'variants[0].alphaMissense.score'),
    ).toEqual({
      found: true,
      value: 0.92,
    });
    expect(resolvePath(variantOutput, 'variants[2].clinvar[0]')).toEqual({
      found: true,
      value: 'Conflicting_interpretations_of_pathogenicity',
    });
  });

  it('resolves a top-level key and a null value', () => {
    expect(resolvePath(variantOutput, 'elapsedMs')).toEqual({
      found: true,
      value: 42,
    });
    expect(resolvePath(variantOutput, 'variants[0].hgvsp')).toEqual({
      found: true,
      value: null,
    });
  });

  it('returns found false for missing keys and indexes without throwing', () => {
    expect(resolvePath(variantOutput, 'variants[9].cadd')).toEqual({
      found: false,
    });
    expect(resolvePath(variantOutput, 'variants[0].spliceAi')).toEqual({
      found: false,
    });
    expect(resolvePath(variantOutput, 'diseases[0].name')).toEqual({
      found: false,
    });
    expect(resolvePath(null, 'a.b')).toEqual({ found: false });
    expect(resolvePath(variantOutput, '')).toEqual({ found: false });
    expect(resolvePath(variantOutput, 'variants[')).toEqual({ found: false });
  });
});
