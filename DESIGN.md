---
version: alpha
name: TraceTest Enterprise Quality Design System
description: Official design tokens and design engineering rules for TraceTest AI — Enterprise Quality Engineering & Assurance Platform. Disciplined neutral surfaces with corporate blue primary, high-density data typography, and WCAG AA compliant contrast.

colors:
  primary: "#3067db"
  primary-hover: "#2554b8"
  primary-muted: "#eff6ff"
  on-primary: "#ffffff"
  
  canvas: "#f8fafc"
  surface: "#ffffff"
  surface-subtle: "#f1f5f9"
  surface-hover: "#e2e8f0"
  
  border: "#e2e8f0"
  border-subtle: "#f1f5f9"
  border-strong: "#cbd5e1"
  
  text-primary: "#0f172a"
  text-secondary: "#475569"
  text-muted: "#64748b"
  text-faint: "#94a3b8"
  
  success: "#059669"
  success-surface: "#ecfdf5"
  warning: "#d97706"
  warning-surface: "#fffbeb"
  danger: "#dc2626"
  danger-surface: "#fef2f2"
  info: "#0891b2"
  info-surface: "#ecfeff"
  reasonx: "#7c3aed"
  reasonx-surface: "#f5f3ff"

typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  heading:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  subheading:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  body-dense:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.3
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4

spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px

rounded:
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px
---

# TraceTest Design Guidelines

## 1. Quality Floor & Craft
- **No AI Slop:** Banned: Purple-to-blue generic gradients, floating cards with meaningless metrics, emoji icons.
- **Surface Discipline:** High density, crisp borders (`#E2E8F0`), subtle gray backgrounds (`#F8FAFC`).
- **Interactive Control Floor:** Touch targets >= 44x44px. Every button must have `:hover`, `:focus-visible`, and `:active` (`scale(0.98)`).
- **Motion Floor:** Never `transition: all`. Animate only `transform` and `opacity`. UI transitions < 200ms. Respect `prefers-reduced-motion`.

## 2. Accessibility
- All text meets WCAG AA contrast ratio >= 4.5:1 against its background.
- Tabular data uses `tabular-nums` monospace alignment for all counts and metrics.
- Tables have accessible scrollable regions with `role="region"` and `tabindex="0"`.
