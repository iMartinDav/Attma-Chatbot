'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/internationalization/config';

// Define props interface with proper typing
interface CTAProps {
  dictionary: {
    title: string;
    subtitle: string;
    button?: string;
    viewPricing?: string;
    noCredit?: string;
  };
  locale: Locale;
}

export const CTA: React.FC<CTAProps> = ({ dictionary, locale }) => {
  // Use button text from dictionary or provide fallback
  const buttonText = dictionary.button || 'Start an analysis';

  return (
    <section className="py-20 w-full">
      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-b from-slate-200/40 to-purple-100/10 dark:from-slate-800/40 dark:to-purple-900/10 border border-border mx-auto">
          {/* Decorative background blur */}
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            <div className="absolute opacity-15 -top-32 -left-32 size-120 rounded-full bg-purple-300/20 dark:bg-purple-800/15 blur-3xl" />
            <div className="absolute opacity-15 -bottom-32 -right-32 size-120 rounded-full bg-purple-300/20 dark:bg-purple-800/15 blur-3xl" />
          </div>

          <div className="relative px-6 py-12 sm:px-12 lg:px-16 flex flex-col items-center justify-center text-center space-y-8">
            <h2 className="text-3xl feature-title-gradient font-bold sm:text-4xl md:text-5xl max-w-2xl mx-auto">
              {dictionary.title}
            </h2>
            <p className="max-w-2xl text-lg text-muted-foreground mx-auto">
              {dictionary.subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md mx-auto">
              <Link href="/chat" className="w-full sm:w-auto">
                <Button size="lg" className="font-medium px-8 w-full">
                  {buttonText} <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
              <Link href={`/${locale}/pricing`} className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="font-medium px-8 w-full"
                >
                  {dictionary.viewPricing || 'View Pricing'}
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              {dictionary.noCredit ||
                'No credit card required. Start with our free plan today.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
