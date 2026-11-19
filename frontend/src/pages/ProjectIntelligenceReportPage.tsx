import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileCode,
  FileDown,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Network,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useToast } from "@/components/Toast";
import { ErrorState, LoadingBlock } from "@/components/ui";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";
import { cn, fmtDate } from "@/utils/format";

type PrimarySection =
  | "overview"
  | "deliverables"
  | "role_reports"
  | "evidence"
  | "traceability"
  | "release_gate"
  | "export_centre";

type HandoffRole =
  | "developer"
  | "qa"
  | "automation_agent"
  | "integration"
  | "product_owner"
  | "executive";

const ROLE_METADATA: Record<
  HandoffRole,
  {
    title: string;
    targetTeam: string;
    description: string;
    icon: typeof Code2;
    primaryFormats: string[];
    deliverableScope: string;
  }
> = {
  developer: {
    title: "Developer Engineering Handoff",
    targetTeam: "Software Engineers & Backend Devs",
    description:
      "Normalized functional requirements, Given/When/Then acceptance criteria, domain invariants, and advisory implementation notes.",
    icon: Code2,
    primaryFormats: ["Markdown", "JSON", "XLSX"],
    deliverableScope: "475 Requirements & Linked Criteria",
  },
  qa: {
    title: "QA Test Pack & Verification Dossier",
    targetTeam: "Manual QA & Quality Analysts",
    description:
      "Structured test procedures, positive/negative/boundary breakdown, preconditions, inputs, and uncovered requirement gaps.",
    icon: CheckCircle2,
    primaryFormats: ["XLSX", "Markdown", "CSV"],
    deliverableScope: "Synthesized Tests & Coverage Matrix",
  },
  automation_agent: {
    title: "Autonomous AI Testing Agent Pack",
    targetTeam: "Automation Engineers & AI Tools (Cursor, Copilot, Playwright)",
    description:
      "Machine-readable, self-contained prompt dossier with strict fact-vs-assumption demarcation and 6-step testing execution instructions.",
    icon: Cpu,
    primaryFormats: ["JSON Schema v2.0", "Agent Prompt (.md)"],
    deliverableScope: "Self-Contained Test Synthesis Prompt",
  },
  integration: {
    title: "Integration & Interface Specification",
    targetTeam: "Integration Engineers & Platform Architects",
    description:
      "System actors, permissions matrix, integration requirements, data exchange boundaries, and interface invariants.",
    icon: Network,
    primaryFormats: ["Markdown", "JSON"],
    deliverableScope: "Boundary Contracts & Security Rules",
  },
  product_owner: {
    title: "Product Owner & Business Scope Dossier",
    targetTeam: "Product Owners, Business Analysts & Stakeholders",
    description:
      "Business mission, user scenarios, priority distribution, approval status, and unresolved ambiguity clarification requests.",
    icon: Briefcase,
    primaryFormats: ["Markdown", "JSON", "XLSX"],
    deliverableScope: "Business Scope & Scenarios",
  },
  executive: {
    title: "Executive Quality & Release Report",
    targetTeam: "VP Engineering, Head of QA & Compliance Auditors",
    description:
      "Deterministic readiness score (30.5%), 5-category gate score breakdown, release blocking reasons, and prioritized remediation roadmap.",
    icon: ShieldCheck,
    primaryFormats: ["Print Dossier / PDF", "Markdown", "JSON"],
    deliverableScope: "Quality Decision & Risk Ledger",
  },
};

