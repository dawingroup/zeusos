/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./popup/**/*.{js,ts,jsx,tsx,html}",
    "./content/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#872E5C',
        error: '#DC2626',
        success: '#16A34A',
      },
    },
  },
  plugins: [],
}
