/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        calista: {
          ink: '#0f172a',
          gold: '#c8a96a',
          cream: '#faf6ef'
        }
      }
    }
  },
  plugins: []
}
