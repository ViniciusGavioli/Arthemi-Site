import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/styles/**/*.css',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Bege/Nude Elegante - Arthemi
        primary: {
          50: '#fdfcfb',
          100: '#f9f5f1',
          200: '#f2ebe3',
          300: '#e8dcd0',
          400: '#d4c4b0',
          500: '#bfa88e',
          600: '#a68b6d',
          700: '#8a7259',
          800: '#715d4a',
          900: '#5d4d3e',
          950: '#322921',
        },
        secondary: {
          50: '#faf8f6',
          100: '#f3eeea',
          200: '#e6ddd4',
          300: '#d5c7b8',
          400: '#c0ab96',
          500: '#ab9179',
          600: '#9a7d64',
          700: '#806654',
          800: '#695447',
          900: '#57463c',
          950: '#2e2420',
        },
        // Accent dourado suave
        accent: {
          50: '#fdfbf7',
          100: '#faf5eb',
          200: '#f4e9d4',
          300: '#ead6b3',
          400: '#dfc08e',
          500: '#d4a96a',
          600: '#c49150',
          700: '#a47642',
          800: '#855f39',
          900: '#6d4e31',
          950: '#3a2819',
        },
        // Tons neutros quentes
        warm: {
          50: '#fefdfb',
          100: '#fcf9f5',
          200: '#f8f2ea',
          300: '#f2e8db',
          400: '#e8d9c7',
          500: '#dcc9b0',
          600: '#ceb698',
          700: '#b89c7a',
          800: '#9a8163',
          900: '#7d6a52',
          950: '#42372b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
