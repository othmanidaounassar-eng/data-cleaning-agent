import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          950: "rgb(var(--base-950) / <alpha-value>)",
          900: "rgb(var(--base-900) / <alpha-value>)",
          850: "rgb(var(--base-850) / <alpha-value>)",
          800: "rgb(var(--base-800) / <alpha-value>)",
          700: "rgb(var(--base-700) / <alpha-value>)",
          600: "rgb(var(--base-600) / <alpha-value>)",
        },
        ink: {
          100: "rgb(var(--ink-100) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
        },
        accent: {
          blue: "#4F7CFF",
          blueDim: "#3358CC",
          violet: "#8B5CF6",
          violetDim: "#6D3FD1",
        },
        signal: {
          good: "#34D399",
          warn: "#F5A623",
          bad: "#F16565",
        },
      },
      fontFamily: {
        display: [
          "var(--font-display)",
          "var(--font-arabic)",
          "system-ui",
          "sans-serif",
        ],
        body: [
          "var(--font-body)",
          "var(--font-arabic)",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "grad-primary": "linear-gradient(135deg, #4F7CFF 0%, #8B5CF6 100%)",
        "grad-radial-glow":
          "radial-gradient(60% 60% at 50% 0%, rgba(79,124,255,0.20) 0%, rgba(139,92,246,0.08) 45%, rgba(7,9,15,0) 80%)",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(4, 6, 12, 0.45)",
        "glow-blue":
          "0 0 0 1px rgba(79,124,255,0.25), 0 0 24px rgba(79,124,255,0.25)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "pulse-node": {
          "0%, 100%": { opacity: "0.4", transform: "scale(0.96)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        "flow-dash": {
          to: { strokeDashoffset: "-24" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pulse-node": "pulse-node 1.8s ease-in-out infinite",
        "flow-dash": "flow-dash 1.2s linear infinite",
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
