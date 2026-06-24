/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#1E3A5F',
          'navy-dark': '#152C47',
          'navy-light': '#2D5A8E',
          orange: '#FF6B35',
          'orange-dark': '#E55A25',
          cream: '#FDF6EE',
          'cream-border': '#e8d8c4',
          blue: '#2D9CDB',
          green: '#27AE60',
          red: '#EB5757',
          'red-light': '#FEF2F2',
          'green-light': '#F0FDF4',
          'blue-light': '#EFF6FF',
          gray: '#6B7280',
          'gray-light': '#F9FAFB',
          'gray-border': '#E5E7EB',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(30,58,95,0.06), 0 4px 12px rgba(30,58,95,0.04)',
        'card-hover': '0 4px 8px rgba(30,58,95,0.08), 0 12px 24px rgba(30,58,95,0.06)',
        'card-raised': '0 8px 16px rgba(30,58,95,0.10), 0 24px 48px rgba(30,58,95,0.08)',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'gentle-pulse': 'gentlePulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
