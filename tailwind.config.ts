import type { Config } from "tailwindcss";

// UCC navy / professional palette, ported from qmr-workbench.html :root tokens.
// Quiet audit office, not an arcade. Agent desk lights become accents in later phases.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#1a3b6e", 2: "#24508f", soft: "#eef2f8" },
        ink: "#24303f",
        muted: "#6b7686",
        line: "#d8dee9",
        ok: "#2e7d32",
        warn: "#b26a00",
        err: "#c62828",
      },
    },
  },
  plugins: [],
};

export default config;
