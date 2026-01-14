/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue"
  ],
  theme: {
    extend: {
      colors: {
        // Override default gray scale for dark theme
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#cccccc',     // Primary text in dark mode
          500: '#858585',     // Muted text in dark mode
          600: '#4b5563',
          700: '#3e3e42',     // Light border in dark mode
          800: '#2d2d30',     // Panel/border in dark mode
          850: '#2a2d2e',     // Hover state in dark mode
          900: '#252526',     // Sidebar in dark mode
          925: '#1e1e1e',     // Main bg in dark mode
          950: '#111827',
        },
        // Primary blue
        primary: {
          50: '#e6f2ff',
          100: '#cce5ff',
          200: '#99cbff',
          300: '#66b0ff',
          400: '#4fc1ff',     // Light blue accent
          500: '#007acc',
          600: '#0062a3',
          700: '#004a7a',
          800: '#003152',
          900: '#264f78',     // Dark blue highlight
          950: '#000c14',
        },
        // Success/green
        success: {
          50: '#e8f5e9',
          100: '#c8e6c9',
          200: '#a5d6a7',
          300: '#81c784',
          400: '#66bb6a',
          500: '#4ec9b0',
          600: '#3ea18a',
          700: '#2e7964',
          800: '#1e513e',
          900: '#0e2918',
          950: '#07140c',
        },
        // Warning/orange
        warning: {
          50: '#fff3e0',
          100: '#ffe0b2',
          200: '#ffcc80',
          300: '#ffb74d',
          400: '#ffa726',
          500: '#ff9800',
          600: '#fb8c00',
          700: '#f57c00',
          800: '#ef6c00',
          900: '#e65100',
          950: '#bf360c',
        },
        // Error/red
        error: {
          50: '#ffebee',
          100: '#ffcdd2',
          200: '#ef9a9a',
          300: '#e57373',
          400: '#ef5350',
          500: '#f44336',
          600: '#e53935',
          700: '#d32f2f',
          800: '#c62828',
          900: '#b71c1c',
          950: '#8b0000',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 2px 4px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 8px rgba(0, 0, 0, 0.12)',
        'modal': '0 12px 24px rgba(0, 0, 0, 0.2)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}