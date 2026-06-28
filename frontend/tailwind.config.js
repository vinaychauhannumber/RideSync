/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563EB",
          dark: "#1D4ED8",
        },
        secondary: {
          DEFAULT: "#06B6D4",
          dark: "#0891B2",
        },
        accent: {
          DEFAULT: "#10B981",
          dark: "#059669",
        },
      },
    },
  },
  plugins: [],
};
