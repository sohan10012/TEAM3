import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bug,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Layers,
  RotateCcw,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/Toast";
import { Button, Dialog } from "@/components/ui";
import { api } from "@/services/api";
import { cn, fmtDate, fmtDuration } from "@/utils/format";

interface ExecutionResultInspectionModalProps {
  resultId: number | null;
  onClose: () => void;
  onCreateDefect?: (resultId: number) => void;
}

export function ExecutionResultInspectionModal({
  resultId,
  onClose,
  onCreateDefect,
}: ExecutionResultInspectionModalProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const q = useQuery({
    queryKey: ["execution-result", resultId],
    queryFn: () => api.get<any>(`/execution-results/${resultId}`),
    enabled: Boolean(resultId),
  });

  const analyzeMutation = useMutation({
    mutationFn: () => api.post(`/execution-results/${resultId}/analyze`, {}),
    onSuccess: () => {
      toast.ok("AI root cause hypothesis generated successfully");
      qc.invalidateQueries({ queryKey: ["execution-result", resultId] });
    },
    onError: toast.error,
  });

  if (!resultId) return null;

  const data = q.data;
  const tc = data?.test_case;
  const req = data?.requirement;
  const failureAnalysis = data?.failure_analysis;
  const isFailed = data?.status === "failed" || data?.status === "error";

  const copyLogs = () => {
    const text = `=== EXECUTION RESULT LOG: ${data?.id} ===\nTest: ${tc?.key} - ${tc?.title}\nStatus: ${data?.status}\n\nAssertion Message:\n${data?.message}\n\nStdout:\n${data?.stdout}\n\nStack Trace:\n${data?.stack_trace}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.ok("Execution evidence copied to clipboard");
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={tc?.key ? `${tc.key} — Expected vs Actual Intelligence` : "Expected vs Actual Result Intelligence"}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={copyLogs}>
              {copied ? <Check className="h-4 w-4 mr-1 text-emerald-600" /> : <Copy className="h-4 w-4 mr-1 text-slate-500" />}
              {copied ? "Copied" : "Copy Evidence"}
            </Button>
            {isFailed && onCreateDefect && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onCreateDefect(resultId);
                }}
              >
                <Bug className="h-4 w-4 mr-1.5" />
                {data?.linked_defect ? "View / Link Defect" : "File Defect from Failure"}
              </Button>
            )}
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      }
    >
      {q.isLoading && (
        <div className="p-8 text-center text-sm text-slate-500 animate-pulse">
          Loading comprehensive result intelligence…
        </div>
      )}

      {q.isError && (
        <div className="p-6 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          Failed to load execution result details: {q.error instanceof Error ? q.error.message : "Unknown error"}
        </div>
      )}

      {data && (
        <div className="space-y-6 text-xs max-h-[70vh] overflow-y-auto pr-1">
          {/* Header Metadata Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-medium">Test Case</span>
              <p className="font-semibold text-slate-900 truncate mt-0.5">{tc?.title || "—"}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-medium">Execution Run</span>
              <p className="font-mono font-medium text-slate-900 mt-0.5">{data.execution_key || `#${data.execution_id}`}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-medium">Runner Engine</span>
              <p className="font-mono text-slate-800 mt-0.5">{data.runner || "Simulation"}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-medium">Execution Duration</span>
              <p className="font-mono font-bold text-slate-900 mt-0.5">{fmtDuration(data.duration_ms)}</p>
            </div>
          </div>

          {/* Section A: 4-Dimension Expected vs Actual Comparison Matrix */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                Structured Expected vs. Actual Comparison Matrix
              </h4>
              <span className="text-[11px] text-slate-500">4 Dimensional Quality Verification</span>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2 px-3 w-32">Dimension</th>
                    <th className="py-2 px-3">Expected Specification</th>
                    <th className="py-2 px-3">Actual Observed Output</th>
                    <th className="py-2 px-3 w-20 text-center">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.comparison_matrix?.map((row: any, idx: number) => {
                    const rowPassed = row.status === "passed";
                    return (
                      <tr key={idx} className={rowPassed ? "hover:bg-slate-50/50" : "bg-red-50/30 hover:bg-red-50/50"}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{row.dimension}</td>
                        <td className="py-2.5 px-3 text-slate-700 leading-relaxed">{row.expected || "—"}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-900 leading-relaxed">
                          {row.actual || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-2xs font-bold uppercase",
                              rowPassed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: AI Root Cause Analysis & Investigation (For Failures) */}
          {isFailed && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-700" />
                  <h4 className="font-semibold text-amber-950 text-xs">AI Root Cause Analysis & Investigation</h4>
                  {failureAnalysis?.failure_category && (
                    <span className="rounded bg-amber-200/80 px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-amber-900">
                      {failureAnalysis.failure_category.replace(/_/g, " ")}
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  loading={analyzeMutation.isPending}
                  onClick={() => analyzeMutation.mutate()}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Re-evaluate AI Hypothesis
                </Button>
              </div>

              {failureAnalysis ? (
                <div className="space-y-2.5 pt-1 text-slate-800">
                  <div>
                    <span className="font-medium text-amber-950 text-[11px]">Root Cause Hypothesis:</span>
                    <p className="mt-0.5 leading-relaxed bg-white/80 p-2.5 rounded border border-amber-200/70 text-slate-800">
                      {failureAnalysis.root_cause_hypothesis}
                    </p>
                  </div>

                  {failureAnalysis.supporting_evidence?.length > 0 && (
                    <div>
                      <span className="font-medium text-amber-950 text-[11px]">Supporting Evidence Quotes:</span>
                      <ul className="mt-1 space-y-1 list-disc list-inside text-[11px] text-slate-700 font-mono">
                        {failureAnalysis.supporting_evidence.map((quote: string, i: number) => (
                          <li key={i} className="bg-amber-100/50 p-1.5 rounded">"{quote}"</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {failureAnalysis.recommended_action && (
                    <div className="bg-white/90 p-2.5 rounded border border-amber-200 text-xs">
                      <span className="font-semibold text-slate-900">Recommended QA Action:</span>
                      <p className="mt-0.5 text-slate-700">{failureAnalysis.recommended_action}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span>Framed as hypothesis (confidence: {Math.round((failureAnalysis.confidence || 0.88) * 100)}%)</span>
                    <span>Grounding: Persisted execution logs & specification models</span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-slate-600 mb-2">No failure investigation has been generated yet for this result.</p>
                  <Button variant="primary" loading={analyzeMutation.isPending} onClick={() => analyzeMutation.mutate()}>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Generate Root Cause Hypothesis
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Section C: Traceability Chain (Requirement -> Clause -> AC -> Defect) */}
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-blue-600" />
              Traceability & Defect Linkage
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Parent Requirement */}
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Originating Requirement</span>
                {req ? (
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-700">{req.key}</span>
                    <p className="text-slate-800 text-xs mt-0.5 font-medium">{req.title}</p>
                    {tc?.clause_keys?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tc.clause_keys.map((ck: string) => (
                          <span key={ck} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 border border-slate-200">
                            {ck}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500">No parent requirement linked.</p>
                )}
              </div>

              {/* Linked Defect */}
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Associated Defect</span>
                {data.linked_defect ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-700">{data.linked_defect.key}</span>
                      <span className="rounded bg-rose-100 text-rose-800 text-2xs px-1.5 py-0.2 font-bold uppercase">
                        {data.linked_defect.severity}
                      </span>
                    </div>
                    <p className="text-slate-800 text-xs mt-0.5 truncate">{data.linked_defect.title}</p>
                    <Link
                      to={`/defects?q=${data.linked_defect.key}`}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-1 font-medium"
                    >
                      Open defect record <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col justify-between h-full pt-1">
                    <p className="text-slate-500 text-xs">No defect currently linked.</p>
                    {isFailed && onCreateDefect && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onCreateDefect(resultId);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 mt-2 cursor-pointer"
                      >
                        <Bug className="h-3.5 w-3.5" />
                        Log defect from this failure →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section D: Stdout & Execution Evidence */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-slate-700" />
                Raw Execution Stdout & Log Evidence
              </h4>
              <button
                type="button"
                onClick={copyLogs}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
              >
                Copy Log Text
              </button>
            </div>

            <div className="rounded-lg border border-slate-300 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100 max-h-48 overflow-auto whitespace-pre-wrap break-words">
              {data.message && (
                <div className="text-red-400 font-semibold mb-2 pb-2 border-b border-slate-800">
                  Assertion / Error: {data.message}
                </div>
              )}
              {data.stdout || "No stdout recorded for this test case."}
              {data.stack_trace && (
                <div className="mt-2 pt-2 border-t border-slate-800 text-slate-400 text-[10px]">
                  {data.stack_trace}
                </div>
              )}
            </div>
          </div>

          {/* Section E: Historical Execution Attempts */}
          {data.execution_history?.length > 1 && (
            <div className="space-y-2 pt-1 border-t border-slate-200">
              <h4 className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-600" />
                Historical Attempts for {tc?.key} ({data.execution_history.length} runs)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {data.execution_history.map((h: any) => (
                  <div
                    key={h.result_id}
                    className={cn(
                      "rounded border p-2 text-2xs space-y-0.5",
                      h.status === "passed" ? "bg-emerald-50/50 border-emerald-200" : "bg-red-50/50 border-red-200"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{h.execution_key}</span>
                      <span className={cn("font-bold uppercase text-[9px]", h.status === "passed" ? "text-emerald-700" : "text-red-700")}>
                        {h.status}
                      </span>
                    </div>
                    <p className="text-slate-500 font-mono">{fmtDuration(h.duration_ms)}</p>
                    <p className="text-slate-400 text-[9px] truncate">{fmtDate(h.started_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
