/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        card: 'var(--card)',
        primary: {
          DEFAULT: 'var(--pri)',
          dark: 'var(--prid)',
        },
        foreground: 'var(--txt)',
        muted: 'var(--mut)',
        border: 'var(--bd)',
      },
      borderRadius: {
        card: '14px',
        btn: '10px',
      },
    },
  },
  plugins: [],
};

