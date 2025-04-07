'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { DnaIcon } from '@/components/icons';

// Constants for reusability and maintainability
const GENIE_PINK = '#25C6A3';
const TYPING_SPEED = 30;
const TYPING_DELAY = 500;

// Reusable hook for typing animation
function useTypewriter(text: string, delay = TYPING_DELAY, speed = TYPING_SPEED) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    setDisplayedText('');
    const startTimeout = setTimeout(() => {
      setDisplayedText(text.charAt(0));
    }, delay);
    return () => clearTimeout(startTimeout);
  }, [text, delay]);

  useEffect(() => {
    if (displayedText.length < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1));
      }, speed);
      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
    }
  }, [displayedText, text, speed]);

  return { displayedText, isTyping };
}

export default function NotFound() {
  const router = useRouter();
  const message = "I've analyzed all possible dimensions but couldn't locate this page in our DNA database. Would you like me to sequence you back to a known location?";
  const { displayedText, isTyping } = useTypewriter(message);

  // Memoize the handler to prevent unnecessary rerenders
  const handleGoBack = useCallback(() => router.back(), [router]);

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-background to-[#25C6A3]/5 p-4">
      <div className="container max-w-4xl mx-auto flex flex-col items-center justify-center">
        {/* 404 DNA visualization */}
        <div className="relative size-80 mb-8 flex items-center justify-center" aria-hidden="true">
          <div className="relative size-64 animate-pulse">
            <DnaIcon size={256} />
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex gap-8" aria-label="404 error">
              <span className="text-[#25C6A3] text-8xl font-extrabold drop-shadow-md opacity-90">4</span>
              <span className="text-[#25C6A3] text-8xl font-extrabold drop-shadow-md opacity-90">0</span>
              <span className="text-[#25C6A3] text-8xl font-extrabold drop-shadow-md opacity-90">4</span>
            </div>
          </div>
        </div>
        
        {/* Error message bubble */}
        <div className="chat-bubble bg-[#25C6A3]/5 border border-[#25C6A3]/20 p-6 rounded-2xl w-full max-w-2xl mb-8 relative"
          role="alert" 
          aria-live="polite"
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 size-4 rotate-45 bg-[#25C6A3]/5 border-t border-l border-[#25C6A3]/20" />
          
          <h1 className="text-2xl font-bold text-[#25C6A3] mb-4">
            Genetic Sequence Not Found
          </h1>
          
          <div className="text-muted-foreground space-y-4">
            <p className="text-lg">
              {displayedText}
              {isTyping && <span className="inline-block size-2 ml-1 bg-[#25C6A3]/50 animate-pulse" />}
            </p>
          </div>
        </div>
        
        {/* Navigation buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
          <Button 
            onClick={handleGoBack} 
            variant="outline"
            className="border-[#25C6A3]/30 hover:bg-[#25C6A3]/5 group transition-all"
            size="lg"
          >
            <span className="mr-2 opacity-70 group-hover:opacity-100">🧬</span>
            Rewind Sequence
          </Button>
          
          <Button 
            asChild
            size="lg"
            className="bg-[#25C6A3] hover:opacity-90 transition-opacity shadow-sm"
          >
            <Link href="/">
              <span className="mr-2 group-hover:animate-pulse">🏠</span>
              Return Home
            </Link>
          </Button>
        </div>
        
        {/* Footer */}
        <div className="mt-16 text-sm text-muted-foreground flex items-center gap-2">
          <span className="block h-px w-8 bg-[#25C6A3]/20" />
          <p>Need genetic analysis? <Link href="/chat" className="text-[#25C6A3] hover:text-[#25C6A3]/80 transition-colors hover:underline underline-offset-4">Ask the Attma</Link></p>
          <span className="block h-px w-8 bg-[#25C6A3]/20" />
        </div>
      </div>
    </div>
  );
}
