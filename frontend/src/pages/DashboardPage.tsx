import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileText,
  GitBranch,
  GitCommit,
  PlayCircle,
  Server,
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
  const isEcho = Boolean(current?.key === "ECHO" || current?.name?.toLowerCase().includes("echobox"));

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

      {/* Domain / Architecture Directory */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#3067DB]" />
            <h3 className="text-xs font-semibold text-slate-900">
              {isEcho ? "EchoBox Target Architecture Components" : (current ? `${current.name} Verification Modules` : "Target System Modules")}
            </h3>
          </div>
          <Link to="/projects" className="text-xs font-medium text-[#3067DB] hover:underline">
            View All Projects
          </Link>
        </div>
        {isEcho ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded border border-slate-200 p-3 bg-slate-50/50">
              <span className="font-semibold text-slate-800 block">ECHO-ROOM: Ephemeral Rooms</span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Room creation, 24-hour TTL expiration, pseudonym generation, room ownership.
              </span>
            </div>
            <div className="rounded border border-slate-200 p-3 bg-slate-50/50">
              <span className="font-semibold text-slate-800 block">ECHO-MSG: Messages & RPC</span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Anonymous message submission, DynamoDB single-table storage, rate limiting.
              </span>
            </div>
            <div className="rounded border border-slate-200 p-3 bg-slate-50/50">
              <span className="font-semibold text-slate-800 block">ECHO-AUTH: Dual Cognito Pools</span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Owner vs respondent authentication, JWT signature validation, token expiry.
              </span>
            </div>
            <div className="rounded border border-slate-200 p-3 bg-slate-50/50">
              <span className="font-semibold text-slate-800 block">ECHO-MOD: Moderation & Export</span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Content filtering, room closing, CSV/JSON export, soft-delete archival.
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded border border-slate-200 p-3 bg-slate-50/50">
              <span className="font-semibold text-slate-800 block">Requirements Analysis</span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Source document parsing, clause extraction, ambiguity scoring, and rule discovery.
              </span>
            </div>
            <div className="rounded border border-slate-200 p-3 bg-slate-50/50">
              <span className="font-semibold text-slate-800 block">Test Synthesis</span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Grounded acceptance criteria generation, automated test cases, and fixture synthesis.
              </span>
            </div>
            <div className="rounded border border-slate-200 p-3 bg-slate-50/50">
              <span className="font-semibold text-slate-800 block">Isolated Execution</span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Sandboxed runtime execution, assertion verification, and execution trace recording.
              </span>
            </div>
            <div className="rounded border border-slate-200 p-3 bg-slate-50/50">
              <span className="font-semibold text-slate-800 block">Defect & Quality Audit</span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Automated triage, immutable defect logging, regression tracking, and exportable reports.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsDashboardView({ projectId, current }: { projectId: number | null; current: any }) {
  const nav = useNavigate();
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
              detail: current?.key ? `${current.key} Connected` : "Repository Link",
              active: true,
              done: !!current?.key,
              onClick: () => setConnectOpen(true),
            },
            {
              num: 2,
              name: "Analyze",
              detail: current?.key ? "Source & AST Mapped" : "Inspect Source",
              active: !!current?.key,
              done: !!current?.key,
              onClick: () => nav("/projects"),
            },
            {
              num: 3,
              name: "Requirements",
              detail: `${k?.total_requirements ?? 0} Grounded`,
              active: (k?.total_requirements ?? 0) > 0,
              done: (k?.total_requirements ?? 0) > 0,
              onClick: () => nav(`/requirements?${scope}`),
            },
            {
              num: 4,
              name: "Test Generation",
              detail: `${k?.total_test_cases ?? 0} Traceable`,
              active: (k?.total_test_cases ?? 0) > 0,
              done: (k?.total_test_cases ?? 0) > 0,
              onClick: () => nav(`/tests?${scope}`),
            },
            {
              num: 5,
              name: "Execute",
              detail: `${k?.total_executions ?? 0} Sandboxed`,
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

      {/* Connected Repository & Multi-Environment Verification Status */}
      {((current as any)?.github || current?.key === "ECHO") && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#3067DB] border border-blue-100">
                {current?.key || "ECHO"}
              </span>
              <span className="text-xs font-semibold text-slate-900 tracking-tight">
                Repository & Execution Environment Status
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setConnectOpen(true)}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition-colors cursor-pointer"
              >
                <GitBranch className="h-3.5 w-3.5 text-slate-500" />
                <span>Connect another repository</span>
              </button>
            </div>
          </div>

          {/* Source Revision Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs mb-4">
            <div className="rounded border border-slate-100 bg-slate-50/60 p-2.5">
              <span className="text-[11px] font-medium text-slate-500 block">Repository</span>
              <a
                href={(current as any)?.github?.url || "https://github.com/sohan10012/EchoBox"}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
              >
                <span>{((current as any)?.github?.url || "https://github.com/sohan10012/EchoBox").replace(/^https?:\/\/github\.com\//, "")}</span>
                <ExternalLink className="h-3 w-3 inline" />
              </a>
            </div>
            <div className="rounded border border-slate-100 bg-slate-50/60 p-2.5">
              <span className="text-[11px] font-medium text-slate-500 block">Branch & Ref</span>
              <span className="font-mono text-xs text-slate-800 flex items-center gap-1 mt-0.5">
                <GitBranch className="h-3 w-3 text-slate-500" />
                <span>{(current as any)?.github?.branch || "main"}</span>
              </span>
            </div>
            <div className="rounded border border-slate-100 bg-slate-50/60 p-2.5">
              <span className="text-[11px] font-medium text-slate-500 block">Ingested Revision</span>
              <span className="font-mono text-xs text-slate-800 flex items-center gap-1 mt-0.5" title={(current as any)?.github?.commit_sha || "b3740a62ad414a141e82146adafb47c4850fd782"}>
                <GitCommit className="h-3 w-3 text-slate-500" />
                <span>{((current as any)?.github?.commit_sha || "b3740a62ad41").slice(0, 10)}</span>
              </span>
            </div>
            <div className="rounded border border-slate-100 bg-slate-50/60 p-2.5">
              <span className="text-[11px] font-medium text-slate-500 block">Source Architecture</span>
              <span className="text-xs font-medium text-slate-800 block mt-0.5">
                8 Modules • 13 RPC Actions • Single Table
              </span>
            </div>
          </div>

          {/* Multi-Environment Execution Ledger */}
          <div className="rounded border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Cpu className="h-3.5 w-3.5 text-slate-600" />
                <span>Verified Execution Environments</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Never combine sandbox mock results with live remote endpoints.
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
              {/* Real SUT Primary Engine */}
              <div className="rounded border border-emerald-200 bg-emerald-50/40 p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-900 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Real Code SUT (Primary)</span>
                  </span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                    moto DynamoDB
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Real SUT entrypoint (`kind="real_code"`, `is_default=true`). Executes actual Lambda handlers under moto DynamoDB in Linux bwrap+rlimits sandbox.
                </p>
              </div>

              {/* Simulation Harness Baseline */}
              <div className="rounded border border-slate-200 bg-slate-50/60 p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
                    <span>Simulation (Baseline)</span>
                  </span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                    In-Memory
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Fast in-memory simulation (`kind="simulation"`). Preserved as secondary baseline for regression detection.
                </p>
              </div>

              {/* AI Inference Providers */}
              <div className="rounded border border-blue-200 bg-blue-50/40 p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1">
                    <Server className="h-3.5 w-3.5 text-blue-600" />
                    <span>AI Provider SlotPool</span>
                  </span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                    Multi-Slot
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Groq (gpt-oss-120b) + Gemini (2.5-flash). Dynamic multi-slot rotation, rate-limit cooldown, and circuit breaker protection.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  label="Requirement coverage"
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

                <Panel title="Requirement coverage by project" bodyClass="h-64">
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
                          name="Coverage"
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
                          <th className="px-4 py-2.5">Coverage</th>
                          <th className="px-4 py-2.5">Executions</th>
                          <th className="px-4 py-2.5">Pass rate</th>
                          <th className="px-4 py-2.5">Open defects</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {d.projects.map((p: any) => (
                          <tr key={p.project_id ?? p.key} className="hover:bg-slate-50 cursor-pointer" onClick={() => nav(`/projects/${p.project_id}`)}>
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
      return <RequirementsProjectDashboard projectId={projectId} fallback={fallback} />;
    }
    return <ProductionProjectDashboard projectId={projectId} fallback={fallback} />;
  }
  return <AnalyticsDashboardView projectId={projectId} current={current} />;
}
