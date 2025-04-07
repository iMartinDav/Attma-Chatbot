'use client';

import { GradientHeading } from '@/components/ui/gradient-heading';
import { COLORS } from '@/lib/design-tokens';

// Define the proper interface for the component props
interface PricingHeaderProps {
  dictionary: {
    title: string;
    subtitle: string;
    plans?: any; // Include this to match the parent component's structure
    faq?: any; // Include this to match the parent component's structure
    flexiblePlans?: string;
  };
}

export function PricingHeader({ dictionary }: PricingHeaderProps) {
  return (
    <div className="flex flex-col items-center space-y-4 text-center max-w-3xl mx-auto">
      <span
        className="inline-block px-4 py-1.5 mb-3 rounded-full text-sm font-medium"
        style={{
          background: `linear-gradient(to right, ${COLORS.geniePink}15, ${COLORS.geniePink}30)`,
          color: COLORS.geniePink,
        }}
      >
        {dictionary.flexiblePlans || 'Flexible Plans'}
      </span>

      <GradientHeading
        as="h1"
        gradient="elegant"
        className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-2"
      >
        {dictionary.title}
      </GradientHeading>

      <p className="max-w-[700px] text-muted-foreground md:text-xl leading-relaxed">
        {dictionary.subtitle}
      </p>
    </div>
  );
}
