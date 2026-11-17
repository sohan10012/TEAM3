import {
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  FileText,
  Play,
  XCircle,
  HelpCircle,
  Unlink,
  Layers,
  ShieldAlert,
  ArrowRight,
  FilterX,
  Code2,
  UserCheck,
} from "lucide-react";
import { cn } from "@/utils/format";

export type TestFilterKey =
  | "all"
  | "approved"
  | "pending_review"
  | "automated"
  | "manual"
  | "executed"
  | "passed"
  | "failed"
  | "blocked"
  | "unexecuted"
  | "without_requirement"
  | "without_acceptance_criteria";

export interface TestManagementMetricsData {
  total_tests: number;
  approved_tests: number;
  pending_review: number;
  automated_tests: number;
  manual_tests: number;
  executed_tests: number;
  passed_tests: number;
  failed_tests: number;
  blocked_tests: number;
  unexecuted_tests: number;
  without_requirement: number;
  without_acceptance_criteria: number;
  uncovered_ac_count?: number;
  total_ac_count?: number;
  ac_coverage_pct?: number;
  by_category?: Record<string, number>;
}

export interface TestManagementOverviewMetricsProps {
  metrics: TestManagementMetricsData;
  activeFilter?: TestFilterKey;
  onFilterChange?: (filter: TestFilterKey) => void;
  onGenerateTestsClick?: () => void;
}

