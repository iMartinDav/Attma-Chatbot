import type { Locale } from '../internationalization/config';

export interface CaseStudyItem {
  id: string;
  title: string;
  description: string;
  image?: string;
  tag: string;
  /** Opens the chat with this request when the card's button is pressed. */
  prompt?: string;
}

export interface CasesProps {
  locale: Locale;
  dictionary?: {
    title?: string;
    subtitle?: string;
    viewAll?: string;
    readCase?: string;
    items?: CaseStudyItem[];
  };
}

export interface FeaturesProps {
  locale: Locale;
  dictionary: {
    title: string;
    subtitle: string;
    items?: Array<{
      id: string;
      title: string;
      description: string;
      icon?: string;
    }>;
  };
}

export interface CTAProps {
  locale: Locale;
  dictionary: {
    title: string;
    subtitle: string;
    button?: string;
    viewPricing?: string;
    noCredit?: string;
  };
}

export interface HeroProps {
  locale: Locale;
  dictionary: {
    title: string;
    subtitle: string;
    introducing?: string;
    ctaStart?: string;
    ctaExplore?: string;
  };
}

export interface HomePageDictionary {
  meta: {
    title: string;
    description: string;
  };
  home: {
    hero: HeroProps['dictionary'];
    features: FeaturesProps['dictionary'];
    cases?: CasesProps['dictionary'];
    cta: CTAProps['dictionary'];
  };
}

export interface ContactBenefit {
  title: string;
  description: string;
}

export interface ContactFormProps {
  locale: Locale;
  dictionary: {
    title: string;
    subtitle: string;
    form: {
      firstName: string;
      lastName: string;
      email: string;
      company: string;
      researchArea: string;
      message: string;
      submit: string;
      policy: string;
    };
    benefits: {
      expertSupport: ContactBenefit;
      research: ContactBenefit;
      response: ContactBenefit;
      privacy: ContactBenefit;
    };
    researchAreas?: {
      genomics: string;
      proteomics: string;
      drugDiscovery: string;
      medicalImaging: string;
      clinicalTrials: string;
      other: string;
    };
    errors?: {
      general: string;
      required: string;
      invalidEmail: string;
      submission: string;
    };
    success: {
      title: string;
      message: string;
      button: string;
    };
  };
}
