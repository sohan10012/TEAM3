import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bug,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  GitBranch,
  GitCommit,
  Github,
  Layers,
  Play,
  PlayCircle,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog } from "@/components/ui";
import { api } from "@/services/api";
import type { ProjectDashboardData } from "@/types/models";
import { cn } from "@/utils/format";

interface Props {
  projectId: number;
  isDetailView?: boolean;
  fallback?: React.ReactNode;
}

export function ProductionProjectDashboard({ projectId, isDetailView = false, fallback }: Props) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"runs" | "requirements" | "defects" | "config">("runs");
  const [selectedExId, setSelectedExId] = useState<number | null>(null);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [selectedEnvId, setSelectedEnvId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const query = useQuery({
    queryKey: ["project_dashboard", projectId, selectedExId],
    queryFn: () =>
      api.get<ProjectDashboardData>(`/projects/${projectId}/dashboard`, {
        execution_id: selectedExId || undefined,
      }),
    refetchInterval: 30_000,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      // Find suites or execute project tests
      const suitesRes = await api.get<{ items: { id: number }[] }>(`/suites?project_id=${projectId}`);
      if (suitesRes.items && suitesRes.items.length > 0) {
        return api.post(`/suites/${suitesRes.items[0].id}/execute`, {
          environment_id: selectedEnvId || undefined,
        });
      }
      // If no suites exist, trigger execution via retry/direct test
      return api.post(`/projects/${projectId}/environments`, {});
    },
    onSuccess: () => {
      setRunModalOpen(false);
      qc.invalidateQueries({ queryKey: ["project_dashboard", projectId] });
    },
  });

  if (query.isLoading) {
    return (
      <div className="py-20 text-center space-y-3">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#3067DB]" />
        <p className="text-sm font-medium text-slate-600">Loading project telemetry...</p>
      </div>
    );
  }

  if (!query.data) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center space-y-3 max-w-lg mx-auto my-12">
        <XCircle className="h-8 w-8 text-red-500 mx-auto" />
        <h3 className="text-sm font-semibold text-red-800">Failed to load project dashboard</h3>
        <p className="text-xs text-red-600">Could not retrieve telemetry for project ID {projectId}.</p>
        <button
          onClick={() => query.refetch()}
          className="inline-flex items-center gap-1.5 rounded bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  const data = query.data;
  const p = data?.project ?? ({} as any);
  const s = data?.summary ?? ({} as any);
  const q = data?.quality_coverage ?? ({} as any);
  const latestEx = data?.latest_execution;
  const repo = p?.repository ?? ({} as any);
  const currentEnv = p?.current_environment;

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 pb-16">
      {/* Project Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {isDetailView && (
            <button
              onClick={() => nav("/projects")}
              className="mt-0.5 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Back to Projects"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          {/* GitHub Project Avatar Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1F2328] text-white shadow-2xs">
            <Github className="h-5 w-5" />
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{p.name}</h1>
              {/* Project Health Status Badge */}
              {p.health_status === "healthy" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-2xs font-semibold text-[#065F46] border border-[#A7F3D0]">
                  <Check className="h-3 w-3" /> Healthy
                </span>
              )}
              {p.health_status === "degraded" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-2xs font-semibold text-red-700 border border-red-200">
                  <XCircle className="h-3 w-3" /> Degraded
                </span>
              )}
              {p.health_status === "warning" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-2xs font-semibold text-amber-700 border border-amber-200">
                  Warning
                </span>
              )}
              {p.health_status === "not_tested" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-2xs font-semibold text-slate-600 border border-slate-200">
                  Not Tested
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">{p.description}</p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {repo.url && (
            <a
              href={repo.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Github className="h-3.5 w-3.5 text-slate-700" />
              <span>Repository</span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          )}
          <button
            onClick={() => setRunModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1D63ED] hover:bg-[#1550C0] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
          >
            <PlayCircle className="h-4 w-4" />
            <span>Run Tests</span>
          </button>
        </div>
      </div>

      {/* Project Meta Information Row (5 Columns) */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 text-xs">
          {/* 1. Repository */}
          <div className="pt-2 md:pt-0 md:px-3 first:pl-0">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Repository</span>
            {repo.repo_name ? (
              <a
                href={repo.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#3067DB] hover:underline flex items-center gap-1 truncate"
              >
                <span className="truncate">{repo.repo_name}</span>
                <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
              </a>
            ) : (
              <span className="text-slate-400 italic">Not connected</span>
            )}
          </div>

          {/* 2. Branch */}
          <div className="pt-2 md:pt-0 md:px-3">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Branch</span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <GitBranch className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-mono text-xs">{repo.branch}</span>
            </div>
          </div>

          {/* 3. Latest Commit */}
          <div className="pt-2 md:pt-0 md:px-3">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Latest Commit</span>
            <div className="flex items-center gap-1.5">
              <GitCommit className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-mono text-xs text-slate-800">
                {repo.latest_commit_short || "—"}
              </span>
              {repo.latest_commit_sha && (
                <button
                  onClick={() => handleCopySha(repo.latest_commit_sha!)}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-700 transition-colors"
                  title="Copy full commit SHA"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
              {copied && <span className="text-[10px] text-emerald-600 font-medium">Copied</span>}
            </div>
          </div>

          {/* 4. Last Tested */}
          <div className="pt-2 md:pt-0 md:px-3">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Last Tested</span>
            <div className="flex items-center gap-1.5 text-slate-800">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-xs truncate">
                {repo.last_tested_at
                  ? new Date(repo.last_tested_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Not tested yet"}
              </span>
            </div>
          </div>

          {/* 5. Environment */}
          <div className="pt-2 md:pt-0 md:px-3 last:pr-0">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Environment</span>
            <div className="flex items-center gap-1.5 text-slate-800">
              <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-xs font-medium truncate">
                {currentEnv?.name || "Simulation (Moto)"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Test Summary Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Test Summary</h2>
          <div className="flex items-center gap-3">
            {s.latest_run_key && (
              <span className="rounded bg-slate-100 px-2.5 py-0.5 font-mono text-2xs font-semibold text-slate-700">
                Run ID: {s.latest_run_key}
              </span>
            )}
            {s.latest_run_id ? (
              <Link
                to={`/executions/${s.latest_run_id}`}
                className="text-xs font-medium text-[#3067DB] hover:underline inline-flex items-center gap-1"
              >
                <span>View Full Report</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : (
              <span className="text-xs text-slate-400 italic">No report available</span>
            )}
          </div>
        </div>

        {/* 6 Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Requirements */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Requirements</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {s.total_requirements}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
              <span>→</span>
              <span className="font-semibold text-slate-700">{s.total_clauses}</span>
              <span>atomic clauses</span>
            </div>
          </div>

          {/* Card 2: Test Cases */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-500">
              <CheckSquare className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Test Cases</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {s.total_test_cases}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              ({s.tests_per_requirement !== undefined ? Number(s.tests_per_requirement).toFixed(1) : "0.0"} per requirement)
            </div>
          </div>

          {/* Card 3: Passed */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Passed</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600">
              {s.passed_tests}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium">
              ({(s.passed_pct ?? 0).toFixed(1)}%)
            </div>
          </div>

          {/* Card 4: Failed */}
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-3.5 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-red-700">
              <XCircle className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Failed</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-red-600">
              {s.failed_tests}
            </div>
            <div className="text-[11px] text-red-700 font-medium">
              ({(s.failed_pct ?? 0).toFixed(1)}%)
            </div>
          </div>

          {/* Card 5: Open Defects */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Bug className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Open Defects</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">{s.open_defects}</span>
              {s.critical_defects > 0 && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                  {s.critical_defects} Critical
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {s.high_defects} High • {s.medium_defects} Med • {s.low_defects} Low
            </div>
          </div>

          {/* Card 6: Execution Time */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Execution Time</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {s.latest_duration_seconds !== null ? `${s.latest_duration_seconds} s` : "—"}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {latestEx ? latestEx.environment_kind : "No runs executed"}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Tabs Section */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {/* Tab Headers */}
        <div className="flex items-center border-b border-slate-200 px-4">
          <button
            onClick={() => setActiveTab("runs")}
            className={cn(
              "py-3 px-3 text-xs font-semibold border-b-2 transition-colors -mb-px flex items-center gap-1.5 cursor-pointer",
              activeTab === "runs"
                ? "border-[#3067DB] text-[#3067DB]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <span>Recent Runs</span>
            {data.recent_runs && data.recent_runs.length > 0 && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600">
                {data.recent_runs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("requirements")}
            className={cn(
              "py-3 px-3 text-xs font-semibold border-b-2 transition-colors -mb-px flex items-center gap-1.5 cursor-pointer",
              activeTab === "requirements"
                ? "border-[#3067DB] text-[#3067DB]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <span>Requirements</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600">
              {data.requirements_tab?.total ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("defects")}
            className={cn(
              "py-3 px-3 text-xs font-semibold border-b-2 transition-colors -mb-px flex items-center gap-1.5 cursor-pointer",
              activeTab === "defects"
                ? "border-[#3067DB] text-[#3067DB]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <span>Defects</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600">
              {data.defects_tab?.total_open ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("config")}
            className={cn(
              "py-3 px-3 text-xs font-semibold border-b-2 transition-colors -mb-px flex items-center gap-1.5 cursor-pointer",
              activeTab === "config"
                ? "border-[#3067DB] text-[#3067DB]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <span>Configuration</span>
          </button>
        </div>

        {/* Tab 1: Recent Runs */}
        {activeTab === "runs" && (
          <div>
            {!data.recent_runs || data.recent_runs.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <PlayCircle className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No test runs executed yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click "Run Tests" to execute the test suite in an isolated sandbox or target environment.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Run ID</th>
                      <th className="py-2.5 px-3">Commit</th>
                      <th className="py-2.5 px-3">Environment</th>
                      <th className="py-2.5 px-3">Result</th>
                      <th className="py-2.5 px-3">Tests</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Triggered</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(data.recent_runs || []).map((r) => (
                      <tr
                        key={r.id}
                        className={cn(
                          "hover:bg-slate-50/80 transition-colors",
                          latestEx?.id === r.id && "bg-blue-50/30"
                        )}
                      >
                        <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                          {r.run_id}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {r.commit_short}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {r.environment_name}
                        </td>
                        <td className="py-2.5 px-3">
                          {r.result === "passed" ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">
                              <Check className="h-3 w-3" /> Passed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-2xs font-semibold text-red-700 border border-red-200">
                              <X className="h-3 w-3" /> Failed
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {r.tests_passed} / {r.tests_total}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {r.duration_seconds} s
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {r.triggered_at
                            ? new Date(r.triggered_at).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => setSelectedExId(r.id)}
                            className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1 text-2xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-500" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Requirements */}
        {activeTab === "requirements" && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs bg-slate-50 p-3 rounded-md border border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total</span>
                <span className="font-bold text-slate-900 text-sm">{data.requirements_tab?.total ?? 0}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Documented</span>
                <span className="font-bold text-emerald-600 text-sm">{data.requirements_tab?.documented ?? 0}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Inferred</span>
                <span className="font-bold text-blue-600 text-sm">{data.requirements_tab?.inferred ?? 0}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Awaiting Confirmation</span>
                <span className="font-bold text-amber-600 text-sm">{data.requirements_tab?.awaiting_confirmation ?? 0}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Unmapped (0 Tests)</span>
                <span className="font-bold text-slate-600 text-sm">{data.requirements_tab?.unmapped ?? 0}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-3">Key</th>
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3">Module</th>
                    <th className="py-2 px-3">Origin</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Tests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data.requirements_tab?.items || []).map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-mono font-semibold text-[#3067DB]">
                        <Link to={`/requirements/${req.id}`} className="hover:underline">
                          {req.key}
                        </Link>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900 max-w-xs truncate">
                        {req.title}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                        {req.module_code}
                      </td>
                      <td className="py-2 px-3 text-slate-600 capitalize">
                        {req.origin.replace(/_/g, " ")}
                      </td>
                      <td className="py-2 px-3">
                        <span className={cn(
                          "inline-block rounded px-2 py-0.5 text-2xs font-medium",
                          req.status === "approved" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                        )}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-700">
                        {req.test_cases_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Defects */}
        {activeTab === "defects" && (
          <div className="p-4 space-y-4">
            {!data.defects_tab?.items || data.defects_tab.items.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">Zero Open Defects</p>
                <p className="text-xs text-slate-500">No active defects recorded for this project.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Defect ID</th>
                      <th className="py-2 px-3">Title</th>
                      <th className="py-2 px-3">Severity</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Linked Requirement</th>
                      <th className="py-2 px-3">Detected In</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(data.defects_tab?.items || []).map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-mono font-semibold text-red-600">
                          <Link to={`/defects/${d.id}`} className="hover:underline">
                            {d.key}
                          </Link>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800 max-w-sm truncate">
                          {d.title}
                        </td>
                        <td className="py-2 px-3">
                          <span className={cn(
                            "inline-block rounded px-2 py-0.5 text-2xs font-semibold uppercase",
                            d.severity === "critical" ? "bg-red-100 text-red-700" : d.severity === "high" ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {d.severity}
                          </span>
                        </td>
                        <td className="py-2 px-3 capitalize text-slate-600">{d.status}</td>
                        <td className="py-2 px-3 font-mono text-[#3067DB]">{d.linked_requirement_key}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{d.detection_run_key}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Configuration */}
        {activeTab === "config" && (
          <div className="p-5 space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded border border-slate-200 p-4 space-y-3 bg-slate-50/50">
                <h3 className="font-semibold text-slate-900 text-sm">Repository Integration</h3>
                <div className="space-y-2 text-slate-600">
                  <div>
                    <span className="font-medium text-slate-500 block">Repository URL</span>
                    <span className="font-mono">{data.configuration?.repository_url || "Not configured"}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500 block">Target Branch</span>
                    <span className="font-mono">{data.configuration?.branch || "main"}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500 block">Pinned Commit</span>
                    <span className="font-mono">{data.configuration?.commit_sha || "HEAD"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded border border-slate-200 p-4 space-y-3 bg-slate-50/50">
                <h3 className="font-semibold text-slate-900 text-sm">Execution Engine</h3>
                <div className="space-y-2 text-slate-600">
                  <div>
                    <span className="font-medium text-slate-500 block">Sandbox Mode</span>
                    <span>Fail-closed Bubblewrap container (AST allowlisted)</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500 block">Network Policy</span>
                    <span>Network isolated (loopback bind only)</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500 block">Available Environments</span>
                    <span>{data.configuration?.environments?.length ?? 0} environments configured</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-800 mb-2">Configured Environments</h4>
              <div className="rounded border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Kind</th>
                      <th className="py-2 px-3">Target Details</th>
                      <th className="py-2 px-3 text-right">Default</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(data.configuration?.environments || []).map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 px-3 font-medium text-slate-900">{e.name}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{e.kind}</td>
                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                          {e.base_url || (e.hcm_version ? `Version ${e.hcm_version}` : "Local simulation")}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {e.is_default && (
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#3067DB]">
                              Default
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LOWER DASHBOARD SECTION (Screenshot 2 Reference) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Execution Details */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900">
              Execution Details {latestEx ? `(${latestEx.key})` : ""}
            </h3>
            {latestEx && (
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold border",
                latestEx.status === "passed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
              )}>
                {latestEx.status === "passed" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                <span className="capitalize">{latestEx.status}</span>
              </span>
            )}
          </div>

          {latestEx ? (
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Environment</span>
                <span className="font-semibold text-slate-800">{latestEx.environment_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Started At</span>
                <span className="text-slate-700 font-mono text-[11px]">
                  {new Date(latestEx.started_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Completed At</span>
                <span className="text-slate-700 font-mono text-[11px]">
                  {new Date(latestEx.completed_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Duration</span>
                <span className="font-semibold text-slate-800">{latestEx.duration_seconds} s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Tests Executed</span>
                <span className="font-semibold text-slate-800">
                  {latestEx.passed} / {latestEx.total_tests}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-500 font-medium">Report</span>
                <div className="flex items-center gap-3">
                  <a
                    href={latestEx.junit_url}
                    download
                    className="text-[#3067DB] hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    <span>JUnit (XML)</span>
                  </a>
                  <a
                    href={latestEx.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#3067DB] hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>HTML Report</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-1.5 text-slate-400">
              <Play className="h-6 w-6 mx-auto text-slate-300" />
              <p className="text-xs font-medium text-slate-600">No test execution records</p>
              <p className="text-[11px] text-slate-400">Execute tests to view execution telemetry and report artifacts.</p>
            </div>
          )}
        </div>

        {/* Right: Quality & Coverage */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5">
            Quality & Coverage
          </h3>

          <div className="space-y-4 text-xs">
            {/* Requirement Coverage */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-600">Requirement Coverage</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{(q.requirement_coverage_pct ?? 0).toFixed(1)}%</span>
                  <span className="text-slate-400 text-[11px]">
                    {q.requirement_covered_count} / {q.requirement_total_count}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, q.requirement_coverage_pct ?? 0)}%` }}
                />
              </div>
            </div>

            {/* Clause Coverage */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-600">Clause Coverage</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{(q.clause_coverage_pct ?? 0).toFixed(1)}%</span>
                  <span className="text-slate-400 text-[11px]">
                    {q.clause_covered_count} / {q.clause_total_count}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, q.clause_coverage_pct ?? 0)}%` }}
                />
              </div>
            </div>

            {/* Test Pass Rate */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-600">Test Pass Rate</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">
                    {q.test_pass_rate_pct !== null && q.test_pass_rate_pct !== undefined ? `${q.test_pass_rate_pct.toFixed(1)}%` : "—"}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {q.test_pass_rate_pct !== null ? `${q.pass_rate_passed} / ${q.pass_rate_total}` : "No runs"}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, q.test_pass_rate_pct || 0)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Open Defects Section */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-sm font-bold text-slate-900">
            Open Defects ({data.defects_tab?.total_open ?? 0})
          </h3>
          <Link
            to={`/defects?project_id=${projectId}`}
            className="text-xs font-semibold text-[#3067DB] hover:underline inline-flex items-center gap-1"
          >
            <span>View All Defects</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {!data.defects_tab?.items || data.defects_tab.items.length === 0 ? (
          <div className="py-6 text-center space-y-1 text-slate-400">
            <Check className="h-5 w-5 mx-auto text-emerald-500" />
            <p className="text-xs font-medium text-slate-600">Zero active defects reported</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Title</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Linked Requirement</th>
                  <th className="py-2.5 px-3 text-right">Detected In</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {(data.defects_tab?.items || []).slice(0, 5).map((def) => (
                  <tr key={def.id} className="hover:bg-slate-50/60">
                    <td className="py-2 px-3 font-mono font-semibold text-[#3067DB]">
                      <Link to={`/defects/${def.id}`} className="hover:underline">
                        {def.key}
                      </Link>
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800 max-w-sm truncate">
                      {def.title}
                    </td>
                    <td className="py-2 px-3">
                      {def.severity === "critical" && (
                        <span className="inline-flex items-center gap-1 rounded bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-2xs font-semibold">
                          <XCircle className="h-3 w-3 text-red-600" />
                          <span>Critical</span>
                        </span>
                      )}
                      {def.severity === "high" && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-2xs font-semibold">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          <span>High</span>
                        </span>
                      )}
                      {def.severity !== "critical" && def.severity !== "high" && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-2xs font-semibold capitalize">
                          {def.severity}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {def.status === "open" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-2xs font-semibold">
                          <XCircle className="h-3 w-3 text-red-600" />
                          <span>Open</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-700 border border-slate-200 capitalize">
                          {def.status}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-[#3067DB]">
                      {def.linked_requirement_key}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-500">
                      {def.detection_run_key}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Grid: Requirements Status & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Requirements Status */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5">
            Requirements Status
          </h3>
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase">
              <tr>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Count</th>
                <th className="py-2 px-3 text-right">Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(data.requirements_status || []).map((item) => (
                <tr key={item.status} className="hover:bg-slate-50/60">
                  <td className="py-2 px-3 flex items-center gap-2">
                    {item.status === "Verified" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    {item.status === "In Review" && <Clock className="h-3.5 w-3.5 text-amber-500" />}
                    {item.status === "Not Mapped" && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                    <span className="text-slate-800">{item.status}</span>
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-900">{item.count}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-600">
                    {(item.coverage_pct ?? 0).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: Recent Activity */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {(data.recent_activity || []).map((act) => (
              <div key={act.id} className="flex items-start gap-3 text-xs">
                <div className="mt-0.5 rounded-full p-1.5 bg-blue-50 text-[#1D63ED] shrink-0">
                  {act.icon === "play" && <PlayCircle className="h-3.5 w-3.5" />}
                  {act.icon === "defect" && <FileText className="h-3.5 w-3.5 text-slate-700" />}
                  {act.icon === "repo" && <GitBranch className="h-3.5 w-3.5 text-slate-700" />}
                  {act.icon === "check" && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                  {act.icon === "commit" && <GitBranch className="h-3.5 w-3.5 text-[#1D63ED]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 truncate">{act.title}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{act.relative_time}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{act.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Run Tests Dialog Modal */}
      <Dialog
        open={runModalOpen}
        onOpenChange={setRunModalOpen}
        title={`Execute Tests for ${p.name}`}
        footer={
          <>
            <button
              onClick={() => setRunModalOpen(false)}
              className="rounded px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded bg-[#3067DB] hover:bg-[#2554B8] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{runMutation.isPending ? "Executing..." : "Start Test Run"}</span>
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Choose the execution environment to execute automated test scenarios inside an isolated, AST-validated container.
          </p>

          <div className="space-y-2">
            <label className="font-semibold text-slate-700 block">Select Environment</label>
            <div className="space-y-2">
              {(data.configuration?.environments || []).map((e) => (
                <label
                  key={e.id}
                  className={cn(
                    "flex items-center justify-between rounded-md border p-3 cursor-pointer transition-colors",
                    (selectedEnvId === e.id || (!selectedEnvId && e.is_default))
                      ? "border-[#3067DB] bg-blue-50/30"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                  onClick={() => setSelectedEnvId(e.id)}
                >
                  <div>
                    <div className="font-semibold text-slate-900">{e.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Kind: {e.kind} • {e.base_url || "Local Container Sandbox"}
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="env"
                    checked={selectedEnvId === e.id || (!selectedEnvId && e.is_default)}
                    onChange={() => setSelectedEnvId(e.id)}
                    className="text-[#3067DB]"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
