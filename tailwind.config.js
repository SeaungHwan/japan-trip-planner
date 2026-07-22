/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          DEFAULT: "#0EA5E9",
        },
      },
    },
  },
  plugins: [],
};
