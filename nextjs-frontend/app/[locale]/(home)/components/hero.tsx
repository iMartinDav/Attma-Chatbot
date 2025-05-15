'use client';

import { useState, useEffect } from 'react';
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
  const router = useRouter();

  const samplePrompts = dictionary.typingEffectPrompts?.length 
    ? dictionary.typingEffectPrompts
    : DEFAULT_SAMPLE_PROMPTS;
  
  useEffect(() => {
    if (!samplePrompts.length) return;
    
    const safeIndex = Math.min(currentPlaceholderIndex, samplePrompts.length - 1);
    const placeholder = samplePrompts[safeIndex];
    
    let typingTimer: NodeJS.Timeout;
    let erasingTimer: NodeJS.Timeout;

    if (isTyping) {
      if (currentText.length < placeholder.length) {
        typingTimer = setTimeout(() => {
          setCurrentText(placeholder.substring(0, currentText.length + 1));
        }, 50);
      } else {
        setIsTyping(false);
        erasingTimer = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
      }
    } else {
      if (currentText.length > 0) {
        erasingTimer = setTimeout(() => {
          setCurrentText(currentText.substring(0, currentText.length - 1));
        }, 30);
      } else {
        setIsTyping(true);
        setCurrentPlaceholderIndex((currentPlaceholderIndex + 1) % samplePrompts.length);
      }
    }

    return () => {
      clearTimeout(typingTimer);
      clearTimeout(erasingTimer);
    };
  }, [currentText, currentPlaceholderIndex, isTyping, samplePrompts]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
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
    }
  };

  return (
    <section className="relative py-20 md:py-32 overflow-hidden w-full">
      {/* Decorative background elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-background/80 via-background to-background/80 backdrop-blur-sm"
        />
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-10 size-[36rem] -translate-x-1/2 bg-gradient-to-r from-violet-300/30 to-purple-300/30 blur-3xl dark:from-violet-700/30 dark:to-purple-700/30"
        />
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-10 translate-x-1/4 size-[36rem] bg-gradient-to-r from-indigo-300/30 to-blue-300/30 blur-3xl dark:from-indigo-700/30 dark:to-blue-700/30"
        />
      </div>

      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        <div className="flex flex-col items-center justify-center text-center space-y-8 mx-auto">
          <div className="inline-flex items-center rounded-full border border-border bg-background/50 px-3 py-1 text-sm backdrop-blur-md">
            <span className="font-medium">
              {dictionary.introducing || 'Introducing Attma'}
            </span>
            <Sparkles className="ml-1 size-3.5 text-primary" />
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-3xl mx-auto bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
            {dictionary.title}
          </h1>

          <p className="max-w-[750px] text-lg text-muted-foreground md:text-xl">
            {dictionary.subtitle}
          </p>

          <div className="w-full max-w-3xl mt-8">
            <form onSubmit={handleSubmit}>
              <div className="relative bg-background/20 backdrop-blur-md rounded-xl overflow-hidden border border-[#20c997]/30 shadow-lg">
                <Input
                  type="text"
                  placeholder={currentText || (dictionary.promptPlaceholder || 'Ask Attma...')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-6 py-4 h-20 text-lg border-0 bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground"
                  autoComplete="off"
                  aria-label={dictionary.promptPlaceholder || 'Ask Attma...'}
                />
                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                  <Button
                    type="submit"
                    size="icon"
                    className="h-10 w-10 rounded-full bg-[#20c997] hover:bg-[#20c997]/90"
                    aria-label="Submit question"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {dictionary.suggestionBubbles && Object.entries(dictionary.suggestionBubbles).map(([key, text]) => {
                if (!text) return null;
                
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={`Suggestion: ${text}`}
                    className="px-4 py-2 text-sm font-medium rounded-full border border-[#343541]/20
                             bg-background/30 backdrop-blur-sm hover:border-[#20c997]/50 transition-colors
                             text-foreground/80 hover:text-foreground hover:bg-background/50"
                    onClick={() => {
                      setQuery(text);
                      const form = document.querySelector<HTMLFormElement>('form');
                      if (form) {
                        form.requestSubmit();
                      } else {
                        handleSubmit(new Event('click') as unknown as React.FormEvent);
                      }
                    }}
                  >
                    {text}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
