import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientHeading } from '@/components/ui/gradient-heading';
import { COLORS } from '@/lib/design-tokens';
import type { Locale } from '@/lib/internationalization/config';

interface ContactCTAProps {
  locale: Locale;
  dictionary?: {
    contact?: string;
    customSolution?: string;
    description?: string;
    buttonText?: string;
  };
}

export function ContactCTA({ locale, dictionary = {} }: ContactCTAProps) {
  // Destructure with defaults for cleaner code
  const {
    customSolution = 'Need a custom solution?',
    description = 'Our team can create a tailored pricing plan optimized for your specific research requirements and institutional needs.',
    buttonText = 'Contact Our Team',
  } = dictionary;

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-8 md:p-12 border border-border"
      style={{
        background: `linear-gradient(135deg, ${COLORS.geniePink}10, ${COLORS.geniePink}05)`,
      }}
    >
      {/* Background blur effects */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute opacity-20 -top-32 -left-32 size-[30rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute opacity-20 -bottom-32 -right-32 size-[30rem] rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-4 text-center md:text-left">
          <GradientHeading
            as="h3"
            gradient="brand"
            className="text-2xl font-bold"
          >
            {customSolution}
          </GradientHeading>
          <p className="text-muted-foreground max-w-[500px] leading-relaxed">
            {description}
          </p>
        </div>
        <Link href={`/${locale}/contact`} className="md:shrink-0">
          <Button
            size="lg"
            className="bg-[#25C6A3] hover:opacity-90 transition-opacity border-0 px-8 text-base font-medium shadow-sm"
          >
            {buttonText} <ArrowRight className="ml-1.5 size-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