export default function ProjectIntelligenceReportPage() {
  const { projectId, setProjectId } = useProjects();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  // Sync URL project_id param if explicitly provided
  const urlPid = searchParams.get("project_id");
  if (urlPid && Number(urlPid) > 0 && Number(urlPid) !== projectId) {
    setProjectId(Number(urlPid));
  }

  // Primary Navigation Sections (Apple Segmented Control)
  const [activeSection, setActiveSection] = useState<PrimarySection>("overview");

  // Handoff Workflow State
  const [handoffRole, setHandoffRole] = useState<HandoffRole>("developer");
  const [includeInvariants, setIncludeInvariants] = useState(true);
  const [includeAmbiguities, setIncludeAmbiguities] = useState(true);
  const [includeUncovered, setIncludeUncovered] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);

  // Role Reports Viewer State
  const [selectedRoleView, setSelectedRoleView] = useState<HandoffRole>("developer");

  // Granular Filter & Search
  const [reqCategoryFilter, setReqCategoryFilter] = useState<string>("ALL");
  const [reqSearch, setReqSearch] = useState("");
  const [copyingEntity, setCopyingEntity] = useState<string | null>(null);

  // Queries
  const reportQ = useQuery({
    queryKey: ["project_intelligence_report", projectId],
    queryFn: () => api.get<any>(`/projects/${projectId}/intelligence-report`),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });

  const defectsQ = useQuery({
    queryKey: ["project_defects", projectId],
    queryFn: () => api.get<any>(`/defects?project_id=${projectId}`),
    enabled: Boolean(projectId),
  });

  const roleHandoffQ = useQuery({
    queryKey: ["role_handoff_data", projectId, selectedRoleView],
    queryFn: () =>
      api.get<any>(`/projects/${projectId}/intelligence-report/handoff/${selectedRoleView}?format=json`),
    enabled: Boolean(projectId) && activeSection === "role_reports",
    staleTime: 60_000,
  });

  const regenM = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/intelligence-report/regenerate`),
    onSuccess: () => {
      reportQ.refetch();
      defectsQ.refetch();
      roleHandoffQ.refetch();
      toast.ok("Project Intelligence regenerated with latest persistent records.");
    },
    onError: (err: any) => toast.error(err?.message || "Regeneration failed"),
  });

  const rep = reportQ.data;
  const defectsList: any[] = defectsQ.data?.items || [];

  // Filter requirements for overview table
  const filteredReqs = useMemo(() => {
    if (!rep?.requirements_analysis?.grouped_requirements) return [];
    const grouped = rep.requirements_analysis.grouped_requirements;
    let list: any[] = [];
    if (reqCategoryFilter === "ALL") {
      Object.values(grouped).forEach((arr: any) => {
        list = list.concat(arr);
      });
    } else {
      list = grouped[reqCategoryFilter] || [];
    }
    if (reqSearch.trim()) {
      const q = reqSearch.toLowerCase();
      list = list.filter(
        (r) =>
          r.key?.toLowerCase().includes(q) ||
          r.title?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rep, reqCategoryFilter, reqSearch]);

  // Copy full dataset action handler
  const handleCopyGranular = async (entity: string, label: string) => {
    setCopyingEntity(entity);
    try {
      const res = await fetch(
        `/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=${entity}&format=csv`
      );
      if (!res.ok) throw new Error("Failed to fetch records for export");
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast.ok(`Copied all ${label} to clipboard!`);
    } catch (err: any) {
      toast.error(`Copy failed: ${err?.message || err}`);
    } finally {
      setTimeout(() => setCopyingEntity(null), 1200);
    }
  };

  const handleCopyRoleMarkdown = async (role: HandoffRole, title: string) => {
    setCopyingEntity(`role_${role}`);
    try {
      const res = await fetch(
        `/api/v1/projects/${projectId}/intelligence-report/handoff/${role}?format=markdown`
      );
      if (!res.ok) throw new Error("Failed to generate markdown package");
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast.ok(`Copied complete ${title} to clipboard!`);
    } catch (err: any) {
      toast.error(`Copy failed: ${err?.message || err}`);
    } finally {
      setTimeout(() => setCopyingEntity(null), 1200);
    }
  };

  if (!projectId) {
    return (
      <div className="py-20 text-center max-w-md mx-auto">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 border border-slate-200/80 mb-4 shadow-2xs">
          <BookOpen className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 tracking-tight">Select a Project Workspace</h2>
        <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
          The Engineering Handoff & Project Intelligence Centre provides role-specific deliverables and quality assessments for a specific project. Please select a project from the top workspace selector.
        </p>
      </div>
    );
  }

  if (reportQ.error) {
    return <ErrorState error={reportQ.error} onRetry={reportQ.refetch} />;
  }

  if (reportQ.isLoading || !rep) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <LoadingBlock rows={6} />
      </div>
    );
  }

  const relDec = rep.release_decision || {};
  const execSummary = rep.executive_summary || {};
  const reqAnalysis = rep.requirements_analysis || {};
  const testDesign = rep.test_design || {};
  const acData = testDesign.acceptance_criteria || {};
  const execResults = rep.execution_results || {};
  const traceability = rep.traceability || {};

  const releaseStatus: string = relDec.status || "insufficient_evidence";
  const displayStatus: string =
    relDec.display_status ||
    (releaseStatus === "approved_for_production"
      ? "Approved for Production"
      : "Insufficient Evidence");
  const isApproved: boolean = Boolean(relDec.is_approved);
  const reasons: string[] = relDec.reasons || [];
  const blockingDefects: any[] = relDec.blocking_defects || [];
  const openDefectsCount = defectsList.filter(
    (d) => d.status !== "closed" && d.status !== "verified"
  ).length;

  const totalRuns = execResults.total_runs || 0;
  const isUnexecuted = execResults.is_unexecuted || totalRuns === 0;

  // Release gate pill subtitle logic
  const gateSubtitle = isApproved
    ? "All Assertions Met & Approved"
    : blockingDefects.length > 0
    ? `${blockingDefects.length} Critical Defect(s) Blocking`
    : isUnexecuted
    ? "Awaiting Test Execution"
    : openDefectsCount > 0
    ? `${openDefectsCount} Active Defect(s)`
    : "Review Conditions Pending";

  const NAV_TABS = [
    { id: "overview", label: "Overview", icon: BookOpen, badge: null },
    { id: "deliverables", label: "Deliverables Flow", icon: Workflow, badge: "4 Steps" },
    { id: "role_reports", label: "Team Dossiers", icon: Users, badge: "6 Roles" },
    { id: "evidence", label: "Test Evidence", icon: ShieldCheck, badge: String(testDesign.total_test_cases || 0) },
    { id: "traceability", label: "Traceability", icon: Network, badge: `${traceability.coverage_pct || 0}%` },
    { id: "release_gate", label: "Release Gate", icon: CheckCircle2, badge: isApproved ? "GO" : "NO-GO" },
    { id: "export_centre", label: "Export Centre", icon: Download, badge: null },
  ] as const;

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto print:p-0 print:space-y-4">
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 12mm 15mm 15mm 15mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
            color: #0f172a !important;
          }
          .no-print {
            display: none !important;
          }
          .print-block {
            display: block !important;
          }
          .print-break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-page-break-before {
            break-before: page !important;
            page-break-before: always !important;
          }
        }
      `}</style>

      {/* Top Header & Action Bar — Apple Translucent Depth */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-0.5 text-2xs font-medium text-slate-700 border border-slate-200/70">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Enterprise Engineering Handoff</span>
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-2xs font-mono font-medium text-slate-500">
              {rep.project_key} ({rep.project_name})
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mt-1.5 flex items-center gap-2">
            <span>Project Intelligence Report</span>
            <span className="text-xs font-normal text-slate-400 hidden md:inline">
              — Role-Specific Deliverables & Traceable Quality Dossier
            </span>
          </h1>

          <p className="text-xs text-slate-500 mt-1">
            Domain: <strong className="text-slate-700 font-medium">{rep.domain || "Developer Tools & Infrastructure"}</strong> · Evaluated:{" "}
            {fmtDate(rep.generated_at)}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => regenM.mutate()}
            disabled={regenM.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            title="Recalculate all project assessment metrics"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-400", regenM.isPending && "animate-spin text-blue-600")} />
            <span>{regenM.isPending ? "Evaluating..." : "Regenerate"}</span>
          </button>

          <a
            href={`/api/v1/projects/${projectId}/intelligence-report/complete-package?format=xlsx`}
            download={`${rep.project_key}_Engineering_Workbook.xlsx`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-3.5 text-xs font-medium text-emerald-800 shadow-2xs hover:bg-emerald-100 active:scale-[0.98] transition-all"
            title="Download multi-sheet Excel engineering workbook"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Excel Workbook</span>
          </a>

          <a
            href={`/api/v1/projects/${projectId}/intelligence-report/complete-package?format=json`}
            download={`${rep.project_key}_Complete_Package_v2.json`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all"
            title="Download versioned JSON complete package (Schema v2.0)"
          >
            <FileCode className="h-3.5 w-3.5 text-slate-400" />
            <span>JSON Package</span>
          </a>

          <a
            href={`/api/v1/projects/${projectId}/intelligence-report/export?format=html`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-medium text-white shadow-xs hover:bg-black active:scale-[0.98] transition-all cursor-pointer"
            title="Open standalone print-ready HTML dossier / PDF"
          >
            <Printer className="h-3.5 w-3.5 text-white/90" />
            <span>Print Dossier / PDF</span>
          </a>
        </div>
      </div>

      {/* TOP METRICS BENTO CLUSTER — Apple Clean Surface & Continuous Radii */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 print-break-inside-avoid">
        {/* 1. Readiness Score (Hero Tile) */}
        <div className="col-span-1 sm:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden group hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
                Readiness Score
              </span>
              <span className="text-3xs text-slate-500 block mt-0.5">Evidence-Weighted Quality Gate</span>
            </div>
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">
              {rep.readiness_score}%
            </span>
            <span className="text-xs font-medium text-slate-400">/ 100 max</span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
            <span>5 Governance Areas</span>
            <span className="font-medium text-slate-700">Strict Project Scoped</span>
          </div>
        </div>

        {/* 2. Active Requirements */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              Active Reqs
            </span>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {reqAnalysis.total || 0}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-2xs text-slate-500 flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>{reqAnalysis.quote_coverage_pct || 0}% Verbatim Grounded</span>
          </div>
        </div>

        {/* 3. Acceptance Criteria */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              Criteria
            </span>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {acData.total || 0}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-2xs text-slate-500 flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{acData.pending || 0} Pending Review</span>
          </div>
        </div>

        {/* 4. Synthesized Tests */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              Synthesized Tests
            </span>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {testDesign.total_test_cases || 0}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-2xs text-slate-500 flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span>{testDesign.pending || 0} Draft / Pending</span>
          </div>
        </div>

        {/* 5. Execution Status */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              Execution Runs
            </span>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {isUnexecuted ? "0 Runs" : execResults.pass_rate_display || "N/A"}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-2xs text-slate-500 flex items-center gap-1 truncate" title={isUnexecuted ? "No Code Runs Recorded" : `${totalRuns} Runs Logged`}>
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", isUnexecuted ? "bg-amber-400" : "bg-emerald-500")} />
            <span>{isUnexecuted ? "No Runs Recorded" : `${totalRuns} Runs`}</span>
          </div>
        </div>

        {/* 6. Release Gate Decision (Tile) */}
        <div
          className={cn(
            "col-span-1 sm:col-span-2 lg:col-span-1 rounded-2xl p-5 border flex flex-col justify-between shadow-2xs transition-colors",
            isApproved
              ? "bg-emerald-50/50 border-emerald-200/70 text-emerald-950"
              : "bg-rose-50/50 border-rose-200/70 text-rose-950"
          )}
        >
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider opacity-70 block">
              Release Gate
            </span>
            <div className="mt-3 inline-flex items-center gap-1.5 font-semibold text-xs">
              {isApproved ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>GO (APPROVED)</span>
                </>
              ) : (
                <>
                  <AlertOctagon className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>NO-GO (BLOCKED)</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-black/5 text-3xs opacity-80 truncate" title={gateSubtitle}>
            {gateSubtitle}
          </div>
        </div>
      </div>

      {/* APPLE SEGMENTED CONTROL NAVIGATION BAR */}
      <div className="no-print">
        <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 inline-flex flex-wrap gap-1 shadow-2xs backdrop-blur-xs">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as PrimarySection)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs transition-all duration-150 ease-out cursor-pointer active:scale-[0.98]",
                  isActive
                    ? "bg-white text-slate-900 font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50 font-medium"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-blue-600" : "text-slate-400")} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-3xs font-medium font-mono",
                      isActive ? "bg-slate-100 text-slate-800" : "bg-slate-200/60 text-slate-500"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: EXECUTIVE OVERVIEW */}
      {/* ========================================================================= */}
      <div className={cn(activeSection !== "overview" && "hidden print:block", "space-y-6")}>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-6 print-break-inside-avoid">
          {/* Executive Statement Callout — Apple Translucent Depth */}
          <div className="rounded-2xl border border-blue-100/90 bg-blue-50/40 p-5 backdrop-blur-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-2xs font-semibold text-blue-900 uppercase tracking-wider">
                Executive Quality Assessment Statement
              </span>
            </div>
            <p className="text-sm font-medium text-slate-900 leading-relaxed">
              {execSummary.headline}
            </p>
          </div>

          {/* 4 Ingestion & Discovery Narrative Cards */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Autonomous Discovery & Quality Synthesis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 space-y-2 hover:border-slate-300 transition-colors">
                <span className="font-semibold text-slate-900 block text-xs">1. What Was Analysed?</span>
                <p className="text-slate-600 leading-relaxed">{execSummary.what_was_analysed}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 space-y-2 hover:border-slate-300 transition-colors">
                <span className="font-semibold text-slate-900 block text-xs">2. What Did TraceTest Discover?</span>
                <p className="text-slate-600 leading-relaxed">{execSummary.what_was_discovered}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 space-y-2 hover:border-slate-300 transition-colors">
                <span className="font-semibold text-slate-900 block text-xs">3. What Is Verified & Working?</span>
                <p className="text-slate-600 leading-relaxed">{execSummary.what_is_working}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 space-y-2 hover:border-slate-300 transition-colors">
                <span className="font-semibold text-slate-900 block text-xs">4. Major Concerns & Deficiencies</span>
                <p className="text-slate-600 leading-relaxed">{execSummary.major_concerns}</p>
              </div>
            </div>
          </div>

          {/* Critical Quality Gaps Table (Directly visible on Executive Overview) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Critical Quality Gaps & Remediation Effort</span>
              </h3>
              <span className="text-2xs font-mono text-slate-400">{rep.critical_gaps?.length || 0} Identified Gaps</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200/70">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/70 bg-slate-50/70 text-slate-500 font-medium text-2xs uppercase tracking-wider">
                    <th className="py-2.5 px-3.5 w-10 text-center">#</th>
                    <th className="py-2.5 px-3.5">Gap Description</th>
                    <th className="py-2.5 px-3.5 w-24 text-center">Severity</th>
                    <th className="py-2.5 px-3.5 w-36">Estimated Effort</th>
                    <th className="py-2.5 px-3.5 w-36">Affected Area</th>
                    <th className="py-2.5 px-3.5 w-32 text-right">Target Screen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rep.critical_gaps?.map((g: any) => (
                    <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3.5 font-mono text-center text-slate-400">{g.id}</td>
                      <td className="py-3 px-3.5 font-medium text-slate-900">{g.description}</td>
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-2xs font-semibold uppercase border",
                            g.severity === "Critical"
                              ? "bg-rose-50 text-rose-700 border-rose-200/70"
                              : g.severity === "High"
                              ? "bg-amber-50 text-amber-800 border-amber-200/70"
                              : "bg-blue-50 text-blue-700 border-blue-200/70"
                          )}
                        >
                          {g.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 font-mono text-2xs">{g.effort}</td>
                      <td className="py-3 px-3.5 text-slate-500 text-2xs">{g.affected_area}</td>
                      <td className="py-3 px-3.5 text-right">
                        <Link
                          to={`${g.target_screen || "/requirements"}?project_id=${projectId}`}
                          className="inline-flex items-center gap-1 text-2xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <span>Open Console</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Source Documents Provenance Table */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Ingested Source Documents & Extraction Provenance
              </h3>
              <span className="text-2xs font-mono text-slate-400">{rep.document_analysis?.length || 0} Document(s)</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200/70">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/70 bg-slate-50/70 text-slate-500 font-medium text-2xs uppercase tracking-wider">
                    <th className="py-2.5 px-3.5">Document Name</th>
                    <th className="py-2.5 px-3.5">Purpose</th>
                    <th className="py-2.5 px-3.5 text-center">Format</th>
                    <th className="py-2.5 px-3.5 text-center">Pages</th>
                    <th className="py-2.5 px-3.5 text-center">Sections</th>
                    <th className="py-2.5 px-3.5 text-center">Extracted Reqs</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rep.document_analysis?.map((doc: any) => (
                    <tr key={doc.document_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3.5 font-medium text-slate-900 flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <span className="truncate max-w-sm">{doc.filename}</span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-600">{doc.purpose}</td>
                      <td className="py-3 px-3.5 text-center font-mono text-2xs text-slate-500 uppercase">{doc.file_type}</td>
                      <td className="py-3 px-3.5 text-center font-mono">{doc.page_count}</td>
                      <td className="py-3 px-3.5 text-center font-mono">{doc.sections_identified}</td>
                      <td className="py-3 px-3.5 text-center font-mono font-semibold text-blue-600">{doc.requirements_extracted}</td>
                      <td className="py-3 px-3.5 text-center">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-2xs font-medium text-emerald-800 border border-emerald-200/70">
                          {doc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: ENGINEERING DELIVERABLES & HANDOFF WORKFLOW */}
      {/* ========================================================================= */}
      <div className={cn(activeSection !== "deliverables" && "hidden print:block", "space-y-6")}>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Engineering Handoff Preparation Flow
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Follow this 4-step workflow to package TraceTest's specifications, criteria, and test scenarios for your engineering team or autonomous coding agents.
            </p>
          </div>

          {/* Workflow Step Tracker — Apple Stepper */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4 space-y-1">
              <span className="font-mono text-3xs font-semibold text-blue-600">STEP 1</span>
              <span className="font-semibold text-slate-900 block">Select Audience</span>
              <p className="text-slate-500 text-2xs leading-relaxed">Choose the consumer team or automated agent.</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 space-y-1">
              <span className="font-mono text-3xs font-semibold text-slate-400">STEP 2</span>
              <span className="font-semibold text-slate-900 block">Review Contents</span>
              <p className="text-slate-500 text-2xs leading-relaxed">Verify requirements, criteria, and test procedures.</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 space-y-1">
              <span className="font-mono text-3xs font-semibold text-slate-400">STEP 3</span>
              <span className="font-semibold text-slate-900 block">Configure Scope</span>
              <p className="text-slate-500 text-2xs leading-relaxed">Toggle invariants, ambiguities, and advisory notes.</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 space-y-1">
              <span className="font-mono text-3xs font-semibold text-slate-400">STEP 4</span>
              <span className="font-semibold text-slate-900 block">Export & Copy</span>
              <p className="text-slate-500 text-2xs leading-relaxed">1-Click download in Markdown, JSON, XLSX, or copy.</p>
            </div>
          </div>

          {/* Step 1: Audience Selector Grid */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 block">
              1. Select Target Recipient / Role
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {(Object.keys(ROLE_METADATA) as HandoffRole[]).map((roleKey) => {
                const meta = ROLE_METADATA[roleKey];
                const Icon = meta.icon;
                const isSelected = handoffRole === roleKey;
                return (
                  <button
                    key={roleKey}
                    onClick={() => setHandoffRole(roleKey)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all cursor-pointer active:scale-[0.98]",
                      isSelected
                        ? "border-blue-500 bg-blue-50/30 shadow-xs ring-1 ring-blue-500"
                        : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/40"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={cn("p-2 rounded-xl", isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600")}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-3xs uppercase font-medium text-slate-400">{meta.targetTeam}</span>
                    </div>
                    <span className="font-semibold text-xs text-slate-900 block">{meta.title}</span>
                    <p className="text-2xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {meta.description}
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-3xs font-medium text-slate-400">
                      <span>{meta.deliverableScope}</span>
                      <span className="text-blue-600 font-semibold">{meta.primaryFormats.join(" · ")}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2 & 3: Content Verification & Customization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 block">
                2. Packaged Deliverable Scope ({ROLE_METADATA[handoffRole].title})
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                  <span className="text-slate-600">Active Grounded Requirements</span>
                  <strong className="text-slate-900 font-mono">{reqAnalysis.total || 0}</strong>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                  <span className="text-slate-600">Synthesized Acceptance Criteria</span>
                  <strong className="text-slate-900 font-mono">{acData.total || 0}</strong>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                  <span className="text-slate-600">Behavioral Test Procedures</span>
                  <strong className="text-slate-900 font-mono">{testDesign.total_test_cases || 0}</strong>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                  <span className="text-slate-600">Uncovered Requirements Gap</span>
                  <strong className="text-amber-700 font-mono">{traceability.uncovered_requirements || 0}</strong>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-600">Canonical Release Decision</span>
                  <strong className={cn("font-medium text-2xs uppercase", isApproved ? "text-emerald-700" : "text-rose-700")}>
                    {displayStatus}
                  </strong>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 block">
                3. Section Customization Options
              </span>
              <div className="space-y-2.5 text-xs">
                <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={includeInvariants}
                    onChange={(e) => setIncludeInvariants(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Include Contract Invariants & Statutory Constraints</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={includeAmbiguities}
                    onChange={(e) => setIncludeAmbiguities(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Include Unresolved Ambiguities & Clarification Questions</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={includeUncovered}
                    onChange={(e) => setIncludeUncovered(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Include Gap Ledger (Uncovered Requirements & Unverified Tests)</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Include Advisory Implementation Notes (Explicitly Tagged)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Step 4: Export & Copy Actions for Selected Audience */}
          <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-2xs font-semibold text-blue-900 uppercase tracking-wider block">
                Step 4: Package Ready for Export
              </span>
              <h4 className="text-sm font-semibold text-slate-900 mt-0.5">
                {ROLE_METADATA[handoffRole].title}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Download or copy complete, portable deliverables tailored for {ROLE_METADATA[handoffRole].targetTeam}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleCopyRoleMarkdown(handoffRole, ROLE_METADATA[handoffRole].title)}
                disabled={copyingEntity === `role_${handoffRole}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5 text-slate-400" />
                <span>{copyingEntity === `role_${handoffRole}` ? "Copied!" : "Copy Full Pack"}</span>
              </button>

              <a
                href={`/api/v1/projects/${projectId}/intelligence-report/handoff/${handoffRole}?format=markdown`}
                download={`${rep.project_key}_${handoffRole}_handoff.md`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-medium text-white shadow-xs hover:bg-blue-700 active:scale-[0.98] transition-all"
              >
                <FileDown className="h-3.5 w-3.5 text-white/90" />
                <span>Download Markdown</span>
              </a>

              <a
                href={`/api/v1/projects/${projectId}/intelligence-report/handoff/${handoffRole}?format=json`}
                download={`${rep.project_key}_${handoffRole}_handoff.json`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-medium text-white shadow-xs hover:bg-black active:scale-[0.98] transition-all"
              >
                <FileCode className="h-3.5 w-3.5 text-white/90" />
                <span>Download JSON</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: ROLE-BASED REPORTS INTERACTIVE VIEWER */}
      {/* ========================================================================= */}
      <div className={cn(activeSection !== "role_reports" && "hidden print:block", "space-y-6")}>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Role-Specific Deliverables Viewer
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect authentic, role-tailored report data live in the console before distributing to downstream teams.
              </p>
            </div>

            {/* Sub-Tabs for Roles (Segmented Style) */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
              {(Object.keys(ROLE_METADATA) as HandoffRole[]).map((rKey) => (
                <button
                  key={rKey}
                  onClick={() => setSelectedRoleView(rKey)}
                  className={cn(
                    "px-3 py-1.5 text-2xs font-medium rounded-lg transition-all cursor-pointer capitalize active:scale-[0.98]",
                    selectedRoleView === rKey
                      ? "bg-white text-slate-900 font-semibold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {rKey.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Role Report Content Display */}
          {roleHandoffQ.isLoading ? (
            <LoadingBlock rows={5} />
          ) : roleHandoffQ.data ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-900">{roleHandoffQ.data.title}</h4>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    Target Audience: <strong className="text-slate-700">{ROLE_METADATA[selectedRoleView].targetTeam}</strong> · Generated:{" "}
                    {fmtDate(roleHandoffQ.data.generated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/handoff/${selectedRoleView}?format=markdown`}
                    download={`${rep.project_key}_${selectedRoleView}.md`}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-2xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all"
                  >
                    <Download className="h-3 w-3 text-slate-400" />
                    <span>Markdown</span>
                  </a>
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/handoff/${selectedRoleView}?format=json`}
                    download={`${rep.project_key}_${selectedRoleView}.json`}
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-2xs font-medium text-white shadow-xs hover:bg-black active:scale-[0.98] transition-all"
                  >
                    <FileCode className="h-3 w-3 text-white/90" />
                    <span>JSON</span>
                  </a>
                </div>
              </div>

              {/* Developer Specific Preview */}
              {selectedRoleView === "developer" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 text-xs text-slate-700 space-y-1">
                    <span className="font-semibold text-slate-900 block">Engineering Context:</span>
                    <p className="text-slate-600 text-2xs leading-relaxed">{roleHandoffQ.data.system_overview}</p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
                      Sample Packaged Requirements & Acceptance Criteria:
                    </span>
                    <div className="overflow-x-auto max-h-80 rounded-xl border border-slate-200/70">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/70 text-slate-500 font-medium text-2xs uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3.5">Req Key</th>
                            <th className="py-2.5 px-3.5">Title</th>
                            <th className="py-2.5 px-3.5">Category</th>
                            <th className="py-2.5 px-3.5 text-center">Linked Criteria</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {roleHandoffQ.data.functional_requirements?.slice(0, 15).map((r: any) => (
                            <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-3.5 font-mono font-medium text-blue-600">{r.key}</td>
                              <td className="py-2.5 px-3.5 font-medium text-slate-900 truncate max-w-xs">{r.title}</td>
                              <td className="py-2.5 px-3.5 text-2xs font-mono text-slate-500">{r.category}</td>
                              <td className="py-2.5 px-3.5 text-center font-mono font-semibold text-slate-700">
                                {r.acceptance_criteria?.length || 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* QA Specific Preview */}
              {selectedRoleView === "qa" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-3.5">
                      <span className="text-2xs text-slate-400 uppercase font-medium">Test Procedures</span>
                      <div className="text-xl font-semibold text-slate-900 mt-1">{roleHandoffQ.data.test_cases?.length || 0}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-3.5">
                      <span className="text-2xs text-slate-400 uppercase font-medium">Uncovered Gap</span>
                      <div className="text-xl font-semibold text-amber-700 mt-1">{roleHandoffQ.data.uncovered_requirements?.length || 0}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-3.5">
                      <span className="text-2xs text-slate-400 uppercase font-medium">Execution Status</span>
                      <div className="text-sm font-semibold text-slate-700 mt-1">0 Runs (N/A Pass Rate)</div>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-80 rounded-xl border border-slate-200/70">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/70 text-slate-500 font-medium text-2xs uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3.5">Test Key</th>
                          <th className="py-2.5 px-3.5">Title</th>
                          <th className="py-2.5 px-3.5">Type</th>
                          <th className="py-2.5 px-3.5 text-center">Steps</th>
                          <th className="py-2.5 px-3.5 text-center">Execution Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {roleHandoffQ.data.test_cases?.slice(0, 15).map((t: any) => (
                          <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-3.5 font-mono font-medium text-blue-600">{t.key}</td>
                            <td className="py-2.5 px-3.5 font-medium text-slate-900 truncate max-w-xs">{t.title}</td>
                            <td className="py-2.5 px-3.5 text-2xs font-mono text-slate-500">{t.type}</td>
                            <td className="py-2.5 px-3.5 text-center font-mono font-semibold text-slate-700">{t.steps?.length || 0}</td>
                            <td className="py-2.5 px-3.5 text-center">
                              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-3xs font-medium text-amber-800 border border-amber-200/70">
                                {t.execution_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* AI Agent Specific Preview */}
              {selectedRoleView === "automation_agent" && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 text-xs text-amber-900 leading-relaxed">
                    <strong>AI Agent Disclaimer:</strong> {roleHandoffQ.data.execution_disclaimer}
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 p-5 font-mono text-xs space-y-2 overflow-x-auto max-h-80 shadow-inner">
                    <span className="text-emerald-400 block font-semibold">// Machine-Readable Agent Prompt Instruction Sample</span>
                    <pre className="text-2xs leading-relaxed text-slate-300">
                      {JSON.stringify(roleHandoffQ.data.agent_instructions, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Integration Specific Preview */}
              {selectedRoleView === "integration" && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 text-xs text-slate-700">
                    <strong>Identified Actors & Boundaries:</strong> {roleHandoffQ.data.actors_and_systems?.length || 0} Actors Documented
                  </div>
                  <div className="overflow-x-auto max-h-80 rounded-xl border border-slate-200/70">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/70 text-slate-500 font-medium text-2xs uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3.5">Actor / System</th>
                          <th className="py-2.5 px-3.5">Role Type</th>
                          <th className="py-2.5 px-3.5">Description</th>
                          <th className="py-2.5 px-3.5">Permissions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {roleHandoffQ.data.actors_and_systems?.map((a: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-3.5 font-medium text-slate-900">{a.actor_name}</td>
                            <td className="py-2.5 px-3.5 font-mono text-2xs text-slate-500">{a.role_type}</td>
                            <td className="py-2.5 px-3.5 text-slate-600">{a.description}</td>
                            <td className="py-2.5 px-3.5 font-mono text-2xs text-blue-600">{a.permissions?.join(", ") || "Standard"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Product Owner Specific Preview */}
              {selectedRoleView === "product_owner" && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 text-xs text-slate-700 leading-relaxed">
                    <strong>Mission Statement:</strong> {roleHandoffQ.data.business_objective}
                  </div>
                  <div className="space-y-2">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
                      Documented Business Scenarios:
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {roleHandoffQ.data.business_scenarios?.map((s: any) => (
                        <div key={s.id} className="rounded-2xl border border-slate-200/70 bg-white p-4 space-y-1 text-xs shadow-2xs hover:border-slate-300 transition-colors">
                          <span className="font-semibold text-slate-900 block">{s.name}</span>
                          <p className="text-slate-600 text-2xs leading-relaxed">{s.description}</p>
                          <span className="text-3xs text-slate-400 block pt-1 font-mono">Trigger: {s.trigger_event}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Executive Specific Preview */}
              {selectedRoleView === "executive" && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 flex items-center justify-between">
                    <div>
                      <span className="text-2xs font-semibold uppercase text-slate-400">Readiness Score</span>
                      <div className="text-3xl font-semibold text-blue-600 mt-1">{roleHandoffQ.data.readiness_score}%</div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xs font-semibold uppercase text-slate-400">Gate Decision</span>
                      <div className="text-sm font-semibold text-rose-700 mt-1">{roleHandoffQ.data.gate_display}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: TEST & QUALITY EVIDENCE */}
      {/* ========================================================================= */}
      <div className={cn(activeSection !== "evidence" && "hidden print:block", "space-y-6")}>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-6">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span>Test Design & Behavioral Verification Evidence</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Distribution across test suites, automated assertions, execution status, and defect governance.
            </p>
          </div>

          {/* Test Suite Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4">
              <span className="text-2xl font-semibold text-slate-900">{testDesign.total_test_cases || 0}</span>
              <span className="block text-2xs text-slate-400 uppercase font-medium mt-1">Total Test Cases</span>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4">
              <span className="text-2xl font-semibold text-emerald-700">{testDesign.approved || 0}</span>
              <span className="block text-2xs text-slate-400 uppercase font-medium mt-1">Approved</span>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4">
              <span className="text-2xl font-semibold text-amber-700">{testDesign.pending || 0}</span>
              <span className="block text-2xs text-slate-400 uppercase font-medium mt-1">Pending Review</span>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4">
              <span className="text-2xl font-semibold text-blue-700">{testDesign.automated || 0}</span>
              <span className="block text-2xs text-slate-400 uppercase font-medium mt-1">Automated Checks</span>
            </div>
          </div>

          {/* Executions Segregation Card */}
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 uppercase text-2xs tracking-wider">
                Physical Execution Runs vs Simulated Sandbox
              </span>
              <span className="font-mono text-2xs text-slate-400">
                {totalRuns} Total Run(s) Recorded
              </span>
            </div>
            {isUnexecuted ? (
              <div className="rounded-xl bg-amber-50/60 border border-amber-200/70 p-3.5 text-amber-800 text-xs leading-relaxed">
                <strong>Notice:</strong> No physical code executions have been logged for this project. Pass rate is truthfully reported as <strong>N/A</strong>. Test suites are in draft/pending review status.
              </div>
            ) : (
              <div className="text-slate-600 leading-relaxed">
                {totalRuns} execution runs recorded with pass rate of <strong>{execResults.pass_rate_display}</strong>.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 5: TRACEABILITY & COVERAGE MATRIX */}
      {/* ========================================================================= */}
      <div className={cn(activeSection !== "traceability" && "hidden print:block", "space-y-6")}>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-6">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              <Network className="h-4 w-4 text-blue-600" />
              <span>Full Lifecycle Traceability & Specification Coverage</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              End-to-end lineage mapping from document clauses through acceptance criteria to verified test cases.
            </p>
          </div>

          {/* Coverage Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4">
              <span className="text-2xl font-semibold text-blue-600">{traceability.coverage_pct || 0}%</span>
              <span className="block text-2xs font-semibold uppercase tracking-wider text-slate-700 mt-1">
                Specification Coverage
              </span>
              <span className="text-3xs text-slate-400 block mt-0.5">
                {traceability.covered_requirements || 0} of {traceability.total_requirements || 0} reqs linked to tests
              </span>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4">
              <span className="text-2xl font-semibold text-amber-700">
                {traceability.uncovered_requirements || 0}
              </span>
              <span className="block text-2xs font-semibold uppercase tracking-wider text-slate-700 mt-1">
                Uncovered Requirements Gap
              </span>
              <span className="text-3xs text-slate-400 block mt-0.5">
                Lacking automated or manual test cases
              </span>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4">
              <span className="text-2xl font-semibold text-slate-400">
                {traceability.verified_requirements || 0}
              </span>
              <span className="block text-2xs font-semibold uppercase tracking-wider text-slate-700 mt-1">
                Verified Requirements
              </span>
              <span className="text-3xs text-slate-400 block mt-0.5">
                Passing sandbox execution confirmed
              </span>
            </div>
          </div>

          {/* Searchable Requirements & Traceability Ledger */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Requirement Traceability Ledger ({filteredReqs.length} Matches)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search requirements..."
                    value={reqSearch}
                    onChange={(e) => setReqSearch(e.target.value)}
                    className="h-8.5 pl-8.5 pr-3 text-xs rounded-xl border border-slate-200/80 bg-slate-50/50 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 w-48 sm:w-60 transition-all"
                  />
                </div>
                <select
                  value={reqCategoryFilter}
                  onChange={(e) => setReqCategoryFilter(e.target.value)}
                  className="h-8.5 px-3 text-xs rounded-xl border border-slate-200/80 bg-slate-50/50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer transition-all"
                >
                  <option value="ALL">All Categories</option>
                  <option value="compliance">Compliance</option>
                  <option value="functional">Functional</option>
                  <option value="security">Security</option>
                  <option value="business_rule">Business Rules</option>
                  <option value="non_functional">Non-Functional</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 rounded-xl border border-slate-200/70">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-500 font-medium text-2xs uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3.5">Req Key</th>
                    <th className="py-2.5 px-3.5">Title</th>
                    <th className="py-2.5 px-3.5">Category</th>
                    <th className="py-2.5 px-3.5">Source Location</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredReqs.slice(0, 50).map((r: any) => (
                    <tr key={r.id || r.key} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3.5 font-mono font-medium text-blue-600">{r.key}</td>
                      <td className="py-2.5 px-3.5 font-medium text-slate-900 truncate max-w-xs">{r.title}</td>
                      <td className="py-2.5 px-3.5 text-2xs font-mono text-slate-500">{r.category}</td>
                      <td className="py-2.5 px-3.5 text-2xs text-slate-600">{r.source_location || "Section 1.0"}</td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-3xs font-medium text-slate-700">
                          {r.review_status || "draft"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 6: RELEASE READINESS & GATING BREAKDOWN */}
      {/* ========================================================================= */}
      <div className={cn(activeSection !== "release_gate" && "hidden print:block", "space-y-6")}>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span>Authoritative Release Gate Decision</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Evaluated by canonical release decision engine across 5 formal evidence categories.
              </p>
            </div>

            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 border font-medium text-xs",
                isApproved
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200/70"
                  : "bg-rose-50 text-rose-800 border-rose-200/70"
              )}
            >
              {isApproved ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>APPROVED FOR PRODUCTION</span>
                </>
              ) : (
                <>
                  <AlertOctagon className="h-4 w-4 text-rose-600" />
                  <span>RELEASE BLOCKED — {displayStatus}</span>
                </>
              )}
            </div>
          </div>

          {/* Score Breakdown Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200/70">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-50/70 text-slate-500 font-medium text-2xs uppercase tracking-wider">
                  <th className="py-2.5 px-3.5">Evaluation Area</th>
                  <th className="py-2.5 px-3.5 text-center">Score</th>
                  <th className="py-2.5 px-3.5 text-center">Category Weight</th>
                  <th className="py-2.5 px-3.5 text-center">Status</th>
                  <th className="py-2.5 px-3.5">Grounded Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rep.metrics_by_area?.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3.5 font-medium text-slate-900">{row.area}</td>
                    <td className="py-3 px-3.5 text-center font-mono font-semibold text-blue-600">{row.score}%</td>
                    <td className="py-3 px-3.5 text-center text-slate-400 text-2xs font-mono">
                      {idx === 0 ? "30%" : idx === 1 ? "25%" : idx === 2 ? "20%" : idx === 3 ? "20%" : "5%"}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-2xs font-medium border",
                          row.status === "Complete"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200/70"
                            : "bg-amber-50 text-amber-800 border-amber-200/70"
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-600 text-2xs">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Blocking Reasons Callout */}
          {reasons.length > 0 && (
            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 space-y-2">
              <span className="text-xs font-semibold text-rose-900 block flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <span>Release Gate Blocking Reasons:</span>
              </span>
              <ul className="space-y-1 text-xs text-rose-800 list-disc list-inside leading-relaxed">
                {reasons.map((r: string, idx: number) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 7: EXPORT CENTRE & GRANULAR SLICES */}
      {/* ========================================================================= */}
      <div className={cn(activeSection !== "export_centre" && "hidden print:block", "space-y-6")}>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-6">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              <Download className="h-4 w-4 text-blue-600" />
              <span>Complete Project Export & Integration Centre</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Download standardized packages or copy granular datasets directly into your clipboard for downstream engineering tools.
            </p>
          </div>

          {/* Subsection 1: Standardized Complete Packages */}
          <div className="space-y-3">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              1. Complete Project Packages (Schema v2.0 & Multi-Sheet Excel)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Multi-Sheet Excel */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-5 space-y-3 flex flex-col justify-between hover:border-emerald-300 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-emerald-950">Excel Workbook</span>
                  </div>
                  <p className="text-2xs text-slate-600 leading-relaxed">
                    6 professionally styled sheets: Executive Summary, Requirements, Criteria, Tests, Traceability, and Uncovered Gaps.
                  </p>
                </div>
                <a
                  href={`/api/v1/projects/${projectId}/intelligence-report/complete-package?format=xlsx`}
                  download={`${rep.project_key}_Engineering_Workbook.xlsx`}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 text-white px-3 py-2 text-xs font-medium hover:bg-emerald-800 active:scale-[0.98] transition-all shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .XLSX (6 Sheets)</span>
                </a>
              </div>

              {/* Complete JSON Package Schema v2.0 */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 flex flex-col justify-between hover:border-slate-300 transition-colors shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-800">
                      <FileCode className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-slate-900">Schema v2.0 JSON</span>
                  </div>
                  <p className="text-2xs text-slate-600 leading-relaxed">
                    Versioned, machine-readable project package including relational IDs, source quotes, and sanitized credentials.
                  </p>
                </div>
                <a
                  href={`/api/v1/projects/${projectId}/intelligence-report/complete-package?format=json`}
                  download={`${rep.project_key}_Complete_Package_v2.json`}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-medium hover:bg-black active:scale-[0.98] transition-all shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download JSON Package</span>
                </a>
              </div>

              {/* Print Dossier */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3 flex flex-col justify-between hover:border-slate-300 transition-colors shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-800">
                      <Printer className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-slate-900">Print Dossier / PDF</span>
                  </div>
                  <p className="text-2xs text-slate-600 leading-relaxed">
                    Standalone, self-contained HTML executive brief with embedded styles, ready for PDF export or paper distribution.
                  </p>
                </div>
                <a
                  href={`/api/v1/projects/${projectId}/intelligence-report/export?format=html`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 active:scale-[0.98] transition-all"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Printable Dossier</span>
                </a>
              </div>
            </div>
          </div>

          {/* Subsection 2: Granular Slices with 1-Click Clipboard Actions */}
          <div className="space-y-3 pt-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              2. Granular Slices & 1-Click Clipboard Actions
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Requirements Slice */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 flex items-center justify-between shadow-2xs hover:border-slate-300 transition-colors">
                <div>
                  <span className="font-semibold text-slate-900 block">All Active Requirements</span>
                  <span className="text-2xs text-slate-500">475 extracted specifications with verbatim quotes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyGranular("requirements", "Requirements")}
                    disabled={copyingEntity === "requirements"}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200/80 text-2xs font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Copy className="h-3 w-3 text-slate-400" />
                    <span>{copyingEntity === "requirements" ? "Copied" : "Copy"}</span>
                  </button>
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=requirements&format=csv`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100/80 text-2xs font-mono font-medium text-slate-700 hover:bg-slate-200/80 active:scale-[0.98] transition-all"
                  >
                    CSV
                  </a>
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=requirements&format=json`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100/80 text-2xs font-mono font-medium text-slate-700 hover:bg-slate-200/80 active:scale-[0.98] transition-all"
                  >
                    JSON
                  </a>
                </div>
              </div>

              {/* Acceptance Criteria Slice */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 flex items-center justify-between shadow-2xs hover:border-slate-300 transition-colors">
                <div>
                  <span className="font-semibold text-slate-900 block">Acceptance Criteria</span>
                  <span className="text-2xs text-slate-500">950 Given/When/Then verifiable statements</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyGranular("acceptance_criteria", "Acceptance Criteria")}
                    disabled={copyingEntity === "acceptance_criteria"}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200/80 text-2xs font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Copy className="h-3 w-3 text-slate-400" />
                    <span>{copyingEntity === "acceptance_criteria" ? "Copied" : "Copy"}</span>
                  </button>
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=acceptance_criteria&format=csv`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100/80 text-2xs font-mono font-medium text-slate-700 hover:bg-slate-200/80 active:scale-[0.98] transition-all"
                  >
                    CSV
                  </a>
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=acceptance_criteria&format=json`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100/80 text-2xs font-mono font-medium text-slate-700 hover:bg-slate-200/80 active:scale-[0.98] transition-all"
                  >
                    JSON
                  </a>
                </div>
              </div>

              {/* Test Cases Slice */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 flex items-center justify-between shadow-2xs hover:border-slate-300 transition-colors">
                <div>
                  <span className="font-semibold text-slate-900 block">Test Procedures & Steps</span>
                  <span className="text-2xs text-slate-500">All {testDesign.total_test_cases || 0} test cases with preconditions & steps</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyGranular("test_cases", "Test Cases")}
                    disabled={copyingEntity === "test_cases"}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200/80 text-2xs font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Copy className="h-3 w-3 text-slate-400" />
                    <span>{copyingEntity === "test_cases" ? "Copied" : "Copy"}</span>
                  </button>
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=test_cases&format=csv`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100/80 text-2xs font-mono font-medium text-slate-700 hover:bg-slate-200/80 active:scale-[0.98] transition-all"
                  >
                    CSV
                  </a>
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=test_cases&format=json`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100/80 text-2xs font-mono font-medium text-slate-700 hover:bg-slate-200/80 active:scale-[0.98] transition-all"
                  >
                    JSON
                  </a>
                </div>
              </div>

              {/* Full Traceability Matrix Slice */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 flex items-center justify-between shadow-2xs hover:border-slate-300 transition-colors">
                <div>
                  <span className="font-semibold text-slate-900 block">Traceability Matrix</span>
                  <span className="text-2xs text-slate-500">Document &rarr; Req &rarr; Criteria &rarr; Test &rarr; Defect mapping</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyGranular("traceability_matrix", "Traceability Matrix")}
                    disabled={copyingEntity === "traceability_matrix"}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200/80 text-2xs font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Copy className="h-3 w-3 text-slate-400" />
                    <span>{copyingEntity === "traceability_matrix" ? "Copied" : "Copy"}</span>
                  </button>
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=traceability_matrix&format=csv`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100/80 text-2xs font-mono font-medium text-slate-700 hover:bg-slate-200/80 active:scale-[0.98] transition-all"
                  >
                    CSV
                  </a>
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=traceability_matrix&format=xlsx`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100/80 text-2xs font-mono font-medium text-slate-700 hover:bg-slate-200/80 active:scale-[0.98] transition-all"
                  >
                    XLSX
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Subsection 3: Integration Readiness Matrix */}
          <div className="space-y-3 pt-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              3. Downstream Tool Integration Readiness
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
              {/* GitHub */}
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/30 p-4 space-y-2 hover:border-emerald-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5 text-emerald-600" />
                    <span>GitHub</span>
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-3xs font-semibold text-emerald-800">
                    CONNECTED
                  </span>
                </div>
                <p className="text-2xs text-slate-600 leading-relaxed">Export generated test procedures directly as Git commits.</p>
                <Link
                  to={`/settings?tab=integrations`}
                  className="inline-flex items-center gap-1 text-3xs font-semibold text-emerald-800 hover:underline pt-1 block"
                >
                  <span>Manage Integration</span>
                  <ArrowRight className="h-2.5 w-2.5" />
                </Link>
              </div>

              {/* Jira */}
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 space-y-2 hover:border-slate-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">Jira Software</span>
                  <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-3xs font-semibold text-slate-600">
                    READY FOR SYNC
                  </span>
                </div>
                <p className="text-2xs text-slate-500 leading-relaxed">Available export path: Issue & test case sync via REST API.</p>
                <span className="text-3xs text-slate-400 block pt-1 font-mono">Connector Ready</span>
              </div>

              {/* Azure DevOps */}
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 space-y-2 hover:border-slate-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">Azure DevOps</span>
                  <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-3xs font-semibold text-slate-600">
                    READY FOR SYNC
                  </span>
                </div>
                <p className="text-2xs text-slate-500 leading-relaxed">Available export path: Azure Test Plans & Work Items.</p>
                <span className="text-3xs text-slate-400 block pt-1 font-mono">Connector Ready</span>
              </div>

              {/* CI/CD Gate */}
              <div className="rounded-2xl border border-blue-200/70 bg-blue-50/30 p-4 space-y-2 hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">CI/CD Gate</span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-3xs font-semibold text-blue-800">
                    SCHEMA V2.0 READY
                  </span>
                </div>
                <p className="text-2xs text-slate-600 leading-relaxed">Automated release decision evaluation in CI pipelines.</p>
                <span className="text-3xs text-blue-700 font-semibold block pt-1 font-mono">CLI & Webhook Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
