import type { ReactNode } from 'react';

export interface SuggestionBubble {
  id: string;
  text: string;
}

export interface SuggestionBubblesProps {
  /**
   * The suggestion bubbles to display
   */
  suggestions: SuggestionBubble[];

  /**
   * Callback for when a suggestion is clicked
   */
  onSelectSuggestion: (text: string) => void;

  /**
   * Whether suggestions are currently disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Optional custom CSS class for the container
   */
  className?: string;
}

/**
 * A component that displays a row of clickable suggestion bubbles
 * with horizontal scrolling on mobile and wrapping on desktop
 */
export function SuggestionBubbles({
  suggestions,
  onSelectSuggestion,
  disabled = false,
  className = '',
}: SuggestionBubblesProps) {
  if (!suggestions?.length) {
    return null;
  }

  return (
    <div
      className={`mt-6 md:mt-8 flex overflow-x-auto scrollbar-hide pb-1 -mx-2 px-2 ${className}`}
    >
      <div className="flex gap-2 sm:gap-3 flex-nowrap sm:flex-wrap justify-start sm:justify-center mx-auto max-w-full snap-x snap-mandatory">
        {suggestions.map(({ id, text }) => (
          <button
            key={id}
            type="button"
            aria-label={`Suggestion: ${text}`}
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full border border-[#343541]/20
                    bg-background/30 backdrop-blur-sm hover:border-[#20c997]/50 transition-all
                    text-foreground/80 hover:text-foreground hover:bg-background/50 active:scale-95 whitespace-nowrap
                    touch-manipulation focus:outline-none focus:ring-2 focus:ring-[#20c997]/50 focus:ring-offset-1
                    snap-start snap-always select-none"
            onClick={() => !disabled && onSelectSuggestion(text)}
            disabled={disabled}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
