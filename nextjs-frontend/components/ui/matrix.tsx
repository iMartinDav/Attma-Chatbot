'use client';

/**
 * A dot-matrix display that plays frames of 0..1 brightness values.
 * Adapted from the Matrix component in ElevenLabs UI (MIT, github.com/elevenlabs/ui) with the
 * same frame API. Differences: colours come from Attma's HSL tokens; the unlit grid is a static
 * layer under the lit one, so a dot that turns off fades out instead of flashing grey; it stays
 * on its first frame for people who prefer reduced motion; and it does not announce every frame
 * to screen readers.
 */

import { useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

export type Frame = number[][];

interface MatrixProps extends React.HTMLAttributes<HTMLDivElement> {
  rows: number;
  cols: number;
  /** A still image; wins over frames. */
  pattern?: Frame;
  frames?: Frame[];
  fps?: number;
  /** Dot diameter in px. */
  size?: number;
  gap?: number;
  onColor?: string;
  offColor?: string;
  ariaLabel?: string;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

// The accumulator keeps the frame rate steady across uneven rAF ticks; taking the remainder
// (not subtracting once) avoids a burst of catch-up frames after the tab was hidden.
function useFrameIndex(count: number, fps: number, playing: boolean): number {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!playing || count < 2) return;
    const interval = 1000 / fps;
    let frameId = 0;
    let last = 0;
    let elapsed = 0;
    const tick = (now: number) => {
      if (last === 0) last = now;
      elapsed += now - last;
      last = now;
      if (elapsed >= interval) {
        elapsed %= interval;
        setIndex((current) => (current + 1) % count);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [count, fps, playing]);
  return index;
}

export function Matrix({
  rows,
  cols,
  pattern,
  frames,
  fps = 12,
  size = 10,
  gap = 2,
  onColor = 'hsl(var(--primary-ink))',
  offColor = 'hsl(var(--muted-foreground))',
  ariaLabel = 'Dot matrix display',
  className,
  ...props
}: MatrixProps) {
  const reduceMotion = useReducedMotion();
  const playing = !pattern && !reduceMotion && (frames?.length ?? 0) > 1;
  const index = useFrameIndex(frames?.length ?? 0, fps, playing);
  const frame = pattern ?? frames?.[playing ? index : 0] ?? [];

  const pitch = size + gap;
  const width = cols * pitch - gap;
  const height = rows * pitch - gap;
  const cells = useMemo(
    () =>
      Array.from({ length: rows * cols }, (_, i) => ({
        row: Math.floor(i / cols),
        col: i % cols,
      })),
    [rows, cols],
  );
  const cx = (col: number) => col * pitch + size / 2;
  const cy = (row: number) => row * pitch + size / 2;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn('inline-block shrink-0 leading-none', className)}
      {...props}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
        aria-hidden
      >
        <g fill={offColor} className="opacity-[0.16] dark:opacity-[0.13]">
          {cells.map(({ row, col }) => (
            <circle
              key={`off-${row}-${col}`}
              cx={cx(col)}
              cy={cy(row)}
              r={size / 2}
            />
          ))}
        </g>
        <g fill={onColor}>
          {cells.map(({ row, col }) => (
            <circle
              key={`on-${row}-${col}`}
              cx={cx(col)}
              cy={cy(row)}
              r={size / 2}
              opacity={clamp(frame[row]?.[col] ?? 0)}
              className="transition-opacity duration-75 ease-linear motion-reduce:transition-none"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
