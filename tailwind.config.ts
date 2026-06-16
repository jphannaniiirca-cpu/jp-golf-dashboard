import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#07101a",
        panel: "#0e1825",
        panelSoft: "#132030",
        line: "#1d2e42",
        fairway: "#1db870",
        mint: "#5fe09c",
        gold: "#c9a84c",
        cream: "#eedea0",
        danger: "#e05c44",
        warning: "#e8a030"
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Segoe UI",
          "system-ui",
          "sans-serif"
        ]
      },
      boxShadow: {
        glow: "0 0 40px rgba(29, 184, 112, 0.1)",
        card: "0 1px 2px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.2)"
      }
    }
  },
  plugins: []
};

export default config;
