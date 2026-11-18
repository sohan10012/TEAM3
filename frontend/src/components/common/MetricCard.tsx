import { ReactNode } from "react";
import { cn } from "@/utils/format";

export type MetricIntent = "good" | "bad" | "warning" | "info" | "neutral";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  intent?: MetricIntent;
  onClick?: () => void;
  className?: string;
  trend?: {
    direction: "up" | "down" | "flat";
    label: string;
  };
}

const intentStyles: Record<MetricIntent, { value: string; badge?: string; border?: string }> = {
  good: {
    value: "text-emerald-700",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  bad: {
    value: "text-rose-700",
    badge: "bg-rose-50 text-rose-800 border-rose-200",
  },
  warning: {
    value: "text-amber-700",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
  },
  info: {
    value: "text-[#1D4ED8]",
    badge: "bg-blue-50 text-[#1D4ED8] border-blue-200",
  },
  neutral: {
    value: "text-slate-900",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

export function MetricCard({
  label,
  value,
  hint,
  icon,
  badge,
  intent = "neutral",
  onClick,
  className,
  trend,
}: MetricCardProps) {
  const Component = onClick ? "button" : "div";
  const styles = intentStyles[intent] ?? intentStyles.neutral;

  return (
    <Component
      onClick={onClick}
      className={cn(
        "group relative flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 sm:p-5 text-left transition-all duration-150",
        onClick
          ? "cursor-pointer hover:border-slate-300 hover:shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]"
          : "hover:border-slate-300",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        {icon && <div className="text-slate-400 shrink-0">{icon}</div>}
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={cn(
            "text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums",
            styles.value
          )}
        >
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trend.direction === "up"
                ? "text-emerald-700"
                : trend.direction === "down"
                ? "text-rose-700"
                : "text-slate-500"
            )}
          >
            {trend.direction === "up" ? "↑ " : trend.direction === "down" ? "↓ " : "→ "}
            {trend.label}
          </span>
        )}
      </div>

      {hint && (
        <div className="mt-1 text-xs text-slate-500 leading-normal truncate">
          {hint}
        </div>
      )}
    </Component>
  );
}

