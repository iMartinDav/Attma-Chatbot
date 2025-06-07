/**
 * A decorative background component with gradient effects
 * Commonly used in hero sections and landing pages
 */
export function HeroBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* Base backdrop blur */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-background/80 via-background to-background/80 backdrop-blur-sm"
      />

      {/* Purple gradient blob */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-10 w-[300%] max-w-[36rem] aspect-square -translate-x-1/2 bg-gradient-to-r from-violet-300/30 to-purple-300/30 blur-3xl dark:from-violet-700/30 dark:to-purple-700/30 sm:w-[100%]"
      />

      {/* Blue gradient blob */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-10 w-[300%] max-w-[36rem] aspect-square translate-x-1/4 bg-gradient-to-r from-indigo-300/30 to-blue-300/30 blur-3xl dark:from-indigo-700/30 dark:to-blue-700/30 sm:w-[100%]"
      />
    </div>
  );
}
