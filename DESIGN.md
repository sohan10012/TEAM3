---
version: 1.0.0
name: TraceTest Enterprise Quality Design System
description: Official design tokens, Apple-inspired interaction principles, and motion engineering standards for TraceTest — Enterprise Quality Engineering Platform. Disciplined neutral surfaces, corporate blue primary, Apple-inspired depth & materials, high-density data typography, and WCAG AA compliant contrast.

colors:
  # Primary Brand (TraceTest Corporate Sapphire)
  primary: "#1D63ED"
  primary-hover: "#1550C0"
  primary-active: "#0E3E9E"
  primary-subtle: "#EFF6FF"
  on-primary: "#FFFFFF"
  
  # Canvas & Surfaces
  canvas: "#F8FAFC"
  surface: "#FFFFFF"
  surface-subtle: "#F1F5F9"
  surface-hover: "#E2E8F0"
  surface-translucent: "rgba(255, 255, 255, 0.85)"
  surface-popover: "rgba(255, 255, 255, 0.95)"
  
  # Borders & Separators
  border: "#E2E8F0"
  border-subtle: "#F1F5F9"
  border-strong: "#CBD5E1"
  border-translucent: "rgba(226, 232, 240, 0.8)"
  
  # Typography / Ink
  text-primary: "#0F172A"
  text-secondary: "#475569"
  text-muted: "#64748B"
  text-faint: "#94A3B8"
  
  # Functional Semantics
  success: "#059669"
  success-surface: "#ECFDF5"
  success-border: "#A7F3D0"
  warning: "#D97706"
  warning-surface: "#FFFBEB"
  warning-border: "#FDE68A"
  danger: "#DC2626"
  danger-surface: "#FEF2F2"
  danger-border: "#FECACA"
  info: "#0284C7"
  info-surface: "#F0F9FF"
  info-border: "#BAE6FD"
  reasonx: "#7C3AED"
  reasonx-surface: "#F5F3FF"
  reasonx-border: "#DDD6FE"

typography:
  fontFamily:
    display: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif"
    body: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif"
    mono: "'SF Mono', 'JetBrains Mono', ui-monospace, monospace"
  tracking:
    display: "-0.025em"
    heading: "-0.015em"
    body: "0em"
    caption: "+0.02em"
  scales:
    title-2xl: "1.5rem"      # 24px
    title-xl: "1.25rem"      # 20px
    title-lg: "1.125rem"     # 18px
    body-base: "0.875rem"    # 14px
    body-dense: "0.8125rem"  # 13px
    caption: "0.75rem"       # 12px
    micro: "0.6875rem"       # 11px

motion:
  curves:
    apple-ease-out: "cubic-bezier(0.16, 1, 0.3, 1)"
    apple-spring: "cubic-bezier(0.175, 0.885, 0.32, 1.1)"
    ease-out-quad: "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
  durations:
    instant: "100ms"
    fast: "160ms"
    normal: "240ms"
    moderate: "360ms"
  rules:
    composite-only: true
    reduced-motion-fallback: "0.01ms cross-fade"

materials:
  popover:
    backdropFilter: "blur(16px) saturate(180%)"
    background: "rgba(255, 255, 255, 0.95)"
    border: "1px solid rgba(226, 232, 240, 0.85)"
    shadow: "0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)"
  header-chrome:
    background: "rgba(255, 255, 255, 0.95)"
    borderBottom: "1px solid rgba(226, 232, 240, 0.8)"
    height: "56px"
---

# TraceTest Design Language & Engineering Standards

## 1. Principles of Apple-Inspired Enterprise Craft
- **Clarity & Restraint:** The interface recedes; the user's requirements, test cases, and quality telemetry take center stage. No gratuitous gradients or decorative noise.
- **Deference & Spatial Continuity:** Dropdowns scale from their trigger origin (`transform-origin: top right`). Sheets enter and exit along identical spatial axes.
- **Direct Manipulation:** Instant feedback on pointer-down (`:active { transform: scale(0.98); }`). Immediate `:focus-visible` states with zero latency.
- **Physical Springs & Interruptibility:** Transitions use critically damped curves (`damping: 1.0`, `cubic-bezier(0.16, 1, 0.3, 1)`) so motion never feels laggy or artificially delayed.

## 2. Accessibility & Quality Floor
- **WCAG AA Contrast:** Text contrast $\ge 4.5:1$ across all surface tiers.
- **Hardware Acceleration:** Animations animate strictly composite properties: `transform`, `opacity`, and `filter`.
- **Keyboard Navigation:** 100% of interactive controls support Tab, Space, Enter, and Escape.
- **Reduced Motion:** When `prefers-reduced-motion: reduce` is active, animations fall back to instant transitions.