export function TestManagementOverviewMetrics({
  metrics,
  activeFilter = "all",
  onFilterChange,
  onGenerateTestsClick,
}: TestManagementOverviewMetricsProps) {
  const cards = [
    {
      id: "all" as const,
      label: "Total Tests",
      count: metrics.total_tests,
      subtext: "Complete test repository",
      icon: Layers,
      accentColor: "text-blue-600 bg-blue-50 border-blue-200",
      activeRing: "ring-2 ring-blue-500 border-blue-300 bg-blue-50/40",
      pillClass: "bg-blue-100 text-blue-800",
    },
    {
      id: "approved" as const,
      label: "Approved",
      count: metrics.approved_tests,
      subtext: `${metrics.total_tests > 0 ? Math.round((metrics.approved_tests / metrics.total_tests) * 100) : 0}% signed off`,
      icon: CheckCircle2,
      accentColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      activeRing: "ring-2 ring-emerald-500 border-emerald-300 bg-emerald-50/40",
      pillClass: "bg-emerald-100 text-emerald-800",
    },
    {
      id: "pending_review" as const,
      label: "Pending Review",
      count: metrics.pending_review,
      subtext: "Awaiting QA sign-off",
      icon: Clock,
      accentColor: "text-amber-600 bg-amber-50 border-amber-200",
      activeRing: "ring-2 ring-amber-500 border-amber-300 bg-amber-50/40",
      pillClass: "bg-amber-100 text-amber-800",
    },
    {
      id: "automated" as const,
      label: "Automated",
      count: metrics.automated_tests,
      subtext: "Pytest / Playwright",
      icon: Code2,
      accentColor: "text-indigo-600 bg-indigo-50 border-indigo-200",
      activeRing: "ring-2 ring-indigo-500 border-indigo-300 bg-indigo-50/40",
      pillClass: "bg-indigo-100 text-indigo-800",
    },
    {
      id: "manual" as const,
      label: "Manual",
      count: metrics.manual_tests,
      subtext: "Human-executed tests",
      icon: UserCheck,
      accentColor: "text-slate-600 bg-slate-100 border-slate-200",
      activeRing: "ring-2 ring-slate-500 border-slate-300 bg-slate-100/40",
      pillClass: "bg-slate-200 text-slate-800",
    },
    {
      id: "executed" as const,
      label: "Executed",
      count: metrics.executed_tests,
      subtext: "Telemetry recorded",
      icon: Play,
      accentColor: "text-teal-600 bg-teal-50 border-teal-200",
      activeRing: "ring-2 ring-teal-500 border-teal-300 bg-teal-50/40",
      pillClass: "bg-teal-100 text-teal-800",
    },
    {
      id: "passed" as const,
      label: "Passed",
      count: metrics.passed_tests,
      subtext: `${metrics.executed_tests > 0 ? Math.round((metrics.passed_tests / metrics.executed_tests) * 100) : 0}% passing rate`,
      icon: CheckCircle2,
      accentColor: "text-emerald-700 bg-emerald-50 border-emerald-300",
      activeRing: "ring-2 ring-emerald-600 border-emerald-400 bg-emerald-50/50",
      pillClass: "bg-emerald-100 text-emerald-900",
    },
    {
      id: "failed" as const,
      label: "Failed",
      count: metrics.failed_tests,
      subtext: metrics.failed_tests > 0 ? "Requires defect triage" : "0 active failures",
      icon: XCircle,
      accentColor: "text-rose-600 bg-rose-50 border-rose-200",
      activeRing: "ring-2 ring-rose-500 border-rose-300 bg-rose-50/40",
      pillClass: "bg-rose-100 text-rose-800",
    },
    {
      id: "blocked" as const,
      label: "Blocked",
      count: metrics.blocked_tests,
      subtext: "Blocked by dependency",
      icon: ShieldAlert,
      accentColor: "text-orange-600 bg-orange-50 border-orange-200",
      activeRing: "ring-2 ring-orange-500 border-orange-300 bg-orange-50/40",
      pillClass: "bg-orange-100 text-orange-800",
    },
    {
      id: "unexecuted" as const,
      label: "Unexecuted",
      count: metrics.unexecuted_tests,
      subtext: "No telemetry recorded",
      icon: HelpCircle,
      accentColor: "text-zinc-600 bg-zinc-100 border-zinc-200",
      activeRing: "ring-2 ring-zinc-500 border-zinc-300 bg-zinc-100/40",
      pillClass: "bg-zinc-200 text-zinc-800",
    },
    {
      id: "without_requirement" as const,
      label: "No Req Trace",
      count: metrics.without_requirement,
      subtext: "Missing requirement link",
      icon: Unlink,
      accentColor: "text-amber-700 bg-amber-50 border-amber-200",
      activeRing: "ring-2 ring-amber-500 border-amber-300 bg-amber-50/40",
      pillClass: "bg-amber-100 text-amber-900",
    },
    {
      id: "without_acceptance_criteria" as const,
      label: "No AC Trace",
      count: metrics.without_acceptance_criteria,
      subtext: "Missing criteria link",
      icon: AlertTriangle,
      accentColor: "text-purple-600 bg-purple-50 border-purple-200",
      activeRing: "ring-2 ring-purple-500 border-purple-300 bg-purple-50/40",
      pillClass: "bg-purple-100 text-purple-800",
    },
  ];

  const uncoveredCount = metrics.uncovered_ac_count ?? 0;
  const covPct = metrics.ac_coverage_pct ?? 0;

  return (
    <div className="space-y-3">
      {/* 12-Card Grid (Responsive 2 / 3 / 4 / 6 columns) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {cards.map((card) => {
          const Icon = card.icon;
          const isActive = activeFilter === card.id;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onFilterChange?.(isActive && card.id !== "all" ? "all" : card.id)}
              className={cn(
                "group relative flex flex-col justify-between text-left rounded-xl border p-3 transition-all duration-150 focus:outline-none cursor-pointer",
                "bg-white shadow-xs hover:border-slate-300 hover:shadow-sm",
                isActive ? card.activeRing : "border-slate-200/80"
              )}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 truncate">
                  {card.label}
                </span>
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
                    card.accentColor
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-1">
                <span className="text-xl font-bold tracking-tight text-slate-900 font-mono">
                  {card.count.toLocaleString()}
                </span>
                {isActive && (
                  <span className="text-3xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-900 text-white">
                    Filtered
                  </span>
                )}
              </div>

              <span className="text-3xs text-slate-500 truncate mt-1">
                {card.subtext}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-bar: Active Filter Reset + AC Coverage Gap Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilter !== "all" ? (
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">
                Active Filter: <strong className="text-slate-900 capitalize">{activeFilter.replace("_", " ")}</strong>
              </span>
              <button
                type="button"
                onClick={() => onFilterChange?.("all")}
                className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-medium text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors shadow-2xs"
              >
                <FilterX className="h-3 w-3 text-slate-500" />
                <span>Reset Filter</span>
              </button>
            </div>
          ) : (
            <span className="text-slate-500 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span>Click any metric card above to isolate test cases in the workspace.</span>
            </span>
          )}
        </div>

        {uncoveredCount > 0 && (
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-amber-800 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span><strong>{uncoveredCount}</strong> Uncovered ACs ({covPct}% Coverage)</span>
            </span>
            {onGenerateTestsClick && (
              <button
                type="button"
                onClick={onGenerateTestsClick}
                className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-2.5 py-1 text-2xs font-semibold text-white hover:bg-purple-700 transition-colors shadow-2xs"
              >
                <Sparkles className="h-3 w-3" />
                <span>Target Uncovered ACs</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

