/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0b0e10', 900: '#0f1214', 850: '#141819', 800: '#181d1f', 700: '#222a2d', 600: '#2e383c', 500: '#475257' },
        bone: { 50: '#f6f4f0', 100: '#ece9e4', 300: '#c9c5bd', 400: '#a29e96' },
        petrol: { 300: '#6fd3cf', 400: '#2fb3b0', 500: '#14a3a6', 600: '#0f8b8d', 700: '#0b6e71' },
        sky: { 400: '#5aa9e6' },
        warn: '#e3a33b',
        danger: '#e5604d',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
