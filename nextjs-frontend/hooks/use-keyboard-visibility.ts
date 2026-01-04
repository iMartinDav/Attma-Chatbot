'use client';

import { useCallback, useEffect, useState } from 'react';

export function useKeyboardVisibility() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollInputIntoView = useCallback((inputElement?: HTMLElement | null) => {
    if (!inputElement) return;
    
    setTimeout(() => {
      inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const viewport = window.visualViewport;
    let initialHeight = viewport.height;

    const handleResize = () => {
      const currentHeight = viewport.height;
      const heightDiff = initialHeight - currentHeight;
      
      if (heightDiff > 150) {
        setIsKeyboardVisible(true);
        setKeyboardHeight(heightDiff);
      } else {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    };

    const handleScroll = () => {
      if (isKeyboardVisible) {
        document.documentElement.style.setProperty(
          '--keyboard-offset',
          `${viewport.offsetTop}px`
        );
      }
    };

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleScroll);

    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleScroll);
    };
  }, [isKeyboardVisible]);

  return { isKeyboardVisible, keyboardHeight, scrollInputIntoView };
}
