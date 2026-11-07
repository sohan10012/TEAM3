import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  GitBranch,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
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
import { EmptyState, ErrorState, LoadingBlock, PageHeader, Panel, Skeleton, Stat } from "@/components/ui";
import { CountUp } from "@/components/common/CountUp";
import { ProductionProjectDashboard } from "@/components/dashboard/ProductionProjectDashboard";
import { RequirementsProjectDashboard } from "@/components/dashboard/RequirementsProjectDashboard";
import { useProjects } from "@/hooks/useProjects";
import { ConnectRepoDialog } from "@/pages/ProjectsPage";
import { api } from "@/services/api";
import { label, pct } from "@/utils/format";

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
  deprecated: "#94A3B8",
  critical: "#B91C1C",
  high: "#EA580C",
  medium: "#D97706",
  low: "#94A3B8",
};

const axis = { fontSize: 11, fill: "#64748B" };

function ProjectOnboardingHub({ current }: { current?: any }) {
  const nav = useNavigate();

  return (
    <div className="space-y-6">
      {/* Hero Welcome Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#3067DB] border border-blue-100">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{current?.name || "Enterprise"} Quality Engineering Workspace</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              Ready for {current?.name || "Requirement"} Verification
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Verify {current?.name ? `${current.name} specifications` : "business requirements"} through AI-assisted clause decomposition, ambiguity detection,
              grounded acceptance criteria synthesis, and sandboxed test execution against target environments.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/requirements"
              className="inline-flex items-center gap-1.5 rounded bg-[#3067DB] hover:bg-[#2554B8] px-3.5 py-2 text-xs font-medium text-white shadow-xs transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Ingest First Requirement</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4-Step Operational Workflow Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-[#3067DB]">
              <FileText className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900">1. Ingest Requirements</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Upload business scenarios, CR documents, or policies in PDF, TXT, or Markdown format with immutable versioning.
            </p>
          </div>
          <button
            onClick={() => nav("/requirements")}
            className="mt-4 flex items-center gap-1 text-xs font-medium text-[#3067DB] hover:underline pt-2 border-t border-slate-100"
          >
            <span>Open Requirements</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-cyan-50 text-[#0891B2]">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900">2. AI Clause & Ambiguity Analysis</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Extract atomic clauses, detect ambiguous phrases ("reasonable", "timely"), and generate quote-verified acceptance criteria.
            </p>
          </div>
          <button
            onClick={() => nav("/requirements")}
            className="mt-4 flex items-center gap-1 text-xs font-medium text-[#0891B2] hover:underline pt-2 border-t border-slate-100"
          >
            <span>AI Workflow</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
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
            onClick={() => nav("/tests/review")}
            className="mt-4 flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline pt-2 border-t border-slate-100"
          >
            <span>Review Queue</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
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
            onClick={() => nav("/executions")}
            className="mt-4 flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline pt-2 border-t border-slate-100"
          >
            <span>Test Executions</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Project Modules */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#3067DB]" />
            <h3 className="text-xs font-semibold text-slate-900">
              {current?.name ? `${current.name} Verification Modules` : "Project Modules"}
            </h3>
          </div>
          <Link to="/projects" className="text-xs font-medium text-[#3067DB] hover:underline">
            View All Projects
          </Link>
        </div>
        {current?.modules?.length ? (
          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2 lg:grid-cols-4">
            {current.modules.map((module: { id: number; code: string; name: string; description: string }) => (
              <div key={module.id} className="rounded border border-slate-200 bg-slate-50/50 p-3">
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

function AnalyticsDashboardView({ projectId, current }: { projectId: number | null; current: any }) {
  const nav = useNavigate();
  const { setProjectId } = useProjects();
  const [range, setRange] = useState({ from: "", to: "" });
  const [connectOpen, setConnectOpen] = useState(false);
  const q = useQuery({
    queryKey: ["dashboard", projectId, range],
    queryFn: () =>
      api.get<any>("/analytics/dashboard", {
        project_id: projectId,
        date_from: range.from || undefined,
        date_to: range.to || undefined,
      }),
  });
  const d = q.data;
  const k = d?.kpis;
  const scope = projectId ? `project_id=${projectId}&` : "";
  const isEmptyWorkspace = k && k.total_requirements === 0 && k.total_executions === 0;

  return (
    <>
      <PageHeader
        title={current ? `${current.name} Command Center` : "Enterprise Quality Command Center"}
        subtitle={
          current
            ? current.description
            : "Real-time verification metrics and quality intelligence for business requirements."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <button
              onClick={() => setConnectOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded bg-[#3067DB] hover:bg-[#2554B8] px-3.5 text-xs font-medium text-white shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>Connect GitHub Repository</span>
            </button>
            <div className="flex h-9 items-center gap-2 rounded border border-slate-200 bg-white px-2.5 text-xs text-slate-600 shadow-2xs">
              <span className="font-medium text-slate-500">From</span>
              <input
                type="date"
                aria-label="Filter from date"
                className="h-7 border-0 bg-transparent text-xs text-slate-800 focus:outline-none focus:ring-0"
                value={range.from}
                onChange={(e) => setRange({ ...range, from: e.target.value })}
              />
              <span className="text-slate-300">|</span>
              <span className="font-medium text-slate-500">To</span>
              <input
                type="date"
                aria-label="Filter to date"
                className="h-7 border-0 bg-transparent text-xs text-slate-800 focus:outline-none focus:ring-0"
                value={range.to}
                onChange={(e) => setRange({ ...range, to: e.target.value })}
              />
            </div>
          </div>
        }
      />

      {/* Guided 6-Step End-to-End Project Journey Header */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">End-to-End QA Journey</span>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#3067DB] border border-blue-100">
              6 Guided Stages
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Continuous traceability from code ingestion to verified defect fixes
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          {[
            {
              num: 1,
              name: "Connect",
              detail: current?.key ? `${current.key} selected` : "Select a project",
              active: true,
              done: !!current?.key,
              onClick: () => setConnectOpen(true),
            },
            {
              num: 2,
              name: "Analyze",
              detail: k ? `${k.analysed_requirements} analyzed` : "Loading…",
              active: (k?.analysed_requirements ?? 0) > 0,
              done: Boolean(k && k.total_requirements > 0 && k.analysed_requirements >= k.total_requirements),
              onClick: () => nav("/projects"),
            },
            {
              num: 3,
              name: "Requirements",
              detail: k ? `${k.total_requirements} recorded` : "Loading…",
              active: (k?.total_requirements ?? 0) > 0,
              done: (k?.total_requirements ?? 0) > 0,
              onClick: () => nav(`/requirements?${scope}`),
            },
            {
              num: 4,
              name: "Test Generation",
              detail: k ? `${k.total_test_cases} test cases` : "Loading…",
              active: (k?.total_test_cases ?? 0) > 0,
              done: (k?.total_test_cases ?? 0) > 0,
              onClick: () => nav(`/tests?${scope}`),
            },
            {
              num: 5,
              name: "Execute",
              detail: k ? `${k.total_executions} execution records` : "Loading…",
              active: (k?.total_executions ?? 0) > 0,
              done: (k?.total_executions ?? 0) > 0,
              onClick: () => nav(`/executions?${scope}`),
            },
            {
              num: 6,
              name: "Defects & Retest",
              detail: `${k?.open_defects ?? 0} Open`,
              active: (k?.open_defects ?? 0) > 0,
              done: (k?.total_defects ?? 0) > 0,
              onClick: () => nav(`/defects?${scope}`),
            },
          ].map((s) => (
            <button
              key={s.num}
              onClick={s.onClick}
              className="flex flex-col text-left p-2.5 rounded border border-slate-100 bg-slate-50/70 hover:bg-blue-50/50 hover:border-blue-200 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-2xs font-mono font-medium text-slate-400 group-hover:text-[#3067DB]">
                  0{s.num}
                </span>
                {s.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-slate-300" />
                )}
              </div>
              <span className="text-xs font-semibold text-slate-900 group-hover:text-[#3067DB]">{s.name}</span>
              <span className="text-[11px] text-slate-500 truncate mt-0.5">{s.detail}</span>
            </button>
          ))}
        </div>
      </div>

      {q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <>
          {/* Data-Driven Stat Counters */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-7 mb-6">
            {!k ? (
              Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20" />)
            ) : (
              <>
                <Stat
                  label="Requirements"
                  value={<CountUp value={k.total_requirements} />}
                  hint={`${k.analysed_requirements} analysed`}
                  onClick={() => nav(`/requirements?${scope}`)}
                />
                <Stat
                  label="Clause coverage"
                  value={<CountUp value={k.requirement_coverage} decimals={1} suffix="%" />}
                  hint="Clauses with active tests"
                  onClick={() => nav("/traceability")}
                />
                <Stat
                  label="Test cases"
                  value={<CountUp value={k.total_test_cases} />}
                  hint={`${k.approved_test_cases} approved`}
                  onClick={() => nav(`/tests?${scope}`)}
                />
                <Stat
                  label="Pending reviews"
                  value={<CountUp value={k.pending_reviews} />}
                  hint="Awaiting dual-control"
                  onClick={() => nav(`/tests/review?${scope}`)}
                />
                <Stat
                  label="Test pass rate"
                  value={<CountUp value={k.pass_rate} decimals={1} suffix="%" />}
                  hint={`${k.total_executions} executions`}
                  onClick={() => nav(`/executions?${scope}`)}
                />
                <Stat
                  label="Open defects"
                  value={<CountUp value={k.open_defects} />}
                  hint={`${k.failed_executions} failed executions`}
                  onClick={() => nav(`/defects?${scope}open_only=true`)}
                />
                <Stat
                  label="Critical defects"
                  value={<CountUp value={k.critical_defects} />}
                  intent={k.critical_defects ? "bad" : "good"}
                  onClick={() => nav(`/defects?${scope}severity=critical&open_only=true`)}
                />
              </>
            )}
          </div>

          {/* If workspace has no requirements/executions, display Onboarding Hub */}
          {isEmptyWorkspace ? (
            <ProjectOnboardingHub current={current} />
          ) : (
            <>
              {/* Analytics Panels when real data exists */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <Panel title="Test execution trend" className="xl:col-span-2" bodyClass="h-64">
                  {!d ? (
                    <LoadingBlock />
                  ) : !d.charts.execution_trend.length ? (
                    <EmptyState title="No executions recorded in this date range" />
                  ) : (
                    <ResponsiveContainer>
                      <LineChart data={d.charts.execution_trend} margin={{ left: -10, right: 8 }}>
                        <CartesianGrid stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="week" tick={axis} />
                        <YAxis tick={axis} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line dataKey="passed" name="Passed" stroke="#059669" strokeWidth={2} dot={false} />
                        <Line dataKey="failed" name="Failed" stroke="#DC2626" strokeWidth={2} dot={false} />
                        <Line dataKey="error" name="Errors" stroke="#D97706" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Panel>

                <Panel title="Result distribution" bodyClass="h-64">
                  {!d ? (
                    <LoadingBlock />
                  ) : !d.charts.result_distribution.length ? (
                    <EmptyState title="No execution results in this date range" />
                  ) : (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={d.charts.result_distribution}
                          dataKey="count"
                          nameKey="status"
                          innerRadius={55}
                          outerRadius={85}
                          onClick={(e: any) => nav(`/executions?${scope}status=${e.status === "passed" ? "passed" : "failed"}`)}
                        >
                          {d.charts.result_distribution.map((r: any) => (
                            <Cell key={r.status} fill={STATUS_COLOR[r.status] ?? "#94A3B8"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v, label(String(n))]} />
                        <Legend formatter={(v) => label(v)} wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Panel>

                <Panel title="Clause coverage by project" bodyClass="h-64">
                  {!d ? (
                    <LoadingBlock />
                  ) : (
                    <ResponsiveContainer>
                      <BarChart data={d.charts.coverage_by_project} margin={{ left: -10 }}>
                        <CartesianGrid stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="project" tick={axis} />
                        <YAxis tick={axis} domain={[0, 100]} unit="%" />
                        <Tooltip formatter={(v) => `${v}%`} />
                        <Bar
                          dataKey="coverage_pct"
                          name="Clause coverage"
                          fill="#3067DB"
                          radius={[3, 3, 0, 0]}
                          onClick={(e: any) => nav(`/traceability?project_id=${e.project_id}`)}
                          cursor="pointer"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Panel>

                <Panel title="Open defects by severity" bodyClass="h-64">
                  {!d ? (
                    <LoadingBlock />
                  ) : (
                    <ResponsiveContainer>
                      <BarChart data={d.charts.defect_severity} margin={{ left: -10 }}>
                        <CartesianGrid stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="severity" tick={axis} tickFormatter={label} />
                        <YAxis tick={axis} allowDecimals={false} />
                        <Tooltip />
                        <Bar
                          dataKey="count"
                          name="Open defects"
                          radius={[3, 3, 0, 0]}
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

                <Panel title="Defects opened and resolved" bodyClass="h-64">
                  {!d ? (
                    <LoadingBlock />
                  ) : !d.charts.defect_resolution.length ? (
                    <EmptyState title="No defect history in this date range" />
                  ) : (
                    <ResponsiveContainer>
                      <BarChart data={d.charts.defect_resolution} margin={{ left: -10 }}>
                        <CartesianGrid stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="week" tick={axis} />
                        <YAxis tick={axis} allowDecimals={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="opened" name="Opened" fill="#EA580C" />
                        <Bar dataKey="resolved" name="Resolved" fill="#059669" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Panel>

                <Panel title="Test case status" bodyClass="h-64">
                  {!d ? (
                    <LoadingBlock />
                  ) : (
                    <ResponsiveContainer>
                      <BarChart data={d.charts.test_status} layout="vertical" margin={{ left: 30 }}>
                        <XAxis type="number" tick={axis} />
                        <YAxis type="category" dataKey="status" tick={axis} tickFormatter={label} width={110} />
                        <Tooltip labelFormatter={label} />
                        <Bar
                          dataKey="count"
                          name="Tests"
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

              {/* Project quality table */}
              <div className="mt-4">
                <Panel title="Project quality" bodyClass="p-0">
                  {!d ? (
                    <div className="p-4"><LoadingBlock /></div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                        <tr>
                          <th className="px-4 py-2.5">Project</th>
                          <th className="px-4 py-2.5">Clause coverage</th>
                          <th className="px-4 py-2.5">Executions</th>
                          <th className="px-4 py-2.5">Pass rate</th>
                          <th className="px-4 py-2.5">Open defects</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {d.projects.map((p: any) => (
                          <tr key={p.project_id ?? p.key} className="hover:bg-slate-50 cursor-pointer" onClick={() => {
                            if (p.project_id) setProjectId(p.project_id);
                            nav(`/projects/${p.project_id}`);
                          }}>
                            <td className="px-4 py-2.5 font-medium text-slate-900">{p.key} — {p.name}</td>
                            <td className="px-4 py-2.5 text-slate-600">{pct(p.coverage_pct)}</td>
                            <td className="px-4 py-2.5 text-slate-600">{p.executions}</td>
                            <td className="px-4 py-2.5 text-slate-600">{pct(p.pass_rate)}</td>
                            <td className="px-4 py-2.5 text-slate-600">{p.open_defects}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Panel>
              </div>
            </>
          )}
        </>
      )}
      <ConnectRepoDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </>
  );
}

export default function DashboardPage() {
  const { projectId, current } = useProjects();
  if (projectId && current && current.key !== "SMPL" && current.key !== "PAY") {
    const fallback = <AnalyticsDashboardView projectId={projectId} current={current} />;
    if (current?.project_type === "requirements_based") {
      return <RequirementsProjectDashboard projectId={projectId} isDashboard fallback={fallback} />;
    }
    return <ProductionProjectDashboard projectId={projectId} fallback={fallback} />;
  }
  return <AnalyticsDashboardView projectId={projectId} current={current} />;
}
