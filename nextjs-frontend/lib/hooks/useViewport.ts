import { useState, useEffect } from 'react';

interface ViewportOptions {
  /**
   * Whether to watch for viewport changes
   * @default true
   */
  watchViewport?: boolean;
}

/**
 * Custom hook to get and track the viewport dimensions
 */
export function useViewport({ watchViewport = true }: ViewportOptions = {}) {
  const [width, setWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 0,
  );
  const [height, setHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );

  useEffect(() => {
    // Don't run on server
    if (typeof window === 'undefined') return;

    // Set initial dimensions
    setWidth(window.innerWidth);
    setHeight(window.innerHeight);

    if (!watchViewport) return;

    // Add resize event listener
    const handleResize = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Clean up event listener
    return () => window.removeEventListener('resize', handleResize);
  }, [watchViewport]);

  return { width, height };
}
