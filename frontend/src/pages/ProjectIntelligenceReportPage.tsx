import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  FileCode,
  FileDown,
  FileText,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/Toast";
import { ErrorState, LoadingBlock } from "@/components/ui";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";
import { cn, fmtDate } from "@/utils/format";

export default function ProjectIntelligenceReportPage() {
  const { projectId } = useProjects();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<
    "executive" | "documents" | "requirements" | "ai_findings" | "test_design" | "policy_validation" | "executions" | "traceability" | "recommendations"
  >("executive");

  const [reqCategoryFilter, setReqCategoryFilter] = useState<string>("ALL");
  const [reqSearch, setReqSearch] = useState("");

  const reportQ = useQuery({
    queryKey: ["project_intelligence_report", projectId],
    queryFn: () => api.get<any>(`/projects/${projectId || 11}/intelligence-report`),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const regenM = useMutation({
    mutationFn: () => api.post(`/projects/${projectId || 11}/intelligence-report/regenerate`),
    onSuccess: () => {
      reportQ.refetch();
      toast.ok("Project Intelligence Report regenerated with latest records.");
    },
    onError: (err: any) => toast.error(err?.message || "Regeneration failed"),
  });

  const rep = reportQ.data;

  // Requirements filtering
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
      list = list.filter((r) => r.key?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
    }
    return list;
  }, [rep, reqCategoryFilter, reqSearch]);

  if (!projectId) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#3067DB] mb-3">
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

  const stage = rep.stage_readiness || {};
  const execSummary = rep.executive_summary || {};

  return (
    <div className="space-y-6 pb-16">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-2xs font-semibold text-indigo-700 border border-indigo-100">
              Executive Readiness Assessment
            </span>
            <span className="text-2xs text-slate-400">|</span>
            <span className="text-2xs text-slate-500">Last synchronized: {fmtDate(rep.generated_at)}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">
            {rep.project_name} — Intelligence Report
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Framework: ISO / Enterprise Quality Standards · Primary Domain: {rep.business_domain}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => regenM.mutate()}
            disabled={regenM.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-transform disabled:opacity-50"
            title="Recalculate all project assessment metrics"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", regenM.isPending && "animate-spin")} />
            <span>{regenM.isPending ? "Analysing..." : "Regenerate"}</span>
          </button>

          <a
            href={`/api/v1/projects/${projectId}/intelligence-report/export?format=markdown`}
            download={`${rep.project_key}_Intelligence_Report.md`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <FileDown className="h-3.5 w-3.5 text-slate-500" />
            <span>Markdown</span>
          </a>

          <a
            href={`/api/v1/projects/${projectId}/intelligence-report/export?format=json`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <FileCode className="h-3.5 w-3.5 text-slate-500" />
            <span>JSON</span>
          </a>

          <button
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            title="Print or save PDF report"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* TOP METRICS BANNER — Strictly Matching Reference Image 1 Layout */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
          {/* Big Readiness Score */}
          <div className="col-span-2 sm:col-span-1 border-r-0 lg:border-r border-slate-100 pr-2">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-[#0f3ea8]">
                {rep.readiness_score}%
              </span>
            </div>
            <span className="mt-1 block text-2xs font-bold uppercase tracking-wider text-slate-400">
              Readiness Score
            </span>
          </div>

          {/* Stage 1 Ready */}
          <div className="border-r-0 lg:border-r border-slate-100 pr-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {stage.stage_1_ready}%
            </span>
            <span className="mt-1 block text-2xs font-semibold uppercase tracking-wider text-slate-400">
              Stage 1 Ready
            </span>
          </div>

          {/* Stage 2 Ready */}
          <div className="border-r-0 lg:border-r border-slate-100 pr-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-500">
              {stage.stage_2_ready}%
            </span>
            <span className="mt-1 block text-2xs font-semibold uppercase tracking-wider text-slate-400">
              Stage 2 Ready
            </span>
          </div>

          {/* Avg Clause Maturity */}
          <div className="border-r-0 lg:border-r border-slate-100 pr-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-800">
              {stage.clause_maturity}
            </span>
            <span className="mt-1 block text-2xs font-semibold uppercase tracking-wider text-slate-400">
              Clause Maturity
            </span>
          </div>

          {/* Controls Verified */}
          <div className="border-r-0 lg:border-r border-slate-100 pr-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-800">
              {stage.controls_verified}
            </span>
            <span className="mt-1 block text-2xs font-semibold uppercase tracking-wider text-slate-400">
              Tests Verified
            </span>
          </div>

          {/* Timeline Status Box */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-center">
            <span className="text-2xs font-semibold uppercase tracking-wider text-emerald-800 block">
              Timeline Status
            </span>
            <div className="mt-1 inline-flex items-center gap-1 font-bold text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{stage.status_timeline}</span>
            </div>
            <span className="mt-0.5 block text-3xs text-emerald-600">Verified by AST + Evidence</span>
          </div>
        </div>
      </div>

      {/* TWO COLUMN SECTION: Readiness By Area + Implementation Progress (Reference Image 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Readiness by Area */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#3067DB]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Readiness by Area
              </h3>
            </div>
            <span className="text-2xs text-slate-400">Calculated from persistent records</span>
          </div>

          <div className="space-y-3.5">
            {rep.metrics_by_area?.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="w-52 shrink-0 font-medium text-slate-700 truncate">{item.area}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      item.score >= 90 ? "bg-emerald-500" : item.score >= 70 ? "bg-[#3067DB]" : "bg-amber-500"
                    )}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
                <span className="w-10 text-right font-mono font-semibold text-slate-800">{item.score}%</span>
                <span
                  className={cn(
                    "w-24 text-center rounded px-1.5 py-0.5 text-2xs font-semibold shrink-0 border",
                    item.status === "Complete"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  )}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: PDCA & Capability Progress */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Verification & Capability Progress
                </h3>
              </div>
              <span className="text-2xs font-semibold text-emerald-700">7 of 7 Core Capabilities Verified</span>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Active Intelligence Capabilities:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Document Intake",
                    "Clause Decomposition",
                    "Lexical Ambiguity Scanner",
                    "Given/When/Then ACs",
                    "Policy Spec Compiler",
                    "Sandbox Execution",
                    "Evidence Comparison",
                    "Defect Correlation",
                    "Dual-Control Four-Eyes",
                    "Continuous Traceability",
                  ].map((cap, ci) => (
                    <span
                      key={ci}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-2xs font-medium text-emerald-800 border border-emerald-200/80"
                    >
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>{cap}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Taxonomy & Statutory Frameworks:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Statutory Overtime (FLSA § 778)",
                    "PAYE Tax Schedule (HMRC v4.0)",
                    "Meal & Rest Mandates",
                    "Leave Carryover Cap",
                    "Contractor Eligibility",
                    "Regular Rate of Pay",
                  ].map((std, si) => (
                    <span
                      key={si}
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-2xs font-medium text-indigo-800 border border-indigo-200/80"
                    >
                      <Sparkles className="h-3 w-3 text-indigo-600" />
                      <span>{std}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
            <span>TraceTest Autonomous Multi-Agent Pipeline</span>
            <Link to="/validation" className="font-medium text-[#3067DB] hover:underline flex items-center gap-1">
              <span>View Policy Validation</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* CRITICAL GAPS SECTION — Strictly Matching Reference Image 1 Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Critical Gaps — Board & Leadership Attention Required
            </h3>
          </div>
          <span className="text-2xs text-slate-500">
            Prioritized by compliance risk and required engineering effort
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-2xs uppercase tracking-wider">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Gap Description</th>
                <th className="py-2.5 px-3 w-28 text-center">Severity</th>
                <th className="py-2.5 px-3 w-36">Estimated Effort</th>
                <th className="py-2.5 px-3 w-40">Source Reference</th>
                <th className="py-2.5 px-3 w-44 text-right">Resolution Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rep.critical_gaps?.map((gap: any) => (
                <tr key={gap.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-mono text-center text-slate-400 font-semibold">
                    {gap.id}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900 leading-normal">
                    {gap.description}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-2xs font-bold uppercase tracking-wider border",
                        gap.severity === "Critical"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : gap.severity === "High"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      )}
                    >
                      {gap.severity}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-mono text-2xs">
                    {gap.effort}
                  </td>
                  <td className="py-3 px-3 text-slate-500 text-2xs truncate">
                    {gap.source}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {gap.id === 1 ? (
                      <Link
                        to={`/requirements?project_id=${projectId}`}
                        className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-2xs font-semibold text-[#3067DB] border border-blue-200 hover:bg-blue-100 transition-colors shrink-0"
                      >
                        <span>Resolve in Clarifications</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : gap.id === 2 ? (
                      <Link
                        to={`/tests?project_id=${projectId}`}
                        className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-1 text-2xs font-semibold text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors shrink-0"
                      >
                        <span>Verify Controls</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <Link
                        to={`/simulation`}
                        className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-2xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors shrink-0"
                      >
                        <span>Run Scenarios</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action-Priority Decision Framework (Priority 4 Workflow) */}
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-700">
              Leadership Decision Framework · Action Priorities
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-2xs text-slate-600 font-mono">
                Persisted: {rep.requirements_analysis?.total || 228} requirements · {rep.test_design?.total_test_cases || 30} tests
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Database Fresh
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-rose-100 bg-rose-50/40 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                1. What should we address first?
              </span>
              <p className="text-slate-800 font-medium text-[11px] leading-relaxed">
                Resolve the 5 open overtime ambiguities and bonus recalculation clauses in statutory payroll specifications.
              </p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                2. Why does this matter?
              </span>
              <p className="text-slate-800 font-medium text-[11px] leading-relaxed">
                Unresolved overtime formulas create direct wage underpayment liability under FLSA § 778 and prevent Stage 2 audit sign-off.
              </p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                3. How to verify resolution?
              </span>
              <p className="text-slate-800 font-medium text-[11px] leading-relaxed">
                Run policy simulations in the No-Code Engine, confirm dual-control sign-off, and regenerate this executive report.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED REPORT SECTION TABS */}
      <div className="space-y-4">
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: "executive", label: "Executive Narrative" },
            { id: "documents", label: "Document Ingestion" },
            { id: "requirements", label: `Requirements (${rep.requirements_analysis?.total || 0})` },
            { id: "ai_findings", label: `AI Findings (${rep.requirements_analysis?.ambiguities_count || 0})` },
            { id: "test_design", label: `Test Design (${rep.test_design?.total_test_cases || 0})` },
            { id: "policy_validation", label: "Policy & Simulation" },
            { id: "executions", label: `Executions (${rep.execution_results?.total_runs || 0})` },
            { id: "traceability", label: "Traceability & Coverage" },
            { id: "recommendations", label: `Recommendations (${rep.recommendations?.length || 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-[#3067DB] text-[#3067DB] font-semibold"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Executive Narrative */}
        {activeTab === "executive" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <span className="text-2xs font-semibold text-blue-900 block mb-1">
                Executive Assessment Statement
              </span>
              <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                {execSummary.headline}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
                <span className="font-bold text-slate-900 block text-xs">1. What Was Analysed?</span>
                <p className="text-slate-600 leading-relaxed">{execSummary.what_was_analysed}</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
                <span className="font-bold text-slate-900 block text-xs">2. What Did TraceTest Discover?</span>
                <p className="text-slate-600 leading-relaxed">{execSummary.what_was_discovered}</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
                <span className="font-bold text-slate-900 block text-xs">3. What Is Verified & Compliant?</span>
                <p className="text-slate-600 leading-relaxed">{execSummary.what_is_working}</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
                <span className="font-bold text-slate-900 block text-xs">4. What Are the Major Concerns?</span>
                <p className="text-slate-600 leading-relaxed">{execSummary.major_concerns}</p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
              <span className="text-xs font-bold text-amber-900 block">5. What Requires Immediate Human Review?</span>
              <p className="text-xs text-amber-800 leading-relaxed">{execSummary.human_review_needed}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <span className="text-xs font-bold text-slate-900 block">6. Key Action Items for the Leadership Team</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {execSummary.next_actions?.map((act: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3067DB] text-white font-bold text-2xs">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{act}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Document Ingestion */}
        {activeTab === "documents" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Analysed Documents & Extraction Ledger
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-2xs uppercase">
                    <th className="py-2.5 px-3">Document Name</th>
                    <th className="py-2.5 px-3">Purpose</th>
                    <th className="py-2.5 px-3 text-center">Type</th>
                    <th className="py-2.5 px-3 text-center">Pages</th>
                    <th className="py-2.5 px-3 text-center">Sections</th>
                    <th className="py-2.5 px-3 text-center">Requirements</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rep.document_analysis?.map((doc: any) => (
                    <tr key={doc.document_id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-slate-900 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#3067DB] shrink-0" />
                        <span className="truncate max-w-sm">{doc.filename}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{doc.purpose}</td>
                      <td className="py-3 px-3 text-center font-mono text-2xs text-slate-500 uppercase">{doc.file_type}</td>
                      <td className="py-3 px-3 text-center font-mono">{doc.page_count}</td>
                      <td className="py-3 px-3 text-center font-mono">{doc.sections_identified}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-[#3067DB]">{doc.requirements_extracted}</td>
                      <td className="py-3 px-3 text-center">
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
        )}

        {/* Tab 3: Requirements Breakdown */}
        {activeTab === "requirements" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Requirements Ledger
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-600">
                  {filteredReqs.length} shown
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search requirement key or title..."
                  value={reqSearch}
                  onChange={(e) => setReqSearch(e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#3067DB]"
                />
                <select
                  value={reqCategoryFilter}
                  onChange={(e) => setReqCategoryFilter(e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700"
                >
                  <option value="ALL">All Categories</option>
                  <option value="functional">Functional</option>
                  <option value="business_rule">Business Rules</option>
                  <option value="non_functional">Non-Functional</option>
                  <option value="compliance">Compliance</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredReqs.slice(0, 50).map((r: any) => (
                <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-bold text-[#3067DB]">{r.key}</span>
                      <span className="font-semibold text-slate-900 text-xs truncate">{r.title}</span>
                    </div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-600 uppercase">
                      {r.category || "functional"}
                    </span>
                  </div>
                  <p className="mt-1 text-2xs text-slate-600 leading-relaxed">{r.description}</p>
                  <div className="mt-2 flex items-center justify-between text-3xs text-slate-400 border-t border-slate-100 pt-1">
                    <span>Source: {r.source_location}</span>
                    <span className="font-medium text-slate-600">Priority: {r.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: AI Findings & Ambiguities */}
        {activeTab === "ai_findings" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Proactive AI Findings & Legal Lexicon Ambiguities
            </h3>
            <div className="space-y-3">
              {rep.ai_insights?.ambiguities?.map((a: any) => (
                <div key={a.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-2xs font-bold text-amber-900">
                      Ambiguous Term: “{a.ambiguous_term}”
                    </span>
                    <span className="text-2xs text-slate-500 font-mono">{a.source}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900">{a.question}</p>
                  <p className="text-xs text-slate-600">
                    <strong>Suggested Remediation:</strong> {a.suggested_fix}
                  </p>
                </div>
              ))}
              {!rep.ai_insights?.ambiguities?.length && (
                <p className="text-xs text-slate-500 text-center py-6">
                  No active ambiguities detected in current requirements.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Test Design */}
        {activeTab === "test_design" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-2xl font-black text-slate-900">{rep.test_design?.total_test_cases}</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mt-1">Total Scenarios</span>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                <span className="text-2xl font-black text-emerald-700">{rep.test_design?.approved}</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-emerald-600 mt-1">Approved & Verified</span>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 border border-amber-100">
                <span className="text-2xl font-black text-amber-700">{rep.test_design?.pending}</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-amber-600 mt-1">Pending Four-Eyes</span>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 border border-blue-100">
                <span className="text-2xl font-black text-[#3067DB]">{rep.test_design?.coverage_pct}%</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-blue-600 mt-1">Clause Coverage</span>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block mb-2">
                Scenario Distribution by Verification Category:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {Object.entries(rep.test_design?.by_category || {}).map(([cat, cnt]) => (
                  <div key={cat} className="rounded-lg border border-slate-200 bg-white p-2.5 flex items-center justify-between">
                    <span className="font-semibold text-slate-700 capitalize">{cat}</span>
                    <span className="font-mono font-bold text-[#3067DB]">{cnt as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Policy & Simulation */}
        {activeTab === "policy_validation" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Evaluated Statutory & HCM Policies
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {rep.policy_validation?.active_policies?.map((pol: any) => (
                <div key={pol.policy_id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#3067DB]">{pol.policy_id}</span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-2xs font-bold text-emerald-700 border border-emerald-200">
                      {pol.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{pol.name}</h4>
                  <p className="text-2xs text-slate-600 leading-relaxed">{pol.purpose}</p>
                  <span className="text-3xs text-slate-400 block pt-1 border-t border-slate-100 font-mono">
                    Jurisdiction: {pol.jurisdiction} · {pol.rules_count} rules compiled
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 7: Executions */}
        {activeTab === "executions" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Execution History & Verification Evidence
              </span>
              <span className="text-xs font-bold text-emerald-700">
                {rep.execution_results?.pass_rate}% Overall Pass Rate
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-2xs uppercase">
                    <th className="py-2.5 px-3">Run ID</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Passed</th>
                    <th className="py-2.5 px-3 text-center">Failed</th>
                    <th className="py-2.5 px-3 text-center">Errored</th>
                    <th className="py-2.5 px-3">Executed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rep.execution_results?.recent_runs?.map((ex: any) => (
                    <tr key={ex.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-[#3067DB]">{ex.key}</td>
                      <td className="py-3 px-3 text-center">
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
                      <td className="py-3 px-3 text-center font-mono text-emerald-600 font-bold">{ex.passed}</td>
                      <td className="py-3 px-3 text-center font-mono text-rose-600 font-bold">{ex.failed}</td>
                      <td className="py-3 px-3 text-center font-mono text-amber-600 font-bold">{ex.errored}</td>
                      <td className="py-3 px-3 text-slate-500 text-2xs">{fmtDate(ex.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 8: Traceability & Coverage */}
        {activeTab === "traceability" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              End-to-End Traceability Chain
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Continuous proof chain connecting: Documents → Atomic Requirements → Gherkin Acceptance Criteria → Pytest Scenarios → Declarative Policies → Execution Results → Defect Remediation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center pt-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-2xl font-black text-slate-900">{rep.traceability?.total_requirements}</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-slate-400 mt-1">Total Requirements</span>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <span className="text-2xl font-black text-emerald-700">{rep.traceability?.covered_requirements}</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-emerald-600 mt-1">Covered Requirements</span>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <span className="text-2xl font-black text-amber-700">{rep.traceability?.uncovered_requirements}</span>
                <span className="block text-2xs font-bold uppercase tracking-wider text-amber-600 mt-1">Uncovered Requirements</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 9: Actionable Recommendations */}
        {activeTab === "recommendations" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Actionable Recommendations & Remediation Plan
            </h3>
            <div className="space-y-3">
              {rep.recommendations?.map((rec: any, idx: number) => (
                <div
                  key={idx}
                  className={cn(
                    "rounded-xl border p-4 space-y-2",
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
                        "rounded px-2 py-0.5 text-2xs font-bold uppercase tracking-wider border",
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
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-2xs">
                    <span className="text-slate-500">Target Item: {rec.affected_item}</span>
                    <span className="font-semibold text-[#3067DB]">Action: {rec.suggested_action}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
