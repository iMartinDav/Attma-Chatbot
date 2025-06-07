import type { SuggestionBubble } from '@/components/ui/suggestion-bubbles';

/**
 * Dictionary-style object containing suggestion bubble texts
 */
export interface SuggestionBubbleDict {
  [key: string]: string | undefined;
}

/**
 * Convert a dictionary-style object of suggestions into a properly formatted
 * array of SuggestionBubble objects for use with the SuggestionBubbles component
 *
 * @param dict Dictionary containing suggestion texts with keys as IDs
 * @returns Array of SuggestionBubble objects, filtering out empty values
 */
export function formatSuggestionBubbles(
  dict?: SuggestionBubbleDict,
): SuggestionBubble[] {
  if (!dict) return [];

  return Object.entries(dict)
    .filter(([_, text]) => Boolean(text))
    .map(([key, text]) => ({
      id: key,
      text: text as string,
    }));
}
