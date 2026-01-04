'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DEFAULT_CASE_IMAGE } from '@/lib/constants/case-studies';
import type { CasesProps } from '@/lib/types/component-types';
import { prepareCaseStudies } from '@/lib/utils/case-helpers';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React, { useMemo } from 'react';

const Cases: React.FC<CasesProps> = ({ locale, dictionary = {} }) => {
  // Process data with our utility
  const { textContent, caseStudies } = useMemo(
    () => prepareCaseStudies(dictionary),
    [dictionary],
  );

  return (
    <section id="cases" className="py-20 bg-secondary/30 w-full">
      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        {/* Section header */}
        <div className="flex flex-col items-center space-y-4 text-center mb-12">
          <h2 className="text-3xl font-bold feature-title-gradient sm:text-4xl">
            {textContent.title}
          </h2>
          <p className="max-w-[700px] text-muted-foreground mx-auto">
            {textContent.subtitle}
          </p>
        </div>

        {/* Case study cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {caseStudies.map((caseStudy) => (
            <Card
              key={caseStudy.id}
              className="overflow-hidden bg-background border-border/60 hover:border-[#25C6A3]/30 transition-colors duration-200 h-full flex flex-col"
            >
              <div className="relative w-full h-48">
                {/* Handle image loading more gracefully */}
                <Image
                  src={caseStudy.image || DEFAULT_CASE_IMAGE}
                  alt={caseStudy.title}
                  className="object-cover"
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  // Add error handling for image loading failures
                  onError={(e) => {
                    // Fallback to default image on error
                    const target = e.target as HTMLImageElement;
                    if (target.src !== DEFAULT_CASE_IMAGE) {
                      target.src = DEFAULT_CASE_IMAGE;
                    }
                  }}
                />
                <div className="absolute top-2 left-2 bg-[#25C6A3] text-white px-2 py-1 text-xs rounded">
                  {caseStudy.tag}
                </div>
              </div>
              <CardContent className="p-6 flex flex-col grow">
                <h3 className="text-xl feature-title-gradient font-bold mb-2">
                  {caseStudy.title}
                </h3>
                <p className="text-muted-foreground mb-4 grow">
                  {caseStudy.description}
                </p>
                <Button
                  variant="link"
                  className="p-0 h-auto font-medium justify-start text-[#25C6A3] hover:text-[#25C6A3]/80"
                >
                  {textContent.readCase}{' '}
                  <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Call to action */}
        <div className="mt-12 text-center">
          <Link href={`/${locale}/contact`}>
            <Button
              variant="outline"
              className="bg-background hover:bg-[#25C6A3]/5 border-[#25C6A3]/30 hover:border-[#25C6A3]/50 transition-colors duration-200"
            >
              {textContent.viewAll} <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Cases;
