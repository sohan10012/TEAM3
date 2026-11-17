import {
  Clock,
} from "lucide-react";
import type { Execution } from "@/types/models";
import { cn, fmtDate, fmtDuration } from "@/utils/format";

interface ExecutionTimelineViewProps {
  executions: Execution[];
  selectedRunId: number | null;
  onSelectRun: (runId: number) => void;
  onInspectResult?: (testCaseId: number) => void;
}

export function ExecutionTimelineView({
  executions,
  selectedRunId,
  onSelectRun,
}: ExecutionTimelineViewProps) {
  if (executions.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-500">
        No execution runs found matching current filter parameters.
      </div>
    );
  }

  // Sort executions descending by id (latest first)
  const sorted = [...executions].sort((a, b) => b.id - a.id);

  return (
    <div className="relative border-l border-slate-200 ml-4 pl-6 space-y-6 py-2">
      {sorted.map((e) => {
        const isPassed = e.status === "passed";
        const isFailed = e.status === "failed" || e.status === "error";
        const isRunning = e.status === "running" || e.status === "queued";
        const isSelected = selectedRunId === e.id;
        const total = Math.max(1, e.total);
        const passRate = Math.round((e.passed / total) * 100);

        return (
          <div key={e.id} className="relative group">
            {/* Timeline Dot */}
            <div
              className={cn(
                "absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white transition-all",
                isPassed ? "bg-emerald-500" : isFailed ? "bg-red-500" : isRunning ? "bg-blue-500 animate-pulse" : "bg-slate-400"
              )}
            />

            {/* Run Card */}
            <div
              onClick={() => onSelectRun(e.id)}
              className={cn(
                "rounded-lg border p-4 text-xs transition-all duration-150 cursor-pointer shadow-xs",
                isSelected
                  ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-500 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-blue-700">{e.key}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wider",
                      isPassed ? "bg-emerald-100 text-emerald-800" : isFailed ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"
                    )}
                  >
                    {e.status}
                  </span>
                  <span className="rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-2xs font-mono font-medium">
                    {e.runner || "Simulation"}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="h-3.5 w-3.5" />
                    {fmtDuration(e.duration_ms)}
                  </span>
                  <span>{fmtDate(e.started_at || e.created_at)}</span>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span>
                    <strong className="text-slate-900">{e.total}</strong> tests
                  </span>
                  <span className="text-emerald-700 font-semibold">
                    {e.passed} passed
                  </span>
                  {e.failed > 0 && (
                    <span className="text-red-700 font-bold">
                      {e.failed} failed
                    </span>
                  )}
                  {e.errored > 0 && (
                    <span className="text-amber-700">
                      {e.errored} errors
                    </span>
                  )}
                  <span className="text-slate-500 font-sans text-2xs">
                    Pass Rate: <strong>{passRate}%</strong>
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-40 h-2 rounded-full overflow-hidden bg-slate-100 flex shrink-0">
                  <div style={{ width: `${(e.passed / total) * 100}%` }} className="bg-emerald-500 h-full" />
                  <div style={{ width: `${(e.failed / total) * 100}%` }} className="bg-red-500 h-full" />
                  <div style={{ width: `${((e.errored || 0) / total) * 100}%` }} className="bg-amber-500 h-full" />
                </div>
              </div>

              {/* Log excerpt if failure */}
              {isFailed && e.log_excerpt && (
                <div className="mt-2 rounded bg-slate-900 p-2 font-mono text-[10px] text-red-300 truncate">
                  {e.log_excerpt}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
