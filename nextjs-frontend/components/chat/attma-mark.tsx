'use client';

import { useEffect, useState } from 'react';

import { type Frame, Matrix } from '@/components/ui/matrix';

const ROWS = 5;
const COLS = 11;
const STEPS = 20;
// One full twist every ten columns, so the strands cross three times across the strip.
const TWIST = (Math.PI * 2) / 10;
// The strand turned away from the viewer stays visible but dim, which is what reads as depth.
const BACK_STRAND = 0.32;
const FPS = 14;

/**
 * Frames of a double helix turning about its long axis, as seen side-on.
 * Each column lights one dot per strand: full brightness for the strand in front, dim for the
 * one behind. Positions are rounded to whole rows, so the server and the browser draw the same
 * first frame and hydration matches.
 */
export function helixFrames(rows = ROWS, cols = COLS, steps = STEPS): Frame[] {
  const middle = (rows - 1) / 2;
  return Array.from({ length: steps }, (_, step) => {
    const turn = (step / steps) * Math.PI * 2;
    const frame: Frame = Array.from({ length: rows }, () =>
      Array<number>(cols).fill(0),
    );
    for (let col = 0; col < cols; col++) {
      const angle = turn - col * TWIST;
      const offset = middle * Math.sin(angle);
      const depth = Math.cos(angle);
      const strands = [
        { row: Math.round(middle + offset), front: depth >= 0 },
        { row: Math.round(middle - offset), front: depth < 0 },
      ];
      for (const strand of strands) {
        const value = strand.front ? 1 : BACK_STRAND;
        frame[strand.row][col] = Math.max(frame[strand.row][col], value);
      }
    }
    return frame;
  });
}

const FRAMES = helixFrames();
// Frame 0 has the strands crossing at both ends and the middle, a balanced still pose.
const RESTING = FRAMES[0];

// 2 px dots on a 3 px pitch make the strip exactly 32 px wide, the width of the avatar column.
const DOT = 2;
const GAP = 1;

/**
 * Attma's mark: a dot-matrix double helix. It turns while Attma is working and rests as a
 * still helix otherwise, so motion only ever means "working".
 */
export function AttmaMark({
  working = false,
  className,
}: {
  working?: boolean;
  className?: string;
}) {
  return (
    <Matrix
      rows={ROWS}
      cols={COLS}
      frames={working ? FRAMES : undefined}
      pattern={working ? undefined : RESTING}
      fps={FPS}
      size={DOT}
      gap={GAP}
      ariaLabel={working ? 'Attma is working' : 'Attma'}
      className={className}
    />
  );
}

/** Whole seconds since mount, for the "Working for Ns" label. */
export function useElapsedSeconds(): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);
  return seconds;
}

export const workingLabel = (seconds: number) =>
  seconds < 1 ? 'Working' : `Working for ${seconds}s`;
