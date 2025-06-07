/**
 * Interface for text truncation options
 */
export interface TruncateTextOptions {
  /**
   * The text to truncate
   */
  text: string;

  /**
   * The maximum length of the text
   */
  maxLength: number;

  /**
   * Whether to add an ellipsis to the truncated text
   * @default false
   */
  ellipsis?: boolean;
}

/**
 * Truncate text to a specific length with optional ellipsis
 */
export function truncateText({
  text,
  maxLength,
  ellipsis = false,
}: TruncateTextOptions): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, ellipsis ? maxLength - 1 : maxLength);
  return ellipsis ? `${truncated}…` : truncated;
}

/**
 * Get the appropriate max length based on viewport width
 * for responsive text truncation
 */
export function getResponsiveTruncateLength(viewportWidth: number): number {
  // Default length for large screens
  let maxLength = 100;

  // Adjust based on viewport width
  if (viewportWidth === 0) return maxLength; // Server-side or not initialized

  // Mobile breakpoints
  if (viewportWidth < 375) return 35; // Small phones
  if (viewportWidth < 480) return 45; // Medium phones
  if (viewportWidth < 640) return 55; // Large phones
  if (viewportWidth < 768) return 70; // Small tablets
  if (viewportWidth < 1024) return 90; // Large tablets

  return maxLength;
}
