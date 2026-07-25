/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core surfaces: a deep, near-black space-blue.
        ink: {
          950: '#06060B',
          900: '#0A0A12',
          800: '#12121C',
          700: '#1B1B29',
          600: '#262638',
        },
        // Brand gradient anchors.
        brand: {
          cyan: '#22D3EE',
          violet: '#8B5CF6',
          fuchsia: '#D946EF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Clash Display"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(139, 92, 246, 0.55)',
        'glow-cyan': '0 0 32px -6px rgba(34, 211, 238, 0.5)',
        card: '0 12px 40px -12px rgba(0, 0, 0, 0.7)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #22D3EE 0%, #8B5CF6 55%, #D946EF 100%)',
        'aurora':
          'radial-gradient(60% 60% at 50% 0%, rgba(139,92,246,0.22) 0%, rgba(34,211,238,0.08) 40%, transparent 75%)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
