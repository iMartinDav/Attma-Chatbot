'use client';

import { useRouter, usePathname } from 'next/navigation';
import {
  isValidLocale,
  type Locale,
  locales,
} from '@/lib/internationalization/config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Languages } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMemo, memo } from 'react';

interface LanguageOption {
  label: string;
  value: string;
  flag: string;
}

interface LanguageSwitcherProps {
  currentLocale: Locale;
  translations?: Record<string, string>;
}

const LanguageMenuItem = memo(
  ({ option, isSelected }: { option: LanguageOption; isSelected: boolean }) => (
    <motion.div
      initial={{ opacity: 0.8 }}
      animate={{ opacity: 1 }}
      className="flex items-center w-full"
    >
      <span className="text-lg mr-2.5 inline-flex w-7 justify-center">
        {option.flag}
      </span>
      <span className="text-sm font-medium">{option.label}</span>
    </motion.div>
  ),
);

LanguageMenuItem.displayName = 'LanguageMenuItem';

export function LanguageSwitcher({
  currentLocale,
  translations = {},
}: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();

  const languageOptions = useMemo(
    () => [
      { label: translations.en || 'English', value: 'en', flag: '🇬🇧' },
      { label: translations.es || 'Español', value: 'es', flag: '🇲🇽' },
      { label: translations.de || 'Deutsch', value: 'de', flag: '🇩🇪' },
      { label: translations.fr || 'Français', value: 'fr', flag: '🇫🇷' },
      { label: translations.zh || '中文', value: 'zh', flag: '🇨🇳' },
      { label: translations.pt || 'Português', value: 'pt', flag: '🇵🇹' },
      { label: translations.it || 'Italiano', value: 'it', flag: '🇮🇹' },
    ],
    [translations],
  );

  const supportedOptions = useMemo(
    () =>
      languageOptions.filter((option) =>
        locales.includes(option.value as Locale),
      ),
    [languageOptions],
  );

  // Fix the type issue by validating locale before setting it
  const handleSelectChange = (value: string) => {
    if (isValidLocale(value)) {
      // Replace the current locale segment in the pathname with the new locale
      const segments = pathname.split('/');
      segments[1] = value; // The locale is always the first segment after the initial slash
      const newPath = segments.join('/');

      router.push(newPath);
    }
  };

  const triggerClasses =
    'w-[50px] min-w-[50px] h-[40px] rounded-full bg-background/50 backdrop-blur-xs border-neutral-200/30 hover:bg-background/80 transition-all duration-200 px-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary/20';
  const contentClasses =
    'bg-background/80 backdrop-blur-md border-neutral-200/30 rounded-xl shadow-lg p-1 min-w-[180px]';
  const itemBaseClasses = cn(
    'rounded-lg py-2.5 cursor-pointer transition-colors duration-150',
    'hover:bg-primary/10 focus:bg-primary/10',
    'data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary',
    'flex items-center',
  );

  return (
    <div className="relative">
      <Select value={currentLocale} onValueChange={handleSelectChange}>
        <SelectTrigger className={triggerClasses} aria-label="Select language">
          <SelectValue>
            <span className="flex items-center justify-center">
              <span className="sr-only">
                {supportedOptions.find(
                  (option) => option.value === currentLocale,
                )?.label || 'Select language'}
              </span>
              <Languages className="size-5" />
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className={contentClasses} align="end" sideOffset={8}>
          {supportedOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className={itemBaseClasses}
            >
              <LanguageMenuItem
                option={option}
                isSelected={option.value === currentLocale}
              />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default memo(LanguageSwitcher);
