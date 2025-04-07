import type { Metadata } from 'next';
import type { LocaleParams, Locale } from '@/lib/internationalization/config';
import { getDictionary } from '@/lib/internationalization/dictionaries';
import { GradientHeading } from '@/components/ui/gradient-heading';
import { ContactCTA } from './components/contact-cta';
import { FeatureComparisonTable } from './components/feature-comparison-table';
import { PricingFAQ } from './components/pricing-faq';
import { PricingHeader } from './components/pricing-header';
import { PricingTiers } from './components/pricing-tiers';

// Metadata generation
export async function generateMetadata({
  params: paramsPromise,
}: {
  params: Promise<LocaleParams>;
}): Promise<Metadata> {
  const params = await paramsPromise;
  const { locale } = params;
  const dictionary = await getDictionary(locale);
  const pricingTitle = (dictionary.pricing?.title as string) || 'Pricing';
  const metaTitle = (dictionary.meta?.title as string) || 'Attma';
  const subtitle = (dictionary.pricing?.subtitle as string) || '';
  return {
    title: `${pricingTitle} | ${metaTitle}`,
    description: subtitle,
  };
}

// Page component
export default async function PricingPage({
  params: paramsPromise,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const params = await paramsPromise;
  const { locale } = params;
  const dict = await getDictionary(locale);

  // Add null safety checks to prevent accessing properties of undefined objects
  // and provide fallback data for critical sections
  const pricing = dict.pricing || {};

  // Check if plans exist and provide a fallback structure if not
  const plans = pricing.plans || {
    free: {
      title: 'Free',
      price: '$0',
      description: 'Perfect for individual researchers getting started',
      button: 'Get Started',
      features: [],
    },
    pro: {
      title: 'Pro',
      price: '$49',
      description: 'For research teams needing advanced features',
      button: 'Start Free Trial',
      features: [],
    },
    enterprise: {
      title: 'Enterprise',
      price: 'Custom',
      description: 'Tailored solutions for institutions',
      button: 'Contact Sales',
      features: [],
    },
  };

  // Similarly check for other required properties
  const faq = pricing.faq || { title: 'FAQ', questions: {} };
  const cta = pricing.cta || {};

  return (
    <main className="flex flex-col items-center justify-center w-full min-h-[calc(100vh-4rem)]">
      {/* Hero section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-secondary/30">
        <div className="container px-4 md:px-6 mx-auto max-w-7xl">
          <PricingHeader dictionary={pricing} />
          <PricingTiers dictionary={plans} locale={locale} />
        </div>
      </section>

      {/* Feature comparison */}
      <section id="feature-comparison" className="w-full py-16 md:py-24">
        <div className="container px-4 md:px-6 mx-auto max-w-7xl">
          <div className="flex flex-col items-center space-y-4 text-center mb-12">
            <GradientHeading
              as="h2"
              gradient="brand"
              className="text-2xl md:text-3xl font-bold tracking-tight"
            >
              {faq.title}
            </GradientHeading>
            <p className="max-w-[700px] text-muted-foreground">
              {pricing.subtitle || 'Choose the right plan for your needs'}
            </p>
          </div>
          <FeatureComparisonTable locale={locale} />
        </div>
      </section>

      {/* FAQ section */}
      <section className="w-full py-16 md:py-24 bg-secondary/30">
        <div className="container px-4 md:px-6 mx-auto">
          <PricingFAQ dictionary={faq} />
        </div>
      </section>

      {/* CTA section */}
      <section className="w-full py-12 md:py-18">
        <div className="container px-4 md:px-6 mx-auto max-w-5xl">
          <ContactCTA locale={locale} dictionary={cta} />
        </div>
      </section>
    </main>
  );
}
