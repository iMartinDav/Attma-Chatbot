import { useEffect, useMemo, useRef } from 'react';

export function useScrollToBottom<T extends HTMLElement>() {
  const containerRef = useRef<T>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Motion preference: downgrade to 'auto' for users preferring reduced motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window))
      return false;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    const end = endRef.current;
    if (!container || !end) return;

    let rafId: number | null = null;
    const schedule = (fn: () => void) => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(fn);
    };

    // Track whether the user is near bottom to respect manual scroll
    const state = { isNearBottom: true };
    const getComposerHeight = (): number => {
      const cs = getComputedStyle(document.documentElement);
      const raw = cs.getPropertyValue('--composer-height').trim();
      const num = raw.endsWith('px') ? parseFloat(raw) : Number(raw);
      return Number.isFinite(num) && num > 0 ? num : 120;
    };
    const bottomDistance = () =>
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const computeNearBottom = () => {
      // Consider "near" if within composer height + small buffer
      const threshold = Math.max(getComposerHeight() + 48, 96);
      state.isNearBottom = bottomDistance() <= threshold;
    };

    const onScroll = () => computeNearBottom();
    container.addEventListener('scroll', onScroll, { passive: true });
    // initial compute
    computeNearBottom();

    // IntersectionObserver: if end sentinel is visible, we are at bottom
    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          const e = entries[0];
          if (e)
            state.isNearBottom =
              e.isIntersecting ||
              bottomDistance() <= Math.max(getComposerHeight() + 48, 96);
        },
        // Be lenient so partial visibility still counts
        { root: container, threshold: 0, rootMargin: '0px 0px -1px 0px' },
      );
      io.observe(end);
    }

    // ResizeObserver: when content height changes (streaming), keep pinned if near bottom
    const ro = new ResizeObserver(() => {
      if (
        state.isNearBottom ||
        bottomDistance() <= Math.max(getComposerHeight() + 48, 96)
      ) {
        schedule(() => {
          // scrollIntoView aligns end to bottom, but we add a tiny manual nudge to account for sub-pixel rounding
          end.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'end',
          });
        });
      }
    });
    ro.observe(container);
    ro.observe(end);

    // Scroll to bottom on mount to avoid content hidden behind input
    schedule(() => {
      end.scrollIntoView({ behavior: 'auto', block: 'end' });
    });

    return () => {
      container.removeEventListener('scroll', onScroll);
      if (io) io.disconnect();
      ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [prefersReducedMotion]);

  // Return both object and array for backward compatibility during transition
  // This helps avoid breaking components while we update them
  return Object.assign([containerRef, endRef] as const, {
    containerRef,
    endRef,
    scrollToBottom: (behavior: ScrollBehavior = 'smooth') => {
      endRef.current?.scrollIntoView({ behavior });
    },
    onViewportEnter: () => {},
    onViewportLeave: () => {},
    isAtBottom: true, // Simplification
  });
}
