import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        kite: {
          50: "#f5f7ff",
          100: "#eceffe",
          200: "#dadffe",
          300: "#b8c2fd",
          400: "#8a99fc",
          500: "#5566ff",
          600: "#4755e6",
          700: "#3a44cc",
          900: "#1a1f5e"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-inter-tight)", "var(--font-inter)", "sans-serif"],
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "Menlo", "monospace"]
      },
      fontSize: {
        "display-2xl": ["72px", { lineHeight: "80px", letterSpacing: "-0.03em", fontWeight: "600" }],
        "display-xl": ["56px", { lineHeight: "62px", letterSpacing: "-0.025em", fontWeight: "600" }],
        "h1-tight": ["40px", { lineHeight: "46px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "h2-tight": ["28px", { lineHeight: "34px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "caption": ["11px", { lineHeight: "16px", letterSpacing: "0.08em", fontWeight: "600" }]
      },
      boxShadow: {
        elev: "0 8px 24px -12px rgba(26, 31, 94, 0.18)",
        soft: "0 1px 0 rgba(26, 31, 94, 0.04)"
      },
      keyframes: {
        breathe: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" }
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.6)" },
          "100%": { boxShadow: "0 0 0 10px rgba(16, 185, 129, 0)" }
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "pulse-dot": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.25)", opacity: "0.65" }
        }
      },
      animation: {
        breathe: "breathe 1.6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
        "fade-up": "fade-up 400ms ease-out both",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
