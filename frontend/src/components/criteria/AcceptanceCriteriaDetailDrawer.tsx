import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  X,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  FileCheck2,
  Sparkles,
  Link2,
  Layers,
  Copy,
  Check,
  Edit3,
  ExternalLink,
  ChevronRight,
  User,
  Activity,
  AlertTriangle,
  FileText,
  History,
} from "lucide-react";
import { Button, Dialog, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api } from "@/services/api";
import { Criterion } from "@/types/models";
import { cn, fmtDate, label } from "@/utils/format";

export interface AcceptanceCriteriaDetailDrawerProps {
  criterionId: number | null;
  open: boolean;
  onClose: () => void;
  onCriterionUpdated?: () => void;
}

export function AcceptanceCriteriaDetailDrawer({
  criterionId,
  open,
  onClose,
  onCriterionUpdated,
}: AcceptanceCriteriaDetailDrawerProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [copiedGherkin, setCopiedGherkin] = useState(false);
  const [copiedQuote, setCopiedQuote] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [clarifyDialogOpen, setClarifyDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [reviewComment, setReviewComment] = useState("");

  // Edit form state
  const [editForm, setEditForm] = useState({
    description: "",
    preconditions: "",
    expected_behaviour: "",
    actor: "",
    action: "",
    expected_output: "",
    rationale: "",
    source_quote: "",
  });

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !editModalOpen && !clarifyDialogOpen && !rejectDialogOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, editModalOpen, clarifyDialogOpen, rejectDialogOpen, onClose]);

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

  // Fetch complete detail
  const q = useQuery({
    queryKey: ["criterion_detail", criterionId],
    queryFn: () => api.get<Criterion>(`/acceptance-criteria/${criterionId}`),
    enabled: open && criterionId !== null,
  });

  const criterion = q.data;

  // Initialize edit form when criterion loads
  useEffect(() => {
    if (criterion) {
      setEditForm({
        description: criterion.description || "",
        preconditions: criterion.preconditions || "",
        expected_behaviour: criterion.expected_behaviour || "",
        actor: criterion.actor || "",
        action: criterion.action || "",
        expected_output: criterion.expected_output || "",
        rationale: criterion.rationale || "",
        source_quote: criterion.source_quote || "",
      });
    }
  }, [criterion]);

  // Review mutation
  const reviewM = useMutation({
    mutationFn: ({ decision, comment }: { decision: string; comment?: string }) =>
      api.post(`/acceptance-criteria/${criterionId}/review`, { decision, comment: comment || "" }),
    onSuccess: () => {
      toast.ok("Review recorded successfully");
      qc.invalidateQueries({ queryKey: ["criterion_detail", criterionId] });
      qc.invalidateQueries({ queryKey: ["project_criteria"] });
      onCriterionUpdated?.();
      setClarifyDialogOpen(false);
      setRejectDialogOpen(false);
      setReviewComment("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to submit review"),
  });

  // Edit mutation
  const editM = useMutation({
    mutationFn: (body: Partial<Criterion>) =>
      api.patch(`/acceptance-criteria/${criterionId}`, body),
    onSuccess: () => {
      toast.ok("Acceptance criterion updated successfully");
      qc.invalidateQueries({ queryKey: ["criterion_detail", criterionId] });
      qc.invalidateQueries({ queryKey: ["project_criteria"] });
      onCriterionUpdated?.();
      setEditModalOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update criterion"),
  });

  if (!open) return null;

  const gherkinText = criterion
    ? `Scenario: ${criterion.key} - ${criterion.description}
  Given ${criterion.preconditions || "preconditions are met"}
  When ${criterion.actor || "actor"} ${(criterion.action || "performs action").toLowerCase()}
  Then ${criterion.expected_behaviour || "expected behaviour occurs"}
  ${criterion.expected_output ? `And output matches: ${criterion.expected_output}` : ""}`
    : "";

  const handleCopyGherkin = () => {
    navigator.clipboard.writeText(gherkinText);
    setCopiedGherkin(true);
    setTimeout(() => setCopiedGherkin(false), 2000);
  };

  const handleCopyQuote = () => {
    if (criterion?.source_quote) {
      navigator.clipboard.writeText(criterion.source_quote);
      setCopiedQuote(true);
      setTimeout(() => setCopiedQuote(false), 2000);
    }
  };

  const confidencePct = Math.round((criterion?.confidence || 0) * 100);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-2xl transform bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-250">
          {/* Header */}
          <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 border border-blue-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {criterion?.key || `AC #${criterionId}`}
                  </span>
                  {criterion?.review_status && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wider",
                        criterion.review_status === "approved"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : criterion.review_status === "needs_clarification"
                          ? "bg-purple-100 text-purple-800 border border-purple-200"
                          : criterion.review_status === "rejected"
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      )}
                    >
                      {label(criterion.review_status)}
                    </span>
                  )}
                  {criterion?.quote_verified ? (
                    <span className="inline-flex items-center gap-1 rounded bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                      <FileCheck2 className="h-3 w-3 text-teal-600" />
                      Document Grounded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-medium text-indigo-800">
                      <Sparkles className="h-3 w-3 text-indigo-600" />
                      AI Inferred
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enterprise Acceptance Criterion & Quality Contract
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
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit</span>
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring transition-colors"
                title="Close drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {q.isLoading && (
              <div className="py-20 text-center text-sm text-slate-500 space-y-2">
                <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Loading criterion intelligence...</p>
              </div>
            )}

            {criterion && (
              <>
                {/* 1. Executive Summary & Status Overview */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                    1. Executive Summary & Status Overview
                  </h3>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                    <p className="text-sm font-medium text-slate-900 leading-relaxed">
                      {criterion.description}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-500 block">Parent Requirement</span>
                        {criterion.requirement ? (
                          <Link
                            to={`/requirements?search=${encodeURIComponent(criterion.requirement.key)}`}
                            className="font-mono font-semibold text-blue-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            <span>{criterion.requirement.key}</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="font-mono font-semibold text-slate-800">
                            {criterion.requirement_key || "REQ-Linked"}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-500 block">Model Confidence</span>
                        <span className="font-bold text-slate-900 mt-0.5 inline-block">
                          {confidencePct}%
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 block">AI Provenance</span>
                        <span className="font-medium text-slate-800 mt-0.5 block truncate" title={criterion.provider}>
                          {criterion.provider} {criterion.model ? `(${criterion.model})` : ""}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 block">Created At</span>
                        <span className="text-slate-600 mt-0.5 block">
                          {criterion.created_at ? fmtDate(criterion.created_at) : "Persisted"}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 2. Business Context & Actor Model */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-amber-600" />
                    2. Business Context & Actor Model
                  </h3>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg bg-amber-50/40 border border-amber-200/80 p-3">
                        <span className="font-semibold text-amber-900 block mb-1">Actor Identity</span>
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <User className="h-3.5 w-3.5 text-amber-700" />
                          <span>{criterion.actor || "Authenticated System Actor"}</span>
                        </div>
                      </div>

                      <div className="rounded-lg bg-blue-50/40 border border-blue-200/80 p-3">
                        <span className="font-semibold text-blue-900 block mb-1">Business Action</span>
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Activity className="h-3.5 w-3.5 text-blue-700" />
                          <span>{criterion.action || criterion.description}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <span className="font-semibold text-slate-700 block">Preconditions & Environment Context:</span>
                      <p className="rounded-lg bg-slate-50 p-2.5 text-slate-700 border border-slate-100 leading-relaxed">
                        {criterion.preconditions || "Standard system execution state with authenticated credentials."}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <span className="font-semibold text-slate-700 block">Expected System Behavior:</span>
                      <p className="rounded-lg bg-slate-50 p-2.5 text-slate-700 border border-slate-100 leading-relaxed">
                        {criterion.expected_behaviour}
                      </p>
                    </div>
                  </div>
                </section>

                {/* 3. Given-When-Then Specification (BDD) */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-emerald-600" />
                      3. Given - When - Then Specification (BDD)
                    </h3>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleCopyGherkin}
                      className="h-7 text-xs bg-white text-slate-700 border-slate-200 shadow-2xs"
                    >
                      {copiedGherkin ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-slate-500" />
                          <span>Copy Gherkin</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 text-xs font-mono">
                    <div className="p-3 rounded-lg bg-slate-900 text-slate-100 space-y-2 text-[11px] leading-relaxed">
                      <p className="text-purple-300">
                        <span className="font-bold text-amber-400">Scenario: </span>
                        {criterion.key} — {criterion.description}
                      </p>
                      <p className="text-blue-300">
                        <span className="font-bold text-blue-400">Given </span>
                        {criterion.preconditions || "preconditions are fulfilled"}
                      </p>
                      <p className="text-amber-200">
                        <span className="font-bold text-amber-400">When </span>
                        {criterion.actor || "actor"} {(criterion.action || "performs operation").toLowerCase()}
                      </p>
                      <p className="text-emerald-300">
                        <span className="font-bold text-emerald-400">Then </span>
                        {criterion.expected_behaviour}
                      </p>
                      {criterion.expected_output && (
                        <p className="text-emerald-200 pl-4 border-l border-emerald-700">
                          <span className="font-bold text-emerald-400">And </span>
                          verified output: {criterion.expected_output}
                        </p>
                      )}
                    </div>

                    {/* Validation conditions list */}
                    {Array.isArray(criterion.validation_conditions) && criterion.validation_conditions.length > 0 && (
                      <div className="font-sans pt-2">
                        <span className="font-semibold text-slate-700 block mb-1.5">Verification Criteria:</span>
                        <ul className="space-y-1 pl-4 list-disc text-xs text-slate-600">
                          {criterion.validation_conditions.map((vc, idx) => (
                            <li key={idx}>{vc}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>

                {/* 4. Source Evidence & Quotations */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <FileCheck2 className="h-3.5 w-3.5 text-teal-600" />
                      4. Source Evidence & Quotations
                    </h3>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleCopyQuote}
                      className="h-7 text-xs bg-white text-slate-700 border-slate-200 shadow-2xs"
                    >
                      {copiedQuote ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-slate-500" />
                          <span>Copy Quote</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Verbatim Quotation:</span>
                      {criterion.quote_verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Substring Matched in Cited Clause
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          Inferred Quotation
                        </span>
                      )}
                    </div>

                    <blockquote className="rounded-lg border-l-4 border-teal-500 bg-teal-50/30 p-3 italic text-slate-800 leading-relaxed font-normal">
                      "{criterion.source_quote || criterion.description}"
                    </blockquote>

                    {/* Cited Clause accordion */}
                    {Array.isArray(criterion.clauses) && criterion.clauses.length > 0 && (
                      <div className="pt-2 space-y-2">
                        <span className="font-semibold text-slate-700 block">Cited Clauses & Excerpts:</span>
                        {criterion.clauses.map((c) => (
                          <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                            <div className="flex items-center justify-between font-mono text-xs">
                              <span className="font-bold text-slate-900">{c.key}</span>
                              {c.source_paths && (
                                <span className="text-slate-500 text-[11px] truncate max-w-[200px]" title={c.source_paths}>
                                  {c.source_paths} {c.line_start ? `(L${c.line_start}-L${c.line_end})` : ""}
                                </span>
                              )}
                            </div>
                            <p className="text-slate-700 text-xs leading-relaxed font-sans">
                              {c.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* 5. AI Intelligence, Rationale & Confidence */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                    5. AI Intelligence, Rationale & Confidence
                  </h3>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 text-xs">
                    <div>
                      <span className="font-semibold text-slate-700 block mb-1">Generation Rationale:</span>
                      <p className="text-slate-700 bg-purple-50/30 border border-purple-100 rounded-lg p-3 leading-relaxed">
                        {criterion.rationale || "Derived to establish clear automated test boundary and specification conformance."}
                      </p>
                    </div>

                    {/* Business rules & assumptions */}
                    {Array.isArray(criterion.business_rules) && criterion.business_rules.length > 0 && (
                      <div>
                        <span className="font-semibold text-slate-700 block mb-1">Business Rules Enforced:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {criterion.business_rules.map((rule, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-800 border border-slate-200"
                            >
                              {String(rule)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(criterion.assumptions) && criterion.assumptions.length > 0 && (
                      <div>
                        <span className="font-semibold text-slate-700 block mb-1">Model Assumptions:</span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600">
                          {criterion.assumptions.map((assump, idx) => (
                            <li key={idx}>{assump}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>

                {/* 6. Requirement & Clause Relationships */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-sky-600" />
                    6. Requirement & Clause Relationships
                  </h3>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 text-xs">
                    {criterion.requirement ? (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-sky-50/50 border border-sky-200/80">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sky-900">{criterion.requirement.key}</span>
                            <span className="text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 bg-sky-100 text-sky-800">
                              {criterion.requirement.category}
                            </span>
                            <span className="text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 bg-slate-100 text-slate-700">
                              {criterion.requirement.priority}
                            </span>
                          </div>
                          <p className="text-slate-800 font-medium text-xs mt-1">
                            {criterion.requirement.title}
                          </p>
                        </div>
                        <Link
                          to={`/requirements?search=${encodeURIComponent(criterion.requirement.key)}`}
                          className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1"
                        >
                          <span>View Req</span>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    ) : (
                      <p className="text-slate-500">No parent requirement metadata available.</p>
                    )}
                  </div>
                </section>

                {/* 7. Test Coverage & Traceability */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-indigo-600" />
                      7. Test Coverage & Traceability
                    </h3>
                    <span className="text-xs font-semibold text-slate-600">
                      {criterion.linked_test_cases?.length || 0} Test Case{(criterion.linked_test_cases?.length || 0) !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 text-xs">
                    {Array.isArray(criterion.linked_test_cases) && criterion.linked_test_cases.length > 0 ? (
                      <div className="space-y-2">
                        {criterion.linked_test_cases.map((tc) => (
                          <div
                            key={tc.id}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-indigo-700">{tc.key}</span>
                              <span className="text-slate-900 font-medium text-xs">{tc.title}</span>
                              <span className="text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 bg-slate-200/70 text-slate-700">
                                {tc.test_type}
                              </span>
                            </div>
                            <Link
                              to={`/tests/${tc.id}`}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                            >
                              <span>Inspect</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50/40 p-4 text-center space-y-1.5">
                        <p className="text-xs font-semibold text-rose-800">
                          Criterion is currently uncovered
                        </p>
                        <p className="text-[11px] text-rose-600">
                          No automated test specifications currently trace to this acceptance criterion.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* 8. Human Review History & Interactive Actions */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-slate-600" />
                    8. Human Review History & Audit Trail
                  </h3>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 text-xs">
                    {Array.isArray(criterion.reviews) && criterion.reviews.length > 0 ? (
                      <div className="space-y-2">
                        {criterion.reviews.map((rev) => (
                          <div
                            key={rev.id}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                    rev.decision === "approve"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : rev.decision === "request_clarification"
                                      ? "bg-purple-100 text-purple-800"
                                      : rev.decision === "reject"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-amber-100 text-amber-800"
                                  )}
                                >
                                  {label(rev.decision)}
                                </span>
                                <span className="font-semibold text-slate-800">{rev.reviewer_name}</span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                {rev.created_at ? fmtDate(rev.created_at) : "Recent"}
                              </span>
                            </div>
                            {rev.comment && (
                              <p className="text-slate-600 text-xs italic">
                                "{rev.comment}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-xs">No formal human reviews recorded yet.</p>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>

          {/* Drawer Actions Footer */}
          {criterion && (
            <div className="border-t border-slate-200 bg-slate-50/90 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Status:</span>
                <span className="font-bold text-slate-800 uppercase tracking-wider">
                  {criterion.review_status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setClarifyDialogOpen(true)}
                  className="h-9 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Request Clarification</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectDialogOpen(true)}
                  className="h-9 text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                >
                  <span>Reject</span>
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => reviewM.mutate({ decision: "approve", comment: "Approved via Acceptance Criteria Drawer" })}
                  disabled={criterion.review_status === "approved" || reviewM.isPending}
                  className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs font-semibold"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{criterion.review_status === "approved" ? "Approved" : "Approve Criterion"}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Criterion Modal */}
      {editModalOpen && (
        <Dialog
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          title={`Edit Criterion: ${criterion?.key}`}
          wide
        >
          <div className="space-y-4 text-xs">
            <Field label="Description / Primary Requirement Statement">
              <Textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Actor">
                <Input
                  value={editForm.actor}
                  onChange={(e) => setEditForm({ ...editForm, actor: e.target.value })}
                />
              </Field>
              <Field label="Action">
                <Input
                  value={editForm.action}
                  onChange={(e) => setEditForm({ ...editForm, action: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Preconditions (GIVEN)">
              <Textarea
                rows={2}
                value={editForm.preconditions}
                onChange={(e) => setEditForm({ ...editForm, preconditions: e.target.value })}
              />
            </Field>

            <Field label="Expected Behavior (THEN)">
              <Textarea
                rows={2}
                value={editForm.expected_behaviour}
                onChange={(e) => setEditForm({ ...editForm, expected_behaviour: e.target.value })}
              />
            </Field>

            <Field label="Expected Output / State Change">
              <Input
                value={editForm.expected_output}
                onChange={(e) => setEditForm({ ...editForm, expected_output: e.target.value })}
              />
            </Field>

            <Field label="AI Rationale / Reasoning">
              <Textarea
                rows={2}
                value={editForm.rationale}
                onChange={(e) => setEditForm({ ...editForm, rationale: e.target.value })}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button size="sm" variant="secondary" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={editM.isPending}
                onClick={() => editM.mutate(editForm)}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Clarification Dialog */}
      {clarifyDialogOpen && (
        <Dialog
          open={clarifyDialogOpen}
          onOpenChange={setClarifyDialogOpen}
          title="Request Clarification for Criterion"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Provide details on what requirement ambiguity or specification question requires clarification before this criterion can be approved.
            </p>
            <Field label="Clarification Inquiry / Question">
              <Textarea
                rows={3}
                placeholder="e.g. Please clarify if the 40-hour overtime limit applies to statutory contractors."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setClarifyDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!reviewComment.trim() || reviewM.isPending}
                loading={reviewM.isPending}
                onClick={() => reviewM.mutate({ decision: "request_clarification", comment: reviewComment })}
              >
                Submit Inquiry
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Reject Dialog */}
      {rejectDialogOpen && (
        <Dialog
          open={rejectDialogOpen}
          onOpenChange={setRejectDialogOpen}
          title="Reject Acceptance Criterion"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Specify the rationale for rejecting this criterion (e.g. hallucinated requirement, duplicate specification, or superseded logic).
            </p>
            <Field label="Rejection Rationale">
              <Textarea
                rows={3}
                placeholder="e.g. This criterion contradicts section 4.2 of the enterprise contract."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!reviewComment.trim() || reviewM.isPending}
                loading={reviewM.isPending}
                onClick={() => reviewM.mutate({ decision: "reject", comment: reviewComment })}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
