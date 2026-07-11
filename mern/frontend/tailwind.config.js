/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-black': 'var(--color-black)',
        'secondary-black': 'var(--color-surface)',
        'primary-yellow': 'var(--color-primary)',
        'secondary-yellow': 'var(--color-primary-hover)',
        'text-light': 'var(--color-white)',
        'dark-gray': 'var(--color-surface-elevated)',
        'card-bg': 'var(--color-surface)',
        'lime-brand': 'var(--color-primary)',
        'lime-brand-light': 'var(--color-primary-hover)',
        'lime-brand-dark': '#8aab0a',
      },
      backgroundColor: {
        'dark': '#f8fafc',
        'card': '#ffffff',
        'input': '#ffffff',
      },
      textColor: {
        'primary': '#0f172a',
        'secondary': '#64748b',
        'accent': '#059669',
      },
      borderColor: {
        'primary': '#e2e8f0',
        'accent': '#059669',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'pulse-slow': 'pulse 3s infinite',
        'float': 'float 6s ease-in-out infinite',
        'scale-in': 'scaleIn 0.5s ease-out forwards',
        'bounce-soft': 'bounceSoft 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      boxShadow: {
        'card': '0 10px 30px -14px rgba(15, 23, 42, 0.16)',
        'glow-lime': '0 12px 28px -12px rgba(5, 150, 105, 0.35)',
        'glow-yellow': '0 12px 28px -12px rgba(245, 158, 11, 0.3)',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      }
    },
  },
  plugins: [],
}
