import { CheckCircle2, Clock, AlertCircle, Flame, Layers } from "lucide-react";
import { cn } from "@/utils/format";

export interface RequirementsMetricsProps {
  totalCount: number;
  approvedCount: number;
  pendingCount: number;
  needsClarificationCount: number;
  criticalHighCount: number;
  documentCount?: number;
  processedCount?: number;
  activeFilter?: string;
  onFilterChange?: (filterType: "all" | "approved" | "pending_review" | "needs_clarification" | "critical_high") => void;
}

export function RequirementsOverviewMetrics({
  totalCount,
  approvedCount,
  pendingCount,
  needsClarificationCount,
  criticalHighCount,
  documentCount = 0,
  processedCount = 0,
  activeFilter = "all",
  onFilterChange,
}: RequirementsMetricsProps) {
  const cards = [
    {
      id: "all" as const,
      label: "Total Extracted",
      count: totalCount,
      subtext:
        documentCount > 0
          ? `${processedCount || documentCount}/${documentCount} source documents processed`
          : "Total recorded requirements",
      icon: Layers,
      accentColor: "text-blue-600 bg-blue-50 border-blue-200",
      activeRing: "ring-2 ring-blue-500 border-blue-300 bg-blue-50/40",
      pillClass: "bg-blue-100 text-blue-800",
    },
    {
      id: "approved" as const,
      label: "Approved Requirements",
      count: approvedCount,
      subtext: `${totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0}% of total verified`,
      icon: CheckCircle2,
      accentColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      activeRing: "ring-2 ring-emerald-500 border-emerald-300 bg-emerald-50/40",
      pillClass: "bg-emerald-100 text-emerald-800",
    },
    {
      id: "pending_review" as const,
      label: "Pending Review",
      count: pendingCount,
      subtext: "Awaiting QA sign-off",
      icon: Clock,
      accentColor: "text-amber-600 bg-amber-50 border-amber-200",
      activeRing: "ring-2 ring-amber-500 border-amber-300 bg-amber-50/40",
      pillClass: "bg-amber-100 text-amber-800",
    },
    {
      id: "needs_clarification" as const,
      label: "Requires Clarification",
      count: needsClarificationCount,
      subtext: "Ambiguities or open questions",
      icon: AlertCircle,
      accentColor: "text-purple-600 bg-purple-50 border-purple-200",
      activeRing: "ring-2 ring-purple-500 border-purple-300 bg-purple-50/40",
      pillClass: "bg-purple-100 text-purple-800",
    },
    {
      id: "critical_high" as const,
      label: "Critical / High Priority",
      count: criticalHighCount,
      subtext: "High-impact quality obligations",
      icon: Flame,
      accentColor: "text-rose-600 bg-rose-50 border-rose-200",
      activeRing: "ring-2 ring-rose-500 border-rose-300 bg-rose-50/40",
      pillClass: "bg-rose-100 text-rose-800",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onFilterChange?.(card.id)}
            aria-pressed={isActive}
            className={cn(
              "group relative flex flex-col justify-between text-left p-3.5 rounded-xl border transition-all duration-150 cursor-pointer",
              "bg-white shadow-2xs hover:shadow-xs",
              isActive
                ? card.activeRing
                : "border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {card.label}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {card.count}
                  </span>
                </div>
              </div>

              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-transform duration-150 group-hover:scale-105",
                  card.accentColor
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="truncate">{card.subtext}</span>
              {isActive && (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-200/80 px-1.5 py-0.2 rounded">
                  Filtered
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
