import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class', // Changed from 'media' to 'class' for better control
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    fontFamily: {
      sans: ['geist'],
      mono: ['geist-mono'],
    },
    extend: {
      // Animation keyframes
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-in-out',
        slideUp: 'slideUp 0.5s ease-out 0.2s both',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // Core color definitions
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Chart colors
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        // Sidebar-specific colors
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        attma: {
          primary: '#25C6A3',
          accent: '#4EF9DB',
          logo: '#80f1e5', // Adding specific logo color for consistent reference
          muted: 'rgba(37, 198, 163, 0.1)',
          border: 'rgba(37, 198, 163, 0.2)',
        },
      },
      // Backdrop filter settings
      backdropBlur: {
        sidebar: '16px',
        'sidebar-desktop': '20px',
      },
      backdropSaturate: {
        sidebar: '180%',
        'sidebar-desktop': '180%',
      },
      // Enhanced dark mode shadows
      boxShadow: {
        'dark-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.35)',
        'dark-md':
          '0 4px 6px -1px rgba(0, 0, 0, 0.35), 0 2px 4px -1px rgba(0, 0, 0, 0.25)',
        'dark-lg':
          '0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -2px rgba(0, 0, 0, 0.25)',
        'soft-sm': '0 2px 4px rgba(37, 198, 163, 0.06)',
        'soft-md': '0 4px 6px rgba(37, 198, 163, 0.1)',
        'soft-lg': '0 10px 15px rgba(37, 198, 163, 0.1)',
        glass:
          '0 0 0 1px rgba(37, 198, 163, 0.05), 0 4px 6px rgba(37, 198, 163, 0.1)',
      },
      // Custom dark mode background utilities
      backgroundColor: {
        'dark-card-hover': 'hsl(240 17% 12%)',
        'dark-highlight': 'hsl(164 84% 59% / 0.1)',
        scientific: {
          subtle: 'hsl(164 84% 98%)',
          hover: 'hsl(164 84% 97%)',
          active: 'hsl(164 84% 96%)',
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
    ({ addUtilities }: { addUtilities: (utilities: object) => void }) => {
      // Add custom utilities
      const newUtilities = {
        // Simple glass effect base
        '.glass': {
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
          'background-color': 'rgba(255, 255, 255, 0.5)',
          '@apply dark:bg-black/20': {},
        },

        // Simplified sidebar glass effect
        '.sidebar-glass': {
          '@apply backdrop-blur-sidebar bg-sidebar/85': {},
          'backdrop-saturate': '110%',
          border: '1px solid hsl(var(--sidebar-border))',
          'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        },

        // Desktop-specific sidebar glass
        '.sidebar-glass-desktop': {
          '@apply backdrop-blur-sidebar-desktop': {},
          'backdrop-saturate': '115%',
        },
        // Dark mode glass effect
        '.dark-glass': {
          'backdrop-filter': 'blur(16px) saturate(120%)',
          'background-color': 'hsl(240 17% 9% / 0.85)',
          border: '1px solid hsl(240 3.7% 15.9% / 0.3)',
        },
        '.dark-glass-hover': {
          'background-color': 'hsl(240 17% 12% / 0.9)',
          'border-color': 'hsl(164 84% 59% / 0.2)',
        },
        // Enhanced glass effects
        '.glass-light': {
          'backdrop-filter': 'blur(16px) saturate(180%)',
          'background-color': 'rgba(255, 255, 255, 0.8)',
          border: '1px solid rgba(37, 198, 163, 0.1)',
          'box-shadow': '0 4px 6px rgba(37, 198, 163, 0.05)',
        },
        '.glass-card': {
          'background-color': 'rgba(255, 255, 255, 0.9)',
          border: '1px solid rgba(37, 198, 163, 0.15)',
          'box-shadow': '0 4px 6px rgba(37, 198, 163, 0.07)',
        },
        // Scientific interaction states
        '.scientific-hover': {
          transition: 'all 0.2s ease',
          '&:hover': {
            'background-color': 'rgba(37, 198, 163, 0.05)',
            'border-color': 'rgba(37, 198, 163, 0.3)',
          },
        },
      };

      addUtilities(newUtilities);
    },
  ],
};

export default config;
