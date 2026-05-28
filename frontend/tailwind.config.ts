import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        ink: '#0a0a0a',
        paper: '#fafaf9',
        line: '#e5e5e5',
        muted: '#6b7280',
        accent: '#0a8043',
      },
    },
  },
  plugins: [],
} satisfies Config;
