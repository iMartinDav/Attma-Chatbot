import {
  defaultLocale,
  isValidLocale,
} from '@/lib/internationalization/config';
import { getDictionary } from '@/lib/internationalization/dictionaries';
import type { HomePageDictionary } from '@/lib/types/component-types';
import Cases from './(home)/components/cases';
import { CTA } from './(home)/components/cta';
import { Features } from './(home)/components/features';
import { Hero } from './(home)/components/hero';
import { Stats } from './(home)/components/stats';

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

  // A locale missing the home section falls back to English, never to
  // copy that lives in code.
  const dictionary = (await getDictionary(
    locale,
  )) as unknown as HomePageDictionary;
  const home =
    dictionary.home ??
    ((await getDictionary(defaultLocale)) as unknown as HomePageDictionary)
      .home;

  return (
    <main className="flex w-full flex-col items-center justify-center">
      <Hero dictionary={home.hero} locale={locale} />
      <Features dictionary={home.features} locale={locale} />
      {home.cases && <Cases dictionary={home.cases} locale={locale} />}
      <Stats locale={locale} />
      <CTA dictionary={home.cta} locale={locale} />
    </main>
  );
}
