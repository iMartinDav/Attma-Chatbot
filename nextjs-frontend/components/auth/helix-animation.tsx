'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// The same helix animation as the attma.bio sign-in, served from this app
// (public/animations/helix.json) so the page needs no third-party request.
const Lottie = dynamic(() => import('react-lottie-player'), { ssr: false });

export function HelixAnimation({ className }: { className?: string }) {
  const [data, setData] = useState<object | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    fetch('/animations/helix.json')
      .then((response) => response.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return <div className={className} aria-hidden="true" />;

  return (
    <Lottie
      loop
      play={!reduceMotion}
      animationData={data}
      rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }}
      className={className}
      aria-hidden="true"
    />
  );
}
