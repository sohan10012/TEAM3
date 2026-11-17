import { useQuery } from "@tanstack/react-query";
import {
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Button, Dialog, Select } from "@/components/ui";
import { api } from "@/services/api";
import type { Execution, ExecutionComparisonData } from "@/types/models";
import { cn, fmtDuration } from "@/utils/format";

interface ExecutionRunCompareModalProps {
  initialRunAId: number | null;
  runs: Execution[];
  onClose: () => void;
}

export function ExecutionRunCompareModal({
  initialRunAId,
  runs,
  onClose,
}: ExecutionRunCompareModalProps) {
  const [runAId, setRunAId] = useState<number>(initialRunAId || runs[0]?.id || 0);
  const [runBId, setRunBId] = useState<number>(
    runs.find((r) => r.id !== (initialRunAId || runs[0]?.id))?.id || runs[0]?.id || 0
  );
  const [activeTab, setActiveTab] = useState<"all" | "regressions" | "improvements" | "persistent" | "stable">("regressions");

  const q = useQuery({
    queryKey: ["execution-comparison", runAId, runBId],
    queryFn: () => api.get<ExecutionComparisonData>(`/executions/${runAId}/compare/${runBId}`),
    enabled: Boolean(runAId && runBId && runAId !== runBId),
  });

  const data = q.data;

  const filteredItems = (() => {
    if (!data) return [];
    if (activeTab === "regressions") return data.regressions;
    if (activeTab === "improvements") return data.improvements;
    if (activeTab === "persistent") return data.persistent_failures;
    if (activeTab === "stable") return data.all_comparisons.filter((c) => c.transition === "stable_pass");
    return data.all_comparisons;
  })();

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Historical Execution Comparison"
      footer={
        <div className="flex items-center justify-end w-full">
          <Button onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div className="space-y-5 text-xs max-h-[75vh] overflow-y-auto pr-1">
        {/* Run Selector Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Run A (Baseline)
            </label>
            <Select
              value={runAId}
              onChange={(e) => setRunAId(Number(e.target.value))}
              className="w-full text-xs font-mono"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.key} ({r.status.toUpperCase()} - {r.total} tests)
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Run B (Comparison Target)
            </label>
            <Select
              value={runBId}
              onChange={(e) => setRunBId(Number(e.target.value))}
              className="w-full text-xs font-mono"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.key} ({r.status.toUpperCase()} - {r.total} tests)
                </option>
              ))}
            </Select>
          </div>
        </div>

        {runAId === runBId ? (
          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
            Please select two different execution runs to perform comparative analysis.
          </div>
        ) : q.isLoading ? (
          <div className="p-12 text-center text-slate-500 animate-pulse">
            Computing test-level comparison between runs…
          </div>
        ) : q.isError ? (
          <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
            Failed to compute comparison: {q.error instanceof Error ? q.error.message : "Unknown error"}
          </div>
        ) : data ? (
          <>
            {/* Executive Comparison Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1">
                <span className="text-[10px] text-slate-500 font-medium">Pass Rate Delta</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "text-lg font-bold font-mono",
                    data.delta.pass_rate_diff > 0 ? "text-emerald-700" : data.delta.pass_rate_diff < 0 ? "text-red-700" : "text-slate-700"
                  )}>
                    {data.delta.pass_rate_diff > 0 ? `+${data.delta.pass_rate_diff}%` : `${data.delta.pass_rate_diff}%`}
                  </span>
                  {data.delta.pass_rate_diff >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  {data.run_a.pass_rate}% → {data.run_b.pass_rate}%
                </p>
              </div>

              <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 space-y-1">
                <span className="text-[10px] text-rose-800 font-medium">Regressions</span>
                <div className="text-lg font-bold font-mono text-rose-700">
                  {data.summary.regressions_count}
                </div>
                <p className="text-[10px] text-rose-600">Passed in A, Failed in B</p>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-1">
                <span className="text-[10px] text-emerald-800 font-medium">Improvements</span>
                <div className="text-lg font-bold font-mono text-emerald-700">
                  {data.summary.improvements_count}
                </div>
                <p className="text-[10px] text-emerald-600">Failed in A, Passed in B</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1">
                <span className="text-[10px] text-slate-500 font-medium">Duration Delta</span>
                <div className="text-lg font-bold font-mono text-slate-800">
                  {data.delta.duration_diff_ms > 0 ? `+${fmtDuration(data.delta.duration_diff_ms)}` : fmtDuration(data.delta.duration_diff_ms)}
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  {fmtDuration(data.run_a.duration_ms)} → {fmtDuration(data.run_b.duration_ms)}
                </p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("regressions")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                  activeTab === "regressions" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                Regressions ({data.summary.regressions_count})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("improvements")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                  activeTab === "improvements" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                Improvements ({data.summary.improvements_count})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("persistent")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                  activeTab === "persistent" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                Persistent Failures ({data.summary.persistent_failures_count})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                  activeTab === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                All Compared ({data.summary.total_compared})
              </button>
            </div>

            {/* Test Items Table */}
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Test Case</th>
                    <th className="py-2 px-3">Run A Status</th>
                    <th className="py-2 px-3">Run B Status</th>
                    <th className="py-2 px-3">Transition</th>
                    <th className="py-2 px-3 text-right">Duration Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No test cases found matching this comparison filter.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item: any) => {
                      const isReg = item.transition === "regression";
                      const isImp = item.transition === "improvement";
                      return (
                        <tr
                          key={item.test_case_id}
                          className={cn(
                            "hover:bg-slate-50/70",
                            isReg && "bg-red-50/40",
                            isImp && "bg-emerald-50/40"
                          )}
                        >
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-blue-700">{item.test_key}</span>
                            <p className="text-slate-800 text-[11px] truncate max-w-sm mt-0.5">{item.test_title}</p>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={cn(
                              "inline-block rounded px-2 py-0.5 text-2xs font-bold uppercase",
                              item.status_a === "passed" ? "bg-emerald-100 text-emerald-800" : item.status_a === "not_run" ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-800"
                            )}>
                              {item.status_a}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={cn(
                              "inline-block rounded px-2 py-0.5 text-2xs font-bold uppercase",
                              item.status_b === "passed" ? "bg-emerald-100 text-emerald-800" : item.status_b === "not_run" ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-800"
                            )}>
                              {item.status_b}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wider",
                              isReg ? "bg-red-100 text-red-800" : isImp ? "bg-emerald-100 text-emerald-800" : item.transition === "persistent_failure" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                            )}>
                              {item.transition.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-600">
                            {item.duration_delta_ms !== 0 ? `${item.duration_delta_ms > 0 ? "+" : ""}${item.duration_delta_ms}ms` : "0ms"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
