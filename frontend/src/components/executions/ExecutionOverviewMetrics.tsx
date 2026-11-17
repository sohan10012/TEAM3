import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bug,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  Play,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import type { ExecutionMetrics } from "@/types/models";
import { cn, fmtDuration } from "@/utils/format";

interface ExecutionOverviewMetricsProps {
  metrics: ExecutionMetrics | null | undefined;
  isLoading: boolean;
  selectedFilter: string | null;
  onSelectFilter: (filterKey: string | null) => void;
  onOpenFlakyModal?: () => void;
}

export function ExecutionOverviewMetrics({
  metrics,
  isLoading,
  selectedFilter,
  onSelectFilter,
  onOpenFlakyModal,
}: ExecutionOverviewMetricsProps) {
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 animate-pulse">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg border border-slate-200 bg-slate-100" />
        ))}
      </div>
    );
  }

  const kpis = [
    {
      id: "total_runs",
      label: "Total Execution Runs",
      value: metrics.total_runs.toLocaleString(),
      subtext: "Historical test runs",
      icon: Layers,
      color: "text-slate-900",
      bg: "bg-slate-50 border-slate-200",
      badge: "Historical",
      filterValue: null,
    },
    {
      id: "latest_run",
      label: "Latest Run",
      value: metrics.latest_run?.key || "—",
      subtext: metrics.latest_run ? `${metrics.latest_run.status.toUpperCase()} (${metrics.latest_run.total} tests)` : "No runs recorded",
      icon: Play,
      color: metrics.latest_run?.status === "passed" ? "text-emerald-700" : "text-amber-700",
      bg: metrics.latest_run?.status === "passed" ? "bg-emerald-50/50 border-emerald-200" : "bg-amber-50/50 border-amber-200",
      badge: metrics.latest_run?.runner || "Latest",
      filterValue: metrics.latest_run?.id ? `run_${metrics.latest_run.id}` : null,
    },
    {
      id: "total_tests_executed",
      label: "Total Tests Executed",
      value: metrics.total_tests_executed.toLocaleString(),
      subtext: `${metrics.unique_tests_executed.toLocaleString()} unique test specs`,
      icon: Activity,
      color: "text-slate-900",
      bg: "bg-slate-50 border-slate-200",
      badge: "Cumulative",
      filterValue: null,
    },
    {
      id: "passed_tests",
      label: "Passed Tests",
      value: metrics.passed_tests.toLocaleString(),
      subtext: `${metrics.pass_rate}% pass rate`,
      icon: CheckCircle2,
      color: "text-emerald-700",
      bg: "bg-emerald-50/60 border-emerald-200",
      badge: "Passed",
      filterValue: "passed",
    },
    {
      id: "failed_tests",
      label: "Failed Tests",
      value: metrics.failed_tests.toLocaleString(),
      subtext: `${metrics.failure_rate}% failure rate`,
      icon: XCircle,
      color: metrics.failed_tests > 0 ? "text-red-700" : "text-slate-600",
      bg: metrics.failed_tests > 0 ? "bg-red-50/60 border-red-200" : "bg-slate-50 border-slate-200",
      badge: "Failed",
      filterValue: "failed",
    },
    {
      id: "blocked_tests",
      label: "Blocked Tests",
      value: metrics.blocked_tests.toLocaleString(),
      subtext: "Environmental or gated",
      icon: AlertOctagon,
      color: metrics.blocked_tests > 0 ? "text-amber-700" : "text-slate-600",
      bg: metrics.blocked_tests > 0 ? "bg-amber-50/60 border-amber-200" : "bg-slate-50 border-slate-200",
      badge: "Blocked",
      filterValue: "blocked",
    },
    {
      id: "skipped_tests",
      label: "Skipped Tests",
      value: metrics.skipped_tests.toLocaleString(),
      subtext: "Intentionally bypassed",
      icon: RotateCcw,
      color: "text-slate-700",
      bg: "bg-slate-50 border-slate-200",
      badge: "Skipped",
      filterValue: "skipped",
    },
    {
      id: "not_executed",
      label: "Not Executed",
      value: metrics.not_executed_tests.toLocaleString(),
      subtext: "Zero execution attempts",
      icon: AlertTriangle,
      color: metrics.not_executed_tests > 0 ? "text-amber-700" : "text-slate-600",
      bg: metrics.not_executed_tests > 0 ? "bg-amber-50/40 border-amber-200" : "bg-slate-50 border-slate-200",
      badge: "Unexecuted",
      filterValue: "unexecuted",
    },
    {
      id: "pass_rate",
      label: "Pass Rate",
      value: `${metrics.pass_rate}%`,
      subtext: `Target SLA ≥ 98.0%`,
      icon: metrics.pass_rate >= 98 ? TrendingUp : TrendingDown,
      color: metrics.pass_rate >= 98 ? "text-emerald-700" : "text-amber-700",
      bg: metrics.pass_rate >= 98 ? "bg-emerald-50/60 border-emerald-200" : "bg-amber-50/60 border-amber-200",
      badge: "SLA",
      filterValue: null,
    },
    {
      id: "failure_rate",
      label: "Failure Rate",
      value: `${metrics.failure_rate}%`,
      subtext: `Denominator: ${metrics.passed_tests + metrics.failed_tests + metrics.blocked_tests}`,
      icon: TrendingDown,
      color: metrics.failure_rate > 2 ? "text-red-700" : "text-slate-600",
      bg: metrics.failure_rate > 2 ? "bg-red-50/60 border-red-200" : "bg-slate-50 border-slate-200",
      badge: "Defect Rate",
      filterValue: null,
    },
    {
      id: "avg_duration",
      label: "Avg Execution Duration",
      value: metrics.avg_duration_ms > 1000 ? `${(metrics.avg_duration_ms / 1000).toFixed(1)}s` : `${metrics.avg_duration_ms}ms`,
      subtext: "Per execution run",
      icon: Clock,
      color: "text-slate-800",
      bg: "bg-slate-50 border-slate-200",
      badge: "Telemetry",
      filterValue: null,
    },
    {
      id: "open_defects",
      label: "Open Defects",
      value: metrics.open_defects.toLocaleString(),
      subtext: "Linked to failed executions",
      icon: Bug,
      color: metrics.open_defects > 0 ? "text-rose-700" : "text-slate-600",
      bg: metrics.open_defects > 0 ? "bg-rose-50/60 border-rose-200" : "bg-slate-50 border-slate-200",
      badge: "Defects",
      filterValue: "defects",
    },
  ];

  // Denominator total for visual outcome bar
  const totalOutcomes = Math.max(1, metrics.passed_tests + metrics.failed_tests + metrics.blocked_tests + metrics.skipped_tests);
  const passWidth = (metrics.passed_tests / totalOutcomes) * 100;
  const failWidth = (metrics.failed_tests / totalOutcomes) * 100;
  const blockWidth = (metrics.blocked_tests / totalOutcomes) * 100;
  const skipWidth = (metrics.skipped_tests / totalOutcomes) * 100;

  return (
    <div className="space-y-4">
      {/* 12 Real Database Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const isSelected = selectedFilter === kpi.filterValue && kpi.filterValue !== null;

          return (
            <button
              key={kpi.id}
              type="button"
              onClick={() => {
                if (kpi.filterValue !== null) {
                  onSelectFilter(isSelected ? null : kpi.filterValue);
                }
              }}
              className={cn(
                "group relative flex flex-col justify-between rounded-lg border p-3 text-left transition-all duration-150 min-h-[96px]",
                kpi.bg,
                kpi.filterValue ? "cursor-pointer hover:shadow-sm" : "cursor-default",
                isSelected && "ring-2 ring-blue-600 ring-offset-1 border-blue-500 shadow-sm"
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium text-slate-600 truncate">{kpi.label}</span>
                <Icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", kpi.color)} />
              </div>

              <div className="mt-2">
                <div className={cn("text-xl font-bold tracking-tight font-mono tabular-nums", kpi.color)}>
                  {kpi.value}
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500 truncate">{kpi.subtext}</p>
              </div>

              {isSelected && (
                <div className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-600" />
              )}
            </button>
          );
        })}
      </div>

      {/* Flaky Tests Alert Banner */}
      {metrics.flaky_tests_count > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-amber-800">
              <Flame className="h-4 w-4" />
            </span>
            <div>
              <span className="font-semibold text-slate-900">
                {metrics.flaky_tests_count} Flaky Test Candidate{metrics.flaky_tests_count > 1 ? "s" : ""} Detected
              </span>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Deterministic analysis identified tests with alternating pass/fail outcomes across historical runs (e.g. TC-027 with 4 flips).
              </p>
            </div>
          </div>
          {onOpenFlakyModal && (
            <button
              type="button"
              onClick={onOpenFlakyModal}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-xs hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Inspect Flaky Tests
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Execution Health & Trend Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Outcome Distribution Bar */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-800">Execution Outcome Distribution</span>
            <span className="text-[11px] text-slate-500 font-mono">{metrics.total_tests_executed.toLocaleString()} total</span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 flex" aria-hidden="true">
            <div style={{ width: `${passWidth}%` }} className="bg-emerald-500 h-full transition-all" title={`Passed: ${metrics.passed_tests}`} />
            <div style={{ width: `${failWidth}%` }} className="bg-red-500 h-full transition-all" title={`Failed: ${metrics.failed_tests}`} />
            <div style={{ width: `${blockWidth}%` }} className="bg-amber-500 h-full transition-all" title={`Blocked: ${metrics.blocked_tests}`} />
            <div style={{ width: `${skipWidth}%` }} className="bg-slate-400 h-full transition-all" title={`Skipped: ${metrics.skipped_tests}`} />
          </div>

          <div className="mt-2.5 grid grid-cols-4 gap-1 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Passed ({metrics.passed_tests})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
              <span>Failed ({metrics.failed_tests})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
              <span>Blocked ({metrics.blocked_tests})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
              <span>Skipped ({metrics.skipped_tests})</span>
            </div>
          </div>
        </div>

        {/* Historical Trends (Last 15 Runs) */}
        <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-800">Historical Run Progression (Last 15 Runs)</span>
            <span className="text-[11px] text-slate-500">Pass rate & durations over time</span>
          </div>

          <div className="flex items-end gap-1.5 h-16 pt-2 border-b border-slate-100">
            {metrics.trends.map((t) => {
              const heightPct = Math.max(15, Math.min(100, t.pass_rate));
              const isFail = t.failed > 0;
              return (
                <div
                  key={t.id}
                  className="flex-1 flex flex-col items-center group relative h-full justify-end"
                >
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={cn(
                      "w-full rounded-t-xs transition-all",
                      isFail ? "bg-red-400 hover:bg-red-500" : "bg-emerald-400 hover:bg-emerald-500"
                    )}
                  />
                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 w-36 rounded bg-slate-900 p-2 text-2xs text-white shadow-lg">
                    <p className="font-bold text-white">{t.key}</p>
                    <p className="text-slate-300">Passed: {t.passed} / {t.total}</p>
                    <p className={isFail ? "text-red-400 font-semibold" : "text-emerald-400"}>
                      Pass Rate: {t.pass_rate}%
                    </p>
                    <p className="text-slate-400 font-mono text-[10px] mt-0.5">{fmtDuration(t.duration_ms)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Earlier runs</span>
            <span>Latest run ({metrics.latest_run?.key || "Recent"})</span>
          </div>
        </div>
      </div>

      {/* Runner & Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/80">
        <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Runners:</span>
        {Object.entries(metrics.breakdowns.by_runner).map(([runner, count]) => (
          <button
            key={runner}
            type="button"
            onClick={() => onSelectFilter(selectedFilter === `runner_${runner}` ? null : `runner_${runner}`)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer",
              selectedFilter === `runner_${runner}`
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-slate-100/80 text-slate-700 border-slate-200 hover:bg-slate-200/70"
            )}
          >
            <span>{runner.replace(/_/g, " ")}</span>
            <span className={cn("text-2xs font-mono font-bold rounded-full px-1.5 py-0.2", selectedFilter === `runner_${runner}` ? "bg-blue-800 text-blue-100" : "bg-white text-slate-600")}>
              {count}
            </span>
          </button>
        ))}

        <div className="h-4 w-px bg-slate-200 mx-1" />

        <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Categories:</span>
        {Object.entries(metrics.breakdowns.by_category).slice(0, 6).map(([category, count]) => (
          <button
            key={category}
            type="button"
            onClick={() => onSelectFilter(selectedFilter === `cat_${category}` ? null : `cat_${category}`)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer",
              selectedFilter === `cat_${category}`
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
          >
            <span>{category.replace(/_/g, " ")}</span>
            <span className="text-2xs font-mono text-slate-500">({count})</span>
          </button>
        ))}

        {selectedFilter && (
          <button
            type="button"
            onClick={() => onSelectFilter(null)}
            className="ml-auto text-xs font-medium text-blue-600 hover:text-blue-800 underline cursor-pointer"
          >
            Clear Filter
          </button>
        )}
      </div>
    </div>
  );
}
