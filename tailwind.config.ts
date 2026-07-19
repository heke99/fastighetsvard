import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f2",
          100: "#d6ebe0",
          200: "#aed7c2",
          300: "#7fbd9f",
          400: "#529f7d",
          500: "#348363",
          600: "#26684f",
          700: "#205541",
          800: "#1c4436",
          900: "#18392e",
          950: "#0b201a"
        },
        accent: {
          400: "#f5b942",
          500: "#eda419",
          600: "#cf8408"
        }
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
