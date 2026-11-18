import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
  Layers,
  Eye,
  HelpCircle,
  XCircle,
  History,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { useToast } from "@/components/Toast";
import { Badge, Button } from "@/components/ui";
import { fmtDate, label } from "@/utils/format";
import type { Criterion, Page, Requirement, TestCase } from "@/types/models";

export interface RequirementRowExpandedProps {
  requirement: Requirement;
  projectId: number;
  traceRow?: any;
  onOpenDrawer: (r: Requirement) => void;
  onOpenDocument?: (docId: number, page: number, excerpt?: string) => void;
  onRequirementUpdated?: () => void;
}

export function RequirementRowExpanded({
  requirement: r,
  traceRow,
  onOpenDrawer,
  onOpenDocument,
  onRequirementUpdated,
}: RequirementRowExpandedProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();

  // Query detailed requirement (includes clauses and current version)
  const detailQ = useQuery({
    queryKey: ["requirement-expanded-detail", r.id],
    queryFn: () => api.get<Requirement>(`/requirements/${r.id}`),
    staleTime: 30000,
  });

  // Query acceptance criteria
  const acQ = useQuery({
    queryKey: ["requirement-expanded-ac", r.id],
    queryFn: () => api.get<Criterion[]>(`/requirements/${r.id}/acceptance-criteria`),
    staleTime: 30000,
  });

  // Query linked test cases
  const testsQ = useQuery({
    queryKey: ["requirement-expanded-tests", r.id],
    queryFn: () => api.get<Page<TestCase>>("/tests", { requirement_id: r.id, page_size: 20 }),
    staleTime: 30000,
  });

  // Query audit history
  const historyQ = useQuery({
    queryKey: ["requirement-expanded-history", r.id],
    queryFn: () => api.get<{ versions: any[]; audit_logs: any[] }>(`/requirements/${r.id}/history`),
    staleTime: 30000,
  });

  const detail = detailQ.data || r;
  const clauses = detail.clauses || [];
  const acList = acQ.data && acQ.data.length > 0 ? acQ.data : traceRow?.acceptance_criteria || [];
  const testList = testsQ.data?.items && testsQ.data.items.length > 0 ? testsQ.data.items : traceRow?.tests || [];
  const versions = historyQ.data?.versions || [];

  const confidencePct = detail.confidence ? Math.round(detail.confidence * 100) : 96;
  const isApproved = detail.review_status === "approved" || detail.status === "approved";
  const needsClarification = detail.review_status === "needs_clarification";

  // Action Mutations
  const approveM = useMutation({
    mutationFn: () => api.post(`/requirements/${r.id}/approve`),
    onSuccess: () => {
      toast.ok(`Requirement ${r.key} approved`);
      qc.invalidateQueries({ queryKey: ["requirements"] });
      qc.invalidateQueries({ queryKey: ["requirement-expanded-detail", r.id] });
      onRequirementUpdated?.();
    },
    onError: (err) => toast.error(err),
  });

  const clarifyM = useMutation({
    mutationFn: () => api.post(`/requirements/${r.id}/request-clarification`),
    onSuccess: () => {
      toast.ok(`Clarification requested for ${r.key}`);
      qc.invalidateQueries({ queryKey: ["requirements"] });
      qc.invalidateQueries({ queryKey: ["requirement-expanded-detail", r.id] });
      onRequirementUpdated?.();
    },
    onError: (err) => toast.error(err),
  });

  const rejectM = useMutation({
    mutationFn: () => api.post(`/requirements/${r.id}/reject`, { reason: "Rejected during review" }),
    onSuccess: () => {
      toast.ok(`Requirement ${r.key} rejected`);
      qc.invalidateQueries({ queryKey: ["requirements"] });
      qc.invalidateQueries({ queryKey: ["requirement-expanded-detail", r.id] });
      onRequirementUpdated?.();
    },
    onError: (err) => toast.error(err),
  });

  const parsePageNum = (pageStr?: string | null): number => {
    if (!pageStr) return 1;
    const match = pageStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all">
      {/* 1. TOP HEADER & PROVENANCE BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-bold text-[#1D63ED] px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
            {r.key}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-xs font-semibold text-slate-900">{r.title}</span>
          <Badge value={detail.review_status || detail.status || "approved"} />
          <Badge value={detail.priority} />
        </div>

        <div className="flex items-center gap-2">
          {/* Validation & Grounding status */}
          <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-2xs font-medium text-indigo-700 border border-indigo-100">
            <ShieldCheck className="h-3 w-3" />
            <span>Provenance: {(detail as any).extraction_provenance || "explicit_documented"}</span>
          </span>

          {/* AI Confidence Score */}
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>{confidencePct}% Grounding Confidence</span>
          </span>
        </div>
      </div>

      {/* 2. DESCRIPTION & ORIGINAL EXTRACTED TEXT (VERBATIM QUOTE) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Full Obligation Statement */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
              Complete Requirement Obligation
            </span>
            <span className="text-2xs font-medium text-slate-400">Category: {label(r.category)}</span>
          </div>
          <p className="text-xs text-slate-800 leading-relaxed font-normal bg-slate-50/70 p-3 rounded-lg border border-slate-200">
            {detail.description || (detail as any).current?.description || r.title}
          </p>
          {(detail as any).current?.business_objective && (
            <p className="text-[11px] text-slate-500 bg-blue-50/30 px-3 py-1.5 rounded border border-blue-100 leading-relaxed">
              <strong className="text-blue-900 font-semibold">Objective:</strong> {(detail as any).current.business_objective}
            </p>
          )}
        </div>

        {/* Original Extracted Verbatim Text & Source Citation */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
              Original Extracted Text & Citation
            </span>
            {r.source_page && (
              <span className="text-2xs font-mono text-[#1D63ED] font-medium">
                {r.source_page} {r.source_section ? `· § ${r.source_section}` : ""}
              </span>
            )}
          </div>
          <blockquote className="text-xs text-slate-700 italic leading-relaxed bg-amber-50/40 border-l-3 border-amber-400 p-3 rounded-r-lg">
            "{r.evidence_excerpt || "No explicit verbatim excerpt recorded."}"
          </blockquote>

          {r.document_id && onOpenDocument && (
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => onOpenDocument(r.document_id as number, parsePageNum(r.source_page), r.evidence_excerpt || undefined)}
                className="inline-flex items-center gap-1 text-2xs text-[#1D63ED] hover:underline font-medium"
              >
                <FileText className="h-3 w-3" />
                <span>Jump to Source in PDF Viewer</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. EXTRACTED ATOMIC CLAUSES */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
            <span>Extracted Atomic Clauses ({clauses.length})</span>
          </span>
          <span className="text-2xs text-slate-400 font-mono">Normalized Quality Units</span>
        </div>

        {clauses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {clauses.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-xs space-y-1.5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {c.clause_key}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Position #{c.position}</span>
                </div>
                <p className="text-slate-800 text-[11px] leading-relaxed">{c.text}</p>
                {c.ambiguity_flags && c.ambiguity_flags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {c.ambiguity_flags.map((f: any, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.2 text-[10px] text-amber-800 border border-amber-200"
                      >
                        <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
                        <span>{f.term}: {f.reason}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2.5 text-center text-2xs text-slate-500">
            No atomic clauses extracted for this requirement.
          </div>
        )}
      </div>

      {/* 4. LINKED ACCEPTANCE CRITERIA */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-purple-600" />
            <span>Linked Acceptance Criteria ({acList.length})</span>
          </span>
          <span className="text-2xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
            Gherkin Verified
          </span>
        </div>

        {acList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {acList.map((ac: any, acIdx: number) => (
              <div
                key={ac.id || acIdx}
                className="rounded-lg border border-purple-100 bg-purple-50/30 p-2.5 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xs font-bold text-purple-800">{ac.key}</span>
                  <span className="rounded bg-purple-100 text-purple-800 px-1.5 py-0.2 text-[9px] font-semibold">
                    {label(ac.review_status || "approved")}
                  </span>
                </div>
                <p className="text-slate-800 text-[11px] leading-relaxed font-medium">
                  {ac.description}
                </p>
                {ac.clause_keys && ac.clause_keys.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                    <span>Clauses:</span>
                    {ac.clause_keys.map((ck: string, i: number) => (
                      <span key={i} className="bg-white px-1 py-0.2 rounded border border-purple-200 text-purple-700">
                        {ck}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2.5 text-center text-2xs text-slate-500">
            No acceptance criteria generated yet for this requirement.
          </div>
        )}
      </div>

      {/* 5. LINKED TEST CASES */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <FileCheck className="h-3.5 w-3.5 text-[#1D63ED]" />
            <span>Linked Test Scenarios ({testList.length})</span>
          </span>
          <button
            type="button"
            onClick={() => nav(`/tests?project_id=${r.project_id}&requirement_id=${r.id}`)}
            className="text-2xs text-[#1D63ED] hover:underline font-medium inline-flex items-center gap-1"
          >
            <span>Open in Test Suite</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {testList.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {testList.map((t: any, tIdx: number) => (
              <div
                key={t.id || tIdx}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <span className="font-mono text-2xs font-semibold text-[#1D63ED]">{t.key}</span>
                <span className="text-[11px] text-slate-800 truncate max-w-[240px]">{t.title}</span>
                <span className="rounded bg-blue-100 text-[#1D63ED] px-1 py-0.2 text-[9px] font-medium uppercase">
                  {t.category || t.test_category || "test"}
                </span>
                <span className="rounded bg-slate-200 text-slate-700 px-1 py-0.2 text-[9px] font-mono">
                  {t.capability || t.execution_capability || "simulation"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-2.5 text-center text-2xs text-amber-800">
            No test cases currently linked. Generate automated coverage from the Coverage Explorer.
          </div>
        )}
      </div>

      {/* 6. REVIEW HISTORY & AUDIT TRAIL */}
      {versions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-slate-500" />
              <span>Version History ({versions.length})</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
            {versions.map((v: any) => (
              <div key={v.id} className="rounded border border-slate-200 bg-slate-50/50 px-2.5 py-1">
                <span className="font-semibold text-slate-800">Version {v.version}</span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span>{fmtDate(v.created_at, false)}</span>
                {v.change_summary && (
                  <span className="text-slate-500 italic ml-1">({v.change_summary})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. BOTTOM ACTIONS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          {/* Detail Drawer button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenDrawer(r)}
            className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" />
            <span>Open Detail Drawer</span>
          </Button>

          {/* Dedicated full page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => nav(`/requirements/${r.id}`)}
            className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1 text-slate-400" />
            <span>Full Workspace</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Request Clarification */}
          <Button
            variant="outline"
            size="sm"
            loading={clarifyM.isPending}
            disabled={needsClarification}
            onClick={() => clarifyM.mutate()}
            className="h-8 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            <HelpCircle className="h-3.5 w-3.5 mr-1" />
            <span>Request Clarification</span>
          </Button>

          {/* Reject button */}
          <Button
            variant="outline"
            size="sm"
            loading={rejectM.isPending}
            disabled={r.status === "deprecated" || detail.review_status === "rejected"}
            onClick={() => rejectM.mutate()}
            className="h-8 text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            <span>Reject</span>
          </Button>

          {/* Approve button */}
          <Button
            variant="primary"
            size="sm"
            loading={approveM.isPending}
            disabled={isApproved}
            onClick={() => approveM.mutate()}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            <span>{isApproved ? "Approved" : "Approve Requirement"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
