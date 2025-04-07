// Define the locales supported by your app
export const locales = ['en', 'es', 'fr', 'de', 'zh', 'pt', 'it'] as const;

// Export i18n configuration for compatibility with existing code
export const i18n = {
  locales: ['en', 'es', 'fr', 'de', 'zh', 'pt', 'it'] as const,
  defaultLocale: 'en' as const,
};

// Define the Locale type using the locales array
export type Locale = (typeof locales)[number];

// Interface for params that include locale
export type LocaleParams = {
  locale: Locale;
};

// Dictionary settings
export const defaultLocale = 'en';

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as any);
}
