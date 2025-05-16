'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Locale } from '@/lib/internationalization/config';

interface HeroProps {
  dictionary: {
    title: string;
    subtitle: string;
    introducing?: string;
    ctaExplore?: string;
    promptPlaceholder?: string;
    suggestionBubbles?: {
      analyzeRna?: string;
      explainSingleCell?: string;
      compareProteins?: string;
      identifyMarkers?: string;
      visualizeGenomic?: string;
      interpretCrispr?: string;
    };
    typingEffectPrompts?: string[];
  };
  locale: Locale;
}

const DEFAULT_SAMPLE_PROMPTS = [
  "Analyze this RNA-seq dataset for differential gene expression...",
  "What patterns can you identify in this protein sequence alignment?",
  "Explain the CRISPR-Cas9 mechanism in simple terms",
  "Help me interpret these single-cell sequencing results",
  "What can you tell me about these genomic variants?",
];

export const Hero = ({ dictionary, locale }: HeroProps) => {
  const [query, setQuery] = useState('');
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [currentText, setCurrentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const router = useRouter();

  const samplePrompts = dictionary.typingEffectPrompts?.length 
    ? dictionary.typingEffectPrompts
    : DEFAULT_SAMPLE_PROMPTS;
  
  // Track keyboard focus state for enhanced accessibility
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Handle viewport size on first render and resize
  useEffect(() => {
    const updateViewportWidth = () => {
      setViewportWidth(window.innerWidth);
    };

    // Set initial viewport width
    updateViewportWidth();
    
    // Add resize listener
    window.addEventListener('resize', updateViewportWidth);
    
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);
  
  // Process prompt for responsive display - simplified approach
  const processPromptForDisplay = React.useCallback((prompt: string) => {
    // Calculate available space based on viewport width
    let maxLength = 100; // Default large size
    
    // Adjust for viewport width with more reasonable values
    if (viewportWidth > 0) {
      // Mobile sizes with modest truncation
      if (viewportWidth < 375) maxLength = 35;       // Small phones
      else if (viewportWidth < 480) maxLength = 45;  // Medium phones
      else if (viewportWidth < 640) maxLength = 55;  // Large phones
      // Tablet sizes
      else if (viewportWidth < 768) maxLength = 70;  // Small tablets
      else if (viewportWidth < 1024) maxLength = 90; // Large tablets
    }
    
    // Simple clean truncation without ellipsis for cleaner look
    if (prompt.length > maxLength) {
      return prompt.slice(0, maxLength);
    }
    
    return prompt;
  }, [viewportWidth]);
  
  // Track whether we're showing a truncated prompt
  const [isTruncated, setIsTruncated] = useState(false);

  // Typing effect
  useEffect(() => {
    if (!samplePrompts.length) return;
    
    // Get current prompt
    const safeIndex = Math.min(currentPlaceholderIndex, samplePrompts.length - 1);
    const originalPrompt = samplePrompts[safeIndex];
    const displayPrompt = processPromptForDisplay(originalPrompt);
    
    // We're no longer using truncation indicators
    setIsTruncated(false);
    
    let typingTimer: NodeJS.Timeout;
    let pauseTimer: NodeJS.Timeout;
    
    if (isTyping) {
      // Typing phase
      if (currentText.length < displayPrompt.length) {
        typingTimer = setTimeout(() => {
          setCurrentText(displayPrompt.substring(0, currentText.length + 1));
        }, 50);
      } else {
        // Complete - pause before erasing
        pauseTimer = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
      }
    } else {
      // Erasing phase
      if (currentText.length > 0) {
        typingTimer = setTimeout(() => {
          setCurrentText(currentText.substring(0, currentText.length - 1));
        }, 30);
      } else {
        // Move to next prompt
        setIsTyping(true);
        setCurrentPlaceholderIndex((currentPlaceholderIndex + 1) % samplePrompts.length);
      }
    }
    
    return () => {
      clearTimeout(typingTimer);
      clearTimeout(pauseTimer);
    };
  }, [currentText, currentPlaceholderIndex, isTyping, samplePrompts, processPromptForDisplay]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      
      if (query.trim()) {
        const encodedQuery = encodeURIComponent(query.trim());
        const maxLength = 2000;
        const safeQuery = encodedQuery.length > maxLength 
          ? encodedQuery.substring(0, maxLength) 
          : encodedQuery;
          
        router.push(`/${locale}/chat?prompt=${safeQuery}`);
      } else {
        router.push(`/${locale}/chat`);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      router.push(`/${locale}/chat`);
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative py-12 md:py-20 lg:py-32 overflow-hidden w-full">
      {/* Decorative background elements - adjusted for better appearance on mobile */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-background/80 via-background to-background/80 backdrop-blur-sm"
        />
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-10 w-[300%] max-w-[36rem] aspect-square -translate-x-1/2 bg-gradient-to-r from-violet-300/30 to-purple-300/30 blur-3xl dark:from-violet-700/30 dark:to-purple-700/30 sm:w-[100%]"
        />
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-10 w-[300%] max-w-[36rem] aspect-square translate-x-1/4 bg-gradient-to-r from-indigo-300/30 to-blue-300/30 blur-3xl dark:from-indigo-700/30 dark:to-blue-700/30 sm:w-[100%]"
        />
      </div>

      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        <div className="flex flex-col items-center justify-center text-center space-y-5 md:space-y-8 mx-auto">
          <div className="inline-flex items-center rounded-full border border-border bg-background/50 px-3 py-1 text-xs sm:text-sm backdrop-blur-md">
            <span className="font-medium">
              {dictionary.introducing || 'Introducing Attma'}
            </span>
            <Sparkles className="ml-1 size-3 sm:size-3.5 text-primary" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl xl:text-7xl max-w-3xl mx-auto bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-2">
            {dictionary.title}
          </h1>

          <p className="max-w-[750px] text-base sm:text-lg text-muted-foreground md:text-xl px-3">
            {dictionary.subtitle}
          </p>

          <div className="w-full max-w-3xl mt-5 md:mt-8 px-2 sm:px-0">
            <form onSubmit={handleSubmit} className="w-full">
              <div className="relative bg-background/20 backdrop-blur-md rounded-xl overflow-hidden border border-[#20c997]/30 shadow-lg">
                {/* Add container to control placeholder display and text overflow */}
                <div className="relative w-full">
                  <Input
                    type="text"
                    placeholder={currentText || (dictionary.promptPlaceholder || 'Ask Attma...')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 h-14 sm:h-16 md:h-20 text-base sm:text-lg border-0 bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground/80 placeholder:text-sm sm:placeholder:text-base"
                    autoComplete="off"
                    style={{
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden'
                    }}
                    aria-label={dictionary.promptPlaceholder || 'Ask Attma...'}
                  />
                  {/* No visual truncation indicator - clean design */}
                </div>
                <div className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2">
                  <Button
                    type="submit"
                    size="icon"
                    className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-[#20c997] hover:bg-[#20c997]/90 shadow-md transition-all active:scale-95 disabled:opacity-70"
                    aria-label="Submit question"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className="h-4 w-4 sm:h-5 sm:w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-6 md:mt-8 flex overflow-x-auto scrollbar-hide pb-1 -mx-2 px-2">
              <div className="flex gap-2 sm:gap-3 flex-nowrap sm:flex-wrap justify-start sm:justify-center mx-auto max-w-full snap-x snap-mandatory">
                {dictionary.suggestionBubbles && Object.entries(dictionary.suggestionBubbles).map(([key, text]) => {
                  if (!text) return null;
                  
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={`Suggestion: ${text}`}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full border border-[#343541]/20
                              bg-background/30 backdrop-blur-sm hover:border-[#20c997]/50 transition-all
                              text-foreground/80 hover:text-foreground hover:bg-background/50 active:scale-95 whitespace-nowrap
                              touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#20c997]/50 focus:ring-offset-1
                              snap-start snap-always select-none"
                      onClick={() => {
                        if (isSubmitting) return;
                        setQuery(text);
                        setIsSubmitting(true);
                        
                        // Add slight delay for mobile feedback
                        setTimeout(() => {
                          const form = document.querySelector<HTMLFormElement>('form');
                          if (form) {
                            form.requestSubmit();
                          } else {
                            handleSubmit(new Event('click') as unknown as React.FormEvent);
                          }
                        }, 50);
                      }}
                      disabled={isSubmitting}
                    >
                      {text}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
