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
        // Cores da marca Arthemi
        primary: {
          50: '#f0f9f4',
          100: '#d9f0e3',
          200: '#b5e1ca',
          300: '#84cba8',
          400: '#51ae82',
          500: '#2d9266',
          600: '#1e7652',
          700: '#185f43',
          800: '#154c37',
          900: '#123f2e',
          950: '#09231a',
        },
        secondary: {
          50: '#fef6f0',
          100: '#fde9db',
          200: '#fad0b6',
          300: '#f6b087',
          400: '#f18656',
          500: '#ed6633',
          600: '#de4c23',
          700: '#b83a1e',
          800: '#933020',
          900: '#772a1d',
          950: '#40130d',
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
