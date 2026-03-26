import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#09070f",
        panel: "#120f1c",
        panelAlt: "#181327",
        line: "#31264a",
        lime: {
          100: "#f4ebff",
          200: "#e4ccff",
          300: "#cfa0ff",
          400: "#b26bff",
          500: "#8b3dff",
          600: "#6820d9"
        }
      },
      fontFamily: {
        sans: ["'Space Grotesk'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(178, 107, 255, 0.18), 0 18px 60px rgba(8, 6, 18, 0.5)"
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top, rgba(178, 107, 255, 0.16), transparent 32%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)"
      },
      backgroundSize: {
        "hero-grid": "auto, 32px 32px, 32px 32px"
      }
    }
  },
  plugins: []
};

export default config;
