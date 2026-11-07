/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Google Sans"', "Tahoma", "Arial", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "ui-monospace", "monospace"],
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
        accent: { DEFAULT: "#3067DB", hover: "#2554B8", soft: "#EFF6FF", ring: "#93C5FD" },
        dayforce: {
          primary: "#3067DB",
          "primary-hover": "#2554B8",
          "primary-light": "#EFF6FF",
          secondary: "#0F172A",
          accent: "#0891B2",
          "accent-light": "#ECFEFF",
          light: "#F8FAFC",
          surface: "#FFFFFF",
          border: "#E2E8F0",
        },
        ink: "#0F172A",
      },
      fontSize: { "2xs": ["0.6875rem", "1rem"] },
      boxShadow: {
        xs: "0 1px 2px rgba(0, 0, 0, 0.04)",
        card: "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)",
        popover: "0 4px 12px rgba(0, 0, 0, 0.08)",
        modal: "0 12px 32px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
};
