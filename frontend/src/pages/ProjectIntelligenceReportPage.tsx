import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileCode,
  FileDown,
  FileText,
  Layers,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
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

const TEST_CATEGORY_DESCRIPTIONS: Record<string, { label: string; desc: string; focus: string }> = {
  positive: {
    label: "Positive / Nominal Path",
    desc: "Valid business transactions, standard workflows, and baseline compliance.",
    focus: "Happy path verification",
  },
  negative: {
    label: "Negative & Invalidation",
    desc: "Invalid parameters, malformed payloads, out-of-range inputs, and rejection handling.",
    focus: "Rejection & state retention",
  },
  boundary_value: {
    label: "Boundary Value Analysis",
    desc: "Threshold edges, upper/lower bounds, rate limits, and boundary transition conditions.",
    focus: "Threshold accuracy",
  },
  edge_case: {
    label: "Edge Cases & Anomalies",
    desc: "Corner conditions, leap years, concurrent operations, and temporal crossing boundaries.",
    focus: "Extreme condition resilience",
  },
  input_validation: {
    label: "Input Validation & Sanitization",
    desc: "Field types, lengths, character limits, formatting, and JSON/API schema constraints.",
    focus: "Schema compliance",
  },
  business_rule: {
    label: "Business Rules & Statutory Logic",
    desc: "Statutory formulas, regulatory logic, algorithmic policies, and invariant enforcement.",
    focus: "Regulatory algorithm fidelity",
  },
  permission_role: {
    label: "Role-Based Access & Security",
    desc: "Access authorization, unauthorized execution attempts, and dual-control sign-offs.",
    focus: "RBAC enforcement & dual control",
  },
  security: {
    label: "Security & Anti-Tampering",
    desc: "Privilege escalation, token forgery defense, injection defense, and cryptographic integrity.",
    focus: "Data confidentiality & integrity",
  },
  error_handling: {
    label: "Error Handling & Recovery",
    desc: "Graceful degradation, transaction rollbacks, fault isolation, and descriptive errors.",
    focus: "Resilience & atomicity",
  },
  integration: {
    label: "Integration & Handoffs",
    desc: "Third-party interfaces, upstream/downstream handoffs, external APIs, and database sync.",
    focus: "Cross-system interoperability",
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

  const [activeTab, setActiveTab] = useState<
    | "executive"
    | "spec_intelligence"
    | "requirement_quality"
    | "test_design"
    | "executions"
    | "traceability"
    | "release_readiness"
    | "recommendations"
  >("executive");

  const [reqCategoryFilter, setReqCategoryFilter] = useState<string>("ALL");
  const [reqSearch, setReqSearch] = useState("");

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

  const regenM = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/intelligence-report/regenerate`),
    onSuccess: () => {
      reportQ.refetch();
      defectsQ.refetch();
      toast.ok("Project Intelligence Report regenerated with latest persistent records.");
    },
    onError: (err: any) => toast.error(err?.message || "Regeneration failed"),
  });

  const rep = reportQ.data;
  const defectsList: any[] = defectsQ.data?.items || [];

  // Filter requirements in Tab 3
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

  if (!projectId) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1D63ED] mb-3">
          <BookOpen className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-slate-900">Select a Project Workspace</h2>
        <p className="mt-1 text-xs text-slate-500">
          The Project Intelligence Report provides consolidated assessment metrics for a specific project. Please select a project from the top workspace selector.
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
  const displayStatus: string = relDec.display_status || (releaseStatus === "approved_for_production" ? "Approved for Production" : "Insufficient Evidence");
  const isApproved: boolean = Boolean(relDec.is_approved);
  const reasons: string[] = relDec.reasons || [];
  const blockingDefects: any[] = relDec.blocking_defects || [];
  const openDefectsCount = defectsList.filter((d) => d.status !== "closed" && d.status !== "verified").length;

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
              Executive Quality & Release Intelligence
            </span>
            <span className="text-2xs text-slate-400">|</span>
            <span className="text-2xs text-slate-500">
              Last synchronized: {rep.generated_at ? fmtDate(rep.generated_at) : "Current"}
            </span>
            <span className="text-2xs text-slate-400">|</span>
            <span className="text-2xs font-mono text-slate-500">Hash: {rep.version_hash}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">
            {rep.project_name} — Quality Intelligence Report
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Primary Domain: <span className="font-medium text-slate-700">{rep.business_domain}</span> · Project Key:{" "}
            <span className="font-mono font-semibold text-[#1D63ED]">{rep.project_key}</span> (ID: {rep.project_id})
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
            <span>{regenM.isPending ? "Analysing..." : "Regenerate"}</span>
          </button>

          <a
            href={`/api/v1/projects/${projectId}/intelligence-report/export?format=markdown`}
            download={`${rep.project_key}_Intelligence_Report.md`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            title="Download complete 11-section markdown report"
          >
            <FileDown className="h-3.5 w-3.5 text-slate-500" />
            <span>Markdown</span>
          </a>

          <a
            href={`/api/v1/projects/${projectId}/intelligence-report/export?format=json`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            title="Download structured JSON report data"
          >
            <FileCode className="h-3.5 w-3.5 text-slate-500" />
            <span>JSON</span>
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

      {/* TOP METRICS BANNER — Truthful, Grounded in Real Data */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs print-break-inside-avoid">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
          {/* 1. Readiness Score */}
          <div className="col-span-2 sm:col-span-1 border-r-0 lg:border-r border-slate-100 pr-2">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-[#1D63ED]">
                {rep.readiness_score}%
              </span>
            </div>
            <span className="mt-1 block text-2xs font-bold uppercase tracking-wider text-slate-400">
              Readiness Score
            </span>
          </div>

          {/* 2. Total Requirements */}
          <div className="border-r-0 lg:border-r border-slate-100 pr-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {reqAnalysis.total || 0}
            </span>
            <span className="mt-1 block text-2xs font-semibold uppercase tracking-wider text-slate-400">
              Active Reqs ({traceability.total_clauses || 0} clauses)
            </span>
          </div>

          {/* 3. Acceptance Criteria */}
          <div className="border-r-0 lg:border-r border-slate-100 pr-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-700">
              {acData.total || 0}
            </span>
            <span className="mt-1 block text-2xs font-semibold uppercase tracking-wider text-slate-400">
              ACs ({acData.approved || 0} approved)
            </span>
          </div>

          {/* 4. Test Scenarios */}
          <div className="border-r-0 lg:border-r border-slate-100 pr-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-800">
              {testDesign.total_test_cases || 0}
            </span>
            <span className="mt-1 block text-2xs font-semibold uppercase tracking-wider text-slate-400">
              Tests ({testDesign.approved || 0} approved)
            </span>
          </div>

          {/* 5. Executions & Pass Rate */}
          <div className="border-r-0 lg:border-r border-slate-100 pr-2">
            <span
              className={cn(
                "text-2xl sm:text-3xl font-extrabold",
                isUnexecuted ? "text-slate-400 text-xl sm:text-2xl" : "text-emerald-600"
              )}
            >
              {isUnexecuted ? "0 Runs" : execResults.pass_rate_display}
            </span>
            <span className="mt-1 block text-2xs font-semibold uppercase tracking-wider text-slate-400">
              {isUnexecuted ? "Awaiting Execution" : `${execResults.passed_tests_count || 0} Tests Verified`}
            </span>
          </div>

          {/* 6. Release Gate Decision Pill */}
          <div
            className={cn(
              "rounded-xl border p-3 text-center",
              isApproved
                ? "border-emerald-300 bg-emerald-50/70 text-emerald-900"
                : releaseStatus === "not_approved"
                ? "border-rose-300 bg-rose-50/70 text-rose-900"
                : "border-amber-300 bg-amber-50/70 text-amber-900"
            )}
          >
            <span className="text-2xs font-semibold uppercase tracking-wider block">
              Release Gate
            </span>
            <div className="mt-1 inline-flex items-center gap-1 font-bold text-xs">
              {isApproved ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700">GO FOR RELEASE</span>
                </>
              ) : releaseStatus === "not_approved" ? (
                <>
                  <AlertOctagon className="h-3.5 w-3.5 text-rose-600" />
                  <span className="text-rose-700">NO-GO (NOT APPROVED)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-amber-800">INSUFFICIENT EVIDENCE</span>
                </>
              )}
            </div>
            <span className="mt-0.5 block text-3xs font-mono text-slate-600 font-medium">
              {gateSubtitle}
            </span>
          </div>
        </div>
      </div>

      {/* 8 STRUCTURED SECTION TABS (Matching User Requirements) */}
      <div className="space-y-4">
        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto no-scrollbar no-print">
          {[
            { id: "executive", label: "A. Executive Summary" },
            { id: "spec_intelligence", label: "B. Specification Intelligence" },
            { id: "requirement_quality", label: `C. Requirement Quality (${reqAnalysis.total || 0})` },
            { id: "test_design", label: `D. Test Design (${testDesign.total_test_cases || 0})` },
            { id: "executions", label: `E. Execution & Simulation (${totalRuns})` },
            { id: "traceability", label: `F. Traceability (${traceability.coverage_pct || 0}%)` },
            { id: "release_readiness", label: `G. Release Gate (${displayStatus})` },
            { id: "recommendations", label: `H. Next Actions (${rep.recommendations?.length || 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer",
                activeTab === tab.id
                  ? "border-[#1D63ED] text-[#1D63ED] font-semibold"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* TAB A: EXECUTIVE SUMMARY */}
        {/* ========================================================================= */}
        <div className={cn(activeTab !== "executive" && "hidden print:block", "print-page-break-before")}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 print-break-inside-avoid">
            {/* Executive Headline Callout */}
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

            {/* Human Review Needed Callout */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
              <span className="text-xs font-bold text-amber-900 block">5. Required Human Reviews & Four-Eyes Sign-Offs</span>
              <p className="text-xs text-amber-800 leading-relaxed">{execSummary.human_review_needed}</p>
            </div>

            {/* Critical Quality Gaps Table */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Critical Quality Gaps & Remediation Effort
                </h4>
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
        {/* TAB B: SPECIFICATION INTELLIGENCE */}
        {/* ========================================================================= */}
        <div className={cn(activeTab !== "spec_intelligence" && "hidden print:block", "print-page-break-before")}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 print-break-inside-avoid">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Workflow className="h-4 w-4 text-[#1D63ED]" />
                Specification Intelligence & Business Modeling
              </h3>
              <p className="text-2xs text-slate-500 mt-0.5">
                Organizational roles, business workflows, architecture constraints, and statutory calculation rules.
              </p>
            </div>

            {/* Architecture Context Callout */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-700 block">
                Architecture & Domain Context
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                {rep.ai_insights?.context?.product_overview}
              </p>
              <div className="text-2xs text-slate-500 border-t border-slate-200/60 pt-1.5 font-mono">
                Architecture Scope: {rep.ai_insights?.context?.architecture_context}
              </div>
            </div>

            {/* Roles & Actors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-slate-600" />
                  Actors & Stakeholders ({rep.ai_insights?.context?.roles?.length || 0})
                </h4>
                <span className="text-2xs text-slate-400">Grounded in project permissions</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rep.ai_insights?.context?.roles?.map((r: any) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1 hover:border-slate-300 transition-colors">
                    <span className="text-xs font-bold text-slate-900 block">{r.role_name}</span>
                    <p className="text-2xs text-slate-600 leading-relaxed">{r.description}</p>
                    {r.responsibilities && (
                      <span className="text-3xs font-mono text-slate-500 block pt-1 border-t border-slate-100">
                        Responsibilities: {r.responsibilities}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Business Scenarios */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Workflow className="h-4 w-4 text-slate-600" />
                  Business Scenarios & Operations ({rep.ai_insights?.context?.scenarios?.length || 0})
                </h4>
                <span className="text-2xs text-slate-400">Compiled operational workflows</span>
              </div>
              <div className="space-y-3">
                {rep.ai_insights?.context?.scenarios?.map((s: any) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{s.title}</span>
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-2xs font-medium text-blue-700 border border-blue-200">
                        Actor: {s.actor || "System"}
                      </span>
                    </div>
                    <p className="text-2xs text-slate-600 leading-relaxed">{s.description}</p>
                    {s.expected_outcome && (
                      <div className="text-2xs text-emerald-700 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 font-medium">
                        Expected Outcome: {s.expected_outcome}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB C: REQUIREMENT QUALITY AND EVIDENCE */}
        {/* ========================================================================= */}
        <div className={cn(activeTab !== "requirement_quality" && "hidden print:block", "print-page-break-before")}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 print-break-inside-avoid">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#1D63ED]" />
                Requirement Quality & Evidence Ledger
              </h3>
              <p className="text-2xs text-slate-500 mt-0.5">
                Verbatim quotation coverage, physical page mapping, confidence scoring, and provenance audit.
              </p>
            </div>

            {/* Quality Summary Badges Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-center">
                <span className="text-2xl font-black text-slate-900">{reqAnalysis.quote_coverage_pct || 0}%</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mt-1">Source Quotation Rate</span>
              </div>
              <div className="rounded-xl bg-blue-50 p-3.5 border border-blue-100 text-center">
                <span className="text-2xl font-black text-[#1D63ED]">{reqAnalysis.page_coverage_pct || 0}%</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-blue-600 mt-1">Page Completeness</span>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3.5 border border-emerald-100 text-center">
                <span className="text-2xl font-black text-emerald-700">
                  {reqAnalysis.provenance?.explicit_documented || 0}
                </span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-emerald-600 mt-1">Documented Reqs</span>
              </div>
              <div className="rounded-xl bg-purple-50 p-3.5 border border-purple-100 text-center">
                <span className="text-2xl font-black text-purple-700">
                  {reqAnalysis.provenance?.ai_inferred || 0}
                </span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-purple-600 mt-1">AI-Inferred Reqs</span>
              </div>
            </div>

            {/* Categories Distribution Table */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Requirement Taxonomy Breakdown:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {Object.entries(reqAnalysis.categories || {}).map(([cat, cnt]: any) => (
                  <div key={cat} className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                    <span className="text-lg font-bold text-slate-900">{cnt}</span>
                    <span className="block text-3xs font-medium text-slate-500 uppercase truncate mt-0.5">
                      {cat.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Requirements Ledger with Search & Filter */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Requirements Ledger ({filteredReqs.length} shown)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 no-print">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search key, title, quotation..."
                      value={reqSearch}
                      onChange={(e) => setReqSearch(e.target.value)}
                      className="h-8 pl-8 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:outline-none focus:border-[#1D63ED]"
                    />
                  </div>
                  <select
                    value={reqCategoryFilter}
                    onChange={(e) => setReqCategoryFilter(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    <option value="ALL">All Categories</option>
                    {Object.keys(reqAnalysis.categories || {}).map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, " ").toUpperCase()} ({reqAnalysis.categories[c]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {filteredReqs.slice(0, 60).map((r: any) => (
                  <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-bold text-[#1D63ED]">{r.key}</span>
                        <span className="font-semibold text-slate-900 text-xs truncate">{r.title}</span>
                      </div>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-600 uppercase">
                        {r.category}
                      </span>
                    </div>
                    <p className="mt-1 text-2xs text-slate-600 leading-relaxed font-serif italic bg-slate-50 p-2 rounded border border-slate-100">
                      "{r.description}"
                    </p>
                    <div className="mt-2 flex items-center justify-between text-3xs text-slate-400 border-t border-slate-100 pt-1">
                      <span>Source: {r.source_location}</span>
                      <span className="font-medium text-slate-600">Priority: {r.priority} · Confidence: {r.confidence}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB D: ACCEPTANCE CRITERIA AND TEST DESIGN */}
        {/* ========================================================================= */}
        <div className={cn(activeTab !== "test_design" && "hidden print:block", "print-page-break-before")}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 print-break-inside-avoid">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#1D63ED]" />
                  Acceptance Criteria Synthesis & 10-Category Test Design
                </h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Exhaustive behavioral criteria and multi-category test coverage matrix.
                </p>
              </div>
              <Link
                to={`/acceptance-criteria?project_id=${projectId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D63ED] hover:underline"
              >
                <span>Open Criteria Console</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Criteria vs Tests Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="rounded-xl bg-purple-50 p-3.5 border border-purple-100">
                <span className="text-2xl font-black text-purple-700">{acData.total || 0}</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-purple-600 mt-1">
                  Acceptance Criteria
                </span>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3.5 border border-emerald-100">
                <span className="text-2xl font-black text-emerald-700">{testDesign.total_test_cases || 0}</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-emerald-600 mt-1">
                  Synthesized Tests
                </span>
              </div>
              <div className="rounded-xl bg-blue-50 p-3.5 border border-blue-100">
                <span className="text-2xl font-black text-[#1D63ED]">{testDesign.coverage_pct || 0}%</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-blue-600 mt-1">
                  Clause Coverage
                </span>
              </div>
              <div className="rounded-xl bg-amber-50 p-3.5 border border-amber-100">
                <span className="text-2xl font-black text-amber-700">{testDesign.pending || 0}</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-amber-600 mt-1">
                  Pending Human Review
                </span>
              </div>
            </div>

            {/* 10 Test Categories Detailed Grid — Truthful Counts */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Verification Scope & Test Count per Category:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {Object.entries(TEST_CATEGORY_DESCRIPTIONS).map(([key, meta]) => {
                  const count = testDesign.by_category?.[key] || 0;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "rounded-xl border p-3.5 space-y-1.5 transition-colors",
                        count > 0 ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50/50 opacity-70"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", count > 0 ? "bg-blue-600" : "bg-slate-300")} />
                          {meta.label}
                        </span>
                        <span
                          className={cn(
                            "font-mono font-bold px-2 py-0.5 rounded text-2xs border",
                            count > 0
                              ? "text-blue-700 bg-blue-50 border-blue-200"
                              : "text-slate-500 bg-slate-100 border-slate-200"
                          )}
                        >
                          {count} tests
                        </span>
                      </div>
                      <p className="text-slate-600 text-2xs leading-relaxed">{meta.desc}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                        <span>Focus: {meta.focus}</span>
                        <span className={count > 0 ? "text-emerald-600 font-semibold" : "text-slate-400"}>
                          {count > 0 ? "Active in suite" : "Pending synthesis"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB E: SIMULATION AND EXECUTION RESULTS */}
        {/* ========================================================================= */}
        <div className={cn(activeTab !== "executions" && "hidden print:block", "print-page-break-before")}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 print-break-inside-avoid">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Execution Verification & Simulation History
                </h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Segregation between In-Memory Behaviour Simulation vs Physical Code/Sandbox Execution.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-800 font-mono">
                {totalRuns} Run(s) Recorded
              </span>
            </div>

            {/* Execution Governance Notice */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 space-y-1">
              <span className="font-bold text-slate-900 block text-2xs uppercase tracking-wider">
                Execution Truthfulness Standard:
              </span>
              <p>
                Deterministic state-machine simulation verifies requirement rule completeness. Real code execution executes physical test scripts against target application APIs or repository endpoints. A simulated pass is never described as proof that the physical application works.
              </p>
            </div>

            {/* Execution Containers or Empty Notice */}
            {isUnexecuted ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center space-y-2">
                <AlertCircle className="mx-auto h-8 w-8 text-slate-400" />
                <p className="text-sm font-semibold text-slate-800">No Executions Recorded</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  This project has compiled requirements and synthesized test cases, but zero execution runs have been recorded in the database.
                </p>
                <div className="pt-2">
                  <Link
                    to={`/simulation?project_id=${projectId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D63ED] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1550C0] transition-colors"
                  >
                    <span>Launch Policy Simulation Console →</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                    <span className="text-xl font-bold text-slate-900">{totalRuns}</span>
                    <span className="block text-2xs text-slate-500 uppercase mt-0.5">Total Runs</span>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200">
                    <span className="text-xl font-bold text-emerald-700">{execResults.passed_runs || 0}</span>
                    <span className="block text-2xs text-emerald-700 uppercase mt-0.5">Passed Runs</span>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-3 border border-rose-200">
                    <span className="text-xl font-bold text-rose-700">{execResults.failed_runs || 0}</span>
                    <span className="block text-2xs text-rose-700 uppercase mt-0.5">Failed / Errored</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-2xs uppercase">
                        <th className="py-2.5 px-3">Run Key</th>
                        <th className="py-2.5 px-3">Execution Engine</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Tests Run</th>
                        <th className="py-2.5 px-3 text-center">Passed</th>
                        <th className="py-2.5 px-3 text-center">Failed</th>
                        <th className="py-2.5 px-3 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {execResults.recent_runs?.map((ex: any) => (
                        <tr key={ex.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#1D63ED]">{ex.key}</td>
                          <td className="py-2.5 px-3 capitalize text-slate-700 font-medium">{ex.source?.replace(/_/g, " ")}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 text-2xs font-semibold uppercase border",
                                ex.status === "passed"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              )}
                            >
                              {ex.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">{ex.total}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-emerald-600 font-bold">{ex.passed}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-rose-600 font-bold">{ex.failed}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            {round2(ex.duration_ms / 1000)}s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB F: TRACEABILITY AND COVERAGE */}
        {/* ========================================================================= */}
        <div className={cn(activeTab !== "traceability" && "hidden print:block", "print-page-break-before")}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 print-break-inside-avoid">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  End-to-End Requirements Traceability Ledger
                </h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Strict 7-stage chain: Document → Requirement → Clause → AC → Test Case → Execution → Defect.
                </p>
              </div>
              <Link
                to={`/traceability?project_id=${projectId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D63ED] hover:underline"
              >
                <span>Interactive Traceability Explorer</span>
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
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-2.5">
                <span className="text-lg font-bold text-purple-700">{traceability.total_acceptance_criteria || 0}</span>
                <span className="block text-3xs uppercase font-medium text-purple-600 mt-1">4. Criteria</span>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2.5">
                <span className="text-lg font-bold text-[#1D63ED]">{traceability.total_test_cases || 0}</span>
                <span className="block text-3xs uppercase font-medium text-blue-600 mt-1">5. Test Cases</span>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
                <span className="text-lg font-bold text-emerald-700">{traceability.total_executions || 0}</span>
                <span className="block text-3xs uppercase font-medium text-emerald-600 mt-1">6. Executions</span>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-2.5">
                <span className="text-lg font-bold text-rose-700">{traceability.total_defects || 0}</span>
                <span className="block text-3xs uppercase font-medium text-rose-600 mt-1">7. Defects</span>
              </div>
            </div>

            {/* Coverage Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <span className="text-2xl font-black text-emerald-700">
                  {traceability.covered_requirements || 0} / {traceability.total_requirements || 0}
                </span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-emerald-600 mt-1">
                  Covered Requirements ({traceability.coverage_pct || 0}%)
                </span>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <span className="text-2xl font-black text-amber-700">
                  {traceability.uncovered_requirements || 0}
                </span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-amber-600 mt-1">
                  Uncovered Requirements (Missing Tests)
                </span>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <span className="text-2xl font-black text-blue-700">
                  {traceability.verified_requirements || 0}
                </span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-blue-600 mt-1">
                  Verified Requirements (Passed Executions)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB G: RELEASE READINESS AND DECISION */}
        {/* ========================================================================= */}
        <div className={cn(activeTab !== "release_readiness" && "hidden print:block", "print-page-break-before")}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 print-break-inside-avoid">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Authoritative Release Gate Assessment
              </h3>
              <p className="text-2xs text-slate-500 mt-0.5">
                Centralized release decision engine grounded in physical records and documented formulas.
              </p>
            </div>

            {/* Gate Reasons Callout */}
            <div
              className={cn(
                "rounded-xl border p-4 text-xs space-y-2",
                isApproved
                  ? "border-emerald-200 bg-emerald-50/50"
                  : releaseStatus === "not_approved"
                  ? "border-rose-200 bg-rose-50/50"
                  : "border-amber-200 bg-amber-50/50"
              )}
            >
              <span className="font-bold uppercase tracking-wider text-slate-900 block text-2xs">
                {isApproved ? "Release Approval Justification:" : "Release Gate Conditions & Blockers:"}
              </span>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                {reasons.map((r, ri) => (
                  <li key={ri}>{r}</li>
                ))}
              </ul>
            </div>

            {/* 4 Pillars Score Breakdown Table */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Evidence-Backed Score Breakdown by Functional Area:
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-2xs uppercase">
                      <th className="py-2.5 px-3">Evaluation Area</th>
                      <th className="py-2.5 px-3 text-center">Score</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3">Measurement Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rep.metrics_by_area?.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-semibold text-slate-900">{item.area}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-[#1D63ED]">
                          {item.score}%
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-2xs font-semibold uppercase border",
                              item.status === "Complete"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : item.status === "Blocked"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            )}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 text-2xs">{item.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Critical Quality Gaps Table */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Critical Quality Gaps & Remediation Effort
                </h4>
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
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB H: RECOMMENDED NEXT ACTIONS */}
        {/* ========================================================================= */}
        <div className={cn(activeTab !== "recommendations" && "hidden print:block", "print-page-break-before")}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5 print-break-inside-avoid">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Actionable Next Steps & Remediation Directives
              </h3>
              <p className="text-2xs text-slate-500 mt-0.5">
                Prioritized engineering directives with affected database records and direct navigation shortcuts.
              </p>
            </div>

            <div className="space-y-3.5">
              {rep.recommendations?.map((rec: any, idx: number) => (
                <div
                  key={idx}
                  className={cn(
                    "rounded-xl border p-4 space-y-2.5 transition-colors",
                    rec.priority === "Critical"
                      ? "border-rose-200 bg-rose-50/30"
                      : rec.priority === "High"
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "rounded px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wider border",
                        rec.priority === "Critical"
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : rec.priority === "High"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-slate-100 text-slate-700 border-slate-300"
                      )}
                    >
                      {rec.priority} Priority
                    </span>
                    <span className="text-2xs text-slate-500 font-medium">Responsible: {rec.review_area}</span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900">{rec.problem}</h4>
                  <p className="text-2xs text-slate-600 leading-relaxed">
                    <strong>Why it matters:</strong> {rec.why_it_matters}
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100 pt-2 text-2xs">
                    <span className="text-slate-500">
                      Target Area: <strong>{rec.affected_item}</strong>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-[#1D63ED]">{rec.suggested_action}</span>
                      {rec.target_screen && (
                        <Link
                          to={`${rec.target_screen}?project_id=${projectId}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-2xs font-semibold text-white hover:bg-slate-800 transition-colors shrink-0"
                        >
                          <span>Execute Step</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
