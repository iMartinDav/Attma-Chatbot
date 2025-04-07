import type { Locale } from '../lib/internationalization/config';

// Dictionary interfaces
export interface MetaDictionary {
  title: string;
  description: string;
}

export interface CTADictionary {
  customSolution?: string;
  description?: string;
  buttonText?: string;
  contact?: string;
}

export interface PricingPlanDictionary {
  title: string;
  price: string;
  description: string;
  button: string;
}

export interface PricingPlansDictionary {
  free: PricingPlanDictionary;
  pro: PricingPlanDictionary;
  enterprise: PricingPlanDictionary;
}

export interface FAQDictionary {
  title: string;
  questions: Record<
    string,
    {
      question: string;
      answer: string;
    }
  >;
}

export interface PricingDictionary {
  title: string;
  subtitle: string;
  plans: PricingPlansDictionary;
  faq: FAQDictionary;
  cta?: CTADictionary;
}

export interface AppDictionary {
  meta: MetaDictionary;
  pricing: PricingDictionary;
  // Other sections can be added as needed
}

// Component prop interfaces that use dictionary
export interface LocalizedProps {
  locale: Locale;
}

export interface DictionaryProps<T> {
  dictionary?: T;
}
