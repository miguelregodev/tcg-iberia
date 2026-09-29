import type { Config } from 'tailwindcss';
import postcss from 'postcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Kept in sync with tailwind.config.js (the config actually loaded
        // by PostCSS — .js takes precedence over .ts when both exist).
        dark: {
          bg: '#171625',
          bgSecondary: '#1D1B2B',
          surface: '#211F30',
          surfaceHover: '#2A2740',
          border: 'rgba(255,255,255,0.08)',
          borderStrong: 'rgba(255,255,255,0.16)',
        },
        premium: {
          gold: '#F5E77A',
          gold_dark: '#E8D766',
          red: '#E2685C',
        },
        text: {
          primary: '#F5F3EA',
          secondary: '#A6A3B5',
          muted: '#736F86',
        },
        success: {
          DEFAULT: '#5FBE87',
          bg: 'rgba(95,190,135,0.12)',
        },
        warning: {
          DEFAULT: '#E8B95B',
          bg: 'rgba(232,185,91,0.12)',
        },
        danger: {
          DEFAULT: '#E2685C',
          bg: 'rgba(226,104,92,0.12)',
        },
      },
      fontFamily: {
        sans: ['TypoSlabserif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '0.875rem',
      },
      boxShadow: {
        elevated: '0 8px 30px rgba(0,0,0,0.35)',
        accent: '0 0 0 1px rgba(245,231,122,0.4), 0 8px 24px rgba(245,231,122,0.08)',
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in',
        slideUp: 'slideUp 0.3s ease-out',
        pulse_slow: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
