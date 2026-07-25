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
      },
      fontFamily: {
        // Instrument Sans for the interface: narrow enough for dense metadata,
        // with terminals that stay legible at 12px.
        sans: ['"Instrument Sans Variable"', 'system-ui', 'sans-serif'],
        // Bricolage Grotesque for titles. It carries an editorial voice at large
        // sizes, which is what a catalogue of films should sound like. The
        // previous stack named a face ("Clash Display") that was never loaded,
        // so every `font-display` silently rendered as the body face.
        display: ['"Bricolage Grotesque Variable"', '"Instrument Sans Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 12px 40px -12px rgba(0, 0, 0, 0.7)',
      },
          backgroundImage: {
      // Ambient light at the top of the page. It carries no hue of its own: the
      // `--film` set by whatever title is in context tints it, and it stays a
      // neutral lift when none is.
      aurora:
        'radial-gradient(60% 60% at 50% 0%, var(--film, rgba(255,255,255,0.10)) 0%, transparent 62%)',
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
