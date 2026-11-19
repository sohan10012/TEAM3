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
    deliverableScope: "475 Requirements & Linked Acceptance Criteria",
  },
  qa: {
    title: "QA Test Pack & Verification Dossier",
    targetTeam: "Manual QA & Quality Analysts",
    description:
      "Structured test procedures, positive/negative/boundary scenario breakdown, preconditions, input values, and uncovered requirements gaps.",
    icon: CheckCircle2,
    primaryFormats: ["XLSX", "Markdown", "CSV"],
    deliverableScope: "Synthesized Test Cases & Coverage Matrix",
  },
  automation_agent: {
    title: "Autonomous AI Testing Agent Pack",
    targetTeam: "Automation Engineers & AI Tools (Cursor, Claude Code, Playwright)",
    description:
      "Machine-readable, self-contained prompt dossier with strict fact-vs-assumption demarcation and 6-step testing execution instructions.",
    icon: Cpu,
    primaryFormats: ["JSON Schema v2.0", "Agent Markdown Prompt"],
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

  // Primary 7 Navigation Sections
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
      <div className="py-16 text-center max-w-md mx-auto">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1D63ED] mb-3">
          <BookOpen className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-slate-900">Select a Project Workspace</h2>
        <p className="mt-1 text-xs text-slate-500">
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
      <div className="space-y-4">
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

  return (
    <div className="space-y-6 pb-16 print:p-0 print:space-y-4">
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

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-2xs font-semibold text-indigo-700 border border-indigo-100">
              Enterprise Engineering Handoff
            </span>
            <span className="text-2xs text-slate-400">|</span>
            <span className="text-2xs font-mono font-medium text-slate-600">
              {rep.project_key} ({rep.project_name})
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
            <span>Project Intelligence Report</span>
            <span className="text-xs font-normal text-slate-500 hidden sm:inline">
              — Role-Specific Deliverables & Traceable Quality Dossier
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Domain: <strong className="text-slate-700">{rep.domain || "Developer Tools & Infrastructure"}</strong> | Evaluated:{" "}
            {fmtDate(rep.generated_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => regenM.mutate()}
            disabled={regenM.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-transform disabled:opacity-50 cursor-pointer"
            title="Recalculate all project assessment metrics"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", regenM.isPending && "animate-spin")} />
            <span>{regenM.isPending ? "Evaluating..." : "Regenerate"}</span>
          </button>

          <a
            href={`/api/v1/projects/${projectId}/intelligence-report/complete-package?format=xlsx`}
            download={`${rep.project_key}_Engineering_Workbook.xlsx`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-colors"
            title="Download multi-sheet Excel engineering workbook"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Excel Workbook</span>
          </a>

          <a
            href={`/api/v1/projects/${projectId}/intelligence-report/complete-package?format=json`}
            download={`${rep.project_key}_Complete_Package_v2.json`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            title="Download versioned JSON complete package (Schema v2.0)"
          >
            <FileCode className="h-3.5 w-3.5 text-slate-500" />
            <span>JSON Package</span>
          </a>

          <a
            href={`/api/v1/projects/${projectId}/intelligence-report/export?format=html`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors cursor-pointer"
            title="Open standalone print-ready HTML dossier / PDF"
          >
            <Printer className="h-3.5 w-3.5 text-white" />
            <span>Print Dossier / PDF</span>
          </a>
        </div>
      </div>

      {/* TOP METRICS BANNER — Truthful, Grounded in Real SQLite Data */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs print-break-inside-avoid">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
          {/* 1. Readiness Score */}
          <div className="col-span-2 sm:col-span-1 border-r-0 lg:border-r border-slate-100 pr-2">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-[#1D63ED]">
                {rep.readiness_score}%
              </span>
              <span className="text-xs font-semibold text-slate-400">/ 100</span>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mt-1">
              Readiness Score
            </span>
            <span className="text-2xs text-slate-500 block">
              Evidence-Weighted Quality Gate
            </span>
          </div>

          {/* 2. Active Requirements */}
          <div className="border-r-0 sm:border-r border-slate-100 pr-2">
            <div className="text-2xl font-bold text-slate-900">
              {reqAnalysis.total || 0}
            </div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-700 block mt-0.5">
              Active Reqs
            </span>
            <span className="text-2xs text-slate-500 block">
              {reqAnalysis.quote_coverage_pct || 0}% Verbatim Grounded
            </span>
          </div>

          {/* 3. Acceptance Criteria */}
          <div className="border-r-0 lg:border-r border-slate-100 pr-2">
            <div className="text-2xl font-bold text-slate-900">
              {acData.total || 0}
            </div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-700 block mt-0.5">
              Criteria
            </span>
            <span className="text-2xs text-slate-500 block">
              {acData.pending || 0} Pending Review
            </span>
          </div>

          {/* 4. Synthesized Tests */}
          <div className="border-r-0 sm:border-r border-slate-100 pr-2">
            <div className="text-2xl font-bold text-slate-900">
              {testDesign.total_test_cases || 0}
            </div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-700 block mt-0.5">
              Synthesized Tests
            </span>
            <span className="text-2xs text-slate-500 block">
              {testDesign.pending || 0} Draft / Pending
            </span>
          </div>

          {/* 5. Execution Status */}
          <div className="border-r-0 lg:border-r border-slate-100 pr-2">
            <div className="text-2xl font-bold text-slate-900">
              {isUnexecuted ? "0 Runs" : execResults.pass_rate_display || "N/A"}
            </div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-700 block mt-0.5">
              Execution Status
            </span>
            <span className="text-2xs text-slate-500 block">
              {isUnexecuted ? "No Code Runs Recorded" : `${totalRuns} Runs Logged`}
            </span>
          </div>

          {/* 6. Release Gate Decision */}
          <div
            className={cn(
              "col-span-2 sm:col-span-1 rounded-xl p-3 border",
              isApproved
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                : "bg-rose-50/80 border-rose-200 text-rose-900"
            )}
          >
            <span className="text-2xs font-semibold uppercase tracking-wider block">
              Release Gate
            </span>
            <div className="mt-1 inline-flex items-center gap-1 font-bold text-xs">
              {isApproved ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>GO (APPROVED)</span>
                </>
              ) : (
                <>
                  <AlertOctagon className="h-3.5 w-3.5 text-rose-600" />
                  <span>NO-GO (BLOCKED)</span>
                </>
              )}
            </div>
            <span className="text-3xs block opacity-90 mt-0.5 truncate" title={gateSubtitle}>
              {gateSubtitle}
            </span>
          </div>
        </div>
      </div>

      {/* 7 PRIMARY SECTIONS TABS (Engineering Handoff Architecture) */}
      <div className="space-y-4">
        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto no-scrollbar no-print">
          {[
            { id: "overview", label: "1. Executive Overview" },
            { id: "deliverables", label: "2. Engineering Deliverables & Handoff Flow" },
            { id: "role_reports", label: "3. Role-Based Reports (6 Roles)" },
            { id: "evidence", label: `4. Test & Quality Evidence (${testDesign.total_test_cases || 0})` },
            { id: "traceability", label: `5. Traceability & Coverage (${traceability.coverage_pct || 0}%)` },
            { id: "release_gate", label: `6. Release Readiness (${displayStatus})` },
            { id: "export_centre", label: "7. Export Centre & Granular Slices" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as PrimarySection)}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer",
                activeSection === tab.id
                  ? "border-[#1D63ED] text-[#1D63ED] font-semibold"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* SECTION 1: EXECUTIVE OVERVIEW */}
        {/* ========================================================================= */}
        <div className={cn(activeSection !== "overview" && "hidden print:block", "space-y-6")}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 print-break-inside-avoid">
            {/* Executive Statement Callout */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
              <span className="text-2xs font-semibold text-blue-900 block mb-1">
                Executive Quality Assessment Statement
              </span>
              <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                {execSummary.headline}
              </p>
            </div>

            {/* 4 Ingestion & Discovery Narrative Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
                <span className="font-bold text-slate-900 block text-xs">1. What Was Analysed?</span>
                <p className="text-slate-600 leading-relaxed">{execSummary.what_was_analysed}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
                <span className="font-bold text-slate-900 block text-xs">2. What Did TraceTest Discover?</span>
                <p className="text-slate-600 leading-relaxed">{execSummary.what_was_discovered}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
                <span className="font-bold text-slate-900 block text-xs">3. What Is Verified & Working?</span>
                <p className="text-slate-600 leading-relaxed">{execSummary.what_is_working}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
                <span className="font-bold text-slate-900 block text-xs">4. Major Concerns & Deficiencies</span>
                <p className="text-slate-600 leading-relaxed">{execSummary.major_concerns}</p>
              </div>
            </div>

            {/* Critical Quality Gaps Table (Directly visible on Executive Overview) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Critical Quality Gaps & Remediation Effort
                </h3>
                <span className="text-2xs text-slate-400">{rep.critical_gaps?.length || 0} Gap(s)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-2xs uppercase">
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3">Gap Description</th>
                      <th className="py-2 px-3 w-24 text-center">Severity</th>
                      <th className="py-2 px-3 w-36">Estimated Effort</th>
                      <th className="py-2 px-3 w-36">Affected Area</th>
                      <th className="py-2 px-3 w-32 text-right">Target Screen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rep.critical_gaps?.map((g: any) => (
                      <tr key={g.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono text-center text-slate-400">{g.id}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{g.description}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-2xs font-bold uppercase border",
                              g.severity === "Critical"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : g.severity === "High"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            )}
                          >
                            {g.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-2xs">{g.effort}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-2xs">{g.affected_area}</td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            to={`${g.target_screen || "/requirements"}?project_id=${projectId}`}
                            className="inline-flex items-center gap-1 text-2xs font-semibold text-[#1D63ED] hover:underline"
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
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Ingested Source Documents & Extraction Provenance
                </h3>
                <span className="text-2xs text-slate-400">{rep.document_analysis?.length || 0} Document(s)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-2xs uppercase">
                      <th className="py-2 px-3">Document Name</th>
                      <th className="py-2 px-3">Purpose</th>
                      <th className="py-2 px-3 text-center">Format</th>
                      <th className="py-2 px-3 text-center">Pages</th>
                      <th className="py-2 px-3 text-center">Sections</th>
                      <th className="py-2 px-3 text-center">Extracted Reqs</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rep.document_analysis?.map((doc: any) => (
                      <tr key={doc.document_id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#1D63ED] shrink-0" />
                          <span className="truncate max-w-sm">{doc.filename}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{doc.purpose}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-2xs text-slate-500 uppercase">{doc.file_type}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{doc.page_count}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{doc.sections_identified}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-[#1D63ED]">{doc.requirements_extracted}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-800 border border-emerald-200">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#1D63ED]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Engineering Handoff Preparation Flow
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Follow this 4-step workflow to package TraceTest's specifications, criteria, and test scenarios for your engineering team or autonomous coding agents.
              </p>
            </div>

            {/* Workflow Step Tracker */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-1">
                <span className="font-mono text-2xs font-bold text-[#1D63ED]">STEP 1</span>
                <span className="font-semibold text-slate-900 block">Select Audience</span>
                <p className="text-slate-500 text-2xs">Choose the consumer team or automated agent.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                <span className="font-mono text-2xs font-bold text-slate-400">STEP 2</span>
                <span className="font-semibold text-slate-900 block">Review Contents</span>
                <p className="text-slate-500 text-2xs">Verify requirements, criteria, and test procedures.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                <span className="font-mono text-2xs font-bold text-slate-400">STEP 3</span>
                <span className="font-semibold text-slate-900 block">Configure Scope</span>
                <p className="text-slate-500 text-2xs">Toggle invariants, ambiguities, and advisory notes.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                <span className="font-mono text-2xs font-bold text-slate-400">STEP 4</span>
                <span className="font-semibold text-slate-900 block">Export & Copy</span>
                <p className="text-slate-500 text-2xs">1-Click download in Markdown, JSON, XLSX, or copy.</p>
              </div>
            </div>

            {/* Step 1: Audience Selector Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                1. Select Target Recipient / Role
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(Object.keys(ROLE_METADATA) as HandoffRole[]).map((roleKey) => {
                  const meta = ROLE_METADATA[roleKey];
                  const Icon = meta.icon;
                  const isSelected = handoffRole === roleKey;
                  return (
                    <button
                      key={roleKey}
                      onClick={() => setHandoffRole(roleKey)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-all cursor-pointer",
                        isSelected
                          ? "border-[#1D63ED] bg-blue-50/30 shadow-xs ring-1 ring-[#1D63ED]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={cn("p-2 rounded-lg", isSelected ? "bg-[#1D63ED] text-white" : "bg-slate-100 text-slate-600")}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-3xs uppercase font-bold text-slate-400">{meta.targetTeam}</span>
                      </div>
                      <span className="font-bold text-xs text-slate-900 block">{meta.title}</span>
                      <p className="text-2xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {meta.description}
                      </p>
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-3xs font-medium text-slate-400">
                        <span>{meta.deliverableScope}</span>
                        <span className="text-[#1D63ED] font-semibold">{meta.primaryFormats.join(" · ")}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2 & 3: Scope Customization & Content Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                  2. Included Scope & Persisted Counts
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Active Grounded Requirements</span>
                    <strong className="text-slate-900 font-mono">{reqAnalysis.total || 0}</strong>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Synthesized Acceptance Criteria</span>
                    <strong className="text-slate-900 font-mono">{acData.total || 0}</strong>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Behavioral Test Procedures</span>
                    <strong className="text-slate-900 font-mono">{testDesign.total_test_cases || 0}</strong>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Uncovered Requirements Gap</span>
                    <strong className="text-amber-700 font-mono">{traceability.uncovered_requirements || 0}</strong>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-600">Canonical Release Decision</span>
                    <strong className={cn("font-semibold text-2xs uppercase", isApproved ? "text-emerald-700" : "text-rose-700")}>
                      {displayStatus}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                  3. Section Customization Options
                </span>
                <div className="space-y-2.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeInvariants}
                      onChange={(e) => setIncludeInvariants(e.target.checked)}
                      className="rounded border-slate-300 text-[#1D63ED] focus:ring-[#1D63ED]"
                    />
                    <span>Include Contract Invariants & Statutory Constraints</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeAmbiguities}
                      onChange={(e) => setIncludeAmbiguities(e.target.checked)}
                      className="rounded border-slate-300 text-[#1D63ED] focus:ring-[#1D63ED]"
                    />
                    <span>Include Unresolved Ambiguities & Clarification Questions</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeUncovered}
                      onChange={(e) => setIncludeUncovered(e.target.checked)}
                      className="rounded border-slate-300 text-[#1D63ED] focus:ring-[#1D63ED]"
                    />
                    <span>Include Gap Ledger (Uncovered Requirements & Unverified Tests)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeNotes}
                      onChange={(e) => setIncludeNotes(e.target.checked)}
                      className="rounded border-slate-300 text-[#1D63ED] focus:ring-[#1D63ED]"
                    />
                    <span>Include Advisory Implementation Notes (Explicitly Tagged)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Step 4: Export & Copy Actions for Selected Audience */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-2xs font-semibold text-blue-900 uppercase tracking-wider block">
                  Step 4: Package Ready for Export
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                  {ROLE_METADATA[handoffRole].title}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Download or copy complete, portable deliverables tailored for {ROLE_METADATA[handoffRole].targetTeam}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleCopyRoleMarkdown(handoffRole, ROLE_METADATA[handoffRole].title)}
                  disabled={copyingEntity === `role_${handoffRole}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span>{copyingEntity === `role_${handoffRole}` ? "Copied!" : "Copy Full Pack"}</span>
                </button>

                <a
                  href={`/api/v1/projects/${projectId}/intelligence-report/handoff/${handoffRole}?format=markdown`}
                  download={`${rep.project_key}_${handoffRole}_handoff.md`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <FileDown className="h-3.5 w-3.5 text-white" />
                  <span>Download Markdown</span>
                </a>

                <a
                  href={`/api/v1/projects/${projectId}/intelligence-report/handoff/${handoffRole}?format=json`}
                  download={`${rep.project_key}_${handoffRole}_handoff.json`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
                >
                  <FileCode className="h-3.5 w-3.5 text-white" />
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Role-Specific Deliverables Viewer
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspect authentic, role-tailored report data live in the console before distributing to downstream teams.
                </p>
              </div>

              {/* Sub-Tabs for Roles */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(Object.keys(ROLE_METADATA) as HandoffRole[]).map((rKey) => (
                  <button
                    key={rKey}
                    onClick={() => setSelectedRoleView(rKey)}
                    className={cn(
                      "px-2.5 py-1 text-2xs font-semibold rounded-lg transition-colors cursor-pointer capitalize",
                      selectedRoleView === rKey
                        ? "bg-white text-slate-900 shadow-2xs"
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
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{roleHandoffQ.data.title}</h4>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      Target Audience: <strong>{ROLE_METADATA[selectedRoleView].targetTeam}</strong> | Generated:{" "}
                      {fmtDate(roleHandoffQ.data.generated_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/v1/projects/${projectId}/intelligence-report/handoff/${selectedRoleView}?format=markdown`}
                      download={`${rep.project_key}_${selectedRoleView}.md`}
                      className="inline-flex items-center gap-1 text-2xs font-semibold text-[#1D63ED] hover:underline"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download .md</span>
                    </a>
                  </div>
                </div>

                {/* Developer Specific Preview */}
                {selectedRoleView === "developer" && (
                  <div className="space-y-3">
                    <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                      <strong>Business Objective:</strong> {roleHandoffQ.data.business_objective}
                    </div>
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-semibold text-2xs uppercase sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Req Key</th>
                            <th className="py-2 px-3">Title</th>
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3">Source Clause</th>
                            <th className="py-2 px-3 text-center">Linked ACs</th>
                            <th className="py-2 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {roleHandoffQ.data.requirements?.slice(0, 30).map((r: any) => (
                            <tr key={r.requirement_id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-[#1D63ED]">{r.key}</td>
                              <td className="py-2 px-3 font-medium text-slate-900 truncate max-w-xs">{r.title}</td>
                              <td className="py-2 px-3 text-2xs font-mono text-slate-500">{r.category}</td>
                              <td className="py-2 px-3 text-2xs text-slate-600">{r.source_document} (p. {r.document_page || 1})</td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                                {r.acceptance_criteria?.length || 0}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-3xs font-semibold text-slate-700">
                                  {r.review_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* QA Specific Preview */}
                {selectedRoleView === "qa" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                        <span className="text-lg font-bold text-slate-900">{roleHandoffQ.data.total_test_cases}</span>
                        <span className="block text-3xs uppercase font-medium text-slate-500 mt-1">Total Tests</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                        <span className="text-lg font-bold text-emerald-700">{roleHandoffQ.data.coverage_metrics?.covered_requirements}</span>
                        <span className="block text-3xs uppercase font-medium text-slate-500 mt-1">Covered Reqs</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                        <span className="text-lg font-bold text-amber-700">{roleHandoffQ.data.coverage_metrics?.uncovered_requirements}</span>
                        <span className="block text-3xs uppercase font-medium text-slate-500 mt-1">Uncovered Reqs</span>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                        <span className="text-lg font-bold text-blue-700">{roleHandoffQ.data.coverage_metrics?.positive_scenarios}</span>
                        <span className="block text-3xs uppercase font-medium text-slate-500 mt-1">Positive Paths</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-semibold text-2xs uppercase sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Test Key</th>
                            <th className="py-2 px-3">Parent Req</th>
                            <th className="py-2 px-3">Title</th>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3 text-center">Steps</th>
                            <th className="py-2 px-3 text-center">Exec Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {roleHandoffQ.data.test_cases?.map((t: any) => (
                            <tr key={t.test_id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-[#1D63ED]">{t.key}</td>
                              <td className="py-2 px-3 font-mono text-2xs text-slate-500">{t.parent_requirement_key}</td>
                              <td className="py-2 px-3 font-medium text-slate-900 truncate max-w-xs">{t.title}</td>
                              <td className="py-2 px-3 text-2xs font-mono text-slate-500">{t.type}</td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">{t.steps?.length || 0}</td>
                              <td className="py-2 px-3 text-center">
                                <span className="rounded bg-amber-50 px-2 py-0.5 text-3xs font-semibold text-amber-800 border border-amber-200">
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
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-900">
                      <strong>AI Agent Disclaimer:</strong> {roleHandoffQ.data.execution_disclaimer}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-4 font-mono text-xs space-y-2 overflow-x-auto max-h-80">
                      <span className="text-emerald-400 block font-bold">// Machine-Readable Agent Prompt Instruction Sample</span>
                      <pre className="text-2xs leading-relaxed text-slate-300">
                        {JSON.stringify(roleHandoffQ.data.agent_instructions, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Integration Specific Preview */}
                {selectedRoleView === "integration" && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <strong>Identified Actors & Boundaries:</strong> {roleHandoffQ.data.actors_and_systems?.length || 0} Actors Documented
                    </div>
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-semibold text-2xs uppercase">
                          <tr>
                            <th className="py-2 px-3">Actor / System</th>
                            <th className="py-2 px-3">Role Type</th>
                            <th className="py-2 px-3">Description</th>
                            <th className="py-2 px-3">Permissions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {roleHandoffQ.data.actors_and_systems?.map((a: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-semibold text-slate-900">{a.actor_name}</td>
                              <td className="py-2 px-3 font-mono text-2xs text-slate-500">{a.role_type}</td>
                              <td className="py-2 px-3 text-slate-600">{a.description}</td>
                              <td className="py-2 px-3 font-mono text-2xs text-[#1D63ED]">{a.permissions?.join(", ") || "Standard"}</td>
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
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <strong>Mission Statement:</strong> {roleHandoffQ.data.business_objective}
                    </div>
                    <div className="space-y-2">
                      <span className="text-2xs font-bold uppercase tracking-wider text-slate-700 block">Documented Business Scenarios:</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {roleHandoffQ.data.business_scenarios?.map((s: any) => (
                          <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 text-xs">
                            <span className="font-bold text-slate-900 block">{s.name}</span>
                            <p className="text-slate-600 text-2xs">{s.description}</p>
                            <span className="text-3xs text-slate-400 block pt-1">Trigger: {s.trigger_event}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Executive Specific Preview */}
                {selectedRoleView === "executive" && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
                      <div>
                        <span className="text-2xs font-bold uppercase text-slate-500">Readiness Score</span>
                        <div className="text-3xl font-black text-[#1D63ED]">{roleHandoffQ.data.readiness_score}%</div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xs font-bold uppercase text-slate-500">Gate Decision</span>
                        <div className="text-sm font-bold text-rose-700">{roleHandoffQ.data.gate_display}</div>
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#1D63ED]" />
                Test Design & Behavioral Verification Evidence
              </h3>
              <p className="text-2xs text-slate-500 mt-0.5">
                Distribution across test suites, automated assertions, execution status, and defect governance.
              </p>
            </div>

            {/* Test Suite Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xl font-bold text-slate-900">{testDesign.total_test_cases || 0}</span>
                <span className="block text-2xs text-slate-500 uppercase mt-0.5">Total Test Cases</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xl font-bold text-emerald-700">{testDesign.approved || 0}</span>
                <span className="block text-2xs text-slate-500 uppercase mt-0.5">Approved</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xl font-bold text-amber-700">{testDesign.pending || 0}</span>
                <span className="block text-2xs text-slate-500 uppercase mt-0.5">Pending Review</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xl font-bold text-blue-700">{testDesign.automated || 0}</span>
                <span className="block text-2xs text-slate-500 uppercase mt-0.5">Automated Checks</span>
              </div>
            </div>

            {/* Executions Segregation Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 uppercase text-2xs tracking-wider">
                  Physical Execution Runs vs Simulated Sandbox
                </span>
                <span className="font-mono text-2xs text-slate-500">
                  {totalRuns} Total Run(s) Recorded
                </span>
              </div>
              {isUnexecuted ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800 text-xs">
                  <strong>Notice:</strong> No physical code executions have been logged for this project. Pass rate is truthfully reported as <strong>N/A</strong>. Test suites are in draft/pending review status.
                </div>
              ) : (
                <div className="text-slate-600">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-[#1D63ED]" />
                  End-to-End Requirement Traceability Lineage
                </h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Specification Document &rarr; Clause &rarr; Requirement &rarr; Criteria &rarr; Test Case &rarr; Execution &rarr; Defect.
                </p>
              </div>
              <Link
                to={`/traceability?project_id=${projectId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D63ED] hover:underline"
              >
                <span>Interactive Matrix Explorer</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Traceability Flow Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-lg font-bold text-slate-900">{traceability.total_documents || 0}</span>
                <span className="block text-3xs uppercase font-medium text-slate-500 mt-1">1. Documents</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-lg font-bold text-slate-900">{traceability.total_requirements || 0}</span>
                <span className="block text-3xs uppercase font-medium text-slate-500 mt-1">2. Requirements</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-lg font-bold text-slate-900">{traceability.total_clauses || 0}</span>
                <span className="block text-3xs uppercase font-medium text-slate-500 mt-1">3. Clauses</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-lg font-bold text-slate-900">{traceability.total_acceptance_criteria || 0}</span>
                <span className="block text-3xs uppercase font-medium text-slate-500 mt-1">4. Criteria</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-lg font-bold text-slate-900">{traceability.total_test_cases || 0}</span>
                <span className="block text-3xs uppercase font-medium text-slate-500 mt-1">5. Tests</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-lg font-bold text-slate-900">{traceability.total_executions || 0}</span>
                <span className="block text-3xs uppercase font-medium text-slate-500 mt-1">6. Executions</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-lg font-bold text-slate-900">{traceability.total_defects || 0}</span>
                <span className="block text-3xs uppercase font-medium text-slate-500 mt-1">7. Defects</span>
              </div>
            </div>

            {/* Coverage Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <span className="text-2xl font-black text-emerald-700">
                  {traceability.covered_requirements || 0} / {traceability.total_requirements || 0}
                </span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-emerald-800 mt-1">
                  Covered Requirements ({traceability.coverage_pct || 0}%)
                </span>
                <span className="text-3xs text-emerald-600 block mt-0.5">
                  Have at least one associated test case
                </span>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <span className="text-2xl font-black text-amber-700">
                  {traceability.uncovered_requirements || 0}
                </span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-amber-800 mt-1">
                  Uncovered Requirements Gap
                </span>
                <span className="text-3xs text-amber-600 block mt-0.5">
                  Require test case generation
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-2xl font-black text-slate-700">
                  {traceability.verified_requirements || 0}
                </span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-slate-700 mt-1">
                  Verified Requirements
                </span>
                <span className="text-3xs text-slate-500 block mt-0.5">
                  Passing sandbox execution confirmed
                </span>
              </div>
            </div>

            {/* Searchable Requirements & Traceability Ledger */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Searchable Requirement Traceability Ledger ({filteredReqs.length} Matches)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search requirements..."
                      value={reqSearch}
                      onChange={(e) => setReqSearch(e.target.value)}
                      className="h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#1D63ED] w-48 sm:w-60"
                    />
                  </div>
                  <select
                    value={reqCategoryFilter}
                    onChange={(e) => setReqCategoryFilter(e.target.value)}
                    className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#1D63ED]"
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

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold text-2xs uppercase sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Req Key</th>
                      <th className="py-2 px-3">Title</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Source Location</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReqs.slice(0, 50).map((r: any) => (
                      <tr key={r.id || r.key} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold text-[#1D63ED]">{r.key}</td>
                        <td className="py-2 px-3 font-medium text-slate-900 truncate max-w-xs">{r.title}</td>
                        <td className="py-2 px-3 text-2xs font-mono text-slate-500">{r.category}</td>
                        <td className="py-2 px-3 text-2xs text-slate-600">{r.source_location || "Section 1.0"}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-3xs font-semibold text-slate-700">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#1D63ED]" />
                  Authoritative Release Gate Decision
                </h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Evaluated by canonical release decision engine across 5 formal evidence categories.
                </p>
              </div>

              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 border font-bold text-xs",
                  isApproved
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-2xs uppercase">
                    <th className="py-2.5 px-3">Evaluation Area</th>
                    <th className="py-2.5 px-3 text-center">Score</th>
                    <th className="py-2.5 px-3 text-center">Category Weight</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Grounded Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rep.metrics_by_area?.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-slate-900">{row.area}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-[#1D63ED]">{row.score}%</td>
                      <td className="py-3 px-3 text-center text-slate-500 text-2xs font-mono">
                        {idx === 0 ? "30%" : idx === 1 ? "25%" : idx === 2 ? "20%" : idx === 3 ? "20%" : "5%"}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-2xs font-semibold border",
                            row.status === "Complete"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          )}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-2xs">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Blocking Reasons Callout */}
            {reasons.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-2">
                <span className="text-xs font-bold text-rose-900 block flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  Release Gate Blocking Reasons:
                </span>
                <ul className="space-y-1 text-xs text-rose-800 list-disc list-inside">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Download className="h-4 w-4 text-[#1D63ED]" />
                Complete Project Export & Integration Centre
              </h3>
              <p className="text-2xs text-slate-500 mt-0.5">
                Download standardized packages or copy full datasets for downstream developer, QA, and CI/CD pipelines.
              </p>
            </div>

            {/* Subsection 1: Full Project Packages */}
            <div className="space-y-3">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-700 block">
                1. Complete Project Packages (Multi-Format)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      <span>Excel Engineering Workbook</span>
                    </div>
                    <p className="text-2xs text-slate-500 mt-1">
                      Multi-sheet .xlsx workbook containing Executive Summary, Requirements, Criteria, Tests, Traceability, and Gaps.
                    </p>
                  </div>
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/complete-package?format=xlsx`}
                    download={`${rep.project_key}_Engineering_Workbook.xlsx`}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-white" />
                    <span>Download .xlsx</span>
                  </a>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                      <FileCode className="h-4 w-4 text-blue-600" />
                      <span>Schema v2.0 JSON Package</span>
                    </div>
                    <p className="text-2xs text-slate-500 mt-1">
                      Versioned, machine-readable JSON package with preserved IDs, relationships, and no secrets.
                    </p>
                  </div>
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/complete-package?format=json`}
                    download={`${rep.project_key}_Complete_Package_v2.json`}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-600" />
                    <span>Download .json</span>
                  </a>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                      <Printer className="h-4 w-4 text-slate-800" />
                      <span>Print Dossier / PDF</span>
                    </div>
                    <p className="text-2xs text-slate-500 mt-1">
                      Executive standalone HTML document formatted with print styles for instant browser PDF export.
                    </p>
                  </div>
                  <a
                    href={`/api/v1/projects/${projectId}/intelligence-report/export?format=html`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    <Printer className="h-3.5 w-3.5 text-white" />
                    <span>Open Print Dossier</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Subsection 2: Granular Data Slices & 1-Click Copy */}
            <div className="space-y-3 pt-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-700 block">
                2. Granular Slices & 1-Click Clipboard Actions (Full Datasets)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Requirements Slice */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">Requirements Register</span>
                    <span className="text-2xs text-slate-500">All {reqAnalysis.total || 0} active requirements with quotes & metadata</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyGranular("requirements", "Requirements")}
                      disabled={copyingEntity === "requirements"}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-2xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                      <span>{copyingEntity === "requirements" ? "Copied" : "Copy"}</span>
                    </button>
                    <a
                      href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=requirements&format=csv`}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-2xs font-mono font-medium hover:bg-slate-200"
                    >
                      CSV
                    </a>
                    <a
                      href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=requirements&format=json`}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-2xs font-mono font-medium hover:bg-slate-200"
                    >
                      JSON
                    </a>
                  </div>
                </div>

                {/* Acceptance Criteria Slice */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">Acceptance Criteria Ledger</span>
                    <span className="text-2xs text-slate-500">All {acData.total || 0} criteria with Given/When/Then scenarios</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyGranular("acceptance_criteria", "Acceptance Criteria")}
                      disabled={copyingEntity === "acceptance_criteria"}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-2xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                      <span>{copyingEntity === "acceptance_criteria" ? "Copied" : "Copy"}</span>
                    </button>
                    <a
                      href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=acceptance_criteria&format=csv`}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-2xs font-mono font-medium hover:bg-slate-200"
                    >
                      CSV
                    </a>
                    <a
                      href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=acceptance_criteria&format=json`}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-2xs font-mono font-medium hover:bg-slate-200"
                    >
                      JSON
                    </a>
                  </div>
                </div>

                {/* Test Cases Slice */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">Test Procedures & Steps</span>
                    <span className="text-2xs text-slate-500">All {testDesign.total_test_cases || 0} test cases with preconditions & steps</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyGranular("test_cases", "Test Cases")}
                      disabled={copyingEntity === "test_cases"}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-2xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                      <span>{copyingEntity === "test_cases" ? "Copied" : "Copy"}</span>
                    </button>
                    <a
                      href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=test_cases&format=csv`}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-2xs font-mono font-medium hover:bg-slate-200"
                    >
                      CSV
                    </a>
                    <a
                      href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=test_cases&format=json`}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-2xs font-mono font-medium hover:bg-slate-200"
                    >
                      JSON
                    </a>
                  </div>
                </div>

                {/* Full Traceability Matrix Slice */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">Traceability Matrix</span>
                    <span className="text-2xs text-slate-500">Document &rarr; Req &rarr; Criteria &rarr; Test &rarr; Defect mapping</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyGranular("traceability_matrix", "Traceability Matrix")}
                      disabled={copyingEntity === "traceability_matrix"}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-2xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                      <span>{copyingEntity === "traceability_matrix" ? "Copied" : "Copy"}</span>
                    </button>
                    <a
                      href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=traceability_matrix&format=csv`}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-2xs font-mono font-medium hover:bg-slate-200"
                    >
                      CSV
                    </a>
                    <a
                      href={`/api/v1/projects/${projectId}/intelligence-report/granular-export?entity=traceability_matrix&format=xlsx`}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-2xs font-mono font-medium hover:bg-slate-200"
                    >
                      XLSX
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Subsection 3: Integration Readiness Matrix */}
            <div className="space-y-3 pt-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-700 block">
                3. Downstream Tool Integration Readiness
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* GitHub */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5 text-emerald-600" />
                      <span>GitHub</span>
                    </span>
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-3xs font-semibold text-emerald-800">
                      CONNECTED
                    </span>
                  </div>
                  <p className="text-2xs text-slate-600">Export generated test procedures directly as Git commits.</p>
                  <Link
                    to={`/settings?tab=integrations`}
                    className="inline-flex items-center gap-1 text-3xs font-semibold text-emerald-800 hover:underline pt-1 block"
                  >
                    <span>Manage Integration</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                  </Link>
                </div>

                {/* Jira */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Jira Software</span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-3xs font-semibold text-slate-600">
                      READY FOR SYNC
                    </span>
                  </div>
                  <p className="text-2xs text-slate-500">Available export path: Issue & test case sync via REST API.</p>
                  <span className="text-3xs text-slate-400 block pt-1">Connector Ready</span>
                </div>

                {/* Azure DevOps */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Azure DevOps</span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-3xs font-semibold text-slate-600">
                      READY FOR SYNC
                    </span>
                  </div>
                  <p className="text-2xs text-slate-500">Available export path: Azure Test Plans & Work Items.</p>
                  <span className="text-3xs text-slate-400 block pt-1">Connector Ready</span>
                </div>

                {/* CI/CD Gate */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">CI/CD Gate</span>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-3xs font-semibold text-blue-800">
                      SCHEMA V2.0 READY
                    </span>
                  </div>
                  <p className="text-2xs text-slate-600">Automated release decision evaluation in CI pipelines.</p>
                  <span className="text-3xs text-blue-700 font-semibold block pt-1">CLI & Webhook Available</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
