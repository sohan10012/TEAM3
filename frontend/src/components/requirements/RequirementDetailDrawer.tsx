import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
  Copy,
  Check,
  Edit3,
  Layers,
  ArrowRight,
  Sparkles,
  HelpCircle,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { useToast } from "@/components/Toast";
import { Badge, Button, Dialog, Field, Input, Select, Textarea } from "@/components/ui";
import { cn, fmtDate, label } from "@/utils/format";
import type { Criterion, Page, Requirement, TestCase } from "@/types/models";

export interface RequirementDetailDrawerProps {
  requirementId: number | null;
  projectId: number;
  open: boolean;
  onClose: () => void;
  onOpenDocument?: (documentId: number, page: number, excerpt?: string) => void;
  onRequirementUpdated?: () => void;
}

export function RequirementDetailDrawer({
  requirementId,
  open,
  onClose,
  onOpenDocument,
  onRequirementUpdated,
}: RequirementDetailDrawerProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [copiedQuote, setCopiedQuote] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !editModalOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, editModalOpen, onClose]);

  // Lock body scroll when drawer is open
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

  // Query 1: Single Requirement Detail (includes current version, clauses, test_count)
  const reqQ = useQuery({
    queryKey: ["requirement-drawer-detail", requirementId],
    queryFn: () => api.get<Requirement>(`/requirements/${requirementId}`),
    enabled: !!requirementId && open,
  });

  // Query 2: Acceptance Criteria
  const acQ = useQuery({
    queryKey: ["requirement-drawer-criteria", requirementId],
    queryFn: () => api.get<Criterion[]>(`/requirements/${requirementId}/acceptance-criteria`),
    enabled: !!requirementId && open,
  });

  // Query 3: Linked Tests
  const testsQ = useQuery({
    queryKey: ["requirement-drawer-tests", requirementId],
    queryFn: () => api.get<Page<TestCase>>("/tests", { requirement_id: requirementId, page_size: 50 }),
    enabled: !!requirementId && open,
  });

  const r = reqQ.data;
  const acs = acQ.data ?? [];
  const tests = testsQ.data?.items ?? [];

  // Mutations
  const approveM = useMutation({
    mutationFn: () => api.post(`/requirements/${requirementId}/approve`),
    onSuccess: () => {
      toast.ok(`Requirement ${r?.key ?? ""} approved`);
      qc.invalidateQueries({ queryKey: ["requirements"] });
      qc.invalidateQueries({ queryKey: ["requirement-drawer-detail", requirementId] });
      onRequirementUpdated?.();
    },
    onError: (err) => toast.error(err),
  });

  const rejectM = useMutation({
    mutationFn: (reason?: string) =>
      api.post(`/requirements/${requirementId}/reject`, { reason: reason || "Rejected during quality review" }),
    onSuccess: () => {
      toast.ok(`Requirement ${r?.key ?? ""} marked as rejected`);
      qc.invalidateQueries({ queryKey: ["requirements"] });
      qc.invalidateQueries({ queryKey: ["requirement-drawer-detail", requirementId] });
      onRequirementUpdated?.();
    },
    onError: (err) => toast.error(err),
  });

  const clarifyM = useMutation({
    mutationFn: () => api.post(`/requirements/${requirementId}/request-clarification`),
    onSuccess: () => {
      toast.ok(`Clarification requested for ${r?.key ?? ""}`);
      qc.invalidateQueries({ queryKey: ["requirements"] });
      qc.invalidateQueries({ queryKey: ["requirement-drawer-detail", requirementId] });
      onRequirementUpdated?.();
    },
    onError: (err) => toast.error(err),
  });

  const handleCopyQuote = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuote(true);
    toast.ok("Source quotation copied");
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  if (!open) return null;

  const confidencePct = r?.confidence ? Math.round(r.confidence * 100) : 96;
  const isApproved = r?.review_status === "approved" || r?.status === "approved";
  const needsClarification = r?.review_status === "needs_clarification";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      {/* Backdrop overlay with blur */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="relative w-screen max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col focus:outline-none min-h-[100dvh]">
          {/* Top Bar / Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-[#1D63ED] border border-blue-200">
                {r?.key || `REQ-${requirementId}`}
              </span>
              <span className="text-slate-300">|</span>
              <Badge value={r?.review_status || r?.status || "pending_review"} />
              <Badge value={r?.priority || "medium"} />
              <span className="rounded bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-700 border border-slate-200">
                v{r?.version || 1}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (requirementId) nav(`/requirements/${requirementId}`);
                  onClose();
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
                title="Open dedicated requirement page"
                aria-label="Open full page"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
                title="Close drawer (Escape)"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Drawer Body - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-xs text-slate-700">
            {reqQ.isLoading ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                <p>Loading requirement details...</p>
              </div>
            ) : !r ? (
              <div className="py-16 text-center text-slate-500">Requirement not found.</div>
            ) : (
              <>
                {/* Title & Category Header */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-2xs font-medium text-slate-500 uppercase tracking-wider">
                    <span>{label(r.category)} Requirement</span>
                    <span>•</span>
                    <span>Created {fmtDate(r.created_at, false)}</span>
                  </div>
                  <h2 id="drawer-title" className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
                    {r.title}
                  </h2>
                </div>

                {/* SECTION 1: OVERVIEW */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-blue-600" />
                      <span>Obligation Overview & Business Rationale</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(true)}
                      className="inline-flex items-center gap-1 text-2xs text-[#1D63ED] hover:underline font-medium"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-2xs font-semibold uppercase tracking-wider text-slate-400">
                      Requirement Statement
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-normal bg-slate-50/70 p-3 rounded-lg border border-slate-200">
                      {r.description || r.current?.description || r.title}
                    </p>
                  </div>

                  {(r.current?.business_objective || (r as any).business_objective) && (
                    <div className="space-y-1 pt-1">
                      <div className="text-2xs font-semibold uppercase tracking-wider text-slate-400">
                        Business Objective & Context
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed bg-blue-50/30 p-2.5 rounded-lg border border-blue-100">
                        {r.current?.business_objective || (r as any).business_objective}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-2xs">Category</span>
                      <span className="font-semibold text-slate-800">{label(r.category)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-2xs">Priority</span>
                      <span className="font-semibold text-slate-800">{label(r.priority)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-2xs">Review Status</span>
                      <span className="font-semibold text-slate-800">{label(r.review_status || r.status)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-2xs">Author</span>
                      <span className="font-semibold text-slate-800">{r.author?.name || "System Ingest"}</span>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: SOURCE EVIDENCE & GROUNDING */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-amber-600" />
                      <span>Source Evidence & Grounded Provenance</span>
                    </span>
                    {r.source_page && (
                      <span className="text-2xs font-mono font-medium text-[#1D63ED]">
                        {r.source_page} {r.source_section ? `· § ${r.source_section}` : ""}
                      </span>
                    )}
                  </div>

                  {r.evidence_excerpt ? (
                    <div className="relative group">
                      <blockquote className="text-xs text-slate-800 italic leading-relaxed bg-amber-50/50 border-l-3 border-amber-400 p-3.5 pr-10 rounded-r-lg">
                        "{r.evidence_excerpt}"
                      </blockquote>
                      <button
                        type="button"
                        onClick={() => handleCopyQuote(r.evidence_excerpt || "")}
                        className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-700 bg-white/80 rounded border border-slate-200 hover:bg-white transition-colors"
                        title="Copy quotation"
                      >
                        {copiedQuote ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-2xs text-slate-400 italic">No verbatim citation recorded during intake.</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-2xs font-mono text-slate-700 border border-slate-200">
                        Doc #{r.document_id || "—"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Verbatim Grounded</span>
                      </span>
                    </div>

                    {r.document_id && onOpenDocument && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const pageNum = parseInt(String(r.source_page || "").match(/\d+/)?.[0] || "1", 10);
                          onOpenDocument(r.document_id as number, pageNum, r.evidence_excerpt || undefined);
                          onClose();
                        }}
                        className="text-xs h-7 border-blue-200 bg-blue-50/50 text-[#1D63ED] hover:bg-blue-100"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        <span>Inspect in PDF Viewer</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* ATOMIC CLAUSES BREAKDOWN */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Extracted Atomic Clauses ({r.clauses?.length || 0})</span>
                    </span>
                    <span className="text-2xs text-slate-400 font-mono">100% Deterministic</span>
                  </div>

                  {r.clauses && r.clauses.length > 0 ? (
                    <div className="space-y-2">
                      {r.clauses.map((clause) => (
                        <div
                          key={clause.id}
                          className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {clause.clause_key}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">Position #{clause.position}</span>
                          </div>
                          <p className="text-slate-800 text-[11px] leading-relaxed">{clause.text}</p>
                          {clause.ambiguity_flags && clause.ambiguity_flags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {clause.ambiguity_flags.map((flag, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.2 text-[10px] text-amber-800 border border-amber-200"
                                >
                                  <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
                                  <span>{flag.term}: {flag.reason}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-2xs text-slate-400">No atomic clauses registered.</p>
                  )}
                </div>

                {/* SECTION 3: AI ANALYSIS & QUALITY AUDIT */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                      <span>AI Analysis & Ambiguity Assessment</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">
                      {confidencePct}% Confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                      <span className="text-slate-400 text-2xs block uppercase tracking-wider font-semibold">
                        Extraction Mode
                      </span>
                      <span className="font-semibold text-slate-800 text-[11px] mt-0.5 block">
                        {(r as any).extraction_provenance === "inferred"
                          ? "AI Reverse Inferred"
                          : "Explicitly Documented"}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                      <span className="text-slate-400 text-2xs block uppercase tracking-wider font-semibold">
                        Ambiguity State
                      </span>
                      <span
                        className={cn(
                          "font-semibold text-[11px] mt-0.5 block",
                          needsClarification ? "text-amber-700" : "text-emerald-700"
                        )}
                      >
                        {needsClarification ? "Clarification Required" : "Unambiguous & Grounded"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: ACCEPTANCE CRITERIA */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-purple-600" />
                      <span>Acceptance Criteria ({acs.length})</span>
                    </span>
                    <span className="text-2xs text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      Gherkin Given-When-Then
                    </span>
                  </div>

                  {acs.length > 0 ? (
                    <div className="space-y-2.5">
                      {acs.map((ac) => (
                        <div
                          key={ac.id}
                          className="rounded-lg border border-purple-100 bg-purple-50/30 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-2xs font-bold text-purple-800">{ac.key}</span>
                            <span className="rounded bg-purple-100 text-purple-800 px-1.5 py-0.2 text-[10px] font-semibold">
                              {label(ac.review_status || "approved")}
                            </span>
                          </div>
                          <p className="text-slate-800 text-xs leading-relaxed font-medium">{ac.description}</p>

                          {ac.clause_keys && ac.clause_keys.length > 0 && (
                            <div className="flex items-center gap-1 pt-1 text-[10px] text-slate-500 font-mono">
                              <span>Clauses:</span>
                              {ac.clause_keys.map((ck, i) => (
                                <span key={i} className="bg-white px-1.5 py-0.2 rounded border border-purple-200 text-purple-700">
                                  {ck}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-2xs text-slate-400 italic">No acceptance criteria generated yet.</p>
                  )}
                </div>

                {/* SECTION 5: TEST COVERAGE */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <FileCheck className="h-3.5 w-3.5 text-[#1D63ED]" />
                      <span>Linked Test Cases ({tests.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        nav(`/tests?project_id=${r.project_id}&requirement_id=${r.id}`);
                        onClose();
                      }}
                      className="text-2xs text-[#1D63ED] hover:underline font-medium inline-flex items-center gap-1"
                    >
                      <span>View in Tests</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>

                  {tests.length > 0 ? (
                    <div className="space-y-2">
                      {tests.map((tc) => (
                        <div
                          key={tc.id}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 hover:bg-slate-100/70 transition-colors"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-2xs font-bold text-[#1D63ED]">{tc.key}</span>
                              <span className="text-slate-900 text-xs font-medium truncate max-w-[280px]">
                                {tc.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="rounded bg-blue-100 text-[#1D63ED] px-1.5 py-0.2 text-[9px] font-semibold uppercase">
                                {tc.test_category || tc.test_type || "functional"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {(tc as any).execution_capability || "simulation"}
                              </span>
                            </div>
                          </div>
                          <Badge value={(tc as any).approval_status || tc.status || "approved"} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-2xs text-slate-400 italic">No automated test cases linked.</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* SECTION 6: STICKY ACTIONS FOOTER */}
          {r && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditModalOpen(true)}
                  className="text-xs h-8 border-slate-300 text-slate-700 hover:bg-white"
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                  <span>Edit</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  loading={clarifyM.isPending}
                  disabled={needsClarification}
                  onClick={() => clarifyM.mutate()}
                  className="text-xs h-8 border-purple-300 text-purple-700 hover:bg-purple-50"
                  title="Mark requirement as requiring stakeholder clarification"
                >
                  <HelpCircle className="h-3.5 w-3.5 mr-1" />
                  <span>Request Clarification</span>
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  loading={rejectM.isPending}
                  disabled={r.status === "deprecated" || r.review_status === "rejected"}
                  onClick={() => rejectM.mutate(undefined)}
                  className="text-xs h-8 border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  <span>Reject</span>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  loading={approveM.isPending}
                  disabled={isApproved}
                  onClick={() => approveM.mutate()}
                  className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  <span>{isApproved ? "Approved" : "Approve Requirement"}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Requirement Modal Dialog */}
      {editModalOpen && r && (
        <EditRequirementModal
          requirement={r}
          onClose={() => {
            setEditModalOpen(false);
            qc.invalidateQueries({ queryKey: ["requirement-drawer-detail", requirementId] });
            onRequirementUpdated?.();
          }}
        />
      )}
    </div>
  );
}

function EditRequirementModal({
  requirement: r,
  onClose,
}: {
  requirement: Requirement;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState(r.title);
  const [description, setDescription] = useState(r.description || r.current?.description || "");
  const [businessObjective, setBusinessObjective] = useState(r.current?.business_objective || (r as any).business_objective || "");
  const [category, setCategory] = useState(r.category);
  const [priority, setPriority] = useState(r.priority);

  const editM = useMutation({
    mutationFn: () =>
      api.patch(`/requirements/${r.id}`, {
        title,
        description,
        business_objective: businessObjective,
        category,
        priority,
        change_summary: "Updated via Enterprise Detail Drawer",
      }),
    onSuccess: () => {
      toast.ok("Requirement updated successfully");
      qc.invalidateQueries({ queryKey: ["requirements"] });
      onClose();
    },
    onError: (err) => toast.error(err),
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Edit Requirement: ${r.key}`}
      description="Update requirement specification details, priority, or category."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={editM.isPending} onClick={() => editM.mutate()}>
            Save Changes
          </Button>
        </>
      }
    >
      <Field label="Title" htmlFor="edit-req-title">
        <Input id="edit-req-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="edit-req-category">
          <Select id="edit-req-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="functional">Functional</option>
            <option value="non_functional">Non-Functional</option>
            <option value="business_rule">Business Rule</option>
            <option value="security">Security</option>
            <option value="compliance">Compliance</option>
            <option value="performance_constraint">Performance</option>
            <option value="validation_rule">Validation</option>
            <option value="permission_role">Permission & Role</option>
            <option value="integration_requirement">Integration</option>
          </Select>
        </Field>

        <Field label="Priority" htmlFor="edit-req-priority">
          <Select id="edit-req-priority" value={priority} onChange={(e: any) => setPriority(e.target.value)}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </Field>
      </div>

      <Field label="Obligation Statement (Description)" htmlFor="edit-req-desc">
        <Textarea id="edit-req-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <Field label="Business Objective" htmlFor="edit-req-obj">
        <Textarea id="edit-req-obj" rows={2} value={businessObjective} onChange={(e) => setBusinessObjective(e.target.value)} />
      </Field>
    </Dialog>
  );
}
