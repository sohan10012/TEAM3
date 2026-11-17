import {
  CheckCircle2,
  Clock,
  HelpCircle,
  FileCheck2,
  Sparkles,
  Link2,
  AlertTriangle,
  ListChecks,
} from "lucide-react";
import { cn } from "@/utils/format";

export type CriteriaFilterKey =
  | "all"
  | "approved"
  | "pending"
  | "needs_clarification"
  | "grounded"
  | "inferred"
  | "uncovered";

export interface CriteriaMetricsProps {
  totalCount: number;
  approvedCount: number;
  pendingCount: number;
  clarificationCount: number;
  groundedCount: number;
  inferredCount: number;
  linkedRequirementsCount: number;
  uncoveredCount: number;
  activeFilter?: CriteriaFilterKey;
  onFilterChange?: (filter: CriteriaFilterKey) => void;
}

export function AcceptanceCriteriaOverviewMetrics({
  totalCount,
  approvedCount,
  pendingCount,
  clarificationCount,
  groundedCount,
  inferredCount,
  linkedRequirementsCount,
  uncoveredCount,
  activeFilter = "all",
  onFilterChange,
}: CriteriaMetricsProps) {
  const cards = [
    {
      id: "all" as const,
      label: "Total Criteria",
      count: totalCount,
      subtext: `${linkedRequirementsCount} requirements linked`,
      icon: ListChecks,
      accentColor: "text-blue-600 bg-blue-50 border-blue-200",
      activeRing: "ring-2 ring-blue-500 border-blue-300 bg-blue-50/40",
      pillClass: "bg-blue-100 text-blue-800",
    },
    {
      id: "approved" as const,
      label: "Approved",
      count: approvedCount,
      subtext: `${totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0}% of criteria signed off`,
      icon: CheckCircle2,
      accentColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      activeRing: "ring-2 ring-emerald-500 border-emerald-300 bg-emerald-50/40",
      pillClass: "bg-emerald-100 text-emerald-800",
    },
    {
      id: "pending" as const,
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
      count: clarificationCount,
      subtext: "Open inquiries & changes",
      icon: HelpCircle,
      accentColor: "text-purple-600 bg-purple-50 border-purple-200",
      activeRing: "ring-2 ring-purple-500 border-purple-300 bg-purple-50/40",
      pillClass: "bg-purple-100 text-purple-800",
    },
    {
      id: "grounded" as const,
      label: "Document-Grounded",
      count: groundedCount,
      subtext: "Verbatim quote verified",
      icon: FileCheck2,
      accentColor: "text-teal-600 bg-teal-50 border-teal-200",
      activeRing: "ring-2 ring-teal-500 border-teal-300 bg-teal-50/40",
      pillClass: "bg-teal-100 text-teal-800",
    },
    {
      id: "inferred" as const,
      label: "AI-Inferred",
      count: inferredCount,
      subtext: "Derived by model reasoning",
      icon: Sparkles,
      accentColor: "text-indigo-600 bg-indigo-50 border-indigo-200",
      activeRing: "ring-2 ring-indigo-500 border-indigo-300 bg-indigo-50/40",
      pillClass: "bg-indigo-100 text-indigo-800",
    },
    {
      id: "all" as const,
      label: "Linked Requirements",
      count: linkedRequirementsCount,
      subtext: "Traceable requirements",
      icon: Link2,
      accentColor: "text-sky-600 bg-sky-50 border-sky-200",
      activeRing: "ring-2 ring-sky-500 border-sky-300 bg-sky-50/40",
      pillClass: "bg-sky-100 text-sky-800",
      nonFilterable: true,
    },
    {
      id: "uncovered" as const,
      label: "Without Test Coverage",
      count: uncoveredCount,
      subtext: `${totalCount > 0 ? Math.round((uncoveredCount / totalCount) * 100) : 0}% require test authoring`,
      icon: AlertTriangle,
      accentColor: "text-rose-600 bg-rose-50 border-rose-200",
      activeRing: "ring-2 ring-rose-500 border-rose-300 bg-rose-50/40",
      pillClass: "bg-rose-100 text-rose-800",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const isClickable = !card.nonFilterable && !!onFilterChange;
        const isActive = activeFilter === card.id && !card.nonFilterable;

        return (
          <div
            key={idx}
            onClick={() => isClickable && onFilterChange(isActive && card.id !== "all" ? "all" : card.id)}
            className={cn(
              "relative flex flex-col justify-between rounded-xl border bg-white p-3.5 shadow-xs transition-all duration-150",
              isClickable && "cursor-pointer hover:border-slate-300 hover:shadow-sm active:scale-[0.99]",
              isActive ? card.activeRing : "border-slate-200/80 hover:bg-slate-50/60"
            )}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={(e) => {
              if (isClickable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onFilterChange(isActive && card.id !== "all" ? "all" : card.id);
              }
            }}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-semibold tracking-tight text-slate-500 truncate" title={card.label}>
                {card.label}
              </span>
              <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", card.accentColor)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold tracking-tight text-slate-900">
                {card.count.toLocaleString()}
              </span>
              {isActive && (
                <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider rounded bg-blue-100 text-blue-700">
                  Active
                </span>
              )}
            </div>

            <p className="mt-1 text-[10px] text-slate-500 leading-tight truncate" title={card.subtext}>
              {card.subtext}
            </p>
          </div>
        );
      })}
    </div>
  );
}

