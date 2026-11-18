import { ReactNode } from "react";
import { cn, label } from "@/utils/format";

export type StatusType =
  | "passed"
  | "approved"
  | "verified"
  | "healthy"
  | "valid"
  | "completed"
  | "connected"
  | "running"
  | "analysed"
  | "platform_run"
  | "pending_review"
  | "changes_requested"
  | "needs_reapproval"
  | "degraded"
  | "warning"
  | "medium"
  | "failed"
  | "error"
  | "invalid"
  | "rejected"
  | "critical"
  | "high"
  | "blocked"
  | "timed_out"
  | "reopened"
  | "open"
  | "draft"
  | "closed"
  | "low"
  | "queued"
  | "historical_import"
  | "ci"
  | (string & {});

interface StatusConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

const statusConfigs: Record<string, StatusConfig> = {
  // Green - Passed & Verified
  passed: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", dot: "bg-emerald-600" },
  approved: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", dot: "bg-emerald-600" },
  verified: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", dot: "bg-emerald-600" },
  healthy: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", dot: "bg-emerald-600" },
  valid: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", dot: "bg-emerald-600" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", dot: "bg-emerald-600" },
  connected: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", dot: "bg-emerald-600" },

  // Blue - Active & Progress
  running: { bg: "bg-blue-50", text: "text-[#1D4ED8]", border: "border-blue-200", dot: "bg-[#1D63ED] animate-pulse" },
  analysed: { bg: "bg-blue-50", text: "text-[#1D4ED8]", border: "border-blue-200", dot: "bg-[#1D63ED]" },
  platform_run: { bg: "bg-blue-50", text: "text-[#1D4ED8]", border: "border-blue-200", dot: "bg-[#1D63ED]" },
  active: { bg: "bg-blue-50", text: "text-[#1D4ED8]", border: "border-blue-200", dot: "bg-[#1D63ED]" },

  // Amber - Review & Warning
  pending_review: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-600" },
  changes_requested: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-600" },
  needs_reapproval: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-600" },
  degraded: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-600" },
  warning: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-600" },
  medium: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-600" },
  review: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-600" },

  // Red - Failures & Blocking
  failed: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200", dot: "bg-rose-600" },
  error: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200", dot: "bg-rose-600" },
  invalid: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200", dot: "bg-rose-600" },
  rejected: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200", dot: "bg-rose-600" },
  critical: { bg: "bg-rose-600", text: "text-white", border: "border-rose-600", dot: "bg-white" },
  high: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200", dot: "bg-rose-600" },
  blocked: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200", dot: "bg-rose-600" },
  timed_out: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200", dot: "bg-rose-600" },
  reopened: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200", dot: "bg-rose-600" },

  // Neutral - Metadata & Queued
  draft: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-500" },
  closed: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-500" },
  low: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-500" },
  queued: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-400" },
  historical_import: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" },
  ci: { bg: "bg-teal-50", text: "text-teal-800", border: "border-teal-200", dot: "bg-teal-600" },
  neutral: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-500" },
};

export interface StatusBadgeProps {
  status?: StatusType | null;
  children?: ReactNode;
  showDot?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({
  status,
  children,
  showDot = true,
  size = "sm",
  className,
}: StatusBadgeProps) {
  const s = status ? String(status).toLowerCase() : "neutral";
  const cfg = statusConfigs[s] ?? statusConfigs.neutral;

  const displayLabel =
    children ??
    (s === "historical_import"
      ? "Historical import"
      : s === "platform_run"
      ? "Platform run"
      : s === "ci"
      ? "CI"
      : label(s));

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium border",
        size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-xs",
        cfg.bg,
        cfg.text,
        cfg.border,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "rounded-full shrink-0",
            size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
            cfg.dot
          )}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}

