/**
 * Design tokens for the Attma application
 * Centralized location for colors, gradients, and other design values
 */

// Brand colors
export const COLORS = {
  geniePink: '#25C6A3', // Primary brand color
  geniePinkLight: '#FF8299', // Lighter tint for gradients
  geniePinkDark: '#D63E5C', // Deeper shade for emphasis
  geniePinkAccent: '#FF7387', // Softer version for accents
  genteelGray: '#3A3A3A', // Sophisticated dark gray for text
  subtlePink: '#FFF0F3', // Very light pink for backgrounds
} as const;

// Text gradients for headings - more refined and elegant with better light mode visibility
export const TEXT_GRADIENTS = {
  // Elegant gradient with subtle brand influence (default)
  elegant: {
    // Darker gradient with better contrast for light mode
    light: 'from-black via-[#2B0066] to-[#1A0033]',
    // Subtle shimmer from pure white to soft light pink to light gray
    dark: 'from-white via-[#FFF5F7] to-[#F0F0F0]',
  },
  // More pronounced brand gradient but still sophisticated
  brand: {
    // Enhanced contrast for light mode with brand color influence
    light: 'from-black via-[#2B0066] to-[#1A0033]',
    // Crisp white to soft brand highlight
    dark: `from-white via-[#FFEFF2] to-[${COLORS.subtlePink}]`,
  },
  // Premium-looking gradient incorporating brand colors
  premium: {
    // Improved contrast for light mode
    light: 'from-black via-[#2B0066] to-[#1A0033]',
    // Pure white to soft pink glow
    dark: `from-white via-[${COLORS.subtlePink}] to-[${COLORS.geniePinkLight}]/90`,
  },
  // Research/scientific style gradient
  scientific: {
    // Enhanced contrast for light mode
    light: 'from-black via-[#2B0066] to-[#1A0033]',
    // Clean white to light blue-gray
    dark: 'from-white via-[#F7F7F9] to-[#E5E7EB]',
  },
} as const;

// Button gradients with refined color stops
export const BUTTON_GRADIENTS = {
  primary: `from-[${COLORS.geniePink}] via-[${COLORS.geniePinkAccent}] to-[#FF8C65]`,
  primaryHover: `from-[${COLORS.geniePinkDark}] via-[${COLORS.geniePink}] to-[#FF7A50]`,
  subtle: `from-[${COLORS.geniePinkDark}] to-[${COLORS.geniePink}]`,
} as const;

/**
 * Returns a tailwind class string for text gradients based on style and theme
 *
 * @param style - The gradient style to use
 * @param theme - 'light' or 'dark' theme
 * @returns Tailwind classes for the gradient
 */
export const getTextGradient = (
  style: keyof typeof TEXT_GRADIENTS = 'elegant',
  theme?: 'light' | 'dark',
) => {
  // Determine theme based on input or default to light
  const currentTheme = theme || 'light';

  // Return the appropriate gradient with the clip text setup
  return `bg-gradient-to-r ${TEXT_GRADIENTS[style][currentTheme]} bg-clip-text text-transparent`;
};

/**
 * Returns a tailwind class string for button gradients
 *
 * @param style - The gradient style to use
 * @param isHovered - Whether the button is in hover state
 * @returns Tailwind classes for the gradient
 */
export const getButtonGradient = (
  style: keyof typeof BUTTON_GRADIENTS = 'primary',
  isHovered = false,
) => {
  if (isHovered && style === 'primary') {
    return `bg-gradient-to-r ${BUTTON_GRADIENTS.primaryHover}`;
  }
  return `bg-gradient-to-r ${BUTTON_GRADIENTS[style]}`;
};
