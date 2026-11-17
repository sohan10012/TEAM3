import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Compass,
  ExternalLink,
  FileText,
  Flame,
  Layers,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CountUp } from "@/components/common/CountUp";
import { EmptyState, ErrorState, LoadingBlock, Panel, Skeleton, Stat } from "@/components/ui";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";
import { cn, fmtDate, label, pct } from "@/utils/format";

const STATUS_COLOR: Record<string, string> = {
  passed: "#059669",
  failed: "#DC2626",
  error: "#D97706",
  timed_out: "#7C3AED",
  skipped: "#94A3B8",
  approved: "#059669",
  pending_review: "#D97706",
  rejected: "#DC2626",
  changes_requested: "#F59E0B",
  needs_reapproval: "#7C3AED",
  draft: "#64748B",
  deprecated: "#94A3B8",
  critical: "#DC2626",
  high: "#EA580C",
  medium: "#D97706",
  low: "#64748B",
};

const axis = { fontSize: 11, fill: "#64748B" };

function ProjectOnboardingHub({ current }: { current?: any }) {
  const nav = useNavigate();
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#1D4ED8] border border-blue-100">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{current?.name || "Enterprise"} Quality Engineering Workspace</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              Ready for {current?.name || "Requirement"} Verification
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Verify {current?.name ? `${current.name} specifications` : "business requirements"} through AI-assisted clause decomposition, ambiguity detection, grounded acceptance criteria synthesis, and sandboxed test execution.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/requirements"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Ingest First Requirement</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4-Step Operational Workflow Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-[#1D4ED8]">
              <FileText className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900">1. Ingest Requirements</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Upload business scenarios, CR documents, or policies in PDF, TXT, or Markdown format with immutable versioning.
            </p>
          </div>
          <button
            type="button"
            onClick={() => nav("/requirements")}
            className="mt-4 flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline pt-2 border-t border-slate-100 cursor-pointer"
          >
            <span>Open Requirements</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-cyan-50 text-[#0891B2]">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900">2. AI Clause & Ambiguity Analysis</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Extract atomic clauses, detect ambiguous phrases, and generate quote-verified acceptance criteria.
            </p>
          </div>
          <button
            type="button"
            onClick={() => nav("/requirements")}
            className="mt-4 flex items-center gap-1 text-xs font-medium text-[#0891B2] hover:underline pt-2 border-t border-slate-100 cursor-pointer"
          >
            <span>AI Workflow</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-50 text-amber-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900">3. Dual-Control Review</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Enforce the Four-Eyes Principle. Senior reviewers inspect clause grounding and approve scripts with SHA-256 hashes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => nav("/tests/review")}
            className="mt-4 flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline pt-2 border-t border-slate-100 cursor-pointer"
          >
            <span>Review Queue</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-50 text-emerald-600">
              <PlayCircle className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900">4. Sandboxed Execution & Retest</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Execute approved tests inside AST-allowlisted, network-isolated sandboxes against target SUT builds and verify defect fixes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => nav("/executions")}
            className="mt-4 flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline pt-2 border-t border-slate-100 cursor-pointer"
          >
            <span>Test Executions</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Project Modules */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#1D4ED8]" />
            <h3 className="text-xs font-semibold text-slate-900">
              {current?.name ? `${current.name} Verification Modules` : "Project Modules"}
            </h3>
          </div>
          <Link to="/projects" className="text-xs font-medium text-[#1D4ED8] hover:underline">
            View All Projects
          </Link>
        </div>
        {current?.modules?.length ? (
          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2 lg:grid-cols-4">
            {current.modules.map((module: { id: number; code: string; name: string; description: string }) => (
              <div key={module.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <span className="block font-semibold text-slate-800">{module.code} · {module.name}</span>
                {module.description && <span className="mt-1 block text-[11px] text-slate-500">{module.description}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No project modules are configured.</p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const nav = useNavigate();
  const { projectId, current, setProjectId } = useProjects();
  const [timeRange, setTimeRange] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [journeyOpen, setJourneyOpen] = useState(true);

  // Derive date bounds from selected timeRange
  const dateRange = useMemo(() => {
    if (timeRange === "all") return { from: undefined, to: undefined };
    const now = new Date();
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return {
      from: from.toISOString(),
      to: now.toISOString(),
    };
  }, [timeRange]);

  const q = useQuery({
    queryKey: ["dashboard", projectId, timeRange],
    queryFn: () =>
      api.get<any>("/analytics/dashboard", {
        project_id: projectId || undefined,
        date_from: dateRange.from,
        date_to: dateRange.to,
      }),
    refetchInterval: false,
    staleTime: 10_000,
  });

  const d = q.data;
  const k = d?.kpis;
  const scope = projectId ? `project_id=${projectId}&` : "";
  const isAggregate = projectId === null;
  const isEmptyWorkspace = Boolean(k && k.total_requirements === 0 && k.total_executions === 0);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto min-h-[100dvh]">
      {/* =========================================================================
          SECTION 1 — PROJECT IDENTITY HEADER (Redesigned hierarchy, NO large GitHub/date pickers)
          ========================================================================= */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0 flex-1">
            {/* Context badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#1D4ED8] border border-blue-200/80 font-mono">
                {isAggregate ? "ALL WORKSPACES" : current?.key || "PROJECT"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
                {isAggregate
                  ? "Multi-Project Aggregated Scope"
                  : current?.project_type === "requirements_based"
                  ? "Requirements-Based Platform"
                  : "Code-Based Ingestion Platform"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Environment
              </span>
            </div>

            {/* Prominent Project Heading */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
              {isAggregate
                ? "Enterprise Quality Command Center"
                : `${current?.name || "Project"} — Command Center`}
            </h1>

            {/* Muted Project Description */}
            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
              {isAggregate
                ? "Unified quality engineering telemetry, coverage traceability, and defect governance aggregated across all active projects."
                : current?.description ||
                  "Quality engineering workspace with automated requirement parsing, acceptance criteria verification, and isolated execution."}
            </p>
          </div>

          {/* Right Controls: Compact Time-Range Selector & Refresh */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto pt-1">
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-0.5 text-xs">
              {(["all", "7d", "30d", "90d"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer",
                    timeRange === r
                      ? "bg-white text-slate-900 shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {r === "all" ? "All Time" : r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => q.refetch()}
              disabled={q.isFetching}
              title="Refresh project telemetry"
              aria-label="Refresh project telemetry"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/20"
              )}
            >
              <RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin text-[#1D4ED8]")} />
            </button>
          </div>
        </div>

        {/* Aggregate Mode Notification Banner */}
        {isAggregate && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-blue-50/70 border border-blue-200/70 px-4 py-2.5 text-xs text-blue-900">
            <Layers className="h-4 w-4 text-[#1D4ED8] shrink-0" />
            <span>
              Showing aggregate metrics across all active projects. Select a specific project workspace from the top switcher to view isolated project telemetry.
            </span>
          </div>
        )}
      </div>

      {q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : isEmptyWorkspace ? (
        <ProjectOnboardingHub current={current} />
      ) : (
        <>
          {/* =========================================================================
              SECTION 2 — KEY QUALITY METRICS (8 Compact, Consistent, Enterprise KPI Cards)
              ========================================================================= */}
          <div>
            <div className="flex items-center justify-between mb-2.5 px-0.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Key Quality Metrics
              </h2>
              <span className="text-2xs text-slate-400">
                Ground truth from persisted database records
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3">
              {!k ? (
                Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
              ) : (
                <>
                  <Stat
                    label="Requirements"
                    value={<CountUp value={k.total_requirements} />}
                    hint={`${k.analysed_requirements} analyzed`}
                    onClick={() => nav(`/requirements?${scope}`)}
                  />
                  <Stat
                    label="Analyzed Reqs"
                    value={<CountUp value={k.analysed_requirements} />}
                    hint={
                      k.total_requirements
                        ? `${Math.round((k.analysed_requirements / k.total_requirements) * 100)}% analyzed`
                        : "No requirements"
                    }
                    onClick={() => nav(`/requirements?${scope}`)}
                  />
                  <Stat
                    label="Clause Coverage"
                    value={<CountUp value={k.requirement_coverage} decimals={1} suffix="%" />}
                    hint="Verified with tests"
                    onClick={() => nav(`/traceability?${scope}`)}
                  />
                  <Stat
                    label="Test Cases"
                    value={<CountUp value={k.total_test_cases} />}
                    hint={`${k.approved_test_cases} approved`}
                    onClick={() => nav(`/tests?${scope}`)}
                  />
                  <Stat
                    label="Pending Review"
                    value={<CountUp value={k.pending_reviews} />}
                    intent={k.pending_reviews > 0 ? "bad" : undefined}
                    hint="Four-Eyes queue"
                    onClick={() => nav(`/tests/review?${scope}`)}
                  />
                  <Stat
                    label="Test Pass Rate"
                    value={
                      k.pass_rate !== null ? (
                        <CountUp value={k.pass_rate} decimals={1} suffix="%" />
                      ) : (
                        "N/A"
                      )
                    }
                    intent={k.pass_rate !== null && k.pass_rate >= 80 ? "good" : k.pass_rate !== null ? "bad" : undefined}
                    hint={k.total_executions ? `${k.total_executions} runs recorded` : "No runs yet"}
                    onClick={() => nav(`/executions?${scope}`)}
                  />
                  <Stat
                    label="Open Defects"
                    value={<CountUp value={k.open_defects} />}
                    intent={k.open_defects > 0 ? "bad" : "good"}
                    hint={`${k.failed_executions} failed runs`}
                    onClick={() => nav(`/defects?${scope}open_only=true`)}
                  />
                  <Stat
                    label="Critical Defects"
                    value={<CountUp value={k.critical_defects} />}
                    intent={k.critical_defects > 0 ? "bad" : "good"}
                    hint={k.critical_defects > 0 ? "Blocker severity" : "Zero criticals"}
                    onClick={() => nav(`/defects?${scope}severity=critical&open_only=true`)}
                  />
                </>
              )}
            </div>
          </div>

          {/* =========================================================================
              SECTION 3 — QUALITY AND EXECUTION ANALYTICS (6 Redesigned, Aligned Charts)
              ========================================================================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Quality & Execution Analytics
              </h2>
              <span className="text-2xs text-slate-400">
                Visualized with explicit axes, units, and ground-truth values
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Chart 1: Test Execution Trend */}
              <Panel
                title={
                  <div>
                    <p className="font-semibold text-slate-900">Test Execution Trend</p>
                    <p className="text-[11px] font-normal text-slate-500">Weekly execution outcomes (passed, failed, errors) over time</p>
                  </div>
                }
                className="flex flex-col"
                bodyClass="h-64 pt-2"
              >
                {!d ? (
                  <LoadingBlock />
                ) : !d.charts.execution_trend.length ? (
                  <EmptyState title="No execution history recorded in this period" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={d.charts.execution_trend} margin={{ top: 10, left: -10, right: 10, bottom: 0 }}>
                      <CartesianGrid stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="week" tick={axis} label={{ value: "Execution Week", position: "insideBottom", offset: -5, fontSize: 10, fill: "#94A3B8" }} />
                      <YAxis tick={axis} allowDecimals={false} label={{ value: "Results", angle: -90, position: "insideLeft", offset: 12, fontSize: 10, fill: "#94A3B8" }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                      <Line dataKey="passed" name="Passed" stroke="#059669" strokeWidth={2.2} dot={{ r: 3 }} />
                      <Line dataKey="failed" name="Failed" stroke="#DC2626" strokeWidth={2.2} dot={{ r: 3 }} />
                      <Line dataKey="error" name="Errors" stroke="#D97706" strokeWidth={1.8} strokeDasharray="4 3" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Panel>

              {/* Chart 2: Result Distribution Donut */}
              <Panel
                title={
                  <div>
                    <p className="font-semibold text-slate-900">Execution Result Distribution</p>
                    <p className="text-[11px] font-normal text-slate-500">Cumulative distribution of test outcomes across runs</p>
                  </div>
                }
                className="flex flex-col"
                bodyClass="h-64 pt-2"
              >
                {!d ? (
                  <LoadingBlock />
                ) : !d.charts.result_distribution.length ? (
                  <EmptyState title="No execution results in this period" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={d.charts.result_distribution}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        onClick={(e: any) =>
                          nav(`/executions?${scope}status=${e.status === "passed" ? "passed" : "failed"}`)
                        }
                      >
                        {d.charts.result_distribution.map((r: any) => (
                          <Cell key={r.status} fill={STATUS_COLOR[r.status] ?? "#94A3B8"} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, n) => [
                          `${v} tests (${pct(
                            (Number(v) / (d.charts.result_distribution.reduce((acc: number, c: any) => acc + c.count, 0) || 1)) * 100
                          )})`,
                          label(String(n)),
                        ]}
                      />
                      <Legend formatter={(v) => label(v)} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Panel>

              {/* Chart 3: Requirement & Clause Coverage (Isolated Project Coverage) */}
              <Panel
                title={
                  <div>
                    <p className="font-semibold text-slate-900">Requirement & Clause Coverage</p>
                    <p className="text-[11px] font-normal text-slate-500">
                      {d?.charts?.coverage_breakdown
                        ? `${d.charts.coverage_breakdown.coverage_pct}% — ${d.charts.coverage_breakdown.covered_clauses} of ${d.charts.coverage_breakdown.total_clauses} clauses covered`
                        : "Clause coverage status breakdown"}
                    </p>
                  </div>
                }
                className="flex flex-col"
                bodyClass="h-64 pt-2"
              >
                {!d ? (
                  <LoadingBlock />
                ) : d.charts.coverage_breakdown ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={d.charts.coverage_breakdown.categories}
                      margin={{ top: 10, left: -10, right: 10, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="category" tick={axis} />
                      <YAxis tick={axis} allowDecimals={false} label={{ value: "Requirements", angle: -90, position: "insideLeft", offset: 12, fontSize: 10, fill: "#94A3B8" }} />
                      <Tooltip formatter={(v, _n, item) => [`${v} reqs (${(item.payload as any).pct}%)`, "Status"]} />
                      <Bar
                        dataKey="count"
                        name="Requirements"
                        radius={[4, 4, 0, 0]}
                        cursor="pointer"
                        onClick={() => nav(`/traceability?${scope}`)}
                      >
                        {d.charts.coverage_breakdown.categories.map((entry: any) => (
                          <Cell
                            key={entry.category}
                            fill={
                              entry.category === "Fully Covered"
                                ? "#059669"
                                : entry.category === "Partially Covered"
                                ? "#D97706"
                                : "#94A3B8"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No clause coverage data available" />
                )}
              </Panel>

              {/* Chart 4: Open Defects by Severity */}
              <Panel
                title={
                  <div>
                    <p className="font-semibold text-slate-900">Open Defects by Severity</p>
                    <p className="text-[11px] font-normal text-slate-500">Currently active defects requiring resolution, ordered by severity</p>
                  </div>
                }
                className="flex flex-col"
                bodyClass="h-64 pt-2"
              >
                {!d ? (
                  <LoadingBlock />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={d.charts.defect_severity}
                      layout="vertical"
                      margin={{ top: 10, left: 15, right: 20, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                      <XAxis type="number" tick={axis} allowDecimals={false} label={{ value: "Open Defects", position: "insideBottom", offset: -5, fontSize: 10, fill: "#94A3B8" }} />
                      <YAxis type="category" dataKey="severity" tick={axis} tickFormatter={label} width={75} />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        name="Open defects"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={(e: any) => nav(`/defects?${scope}severity=${e.severity}&open_only=true`)}
                      >
                        {d.charts.defect_severity.map((r: any) => (
                          <Cell key={r.severity} fill={STATUS_COLOR[r.severity]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Panel>

              {/* Chart 5: Defects Opened vs Resolved */}
              <Panel
                title={
                  <div>
                    <p className="font-semibold text-slate-900">Defects Opened vs Resolved</p>
                    <p className="text-[11px] font-normal text-slate-500">Defect discovery vs remediation velocity by week</p>
                  </div>
                }
                className="flex flex-col"
                bodyClass="h-64 pt-2"
              >
                {!d ? (
                  <LoadingBlock />
                ) : !d.charts.defect_resolution.length ? (
                  <EmptyState title="No defect history in this period" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.charts.defect_resolution} margin={{ top: 10, left: -10, right: 10, bottom: 0 }}>
                      <CartesianGrid stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="week" tick={axis} label={{ value: "Week", position: "insideBottom", offset: -5, fontSize: 10, fill: "#94A3B8" }} />
                      <YAxis tick={axis} allowDecimals={false} label={{ value: "Defect Count", angle: -90, position: "insideLeft", offset: 12, fontSize: 10, fill: "#94A3B8" }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                      <Bar dataKey="opened" name="Opened" fill="#EA580C" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="resolved" name="Resolved" fill="#059669" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Panel>

              {/* Chart 6: Test Case Status Breakdown */}
              <Panel
                title={
                  <div>
                    <p className="font-semibold text-slate-900">Test Case Review Status</p>
                    <p className="text-[11px] font-normal text-slate-500">Test cases grouped by dual-control approval lifecycle</p>
                  </div>
                }
                className="flex flex-col"
                bodyClass="h-64 pt-2"
              >
                {!d ? (
                  <LoadingBlock />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.charts.test_status} layout="vertical" margin={{ top: 10, left: 30, right: 20, bottom: 0 }}>
                      <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                      <XAxis type="number" tick={axis} allowDecimals={false} label={{ value: "Test Count", position: "insideBottom", offset: -5, fontSize: 10, fill: "#94A3B8" }} />
                      <YAxis type="category" dataKey="status" tick={axis} tickFormatter={label} width={105} />
                      <Tooltip labelFormatter={label} />
                      <Bar
                        dataKey="count"
                        name="Tests"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={(e: any) => nav(`/tests?${scope}status=${e.status}`)}
                      >
                        {d.charts.test_status.map((r: any) => (
                          <Cell key={r.status} fill={STATUS_COLOR[r.status] ?? "#64748B"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Panel>
            </div>
          </div>

          {/* =========================================================================
              SECTION 4 — ACTIONABLE QUALITY INSIGHTS (Direct Links to Scoped Workspaces)
              ========================================================================= */}
          <div>
            <div className="flex items-center justify-between mb-2.5 px-0.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Actionable Quality Insights
              </h2>
              <span className="text-2xs text-slate-400">
                Priority items requiring engineering or QA review
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Insight 1: Pending Dual-Control Reviews */}
              <div
                onClick={() => nav(`/tests/review?${scope}`)}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-amber-300 hover:bg-amber-50/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-amber-600 font-mono">
                    {k?.pending_reviews ?? 0} Pending
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-slate-900 group-hover:text-amber-800">
                  Four-Eyes Approval Queue
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {k?.pending_reviews
                    ? `${k.pending_reviews} test cases await peer review and cryptographic sign-off before execution.`
                    : "All test cases are approved and ready for automated execution."}
                </p>
                <div className="mt-3 flex items-center text-xs font-medium text-amber-700 group-hover:underline">
                  <span>Open Review Queue</span>
                  <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>

              {/* Insight 2: Uncovered Requirements / Traceability Gaps */}
              <div
                onClick={() => nav(`/traceability?${scope}`)}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-300 hover:bg-blue-50/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-200/60">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-[#1D4ED8] font-mono">
                    {d?.charts?.coverage_breakdown?.uncovered_clauses ?? 0} Uncovered
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-slate-900 group-hover:text-[#1D4ED8]">
                  Traceability Coverage Gaps
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {d?.charts?.coverage_breakdown?.uncovered_clauses
                    ? `${d.charts.coverage_breakdown.uncovered_clauses} clauses lack active test cases. Synthesize tests to achieve full coverage.`
                    : "All current specification clauses have verified test coverage."}
                </p>
                <div className="mt-3 flex items-center text-xs font-medium text-[#1D4ED8] group-hover:underline">
                  <span>View Traceability Matrix</span>
                  <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>

              {/* Insight 3: Critical Open Defects */}
              <div
                onClick={() => nav(`/defects?${scope}severity=critical&open_only=true`)}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-red-300 hover:bg-red-50/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 border border-red-200/60">
                    <Flame className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-red-600 font-mono">
                    {k?.critical_defects ?? 0} Blocker
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-slate-900 group-hover:text-red-800">
                  Critical Defect Governance
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {k?.critical_defects
                    ? `${k.critical_defects} critical defects block release certification. Retest and verify fixes.`
                    : "Zero critical defects reported for this project workspace."}
                </p>
                <div className="mt-3 flex items-center text-xs font-medium text-red-700 group-hover:underline">
                  <span>Inspect Defect Register</span>
                  <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>

              {/* Insight 4: Failed Executions / Retests */}
              <div
                onClick={() => nav(`/executions?${scope}status=failed`)}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-orange-300 hover:bg-orange-50/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600 border border-orange-200/60">
                    <PlayCircle className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-orange-600 font-mono">
                    {k?.failed_executions ?? 0} Failed Runs
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-slate-900 group-hover:text-orange-800">
                  Failed Execution Remediation
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {k?.failed_executions
                    ? `${k.failed_executions} execution runs failed due to assertion regressions or environment errors.`
                    : "No failing execution runs detected in the current filter window."}
                </p>
                <div className="mt-3 flex items-center text-xs font-medium text-orange-700 group-hover:underline">
                  <span>Review Run Logs</span>
                  <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 5 — RECENT ACTIVITY & EXECUTIONS (Project-scoped real records)
              ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Executions */}
            <Panel
              title={
                <div>
                  <p className="font-semibold text-slate-900">Recent Project Executions</p>
                  <p className="text-[11px] font-normal text-slate-500">Latest sandboxed test runs and verification passes</p>
                </div>
              }
              actions={
                <Link to={`/executions?${scope}`} className="text-xs font-medium text-[#1D4ED8] hover:underline flex items-center gap-1">
                  <span>View All</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              }
              bodyClass="p-0"
            >
              {!d ? (
                <div className="p-4"><LoadingBlock /></div>
              ) : !d.recent_executions?.length ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No executions recorded for this project yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {d.recent_executions.slice(0, 5).map((ex: any) => (
                    <div
                      key={ex.id}
                      onClick={() => nav(`/executions/${ex.id}`)}
                      className="flex items-center justify-between p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border uppercase shrink-0",
                            ex.status === "passed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : ex.status === "failed"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          )}
                        >
                          {ex.status}
                        </span>
                        <div className="truncate">
                          <span className="font-semibold text-slate-900 font-mono">{ex.key}</span>
                          <span className="text-slate-400 mx-1.5">&bull;</span>
                          <span className="text-slate-500">{ex.source || "Automated"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-slate-500">
                        <span className="font-mono text-[11px]">
                          <span className="text-emerald-600 font-semibold">{ex.passed}P</span>{" "}
                          <span className="text-red-600 font-semibold">{ex.failed}F</span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {ex.started_at ? fmtDate(ex.started_at) : "Recent"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Recent Requirement Versions / Updates */}
            <Panel
              title={
                <div>
                  <p className="font-semibold text-slate-900">Recent Requirement Changes</p>
                  <p className="text-[11px] font-normal text-slate-500">Audited clause and specification modifications</p>
                </div>
              }
              actions={
                <Link to={`/requirements?${scope}`} className="text-xs font-medium text-[#1D4ED8] hover:underline flex items-center gap-1">
                  <span>View All</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              }
              bodyClass="p-0"
            >
              {!d ? (
                <div className="p-4"><LoadingBlock /></div>
              ) : !d.recent_changes?.length ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No requirement version modifications recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {d.recent_changes.slice(0, 5).map((ch: any) => (
                    <div
                      key={`${ch.requirement_id}-${ch.version}`}
                      onClick={() => nav(`/requirements/${ch.requirement_id}`)}
                      className="flex items-center justify-between p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#1D4ED8] border border-blue-200">
                          {ch.key}
                        </span>
                        <div className="truncate">
                          <span className="font-semibold text-slate-800">{ch.title}</span>
                          <span className="text-[11px] text-slate-400 block truncate">{ch.summary || "Specification updated"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                          v{ch.version}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {ch.at ? fmtDate(ch.at) : "Recent"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* =========================================================================
              SECTION 5.5 — AGGREGATE PROJECT COMPARISON TABLE (ONLY in All Workspaces)
              ========================================================================= */}
          {isAggregate && d?.projects && (
            <div>
              <div className="flex items-center justify-between mb-2.5 px-0.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Cross-Project Quality Comparison
                </h2>
                <span className="text-2xs text-slate-400">
                  Available exclusively in aggregate workspace view
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 font-semibold text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Project Workspace</th>
                      <th className="px-4 py-3">Clause Coverage</th>
                      <th className="px-4 py-3">Executions</th>
                      <th className="px-4 py-3">Pass Rate</th>
                      <th className="px-4 py-3">Open Defects</th>
                      <th className="px-4 py-3">Critical Defects</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d.projects.map((p: any) => (
                      <tr
                        key={p.project_id ?? p.key}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                        onClick={() => {
                          if (p.project_id) setProjectId(p.project_id);
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {p.key}
                            </span>
                            <span className="font-semibold text-slate-900">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-slate-700">{pct(p.coverage_pct)}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{p.executions}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {p.pass_rate !== null ? pct(p.pass_rate) : "N/A"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "font-mono font-semibold",
                              p.open_defects > 0 ? "text-amber-600" : "text-emerald-600"
                            )}
                          >
                            {p.open_defects}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "font-mono font-semibold",
                              p.critical_defects > 0 ? "text-red-600" : "text-slate-400"
                            )}
                          >
                            {p.critical_defects}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-medium text-[#1D4ED8] hover:underline">
                            Open Workspace &rarr;
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              SECTION 6 — END-TO-END QA JOURNEY (Moved to lower section, collapsible)
              ========================================================================= */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <button
              type="button"
              onClick={() => setJourneyOpen(!journeyOpen)}
              className="flex items-center justify-between w-full text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-200/60">
                  <Compass className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      End-to-End QA Journey
                    </h3>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#1D4ED8] border border-blue-200">
                      6 Guided Stages
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                    Continuous traceability pipeline from specification ingestion to verified defect remediation.
                  </p>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-slate-400 transition-transform duration-200 group-hover:text-slate-600",
                  !journeyOpen && "-rotate-90"
                )}
              />
            </button>

            {journeyOpen && (
              <div className="mt-4 pt-3.5 border-t border-slate-100">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
                  {[
                    {
                      num: 1,
                      name: "Connect",
                      detail: current?.key ? `${current.key} Active` : "Select Workspace",
                      active: true,
                      done: !!current?.key,
                      onClick: () => nav("/projects"),
                    },
                    {
                      num: 2,
                      name: "Analyze",
                      detail: k ? `${k.analysed_requirements} Analyzed` : "Loading…",
                      active: (k?.analysed_requirements ?? 0) > 0,
                      done: Boolean(k && k.total_requirements > 0 && k.analysed_requirements >= k.total_requirements),
                      onClick: () => nav(`/requirements?${scope}`),
                    },
                    {
                      num: 3,
                      name: "Requirements",
                      detail: k ? `${k.total_requirements} Recorded` : "Loading…",
                      active: (k?.total_requirements ?? 0) > 0,
                      done: (k?.total_requirements ?? 0) > 0,
                      onClick: () => nav(`/requirements?${scope}`),
                    },
                    {
                      num: 4,
                      name: "Test Generation",
                      detail: k ? `${k.total_test_cases} Test Cases` : "Loading…",
                      active: (k?.total_test_cases ?? 0) > 0,
                      done: (k?.total_test_cases ?? 0) > 0,
                      onClick: () => nav(`/tests?${scope}`),
                    },
                    {
                      num: 5,
                      name: "Execute",
                      detail: k ? `${k.total_executions} Runs Recorded` : "Loading…",
                      active: (k?.total_executions ?? 0) > 0,
                      done: (k?.total_executions ?? 0) > 0,
                      onClick: () => nav(`/executions?${scope}`),
                    },
                    {
                      num: 6,
                      name: "Defects & Retest",
                      detail: `${k?.open_defects ?? 0} Open`,
                      active: (k?.open_defects ?? 0) > 0,
                      done: (k?.open_defects ?? 0) === 0 && (k?.total_executions ?? 0) > 0,
                      onClick: () => nav(`/defects?${scope}open_only=true`),
                    },
                  ].map((s) => (
                    <button
                      key={s.num}
                      type="button"
                      onClick={s.onClick}
                      className={cn(
                        "flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer group",
                        s.done
                          ? "border-emerald-200/80 bg-emerald-50/20 hover:bg-emerald-50/40"
                          : "border-slate-200/80 bg-slate-50/60 hover:bg-blue-50/40 hover:border-blue-200"
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-2xs font-mono font-bold text-slate-400 group-hover:text-[#1D4ED8]">
                          0{s.num}
                        </span>
                        {s.done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-slate-300 group-hover:bg-[#1D4ED8]" />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-900 group-hover:text-[#1D4ED8]">
                        {s.name}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate mt-0.5">
                        {s.detail}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
