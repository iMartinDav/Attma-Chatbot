import type { Metadata } from 'next';
import { getDictionary } from '@/lib/internationalization/dictionaries';
import {
  i18n,
  type Locale,
  type LocaleParams,
} from '@/lib/internationalization/config';
import Header from './(home)/components/header';
import Footer from './(home)/components/footer';
import { Toaster } from 'sonner';

// Base metadata configuration
const baseMetadata: Metadata = {
  metadataBase: new URL('https://Attmachatbot.vercel.app'),
  title: 'Attma- The AI Bioinformatician',
  description:
    "Revolutionize your biological research with the world's first AI Bioinformatician",
  openGraph: {
    title: 'Attma- The AI Bioinformatician',
    description:
      'Revolutionize your research with AI-powered bioinformatics analysis',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'AttmaAI Bioinformatician',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Attma- The AI Bioinformatician',
    description:
      'Revolutionize your research with AI-powered bioinformatics analysis',
    images: ['/og-image.jpg'],
  },
};

export async function generateMetadata({
  params: paramsPromise,
}: {
  params: Promise<LocaleParams>;
}): Promise<Metadata> {
  const params = await paramsPromise;
  const dictionary = await getDictionary(params.locale);

  return {
    ...baseMetadata,
    title: dictionary?.meta?.title || baseMetadata.title,
    description: dictionary?.meta?.description || baseMetadata.description,
    openGraph: {
      ...baseMetadata.openGraph,
      title: dictionary?.meta?.title || baseMetadata.openGraph?.title,
      description:
        dictionary?.meta?.description || baseMetadata.openGraph?.description,
    },
    twitter: {
      ...baseMetadata.twitter,
      title: dictionary?.meta?.title || baseMetadata.twitter?.title,
      description:
        dictionary?.meta?.description || baseMetadata.twitter?.description,
    },
  };
}

export const viewport = {
  maximumScale: 1,
};

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: Locale } | Promise<{ locale: Locale }>;
}) {
  // Await params if it's a Promise
  const resolvedParams = await Promise.resolve(params);
  const locale = resolvedParams.locale;

  const dictionary = await getDictionary(locale);

  return (
    <>
      <Header locale={locale} dictionary={dictionary} />
      <main>{children}</main>
      <Footer locale={locale} dictionary={dictionary} />
      <Toaster position="top-center" />
    </>
  );
}
