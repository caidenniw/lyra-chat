/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#F8F6F2',
          alt: '#F0EDE8',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          hover: '#F5F2ED',
          alt: '#FAFAF7',
        },
        border: {
          DEFAULT: '#E2DDD5',
          light: '#EDE9E1',
        },
        primary: {
          DEFAULT: '#0A2947',
          hover: '#081F37',
          light: '#1A4A7A',
          subtle: '#EDF2F8',
        },
        accent: {
          DEFAULT: '#BA6A4C',
          hover: '#A35A3E',
          light: '#D4896E',
          subtle: '#FDF1EC',
          maroon: '#7B2525',
        },
        text: {
          DEFAULT: '#2C2A25',
          muted: '#6B665C',
          dim: '#9C978E',
        },
        user: {
          bg: '#0A2947',
          text: '#FFFFFF',
        },
        assistant: {
          bg: '#F5F2ED',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(44,42,37,0.04), 0 1px 2px rgba(44,42,37,0.06)',
        'medium': '0 4px 6px -1px rgba(44,42,37,0.05), 0 2px 4px -2px rgba(44,42,37,0.05)',
        'card': '0 2px 8px rgba(96,116,86,0.1)',
      },
    },
  },
  plugins: [],
}
