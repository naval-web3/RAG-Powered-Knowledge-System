/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Apple Fitness inspired dark palette
        ink: "#000000",
        surface: "#1c1c1e",
        surface2: "#2c2c2e",
        surface3: "#3a3a3c",
        hairline: "#38383a",
        muted: "#98989f",
        // Primary blue accent (brand) + supporting tones
        move: "#0a84ff",
        movehi: "#409cff",
        exercise: "#30d158",
        stand: "#64d2ff",
        danger: "#ff453a",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
