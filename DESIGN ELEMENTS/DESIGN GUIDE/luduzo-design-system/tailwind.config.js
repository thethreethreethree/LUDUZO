/** =========================================================
 *  LUDUZO — Tailwind config
 *  Wires the design tokens into Tailwind utility classes.
 *  Usage: bg-onyx, text-gold, border-iron, font-display, etc.
 *  Merge this `theme.extend` into your existing tailwind.config.js
 *  ========================================================= */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // app is dark-first; wrap root in <html class="dark">
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        black:   '#0A0A0A',
        onyx:    { DEFAULT: '#161616', 2: '#1C1C1C' },
        iron:    { DEFAULT: '#2A2A2A', 2: '#333333' },
        bone:    '#EDEDED',
        ash:     { DEFAULT: '#8A8A8A', dim: '#5E5E5E' },
        gold: {
          DEFAULT: '#F5C518',
          hover:   '#FFD429',
          dim:     'rgba(245,197,24,0.14)',
          line:    'rgba(245,197,24,0.35)',
        },
        win:  '#3FB950',
        loss: '#E5534B',
        warn: '#E3A008',
        plan: {
          warrior:   '#F5C518',
          gladiator: '#B794F4',
          rookie:    '#8A8A8A',
        },
      },
      fontFamily: {
        display: ['Montserrat', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // role tokens (in addition to Tailwind defaults)
        stat: ['34px', { lineHeight: '1', fontWeight: '800', letterSpacing: '-0.02em' }],
        h1:   ['30px', { lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.02em' }],
      },
      letterSpacing: {
        tightest: '-0.02em',
        label: '0.07em',
      },
      borderRadius: {
        sm: '8px', md: '12px', lg: '14px', xl: '20px', '2xl': '24px', pill: '999px',
      },
      maxWidth: {
        content: '1240px',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(160deg, #1A1A12, #161616)',
        'gold-fill': 'linear-gradient(90deg, #F5C518, #C99A08)',
      },
      keyframes: {
        pulse: {
          '0%':   { boxShadow: '0 0 0 0 rgba(63,185,80,.5)' },
          '70%':  { boxShadow: '0 0 0 7px rgba(63,185,80,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(63,185,80,0)' },
        },
        scan: {
          '0%,100%': { top: '20%' },
          '50%':     { top: '80%' },
        },
      },
      animation: {
        pulse: 'pulse 2s infinite',
        scan:  'scan 2.4s ease-in-out infinite',
      },
      transitionDuration: {
        fast: '120ms',
        base: '150ms',
      },
    },
  },
  plugins: [],
};
