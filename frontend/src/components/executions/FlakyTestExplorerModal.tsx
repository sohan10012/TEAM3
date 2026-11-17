import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Flame,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { api } from "@/services/api";
import type { FlakyTestCandidate } from "@/types/models";
import { cn, fmtDuration } from "@/utils/format";

interface FlakyTestExplorerModalProps {
  projectId: number;
  onClose: () => void;
  onInspectResult?: (resultId: number) => void;
}

export function FlakyTestExplorerModal({
  projectId,
  onClose,
  onInspectResult,
}: FlakyTestExplorerModalProps) {
  const q = useQuery({
    queryKey: ["project-flaky-tests", projectId],
    queryFn: () => api.get<FlakyTestCandidate[]>(`/projects/${projectId}/flaky-tests`),
  });

  const flakyList = q.data ?? [];

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Flaky Test Intelligence & Diagnostics"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-2xs text-slate-500">
            Deterministic detection based on alternating pass/fail sequences across historical runs.
          </span>
          <Button onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
        {/* Explanation Banner */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-1 text-slate-800">
          <div className="flex items-center gap-1.5 font-semibold text-amber-950 text-xs">
            <ShieldAlert className="h-4 w-4 text-amber-700" />
            Evidence-Based Flakiness Detection
          </div>
          <p className="text-[11px] text-slate-700 leading-relaxed">
            Tests are classified as flaky only when genuine status flips (transitioning between passed and failed without code alteration)
            are observed across multiple recorded execution runs. Single failures are never labeled as flaky.
          </p>
        </div>

        {q.isLoading ? (
          <div className="p-8 text-center text-slate-500 animate-pulse">
            Analyzing historical execution telemetry for flakiness patterns…
          </div>
        ) : q.isError ? (
          <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
            Failed to load flaky test analysis: {q.error instanceof Error ? q.error.message : "Unknown error"}
          </div>
        ) : flakyList.length === 0 ? (
          <div className="p-8 text-center rounded-lg border border-slate-200 bg-slate-50 space-y-1">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
            <h4 className="font-semibold text-slate-900 text-sm">Zero Flaky Tests Detected</h4>
            <p className="text-slate-500 text-xs">
              All test cases in this project exhibit deterministic execution behavior across historical runs.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {flakyList.map((item) => (
              <div
                key={item.test_case_id}
                className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3 shadow-xs hover:border-slate-300 transition-colors"
              >
                {/* Test Case Header */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-700 text-xs">{item.test_key}</span>
                      <span className="rounded bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 text-[10px] font-medium">
                        {item.category}
                      </span>
                      <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 text-[10px] font-semibold">
                        {item.priority}
                      </span>
                    </div>
                    <h5 className="font-semibold text-slate-900 text-xs mt-1">{item.test_title}</h5>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block">Flakiness Confidence</span>
                    <span className="font-mono font-bold text-amber-700 text-xs flex items-center justify-end gap-1">
                      <Flame className="h-3.5 w-3.5 text-amber-600" />
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </div>
                </div>

                {/* Metrics Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded border border-slate-100 bg-slate-50/70 p-2 text-2xs">
                  <div>
                    <span className="text-slate-500">Status Flips</span>
                    <p className="font-mono font-bold text-slate-900 mt-0.5">{item.flip_count} transitions</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Runs</span>
                    <p className="font-mono font-medium text-slate-900 mt-0.5">{item.total_runs} evaluated</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Pass / Fail Ratio</span>
                    <p className="font-mono font-medium text-slate-900 mt-0.5">
                      <span className="text-emerald-700">{item.passed_runs}P</span> / <span className="text-red-700">{item.failed_runs}F</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Flip Rate</span>
                    <p className="font-mono font-bold text-amber-700 mt-0.5">{Math.round(item.flip_rate * 100)}%</p>
                  </div>
                </div>

                {/* Status Sequence Visualizer */}
                <div>
                  <span className="text-[10px] text-slate-500 font-medium block mb-1">
                    Recent Execution Sequence (Chronological):
                  </span>
                  <div className="flex items-center gap-1.5">
                    {item.history.map((h, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center gap-1 rounded px-2 py-1 text-2xs font-mono font-bold uppercase cursor-pointer hover:ring-1 hover:ring-slate-400 transition-all",
                          h.status === "passed"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                        )}
                        title={`Run ${h.execution_key}: ${h.status} (${fmtDuration(h.duration_ms)})`}
                        onClick={() => onInspectResult && onInspectResult(h.result_id)}
                      >
                        <span className="text-[9px]">{h.execution_key}</span>
                        {h.status === "passed" ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-700" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
