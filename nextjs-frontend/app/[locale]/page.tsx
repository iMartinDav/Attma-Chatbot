import {
  defaultLocale,
  isValidLocale,
} from '@/lib/internationalization/config';
import { getDictionary } from '@/lib/internationalization/dictionaries';
import { Hero } from './(home)/components/hero';
import { Features } from './(home)/components/features';
import Cases from './(home)/components/cases';
import { CTA } from './(home)/components/cta';
import { Testimonials } from './(home)/components/testimonials';
import { Stats } from './(home)/components/stats';
import type { HomePageDictionary } from '@/lib/types/component-types';

// Define the props type according to Next.js App Router
type Props = {
  params: Promise<{ locale: string }>; // params should be a Promise
};

// Use async/await with proper type assertion
export default async function HomePage({ params }: Props) {
  // Await the params Promise
  const { locale: rawLocale } = await params;

  // Extract locale with proper validation
  const locale = isValidLocale(rawLocale) ? rawLocale : defaultLocale;

  // Fetch dictionary asynchronously
  const rawDictionary = await getDictionary(locale);
  const dictionary = (rawDictionary as unknown as HomePageDictionary) || {};

  // Default content as fallback
  const homeData: HomePageDictionary['home'] = {
    hero: dictionary.home?.hero || {
      title: "The World's First AI Bioinformatician",
      subtitle:
        'Revolutionize your biological data analysis with cutting-edge AI',
    },
    features: dictionary.home?.features || {
      title: 'Supercharge Your Research',
      subtitle: 'Analyze complex biological data faster than ever before',
    },
    cases: dictionary.home?.cases || {
      title: 'Potential Applications',
      subtitle: 'Discover how Attmacan revolutionize your research workflows',
      viewAll: 'Join the beta program',
      readCase: 'Learn more',
    },
    testimonials: dictionary.home?.testimonials || {
      title: 'Hear from our users',
      subtitle: 'Researchers around the world trust Attmafor their work',
    },
    cta: dictionary.home?.cta || {
      title: 'Ready to transform your research?',
      subtitle:
        'Join thousands of scientists accelerating discoveries with Attma',
    },
  };

  // Loading state check
  if (!dictionary || Object.keys(dictionary).length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col items-center justify-center">
      <Hero dictionary={homeData.hero} locale={locale} />
      <Features dictionary={homeData.features} locale={locale} />
      {homeData.cases && <Cases dictionary={homeData.cases} locale={locale} />}
      <Stats locale={locale} />
      <Testimonials dictionary={homeData.testimonials} locale={locale} />
      <CTA dictionary={homeData.cta} locale={locale} />
    </main>
  );
}
