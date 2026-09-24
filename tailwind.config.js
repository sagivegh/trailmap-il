/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nature: {
          50: '#f2f8f4',
          100: '#e1efe6',
          200: '#c5dfd0',
          300: '#9bc6b0',
          400: '#6ca88c',
          500: '#4a8b6e',
          600: '#387057',
          700: '#2e5947',
          800: '#27473a',
          900: '#213b31',
          950: '#11201b',
        },
        earth: {
          50: '#fbf8f5',
          100: '#f6f0ea',
          200: '#ebdcd0',
          300: '#dec2b0',
          400: '#cca28c',
          500: '#b8826b',
          600: '#a36d59',
          700: '#865646',
          800: '#6f473c',
          900: '#5c3d34',
        },
        water: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
