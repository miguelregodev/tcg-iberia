/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Centralized design-token system — change the visual identity here.
        dark: {
          bg: '#171625',           // primary page background
          bgSecondary: '#1D1B2B',  // secondary background (alt sections)
          surface: '#211F30',      // card / panel surface
          surfaceHover: '#2A2740', // hovered surface / raised elements
          border: 'rgba(255,255,255,0.08)',
          borderStrong: 'rgba(255,255,255,0.16)',
        },
        premium: {
          gold: '#F5E77A',      // primary accent (CTAs, prices, active states)
          gold_dark: '#E8D766', // accent hover/pressed
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
      fontSize: {
        xs: ['13px', '16px'],      // 12px → 13px
        sm: ['15px', '20px'],      // 14px → 15px
        base: ['17px', '28px'],    // 16px → 17px
        lg: ['19px', '28px'],      // 18px → 19px
        xl: ['21px', '28px'],      // 20px → 21px
        '2xl': ['25px', '32px'],   // 24px → 25px
        '3xl': ['31px', '36px'],   // 30px → 31px
        '4xl': ['37px', '40px'],   // 36px → 37px
        '5xl': ['48px', '48px'],   // 48px (no change for large sizes)
        '6xl': ['61px', '64px'],   // 60px → 61px
        '7xl': ['72px', '72px'],   // 72px (no change)
        '8xl': ['96px', '96px'],   // 96px (no change)
        '9xl': ['128px', '128px'], // 128px (no change)
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
