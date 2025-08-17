import type { ArtifactKind } from '@/components/chat/artifact';
// import type { ToolInvocation } from 'ai'; // Not available in AI SDK v5
import { z } from 'zod';
import type { Suggestion } from './db/schema';
import type { Locale } from './internationalization/config';

// =============================================================================
// EXISTING TYPES - Internationalization and Components
// =============================================================================

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

// Component-specific types
export interface TestimonialItem {
  id: string;
  quote: string;
  name: string;
  title: string;
  avatar?: string;
}

export interface TestimonialsProps {
  locale: Locale;
  dictionary: {
    title: string;
    subtitle: string;
    items?: TestimonialItem[];
  };
}

export interface CaseStudyItem {
  id: string;
  title: string;
  description: string;
  image?: string;
  tag: string;
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
    testimonials: TestimonialsProps['dictionary'];
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

// =============================================================================
// EXISTING CHAT TYPES - Keep current functionality
// =============================================================================

export type DataPart = { type: 'append-message'; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
}

// =============================================================================
// AI SDK V5 COMPATIBLE TYPES - Updated for v5
// =============================================================================

// AI SDK v5 Tool definitions - updated for new parameter format
export interface ChatToolsV5 {
  createDocument: {
    description: string;
    parameters: {
      type: 'object';
      properties: {
        title: { type: 'string' };
        content: { type: 'string' };
      };
      required: ['title', 'content'];
    };
  };
  updateDocument: {
    description: string;
    parameters: {
      type: 'object';
      properties: {
        id: { type: 'string' };
        description: { type: 'string' };
      };
      required: ['id', 'description'];
    };
  };
  requestSuggestions: {
    description: string;
    parameters: {
      type: 'object';
      properties: {
        documentId: { type: 'string' };
      };
      required: ['documentId'];
    };
  };
  getWeather: {
    description: string;
    parameters: {
      type: 'object';
      properties: {
        location: { type: 'string' };
      };
      required: ['location'];
    };
  };
}

// AI SDK v5 Custom UI Data Types - updated for new streaming
export interface CustomUIDataTypesV5 {
  textArtifact: {
    title: string;
    content: string;
  };
  codeArtifact: {
    title: string;
    content: string;
    language: string;
  };
  pdfArtifact: {
    title: string;
    documentId: string;
  };
  imageArtifact: {
    title: string;
    description: string;
    url: string;
  };
  sheetArtifact: {
    title: string;
    data: Record<string, any>[];
    columns: Array<{ header: string; accessor: string }>;
  };
  graphArtifact: {
    title: string;
    data: any;
    type: 'bar' | 'line' | 'pie';
  };
  // Legacy compatibility
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
}

// AI SDK v5 compatible message format
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | Array<any>;
  toolInvocations?: any[]; // Changed to any[] for AI SDK v5 compatibility
}


export type CustomUIDataTypes = CustomUIDataTypesV5;
