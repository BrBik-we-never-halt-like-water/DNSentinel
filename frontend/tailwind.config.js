/**
 * DNSentinel design system.
 *
 * Three brand colours only, used consistently:
 *   ink    — Midnight Navy  #0F172A : headings, nav, primary surfaces
 *   brand  — Royal Purple   #6D28D9 : buttons, links, active states
 *   accent — Electric Cyan  #06B6D4 : hovers, focus rings, badges, key CTAs (sparingly)
 *
 * `state.*` is a deliberate, functional exception to the 2–3 colour rule: this app
 * reports security posture, so pass/warn/fail must be distinguishable at a glance.
 * They are muted, desaturated tones chosen to sit quietly next to the brand palette,
 * and status is always paired with an icon or text label — never colour alone.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0F172A',
          soft: '#1E293B', // Charcoal — body copy
          muted: '#334155',
        },
        brand: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          DEFAULT: '#6D28D9',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        accent: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          DEFAULT: '#06B6D4',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          soft: '#F8FAFC', // Soft White
          muted: '#F1F5F9',
        },
        line: {
          DEFAULT: '#E2E8F0', // Light Gray
          strong: '#CBD5E1',
        },
        slateGray: '#64748B',
        state: {
          ok: '#0F9D74',
          okSoft: '#ECFDF5',
          warn: '#B45309',
          warnSoft: '#FFFBEB',
          err: '#DC2626',
          errSoft: '#FEF2F2',
          info: '#2563EB',
          infoSoft: '#EFF6FF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        tightest: '-0.045em',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(15,23,42,0.04)',
        card: '0 1px 3px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.10)',
        lift: '0 4px 12px rgba(15,23,42,0.06), 0 20px 48px -16px rgba(15,23,42,0.16)',
        modal: '0 24px 80px -16px rgba(15,23,42,0.30)',
        ring: '0 0 0 4px rgba(109,40,217,0.12)',
        ringAccent: '0 0 0 4px rgba(6,182,212,0.14)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn: {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-18px) rotate(4deg)' },
        },
        drift: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(20px,-14px) scale(1.06)' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.7)' },
        },
        spinSlow: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        fadeUp: 'fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) both',
        fadeIn: 'fadeIn 0.3s ease both',
        scaleIn: 'scaleIn 0.28s cubic-bezier(0.16,1,0.3,1) both',
        shimmer: 'shimmer 1.6s infinite',
        float: 'float 14s ease-in-out infinite',
        drift: 'drift 24s ease-in-out infinite alternate',
        pulseDot: 'pulseDot 2s ease-in-out infinite',
        spinSlow: 'spinSlow 0.85s linear infinite',
      },
    },
  },
  plugins: [],
};
