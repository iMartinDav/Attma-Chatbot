import { useId } from 'react';

/**
 * Attma's helix mark: two glass strands crossing, the front one mint and the
 * back one violet into blue, so the overlap reads as layered glass
 * rather than a stroke icon. Inside a `group`, hovering the group lets four
 * nucleotides (A, C, G, T in their usual colours) step out from the rungs.
 * Motion is transform and opacity only, and off under reduced motion.
 */
const NUCLEOTIDES = [
  { cx: 4.1, cy: 5.5, fill: '#34d399', from: 'translate-x-[4px]', delay: '' },
  {
    cx: 19.9,
    cy: 5.5,
    fill: '#38bdf8',
    from: '-translate-x-[4px]',
    delay: 'group-hover:delay-[40ms]',
  },
  {
    cx: 4.1,
    cy: 18.5,
    fill: '#fbbf24',
    from: 'translate-x-[4px]',
    delay: 'group-hover:delay-[80ms]',
  },
  {
    cx: 19.9,
    cy: 18.5,
    fill: '#fb7185',
    from: '-translate-x-[4px]',
    delay: 'group-hover:delay-[120ms]',
  },
];

const BACK_STRAND = 'M7 2.5C7 9.5 17 14.5 17 21.5';
const FRONT_STRAND = 'M17 2.5C17 9.5 7 14.5 7 21.5';

export function HelixMark({ className = 'size-5' }: { className?: string }) {
  const id = useId();
  const back = `${id}-back`;
  const front = `${id}-front`;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`overflow-visible ${className}`}
    >
      <defs>
        <linearGradient id={back} x1="7" y1="2" x2="17" y2="22">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id={front} x1="17" y1="2" x2="7" y2="22">
          <stop offset="0" stopColor="#5eead4" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* Rungs sit behind both strands, like the ladder seen through glass. */}
      <path
        d="M8.6 5.5h6.8M8.6 18.5h6.8"
        stroke="#99f6e4"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d={BACK_STRAND}
        stroke={`url(#${back})`}
        strokeWidth="3.6"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d={FRONT_STRAND}
        stroke={`url(#${front})`}
        strokeWidth="3.6"
        strokeLinecap="round"
        opacity="0.92"
      />
      {/* A thin specular line along the front strand gives it a glass edge. */}
      <path
        d={FRONT_STRAND}
        stroke="#fff"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.45"
        transform="translate(-0.7 -0.5)"
      />

      {NUCLEOTIDES.map((n) => (
        <circle
          key={n.fill}
          cx={n.cx}
          cy={n.cy}
          r="1.25"
          fill={n.fill}
          className={`origin-center scale-50 opacity-0 transition-[opacity,scale,translate] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] [transform-box:fill-box] group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 motion-reduce:transition-none ${n.from} ${n.delay}`}
        />
      ))}
    </svg>
  );
}
