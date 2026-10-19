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
        background: '#090D16',
        surface: '#111827',
        'surface-hover': '#1F2937',
        'surface-border': '#374151',
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        nats: {
          teal: '#27AEE4',
          green: '#10B981',
          purple: '#8B5CF6',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'monospace'],
      }
    },
  },
  plugins: [],
}
