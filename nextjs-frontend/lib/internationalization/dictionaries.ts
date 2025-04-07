import 'server-only';
import type { Locale } from './config';

// Define our own TestimonialItem interface based on how it's used in the code
export interface TestimonialItem {
  name: string;
  role: string;
  company: string;
  text: string;
  avatar?: string;
}

// Define a more general Dictionary type that matches what the actual function returns
export type Dictionary = {
  [key: string]: any;
};

// Simple cache to avoid loading the same dictionary multiple times
const dictionaries: Record<string, Promise<Dictionary>> = {};

export const getDictionary = async (locale: Locale): Promise<Dictionary> => {
  if (!dictionaries[locale]) {
    dictionaries[locale] = import(`./dictionaries/${locale}.json`).then(
      (module) => module.default,
    );
  }
  return dictionaries[locale];
};

/**
 * Helper function to get a nested value from a dictionary using a path array
 * Example: getTranslation(dictionary, ['common', 'nav', 'features'])
 */
export function getTranslation(
  dictionary: any,
  path: string[],
): string | undefined {
  let current = dictionary;

  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return typeof current === 'string' ? current : undefined;
}
