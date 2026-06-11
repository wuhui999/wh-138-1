/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1677ff',
        success: '#52c41a',
        warning: '#faad14',
        danger: '#ff4d4f',
        ship: {
          50: '#e6f4ff',
          100: '#bae0ff',
          500: '#1677ff',
          600: '#0958d9',
          700: '#003eb3',
        }
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  }
}
