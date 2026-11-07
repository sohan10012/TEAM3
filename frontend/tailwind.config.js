/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Inter"',
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          '"Fira Code"',
          "ui-monospace",
          "monospace",
        ],
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.16, 1, 0.3, 1)",
        spring: "cubic-bezier(0.175, 0.885, 0.32, 1.1)",
      },
      colors: {
        brand: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          muted: "var(--color-primary-muted)",
          fg: "var(--color-on-primary)",
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          subtle: "var(--color-surface-subtle)",
          hover: "var(--color-surface-hover)",
          canvas: "var(--color-canvas)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          subtle: "var(--color-border-subtle)",
          strong: "var(--color-border-strong)",
        },
        accent: { DEFAULT: "#1D63ED", hover: "#1550C0", soft: "#EFF6FF", ring: "#93C5FD" },
        dayforce: {
          primary: "#1D63ED",
          "primary-hover": "#1550C0",
          "primary-light": "#EFF6FF",
          secondary: "#0F172A",
          accent: "#0284C7",
          "accent-light": "#F0F9FF",
          light: "#F8FAFC",
          surface: "#FFFFFF",
          border: "#E2E8F0",
        },
        ink: "#0F172A",
      },
      fontSize: { "2xs": ["0.6875rem", "1rem"] },
      boxShadow: {
        "2xs": "0 1px 2px rgba(15, 23, 42, 0.04)",
        xs: "0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)",
        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.03)",
        popover: "0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
        modal: "0 20px 40px -8px rgba(15, 23, 42, 0.16)",
      },
    },
  },
  plugins: [],
};
