/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#12172B",
          muted: "#5B6478",
          faint: "#8B93A7",
        },
        paper: {
          DEFAULT: "#F6F7F9",
          surface: "#FFFFFF",
        },
        brand: {
          DEFAULT: "#0E6B52",
          soft: "#E4F2EC",
          dark: "#0A5340",
        },
        gold: {
          DEFAULT: "#B8791F",
          soft: "#FBF0DD",
        },
        gain: "#0E9F6E",
        loss: "#D0342C",
        stale: {
          DEFAULT: "#B3261E",
          soft: "#FDEDEC",
        },
        warn: {
          DEFAULT: "#92600C",
          soft: "#FFF6E5",
        },
        border: "#E5E8EF",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl2: "0.875rem",
      },
    },
  },
  plugins: [],
};
