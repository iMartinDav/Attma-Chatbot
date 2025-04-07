import type { Locale } from '@/lib/internationalization/config';

// Base content interface
export interface ContentItem {
  id: string;
}

// Base component props with dictionary pattern
export interface LocalizedComponentProps<T = Record<string, any>> {
  dictionary: T;
  locale: Locale;
}

// Section component base props
export interface SectionProps<T = Record<string, any>>
  extends LocalizedComponentProps<T> {
  className?: string;
}

// Testimonial specific types
export interface TestimonialItem extends ContentItem {
  quote: string;
  name: string;
  title: string;
  avatar: string;
}

export interface TestimonialsDictionary {
  title: string;
  subtitle: string;
  items?: Partial<TestimonialItem>[];
}

export const DEFAULT_TESTIMONIALS_TEXT = {
  title: 'Trusted by Leading Researchers',
  subtitle:
    'See how scientists and institutions worldwide are advancing their work with Attma',
};
