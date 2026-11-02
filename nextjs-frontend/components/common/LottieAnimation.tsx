'use client';

import dynamic from 'next/dynamic';
import React, { useState } from 'react';

// Dynamically import the Lottie component with SSR disabled
const Lottie = dynamic(() => import('react-lottie-player'), { ssr: false });

interface LottieOptions {
  loop: boolean;
  play: boolean;
  animationData: object;
  rendererSettings: {
    preserveAspectRatio: string;
  };
}

interface LottieAnimationProps {
  src: string | object;
  width?: string | number;
  height?: string | number;
  className?: string;
}

const LottieAnimation: React.FC<LottieAnimationProps> = ({
  src,
  width,
  height,
  className,
}) => {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  React.useEffect(() => {
    // Set isClient to true once component mounts
    setIsClient(true);

    if (typeof src === 'string') {
      fetch(src)
        .then((response) => response.json())
        .then((data) => setAnimationData(data))
        .catch(() => setError('Failed to load animation'));
    } else {
      setAnimationData(src);
    }
  }, [src]);

  // Don't render anything on the server
  if (!isClient) {
    return <div className={className} style={{ width, height }} />;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!animationData) {
    return <div className="text-gray-500">Loading animation...</div>;
  }

  const options: LottieOptions = {
    loop: true,
    play: true,
    animationData: animationData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  };

  return (
    <Lottie {...options} style={{ width, height }} className={className} />
  );
};

export default LottieAnimation;
