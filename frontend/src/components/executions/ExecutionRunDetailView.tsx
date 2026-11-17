import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bug,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  GitCompare,
  Play,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { Button, Input } from "@/components/ui";
import { api, downloadUrl } from "@/services/api";
import type { Execution } from "@/types/models";
import { cn, fmtDate, fmtDuration } from "@/utils/format";

interface ExecutionRunDetailViewProps {
  executionId: number;
  onInspectResult: (resultId: number) => void;
  onOpenCompare: (runId: number) => void;
  onOpenExport: (execution: Execution) => void;
  onCreateDefect: (resultId: number) => void;
  onClose?: () => void;
}

export function ExecutionRunDetailView({
  executionId,
  onInspectResult,
  onOpenCompare,
  onOpenExport,
  onCreateDefect,
  onClose,
}: ExecutionRunDetailViewProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"results" | "logs" | "artifacts" | "details">("results");
  const [resultStatusFilter, setResultStatusFilter] = useState<string>("all");
  const [resultSearch, setResultSearch] = useState<string>("");
  const [copiedLog, setCopiedLog] = useState(false);

  // Query Execution Detail
  const q = useQuery({
    queryKey: ["execution", executionId],
    queryFn: () => api.get<Execution>(`/executions/${executionId}`),
    refetchInterval: (qq) =>
      qq.state.data && ["queued", "running"].includes(qq.state.data.status) ? 1500 : false,
  });

  // Query Logs
  const logsQ = useQuery({
    queryKey: ["execution-logs", executionId],
    queryFn: () => api.get<{ execution: string; log: string; status: string }>(`/executions/${executionId}/logs`),
    enabled: activeTab === "logs",
  });

  // Rerun Failed Mutation
  const rerunFailedMutation = useMutation({
    mutationFn: () => api.post(`/executions/${executionId}/rerun-failed`, {}),
    onSuccess: () => {
      toast.ok("Rerun of failed tests dispatched successfully");
      qc.invalidateQueries({ queryKey: ["executions"] });
    },
    onError: toast.error,
  });

  const exec = q.data;

  // Filtered Results
  const filteredResults = useMemo(() => {
    if (!exec?.results) return [];
    return exec.results.filter((r) => {
      const matchesStatus =
        resultStatusFilter === "all"
          ? true
          : resultStatusFilter === "passed"
          ? r.status === "passed"
          : resultStatusFilter === "failed"
          ? r.status === "failed" || r.status === "error"
          : r.status === resultStatusFilter;

      const matchesSearch =
        !resultSearch.trim() ||
        r.test_key.toLowerCase().includes(resultSearch.toLowerCase()) ||
        (r.test_title && r.test_title.toLowerCase().includes(resultSearch.toLowerCase())) ||
        (r.message && r.message.toLowerCase().includes(resultSearch.toLowerCase()));

      return matchesStatus && matchesSearch;
    });
  }, [exec?.results, resultStatusFilter, resultSearch]);

  const copyLogText = () => {
    if (!logsQ.data?.log) return;
    navigator.clipboard.writeText(logsQ.data.log);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
    toast.ok("Full execution log copied to clipboard");
  };

  if (q.isLoading) {
    return (
      <div className="p-12 text-center text-sm text-slate-500 animate-pulse bg-white rounded-lg border border-slate-200">
        Loading execution run telemetry and results…
      </div>
    );
  }

  if (q.isError || !exec) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
        Failed to load execution run: {q.error instanceof Error ? q.error.message : "Run not found"}
      </div>
    );
  }

  const isFailed = exec.status === "failed" || exec.status === "error";
  const isRunning = exec.status === "running" || exec.status === "queued";
  const total = Math.max(1, exec.total);
  const passRate = Math.round((exec.passed / total) * 100);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden text-xs">
      {/* Header Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200/60 transition-colors"
                title="Back to run list"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-blue-700">{exec.key}</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wider",
                    exec.status === "passed"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : isFailed
                      ? "bg-red-100 text-red-800 border border-red-200"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  )}
                >
                  {exec.status}
                </span>
                <span className="rounded bg-slate-200/80 text-slate-700 px-2 py-0.5 font-mono text-2xs font-medium">
                  {exec.runner || "Simulation"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {exec.suite?.name || "Full Test Suite Run"} • Started {fmtDate(exec.started_at || exec.created_at)}
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {isFailed && (
              <Button
                variant="primary"
                loading={rerunFailedMutation.isPending}
                onClick={() => rerunFailedMutation.mutate()}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Rerun Failed Tests ({exec.failed})
              </Button>
            )}

            <Button variant="secondary" onClick={() => onOpenCompare(exec.id)}>
              <GitCompare className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              Compare Run
            </Button>

            <Button variant="secondary" onClick={() => onOpenExport(exec)}>
              <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Real Progress Indicator if Active */}
        {isRunning && (
          <div className="rounded-md border border-blue-200 bg-blue-50/80 p-3 space-y-1.5 animate-pulse">
            <div className="flex items-center justify-between text-blue-900 font-semibold text-xs">
              <span className="flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5 text-blue-600" />
                Execution in progress ({exec.status.toUpperCase()})
              </span>
              <span>Evaluating test specifications…</span>
            </div>
          </div>
        )}

        {/* Run Telemetry Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-medium">Total Tests</span>
            <p className="text-base font-bold font-mono text-slate-900 mt-0.5">{exec.total}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-2.5 text-center">
            <span className="text-[10px] text-emerald-800 uppercase font-medium">Passed</span>
            <p className="text-base font-bold font-mono text-emerald-700 mt-0.5">{exec.passed}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/40 p-2.5 text-center">
            <span className="text-[10px] text-red-800 uppercase font-medium">Failed</span>
            <p className="text-base font-bold font-mono text-red-700 mt-0.5">{exec.failed}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-medium">Pass Rate</span>
            <p className="text-base font-bold font-mono text-slate-900 mt-0.5">{passRate}%</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
            <span className="text-[10px] text-slate-500 uppercase font-medium">Duration</span>
            <p className="text-base font-bold font-mono text-slate-900 mt-0.5">{fmtDuration(exec.duration_ms)}</p>
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="border-b border-slate-200 bg-white px-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("results")}
            className={cn(
              "py-3 px-3.5 font-semibold text-xs border-b-2 transition-all cursor-pointer",
              activeTab === "results"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            Test Results ({exec.results?.length ?? exec.total})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={cn(
              "py-3 px-3.5 font-semibold text-xs border-b-2 transition-all cursor-pointer",
              activeTab === "logs"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            Execution Logs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("artifacts")}
            className={cn(
              "py-3 px-3.5 font-semibold text-xs border-b-2 transition-all cursor-pointer",
              activeTab === "artifacts"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            Artifacts ({exec.artifacts?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={cn(
              "py-3 px-3.5 font-semibold text-xs border-b-2 transition-all cursor-pointer",
              activeTab === "details"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            Environment & Run Details
          </button>
        </div>
      </div>

      {/* Tab 1: Test Results Breakdown */}
      {activeTab === "results" && (
        <div className="p-4 space-y-3">
          {/* Results Filters & Search */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5">
              {["all", "passed", "failed", "blocked", "skipped"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setResultStatusFilter(st)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors cursor-pointer",
                    resultStatusFilter === st
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative w-64">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={resultSearch}
                onChange={(e) => setResultSearch(e.target.value)}
                placeholder="Search test key or error..."
                className="pl-8 text-xs py-1 h-8"
              />
            </div>
          </div>

          {/* Results Table */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Test Case</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Observed Outcome / Failure Summary</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No test results found matching this filter.
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((r) => {
                    const rowFailed = r.status === "failed" || r.status === "error";
                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          "hover:bg-slate-50 transition-colors",
                          rowFailed && "bg-red-50/20 hover:bg-red-50/40"
                        )}
                      >
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-blue-700">{r.test_key}</span>
                          <p className="text-slate-800 text-[11px] truncate max-w-xs mt-0.5">
                            {r.test_title || "—"}
                          </p>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={cn(
                              "inline-block rounded px-2 py-0.5 text-2xs font-bold uppercase",
                              r.status === "passed"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            )}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {fmtDuration(r.duration_ms)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 truncate max-w-sm font-mono text-[11px]">
                          {r.message ? r.message.split("\n")[0] : "Passed nominal assertions"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onInspectResult(r.id)}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-2xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <Eye className="h-3 w-3 text-slate-500" />
                              Inspect
                            </button>
                            {rowFailed && (
                              <button
                                type="button"
                                onClick={() => onCreateDefect(r.id)}
                                className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-2xs font-semibold text-rose-800 hover:bg-rose-100 transition-colors cursor-pointer"
                              >
                                <Bug className="h-3 w-3 text-rose-600" />
                                File Defect
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Logs */}
      {activeTab === "logs" && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">Runner Output & Stdout</span>
            <Button variant="secondary" size="sm" onClick={copyLogText}>
              {copiedLog ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1 text-slate-500" />}
              {copiedLog ? "Copied" : "Copy Log"}
            </Button>
          </div>

          <div className="rounded-lg border border-slate-300 bg-slate-900 p-3.5 font-mono text-[11px] leading-relaxed text-slate-100 max-h-96 overflow-auto whitespace-pre-wrap break-words">
            {logsQ.isLoading ? "Loading execution logs…" : logsQ.data?.log || exec.log_excerpt || "No log content recorded."}
          </div>
        </div>
      )}

      {/* Tab 3: Artifacts */}
      {activeTab === "artifacts" && (
        <div className="p-4 space-y-2">
          {exec.artifacts?.length ? (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
              {exec.artifacts.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-white hover:bg-slate-50">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="font-mono font-medium text-slate-900">{a.name}</p>
                      <p className="text-2xs text-slate-500">{a.kind} • {(a.size_bytes / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <a
                    href={downloadUrl(`/executions/${exec.id}/artifacts/${a.id}`)}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 rounded-lg border border-slate-200 bg-slate-50">
              No artifacts stored for this execution run.
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Environment & Run Details */}
      {activeTab === "details" && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Environment Configuration</span>
            <div className="space-y-1 text-slate-700">
              <p>Name: <strong>{exec.environment?.name || "Default Target"}</strong></p>
              <p>Kind: <span className="font-mono">{exec.environment?.kind || "simulation"}</span></p>
              <p>Isolation: <span className="font-mono">{exec.isolation_level || "netns+rlimits"}</span></p>
              <p>Reference HCM Version: <span className="font-mono">{exec.hcm_version || "1.0"}</span></p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Execution Trigger & Source</span>
            <div className="space-y-1 text-slate-700">
              <p>Source: <span className="font-mono">{exec.source}</span></p>
              <p>Triggered By: <strong>{exec.triggered_by?.name || "System Automated"}</strong></p>
              <p>Branch: <span className="font-mono">{exec.branch || "main"}</span></p>
              <p>Commit SHA: <span className="font-mono">{exec.commit_sha || "—"}</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
