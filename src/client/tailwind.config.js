/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/index.html', './src/client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marble: '#11151d', panel: '#1b2029', crimson: '#9f3d4f', gold: '#d6b678',
        olive: '#87966d', muted: '#929aa6', ivory: '#ece6d7',
      },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'sans-serif'], display: ['Georgia', 'serif'] },
    },
  },
  plugins: [],
};
