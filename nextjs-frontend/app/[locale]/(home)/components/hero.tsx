'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/internationalization/config';

// Define the props interface to fix the type error
interface HeroProps {
  dictionary: {
    title: string;
    subtitle: string;
    introducing?: string;
    ctaStart?: string;
    ctaExplore?: string;
  };
  locale: Locale;
}

export const Hero = ({ dictionary, locale }: HeroProps) => {
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

          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Link href={`/${locale}/chat`}>
              <Button size="lg" className="font-medium w-full sm:w-auto">
                {dictionary.ctaStart || 'Start Chatting'}{' '}
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="font-medium w-full sm:w-auto"
            >
              {dictionary.ctaExplore || 'Explore Features'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
