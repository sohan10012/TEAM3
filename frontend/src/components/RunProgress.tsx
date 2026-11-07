import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge, Notice } from "@/components/ui";
import { useRun } from "@/hooks/useRun";
import { fmtDate } from "@/utils/format";

interface RunProgressProps {
  runId: number;
  onDone?: (status: string) => void;
}

const AGENT_WORKFLOW_STEPS = [
  { key: "sanitize", label: "Input Sanitisation", desc: "Strip control chars, normalize unicode, scan injection markers" },
  { key: "clauses", label: "Clause Extraction", desc: "Decompose requirement text into atomic numbered clauses" },
  { key: "ambiguity", label: "Ambiguity Detection", desc: "Detect underspecified terms and compute ambiguity risk" },
  { key: "criteria", label: "Acceptance Criteria", desc: "Synthesize quote-verified Given-When-Then rules" },
  { key: "tests", label: "Test Scenario Synthesis", desc: "Generate executable Python test scenarios" },
  { key: "edge_cases", label: "Edge-Case Generation", desc: "Synthesize negative boundaries and threshold tests" },
  { key: "rule_validation", label: "Rule Specification", desc: "Validate deterministic AST grammar and parameters" },
  { key: "validation", label: "Deterministic Validation", desc: "Evaluate clause grounding and duplicate prevention" },
  { key: "coverage", label: "Coverage Gap Analysis", desc: "Verify 100% clause-to-test traceability" },
  { key: "review", label: "Human Review Gate", desc: "Persist LangGraph state for dual-control reviewer signoff" },
];

function formatDetail(detail: any): string {
  if (detail == null) return "";
  if (typeof detail === "string") return detail;
  if (typeof detail === "number" || typeof detail === "boolean") return String(detail);
  if (typeof detail === "object") {
    try {
      const entries = Object.entries(detail);
      if (entries.length === 0) return "";
      return entries
        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
        .join(" · ");
    } catch {
      return JSON.stringify(detail);
    }
  }
  return String(detail);
}

