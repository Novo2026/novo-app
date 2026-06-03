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
          'orange-light': '#FF8C5A',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F8F9FB',
          muted: '#F1F3F7',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 8px rgba(0,0,0,0.08), 0 12px 24px rgba(0,0,0,0.06)',
        'card-raised': '0 8px 16px rgba(0,0,0,0.10), 0 24px 48px rgba(0,0,0,0.08)',
        'inner-top': 'inset 0 1px 0 rgba(255,255,255,0.1)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      backgroundImage: {
        'gradient-navy': 'linear-gradient(135deg, #1E3A5F 0%, #152C47 100%)',
        'gradient-orange': 'linear-gradient(135deg, #FF6B35 0%, #E55A25 100%)',
        'gradient-hero': 'linear-gradient(135deg, #1E3A5F 0%, #2D5A8E 50%, #1E3A5F 100%)',
        'gradient-card': 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(248,249,251,0.9) 100%)',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'gentle-pulse': 'gentlePulse 3s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        gentlePulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
