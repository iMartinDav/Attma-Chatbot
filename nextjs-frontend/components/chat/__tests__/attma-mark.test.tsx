import { render, screen } from '@testing-library/react';

jest.mock('motion/react', () => ({ useReducedMotion: () => false }));

import { AttmaMark, helixFrames, workingLabel } from '../attma-mark';

describe('helixFrames', () => {
  const frames = helixFrames();

  it('draws one full turn as 20 frames of a 5 by 11 strip', () => {
    expect(frames).toHaveLength(20);
    for (const frame of frames) {
      expect(frame).toHaveLength(5);
      for (const row of frame) expect(row).toHaveLength(11);
    }
  });

  it('lights one bright front dot in every column, and a dim back dot unless the strands cross', () => {
    for (const frame of frames) {
      for (let col = 0; col < 11; col++) {
        const lit = frame.map((row) => row[col]).filter((value) => value > 0);
        expect(lit).toContain(1);
        expect(lit.length).toBeGreaterThanOrEqual(1);
        expect(lit.length).toBeLessThanOrEqual(2);
        if (lit.length === 2) expect(Math.min(...lit)).toBeCloseTo(0.32);
      }
    }
  });

  it('is identical on every call, so server and browser render the same first frame', () => {
    expect(helixFrames()).toEqual(frames);
  });
});

describe('AttmaMark', () => {
  it('names its state for screen readers', () => {
    const { rerender } = render(<AttmaMark working />);
    expect(screen.getByRole('img', { name: 'Attma is working' })).toBeTruthy();
    rerender(<AttmaMark />);
    expect(screen.getByRole('img', { name: 'Attma' })).toBeTruthy();
  });
});

describe('workingLabel', () => {
  it('counts whole seconds after the first one', () => {
    expect(workingLabel(0)).toBe('Working');
    expect(workingLabel(8)).toBe('Working for 8s');
  });
});
