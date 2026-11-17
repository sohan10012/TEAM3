import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  X,
  CheckCircle2,
  XCircle,
  Play,
  Sparkles,
  Link2,
  Layers,
  Copy,
  Check,
  Edit3,
  ExternalLink,
  Activity,
  FileText,
  History,
  Code2,
  Bug,
  ListOrdered,
  Database,
  Cpu,
} from "lucide-react";
import { Badge, Button, Dialog, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api } from "@/services/api";
import { cn, fmtDate } from "@/utils/format";

export interface TestCaseDetailDrawerProps {
  testId: number | null;
  open: boolean;
  onClose: () => void;
  onTestUpdated?: () => void;
}

export function TestCaseDetailDrawer({
  testId,
  open,
  onClose,
  onTestUpdated,
}: TestCaseDetailDrawerProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [copiedKey, setCopiedKey] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<"approve" | "reject" | "request_changes">("approve");
  const [reviewComment, setReviewComment] = useState("");

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    preconditions: "",
    expected_result: "",
    priority: "medium",
    test_category: "positive",
    automation: "pytest",
  });

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !editModalOpen && !reviewDialogOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, editModalOpen, reviewDialogOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Fetch full detail
  const q = useQuery({
    queryKey: ["test_detail", testId],
    queryFn: () => api.get<any>(`/tests/${testId}`),
    enabled: open && !!testId,
  });

  const tc = q.data;

  // Initialize edit form when data loads
  useEffect(() => {
    if (tc) {
      setEditForm({
        title: tc.title || "",
        description: tc.description || "",
        preconditions: tc.preconditions || "",
        expected_result: tc.expected_result || "",
        priority: tc.priority || "medium",
        test_category: tc.test_category || "positive",
        automation: tc.automation || "pytest",
      });
    }
  }, [tc]);

  // Execute test mutation
  const execM = useMutation({
    mutationFn: async () => {
      return api.post<any>(`/tests/${testId}/execute`);
    },
    onSuccess: (res) => {
      toast.ok(`Execution complete: Status ${res.status.toUpperCase()} (${res.duration_ms}ms)`);
      qc.invalidateQueries({ queryKey: ["test_detail", testId] });
      qc.invalidateQueries({ queryKey: ["tests"] });
      onTestUpdated?.();
    },
    onError: toast.error,
  });

  // Review mutation
  const reviewM = useMutation({
    mutationFn: async () => {
      return api.post(`/tests/${testId}/review`, {
        decision: reviewDecision,
        comment: reviewComment || `Review ${reviewDecision} from test drawer`,
      });
    },
    onSuccess: () => {
      toast.ok(`Test case marked as ${reviewDecision}`);
      setReviewDialogOpen(false);
      setReviewComment("");
      qc.invalidateQueries({ queryKey: ["test_detail", testId] });
      qc.invalidateQueries({ queryKey: ["tests"] });
      onTestUpdated?.();
    },
    onError: toast.error,
  });

  // Edit mutation
  const editM = useMutation({
    mutationFn: async () => {
      return api.patch(`/tests/${testId}`, editForm);
    },
    onSuccess: () => {
      toast.ok("Test specification updated successfully");
      setEditModalOpen(false);
      qc.invalidateQueries({ queryKey: ["test_detail", testId] });
      qc.invalidateQueries({ queryKey: ["tests"] });
      onTestUpdated?.();
    },
    onError: toast.error,
  });

  const copyKey = () => {
    if (tc?.key) {
      navigator.clipboard.writeText(tc.key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (!open) return null;

  const latestResult = tc?.latest_result || (tc?.recent_results && tc.recent_results[0]);
  const execStatus = latestResult?.status || "not_executed";
  const steps = (tc?.steps_json || tc?.steps || []) as Array<{ step?: number; position?: number; action: string; expected?: string }>;
  const defects = (tc?.defects || []) as Array<any>;
  const criteria = (tc?.acceptance_criteria || []) as Array<any>;
  const clauses = (tc?.clauses || []) as Array<any>;
  const results = (tc?.recent_results || []) as Array<any>;
  const reviews = (tc?.reviews || []) as Array<any>;
  const audits = (tc?.audit_logs || []) as Array<any>;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-3xl transform transition ease-in-out duration-300 sm:duration-400 bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
                <Code2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-slate-900">
                    {tc?.key || "Loading..."}
                  </span>
                  <button
                    type="button"
                    onClick={copyKey}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    title="Copy test case ID"
                  >
                    {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  {tc?.status && (
                    <Badge value={tc.status} />
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enterprise Test Case Specification & Execution Intelligence
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEditModalOpen(true)}
                className="h-8 text-xs bg-white text-slate-700 border-slate-200 shadow-2xs"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1" />
                <span>Edit</span>
              </Button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
                title="Close drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body (Scrollable 12 sections) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
            {q.isLoading && (
              <div className="space-y-4 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-3/4" />
                <div className="h-24 bg-slate-100 rounded" />
                <div className="h-32 bg-slate-100 rounded" />
              </div>
            )}

            {tc && (
              <>
                {/* 1. EXECUTIVE OVERVIEW */}
                <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-slate-400" />
                      <span>Section 1: Executive Overview</span>
                    </span>
                    <span className="text-3xs font-mono text-slate-400">
                      Created: {fmtDate(tc.created_at)}
                    </span>
                  </div>

                  <h2 className="text-base font-semibold text-slate-900 leading-snug">
                    {tc.title}
                  </h2>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
                      <span className="text-3xs text-slate-500 uppercase font-semibold">Category</span>
                      <p className="font-semibold text-slate-800 capitalize">{tc.test_category?.replace("_", " ")}</p>
                    </div>

                    <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
                      <span className="text-3xs text-slate-500 uppercase font-semibold">Priority</span>
                      <p className="font-semibold text-slate-800 uppercase">{tc.priority}</p>
                    </div>

                    <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
                      <span className="text-3xs text-slate-500 uppercase font-semibold">Automation</span>
                      <p className="font-semibold text-slate-800 font-mono capitalize">{tc.automation}</p>
                    </div>

                    <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-0.5">
                      <span className="text-3xs text-slate-500 uppercase font-semibold">Execution Status</span>
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          execStatus === "passed" && "bg-emerald-500",
                          execStatus === "failed" && "bg-rose-500",
                          execStatus === "blocked" && "bg-amber-500",
                          execStatus === "not_executed" && "bg-slate-400"
                        )} />
                        <span className="font-semibold text-slate-800 capitalize">{execStatus.replace("_", " ")}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 2. BUSINESS CONTEXT */}
                <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-xs">
                  <span className="text-2xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Section 2: Business Context & Objective</span>
                  </span>

                  {tc.requirement ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-900">
                          {tc.requirement.key}: {tc.requirement.title}
                        </span>
                        <Link
                          to={`/requirements?id=${tc.requirement.id}`}
                          className="inline-flex items-center gap-1 text-3xs font-semibold text-blue-700 hover:text-blue-900"
                        >
                          <span>Open Req</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {tc.description || tc.requirement.evidence_excerpt || "Validated against enterprise specification requirements."}
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-600">
                      {tc.description || "Validated against enterprise specification requirements."}
                    </p>
                  )}
                </section>

                {/* 3. TEST PRECONDITIONS & ENVIRONMENT */}
                <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-xs">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" />
                    <span>Section 3: Preconditions & Execution Capability</span>
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 space-y-1">
                      <span className="text-3xs uppercase font-semibold text-slate-500">Prerequisites</span>
                      <p className="text-slate-800 leading-relaxed">
                        {tc.preconditions || "System initialized in target environment; user permissions configured."}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 space-y-1">
                      <span className="text-3xs uppercase font-semibold text-slate-500">Execution Capability</span>
                      <p className="text-slate-800 font-mono font-medium capitalize">
                        {tc.execution_capability?.replace("_", " ") || "Specification Validation"}
                      </p>
                      <p className="text-3xs text-slate-500">
                        {tc.execution_capability === "simulation"
                          ? "Deterministic model-driven behaviour simulation"
                          : "Deterministic contract & specification structure validation"}
                      </p>
                    </div>
                  </div>
                </section>

                {/* 4. TEST DATA & INPUT PARAMETERS */}
                <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5" />
                      <span>Section 4: Test Data & Input Parameters</span>
                    </span>
                    <span className="text-3xs font-mono text-slate-400">Payload Schema</span>
                  </div>

                  {tc.test_data && Object.keys(tc.test_data).length > 0 ? (
                    <pre className="text-2xs font-mono bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-48 border border-slate-800">
                      {JSON.stringify(tc.test_data, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-slate-500 italic p-2 bg-slate-50 rounded border border-slate-200">
                      No custom input parameters defined. Default nominal fixture data utilized during execution.
                    </p>
                  )}
                </section>

                {/* 5. EXECUTION STEPS TABLE */}
                <section className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <div className="bg-slate-100/70 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <ListOrdered className="h-3.5 w-3.5 text-slate-500" />
                      <span>Section 5: Execution Steps Sequence ({steps.length})</span>
                    </span>
                    <span className="text-3xs font-mono text-slate-500">Step Actions & Expectations</span>
                  </div>

                  {steps.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {steps.map((s, idx) => (
                        <div key={idx} className="p-3.5 hover:bg-slate-50/50 flex gap-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-2xs font-mono font-bold text-slate-700">
                            {s.step || s.position || idx + 1}
                          </span>
                          <div className="space-y-1 flex-1">
                            <p className="font-semibold text-slate-900">{s.action}</p>
                            {s.expected && (
                              <p className="text-slate-600 flex items-start gap-1">
                                <span className="text-emerald-600 font-bold shrink-0">↳ Expected:</span>
                                <span>{s.expected}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-slate-500">
                      No sequential steps specified in metadata.
                    </div>
                  )}
                </section>

                {/* 6. VERIFIABLE EXPECTED RESULTS */}
                <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2 shadow-xs">
                  <span className="text-2xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Section 6: Verifiable Expected Results</span>
                  </span>
                  <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                    {tc.expected_result || "System transaction completes successfully conforming to API specification schema."}
                  </p>
                </section>

                {/* 7. REQUIREMENT & CLAUSE TRACEABILITY */}
                <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-xs">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    <span>Section 7: Requirement & Clause Traceability</span>
                  </span>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-3xs font-semibold uppercase text-slate-500 w-24">Parent Req:</span>
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {tc.requirement_key || `REQ-${tc.requirement_id}`}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="text-3xs font-semibold uppercase text-slate-500 w-24 pt-0.5">Atomic Clauses:</span>
                      <div className="flex flex-wrap gap-1">
                        {clauses.length > 0 ? (
                          clauses.map((c) => (
                            <span
                              key={c.id || c.clause_key}
                              className="font-mono text-2xs bg-slate-50 px-2 py-0.5 rounded border border-slate-300 text-slate-800"
                              title={c.text}
                            >
                              {c.clause_key}
                            </span>
                          ))
                        ) : (
                          (tc.clause_keys || []).map((k: string) => (
                            <span key={k} className="font-mono text-2xs bg-slate-50 px-2 py-0.5 rounded border border-slate-300 text-slate-800">
                              {k}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 8. ACCEPTANCE CRITERIA COVERAGE */}
                <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Section 8: Acceptance Criteria Coverage</span>
                    </span>
                    <span className="text-3xs font-mono text-purple-800">
                      {criteria.length || tc.ac_keys?.length || 0} Criteria Linked
                    </span>
                  </div>

                  {criteria.length > 0 ? (
                    <div className="space-y-2">
                      {criteria.map((ac) => (
                        <div key={ac.id || ac.key} className="rounded-lg border border-purple-200 bg-purple-50/30 p-2.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-purple-900 text-2xs">{ac.key}</span>
                            <Badge value={ac.review_status || "approved"} />
                          </div>
                          <p className="text-slate-700 text-3xs leading-relaxed">{ac.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(tc.ac_keys || []).map((ack: string) => (
                        <span key={ack} className="font-mono text-2xs bg-purple-50 text-purple-800 px-2 py-1 rounded border border-purple-200 font-semibold">
                          ✓ {ack}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                {/* 9. AI GENERATION INTELLIGENCE */}
                <section className="rounded-xl border border-purple-200 bg-purple-50/20 p-4 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      <span>Section 9: AI Generation Intelligence & Grounding</span>
                    </span>
                    <span className="text-2xs font-mono font-bold text-purple-800">
                      Confidence: {Math.round((tc.confidence || 0.9) * 100)}%
                    </span>
                  </div>

                  <p className="text-slate-800 leading-relaxed">
                    {tc.rationale || `Deterministically derived for ${tc.test_category} testing across requirement clauses.`}
                  </p>

                  <div className="flex flex-wrap gap-2 text-3xs pt-1">
                    <span className="rounded bg-white px-2 py-0.5 border border-purple-200 text-purple-900 font-mono">
                      Provider: {tc.provider || "rule_engine"}
                    </span>
                    <span className="rounded bg-white px-2 py-0.5 border border-purple-200 text-purple-900 font-mono">
                      Model: {tc.model || "deterministic-generator"}
                    </span>
                    <span className="rounded bg-white px-2 py-0.5 border border-purple-200 text-purple-900 font-mono">
                      Provenance: {tc.generation_provenance || "ai_generated"}
                    </span>
                    <span className={cn(
                      "rounded px-2 py-0.5 font-semibold border",
                      tc.validation_status === "valid" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
                    )}>
                      Structure Validation: {tc.validation_status || "valid"}
                    </span>
                  </div>

                  {tc.source_quote && (
                    <div className="mt-2 pt-2 border-t border-purple-100">
                      <span className="text-3xs uppercase font-semibold text-purple-800">Grounding Quote</span>
                      <p className="text-2xs italic text-slate-700 mt-0.5 border-l-2 border-purple-400 pl-2">
                        "{tc.source_quote}"
                      </p>
                    </div>
                  )}
                </section>

                {/* 10. EXECUTION HISTORY */}
                <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" />
                      <span>Section 10: Execution History ({results.length})</span>
                    </span>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => execM.mutate()}
                      loading={execM.isPending}
                      className="h-7 text-3xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      <span>Execute Now</span>
                    </Button>
                  </div>

                  {results.length > 0 ? (
                    <div className="space-y-2">
                      {results.map((res) => (
                        <div
                          key={res.id}
                          className={cn(
                            "rounded-lg border p-3 space-y-1.5",
                            res.status === "passed" && "border-emerald-200 bg-emerald-50/20",
                            res.status === "failed" && "border-rose-200 bg-rose-50/20",
                            res.status !== "passed" && res.status !== "failed" && "border-slate-200 bg-slate-50/50"
                          )}
                        >
                          <div className="flex items-center justify-between text-2xs">
                            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {res.status === "passed" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-rose-600" />
                              )}
                              <span className="capitalize">{res.status}</span>
                            </span>
                            <span className="text-slate-500 font-mono text-3xs">
                              {res.duration_ms}ms · {fmtDate(res.started_at || res.finished_at)}
                            </span>
                          </div>
                          {res.message && (
                            <p className="text-slate-700 text-3xs font-medium">{res.message}</p>
                          )}
                          {res.stdout && (
                            <pre className="text-3xs font-mono bg-slate-900 text-slate-100 p-2 rounded max-h-24 overflow-x-auto">
                              {res.stdout}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-lg">
                      No executions recorded yet. Click 'Execute Now' above to run this test case.
                    </div>
                  )}
                </section>

                {/* 11. DEFECTS & EVIDENCE */}
                <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                      <Bug className="h-3.5 w-3.5" />
                      <span>Section 11: Linked Defects & Failure Evidence</span>
                    </span>
                    <span className="text-3xs font-mono text-slate-500">{defects.length} Defect(s)</span>
                  </div>

                  {defects.length > 0 ? (
                    <div className="space-y-2">
                      {defects.map((def) => (
                        <div key={def.id || def.key} className="rounded-lg border border-rose-200 bg-rose-50/30 p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-rose-900">{def.key}</span>
                            <Badge value={def.severity || "high"} />
                          </div>
                          <p className="font-medium text-slate-900">{def.title}</p>
                          {def.error_log && (
                            <pre className="text-3xs font-mono bg-slate-900 text-rose-200 p-2 rounded mt-1 overflow-x-auto">
                              {def.error_log}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic p-2 bg-slate-50 rounded border border-slate-200">
                      ✓ No defects or failure tickets currently linked to this test case.
                    </p>
                  )}
                </section>

                {/* 12. REVIEW & AUDIT HISTORY */}
                <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-xs">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    <span>Section 12: Review Decisions & Audit Trail</span>
                  </span>

                  {reviews.length > 0 ? (
                    <div className="space-y-2">
                      {reviews.map((r, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900 capitalize">
                              Decision: {r.decision}
                            </span>
                            <span className="text-3xs text-slate-500 font-mono">{fmtDate(r.at)}</span>
                          </div>
                          {r.comment && <p className="text-slate-700 text-3xs">{r.comment}</p>}
                          {r.reviewer && (
                            <p className="text-3xs text-slate-500">Reviewer: {r.reviewer.name || r.reviewer.email}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic p-2 bg-slate-50 rounded border border-slate-200">
                      No formal review decisions recorded yet.
                    </p>
                  )}

                  {audits.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <span className="text-3xs uppercase font-semibold text-slate-400">Audit Log Records ({audits.length})</span>
                      <div className="space-y-1">
                        {audits.map((a) => (
                          <div key={a.id} className="flex items-center justify-between text-3xs text-slate-600 bg-slate-50/70 p-1.5 rounded border border-slate-200">
                            <span className="font-mono font-medium">{a.action}</span>
                            <span className="text-slate-400">{fmtDate(a.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          {/* Sticky Actions Footer */}
          <div className="border-t border-slate-200 p-4 bg-slate-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReviewDecision("request_changes");
                  setReviewDialogOpen(true);
                }}
                className="text-xs border-amber-300 text-amber-800 hover:bg-amber-50"
              >
                <span>Request Changes</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReviewDecision("reject");
                  setReviewDialogOpen(true);
                }}
                className="text-xs border-rose-300 text-rose-800 hover:bg-rose-50"
              >
                <span>Reject</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setReviewDecision("approve");
                  setReviewDialogOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                <span>Approve Specification</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Dialog */}
      {reviewDialogOpen && (
        <Dialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          title={`Confirm Review: ${reviewDecision.replace("_", " ").toUpperCase()}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Submit your formal QA review decision for test specification <strong className="font-mono">{tc?.key}</strong>.
            </p>
            <Field label="Review Comments & Audit Note">
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Enter feedback, test conditions verified, or reason for changes..."
                rows={3}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setReviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => reviewM.mutate()}
                loading={reviewM.isPending}
                className={reviewDecision === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
              >
                Confirm Decision
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Edit Dialog */}
      {editModalOpen && (
        <Dialog
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          title={`Edit Test Specification: ${tc?.key}`}
        >
          <div className="space-y-3 text-xs max-h-[70vh] overflow-y-auto pr-1">
            <Field label="Title">
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </Field>

            <Field label="Description">
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </Field>

            <Field label="Preconditions">
              <Textarea
                value={editForm.preconditions}
                onChange={(e) => setEditForm((prev) => ({ ...prev, preconditions: e.target.value }))}
                rows={2}
              />
            </Field>

            <Field label="Expected Result">
              <Textarea
                value={editForm.expected_result}
                onChange={(e) => setEditForm((prev) => ({ ...prev, expected_result: e.target.value }))}
                rows={2}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority">
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, priority: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-2xs"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </Field>

              <Field label="Automation">
                <select
                  value={editForm.automation}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, automation: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-2xs"
                >
                  <option value="pytest">pytest</option>
                  <option value="playwright">playwright</option>
                  <option value="manual">manual</option>
                </select>
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => editM.mutate()}
                loading={editM.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
