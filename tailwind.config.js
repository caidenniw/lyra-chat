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
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'scale-up': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'message-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'fade-in': 'fade-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slide-in-left 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'modal-in': 'scale-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'message-in': 'message-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
