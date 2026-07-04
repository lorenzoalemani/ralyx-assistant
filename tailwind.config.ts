import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#0B0C10",
        surface: "#15171C",
        "surface-hover": "#1C1F26",
        border: "#262A33",
        foreground: "#F3F4F6",
        muted: "#9CA3AF",
        accent: {
          DEFAULT: "#7C5CFF",
          hover: "#6A47FF",
          soft: "#7C5CFF1A",
        },
        danger: "#FF5C5C",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
      },
      boxShadow: {
        glow: "0 0 0 1px #7C5CFF33, 0 8px 30px -10px #7C5CFF4D",
      },
    },
  },
  plugins: [],
};

export default config;
