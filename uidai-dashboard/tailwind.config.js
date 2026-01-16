/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1E88E5",
        secondary: "#1E88E5",
        accent: "#1E88E5",
        success: "#2E7D32",
        warning: "#FB8C00",
        danger: "#C62828",
        background: "#F4F1E8",
      },
    },
  },
  plugins: [],
}
