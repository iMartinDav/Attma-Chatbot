import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUp } from 'lucide-react';
import { useId, useState } from 'react';

export interface HeroInputProps {
  /**
   * Current placeholder text (usually from typing effect)
   */
  placeholder: string;

  /**
   * Default placeholder text when typing effect is empty
   */
  defaultPlaceholder?: string;

  /**
   * Value of the input field
   */
  value: string;

  /**
   * Callback when input value changes
   */
  onChange: (value: string) => void;

  /**
   * Callback when form is submitted
   */
  onSubmit: () => void;

  /**
   * Whether the input is currently submitting
   * @default false
   */
  isSubmitting?: boolean;

  /**
   * ARIA label for the input field
   */
  ariaLabel?: string;
}

/**
 * A specialized input component for hero sections with
 * typing effect placeholder and submit button
 */
export function HeroInput({
  placeholder,
  defaultPlaceholder = 'Ask Attma...',
  value,
  onChange,
  onSubmit,
  isSubmitting = false,
  ariaLabel,
}: HeroInputProps) {
  // Track focus state
  const [isFocused, setIsFocused] = useState(false);

  // Generate unique IDs for accessibility
  const inputId = useId();
  const labelId = useId();

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmitting) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full" aria-label="Ask Attma">
      <div className="relative bg-background/20 backdrop-blur-md rounded-xl overflow-hidden border border-[#20c997]/30 shadow-lg">
        <label id={labelId} htmlFor={inputId} className="sr-only">
          {ariaLabel || defaultPlaceholder}
        </label>
        <div className="relative w-full">
          <Input
            id={inputId}
            type="search"
            placeholder={placeholder || defaultPlaceholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="w-full px-4 sm:px-6 py-3 sm:py-4 h-14 sm:h-16 md:h-20 text-base sm:text-lg border-0 bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground/80 placeholder:text-sm sm:placeholder:text-base"
            autoComplete="off"
            aria-labelledby={labelId}
            aria-label={ariaLabel || defaultPlaceholder}
            aria-describedby={isSubmitting ? 'search-status' : undefined}
            style={{
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          />
        </div>
        <div className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2">
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-[#20c997] hover:bg-[#20c997]/90 shadow-md transition-all active:scale-95 disabled:opacity-70"
            aria-label="Submit question"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div
                className="h-4 w-4 sm:h-5 sm:w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
                data-testid="loading-spinner"
                aria-hidden="true"
              />
            ) : (
              <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
