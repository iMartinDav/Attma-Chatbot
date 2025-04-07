import { Suspense } from 'react';
import type { Metadata } from 'next';
import type { LocaleParams } from '@/lib/internationalization/config';
import { getDictionary } from '@/lib/internationalization/dictionaries';
import { ContactForm } from './components/contact-form';
import { Skeleton } from '@/components/ui/skeleton';
import {
  prepareContactContent,
  getContactMetadata,
} from '@/lib/utils/contact-helpers';

// Define the proper Page props type
interface PageProps {
  params: Promise<LocaleParams>;
}

// Contact form loading skeleton component
function ContactFormSkeleton() {
  return (
    <div className="container mx-auto px-4 md:px-6 py-12 md:py-20 lg:py-24 max-w-7xl">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <div className="space-y-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="size-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-[600px] w-full rounded-lg" />
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const resolvedParams = await params; // Unwrap the Promise
  const locale = resolvedParams.locale;
  const dictionary = await getDictionary(locale);

  return getContactMetadata(dictionary);
}

export default async function ContactPage({ params }: PageProps) {
  const resolvedParams = await params; // Unwrap the Promise
  const locale = resolvedParams.locale;
  const dictionary = await getDictionary(locale);
  const contactDictionary = prepareContactContent(dictionary);

  return (
    <Suspense fallback={<ContactFormSkeleton />}>
      <ContactForm dictionary={contactDictionary} locale={locale} />
    </Suspense>
  );
}