export function RunProgress({ runId, onDone }: RunProgressProps) {
  const { run, done } = useRun(runId);
  const fired = useRef(false);
  const status = run?.status;

  useEffect(() => {
    if (done && status && onDone && !fired.current) {
      fired.current = true;
      onDone(status);
    }
  }, [done, status, onDone]);

  if (!run) {
    return (
      <div className="flex items-center gap-2.5 p-4 text-xs text-slate-600 bg-slate-50 rounded border border-slate-200">
        <Loader2 className="h-4 w-4 animate-spin text-[#3067DB]" />
        <span>Initializing LangGraph checkpoint session...</span>
      </div>
    );
  }

  const executedSteps = run.steps ?? [];

  return (
    <div className="space-y-4" aria-live="polite">
      {/* Run Header & Progress Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded border border-slate-200">
        <div className="flex items-center gap-2">
          <Badge value={run.status} />
          <span className="text-xs font-semibold text-slate-800">
            {run.kind === "analyse" ? "Requirement Intelligence Pipeline" : "Test Generation Workflow"}
          </span>
          <span className="font-mono text-2xs text-slate-400">Run #{run.id}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-36 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-[#3067DB] transition-all duration-300"
              style={{ width: `${Math.round((run.progress ?? 0) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-mono font-medium text-slate-700">
            {Math.round((run.progress ?? 0) * 100)}%
          </span>
        </div>
      </div>

      {/* Step by Step Agent Execution Chain */}
      <div className="divide-y divide-slate-100 rounded border border-slate-200 bg-white shadow-xs overflow-hidden">
        {AGENT_WORKFLOW_STEPS.map((step, idx) => {
          // Check matching step from backend execution
          const matched = executedSteps.find(
            (s) => s?.name && (s.name.toLowerCase().includes(step.key) || s.name.toLowerCase() === step.key)
          );
          const isDone = matched && (matched.status === "completed" || matched.status === "passed" || matched.status === "reused");
          const isFailed = matched && (matched.status === "failed" || matched.status === "error");
          const isRunning = matched && (matched.status === "running" || matched.status === "active");

          let statusBadge = (
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              WAITING
            </span>
          );

          if (isRunning) {
            statusBadge = (
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#3067DB] border border-blue-200 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                RUNNING
              </span>
            );
          } else if (isDone) {
            statusBadge = (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                COMPLETED
              </span>
            );
          } else if (isFailed) {
            statusBadge = (
              <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 border border-rose-200">
                <XCircle className="h-3 w-3" />
                FAILED
              </span>
            );
          } else if (step.key === "review" && run.status === "awaiting_review") {
            statusBadge = (
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                <AlertTriangle className="h-3 w-3" />
                REQUIRES REVIEW
              </span>
            );
          }

          const detailStr = formatDetail(matched?.detail);

          return (
            <div key={step.key} className="p-3 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-[10px] text-slate-500 font-medium">
                  {idx + 1}
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900">{step.label}</span>
                    {detailStr && (
                      <span className="text-[11px] text-slate-500 font-mono bg-slate-50 px-1 rounded border border-slate-100">
                        {detailStr}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">{step.desc}</p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {matched?.at && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                    <Clock className="h-3 w-3" />
                    {fmtDate(matched.at, false)}
                  </span>
                )}
                {statusBadge}
              </div>
            </div>
          );
        })}
      </div>

      {/* Observability Alerts */}
      {run.status === "degraded" && (
        <Notice tone="warn">
          The workflow completed with partial validation fallback. Grounded items were safely persisted; ungrounded
          hallucinations were rejected by deterministic guardrails.
        </Notice>
      )}

      {run.status === "failed" && (
        <Notice tone="danger">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-xs">Workflow Halt</p>
              <p className="text-xs">{run.error ?? "An unexpected exception halted graph execution."}</p>
            </div>
          </div>
        </Notice>
      )}

      {run.status === "awaiting_review" && (
        <Notice>
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-[#3067DB] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-xs text-slate-900">Dual-Control Human Review Required</p>
              <p className="text-xs text-slate-600">
                Generated criteria and test cases are staged in the Review Queue. Test authors cannot self-approve.
              </p>
            </div>
          </div>
        </Notice>
      )}

      {/* Guardrail Rejections & Filter Detections */}
      {(() => {
        const resultObj: any = typeof run.result === "string"
          ? (() => { try { return JSON.parse(run.result); } catch { return {}; } })()
          : (run.result || {});
        const invalidItems: any[] = Array.isArray(resultObj?.invalid_items) ? resultObj.invalid_items : [];
        if (invalidItems.length === 0) return null;
        return (
          <div className="rounded-md border border-rose-200 bg-rose-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-700 shrink-0" />
                <p className="text-xs font-semibold text-rose-900">
                  Guardrail Rejections: Ungrounded Content Blocked ({invalidItems.length})
                </p>
              </div>
              <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 uppercase tracking-wider">
                Enforced by Filter
              </span>
            </div>
            <p className="text-[11px] text-rose-700">
              The items below failed deterministic verbatim quote verification against source clauses and were automatically rejected after repair attempts.
            </p>
            <div className="space-y-2">
              {invalidItems.map((item: any, i: number) => (
                <div key={i} className="rounded border border-rose-200/80 bg-white p-2.5 text-xs space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 truncate">
                      {item.description || item.title || "Synthesized Item"}
                    </span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                      {item.task || "generation"}
                    </span>
                  </div>
                  {item.clause_keys && item.clause_keys.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-slate-500">Cited Clauses:</span>
                      <span className="font-mono text-[10px] text-[#3067DB] bg-blue-50 px-1 rounded">
                        {Array.isArray(item.clause_keys) ? item.clause_keys.join(", ") : String(item.clause_keys)}
                      </span>
                    </div>
                  )}
                  {item.quote && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100">
                      <span className="text-slate-400 font-medium mr-1">Rejected Quote:</span>
                      <span className="italic text-slate-700 line-through">"{typeof item.quote === "string" ? item.quote : JSON.stringify(item.quote)}"</span>
                    </div>
                  )}
                  <p className="text-[11px] text-rose-700 font-medium">
                    {typeof item.error === "string" ? item.error : JSON.stringify(item.error || "Source quote could not be verified against cited clauses.")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Provider & Network Errors */}
      {(() => {
        const resultObj: any = typeof run.result === "string"
          ? (() => { try { return JSON.parse(run.result); } catch { return {}; } })()
          : (run.result || {});
        const providerErrors: any[] = Array.isArray(resultObj?.provider_errors) ? resultObj.provider_errors : [];
        if (providerErrors.length === 0) return null;
        return (
          <div className="rounded border border-amber-200 bg-amber-50/50 p-3">
            <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5 mb-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>AI Provider Diagnostics ({providerErrors.length})</span>
            </p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-800">
              {providerErrors.map((e: any, i: number) => (
                <li key={i}>{typeof e === "string" ? e : JSON.stringify(e)}</li>
              ))}
            </ul>
          </div>
        );
      })()}
    </div>
  );
}
