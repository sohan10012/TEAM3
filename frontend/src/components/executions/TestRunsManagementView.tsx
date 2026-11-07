import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Filter,
  FlaskConical,
  Layers,
  Monitor,
  MoreVertical,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/Toast";
import { Button, Dialog, Field, Input, ResponsiveDetailDrawer, Select } from "@/components/ui";
import { api, downloadUrl } from "@/services/api";
import type { Execution, Page, Project } from "@/types/models";
import { cn, fmtDuration } from "@/utils/format";

interface TestRunsManagementViewProps {
  projectId: number;
  current: Project | null;
}

export function TestRunsManagementView({ projectId, current }: TestRunsManagementViewProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();

  // Query executions
  const q = useQuery({
    queryKey: ["executions", { project_id: projectId, page_size: 200 }],
    queryFn: () => api.get<Page<Execution>>("/executions", { project_id: projectId, page_size: 200 }),
  });

  const execs = useMemo(() => q.data?.items ?? [], [q.data?.items]);

  // Tab state
  const [activeTab, setActiveTab] = useState<"all" | "validation" | "simulation" | "external">("all");
  const [runSubTab, setRunSubTab] = useState<"overview" | "results" | "logs" | "artifacts">("overview");

  // Selection & drawer state
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(true);
  const tableLayoutRef = useRef<HTMLDivElement>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("30");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // New run dialog
  const [isNewRunOpen, setIsNewRunOpen] = useState(false);

  // Sort executions descending by RUN key (RUN-024 first)
  const sortedExecs = useMemo(() => {
    return [...execs].sort((a, b) => {
      const numA = parseInt(a.key.replace("RUN-", ""), 10) || a.id;
      const numB = parseInt(b.key.replace("RUN-", ""), 10) || b.id;
      return numB - numA;
    });
  }, [execs]);

  // Default to the first run returned by the API.
  const selectedRun = useMemo(() => {
    if (!sortedExecs.length) return null;
    if (selectedRunId) {
      const found = sortedExecs.find((e) => e.id === selectedRunId);
      if (found) return found;
    }
    return sortedExecs[0];
  }, [sortedExecs, selectedRunId]);

  const selectedRunQuery = useQuery({
    queryKey: ["execution", selectedRun?.id],
    queryFn: () => api.get<Execution>(`/executions/${selectedRun!.id}`),
    enabled: Boolean(selectedRun && isDetailOpen),
  });
  const selectedLogsQuery = useQuery({
    queryKey: ["execution-logs", selectedRun?.id],
    queryFn: () => api.get<{ execution: string; log: string; status: string }>(`/executions/${selectedRun!.id}/logs`),
    enabled: Boolean(selectedRun && isDetailOpen && runSubTab === "logs"),
  });
  const rerunMutation = useMutation({
    mutationFn: () => api.post(`/executions/${selectedRun!.id}/retry`, {
      failed_only: false,
      environment_id: selectedRun!.environment?.id ?? null,
    }),
    onSuccess: () => {
      toast.ok(`Rerun queued for ${selectedRun?.key}`);
      qc.invalidateQueries({ queryKey: ["executions"] });
    },
    onError: toast.error,
  });
  const detailedRun = selectedRunQuery.data ?? selectedRun;

  // Metric counts
  const totalRuns = q.data?.total ?? sortedExecs.length;
  const hasCompleteRunSet = totalRuns === sortedExecs.length;
  const passedRuns = hasCompleteRunSet ? sortedExecs.filter((e) => e.status === "passed").length : null;
  const failedRuns = hasCompleteRunSet ? sortedExecs.filter((e) => e.status === "failed").length : null;
  const blockedRuns = hasCompleteRunSet ? sortedExecs.filter((e) => e.status === "cancelled" || e.status === "blocked").length : null;

  // Tab counts
  const valCount = sortedExecs.filter((e) => e.execution_type === "specification_validation").length;
  const simCount = sortedExecs.filter((e) => e.execution_type === "simulation").length;
  const extCount = sortedExecs.filter((e) => e.execution_type === "external").length;

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return sortedExecs.filter((e) => {
      const eType = (e.execution_type || e.runner || "").toLowerCase();
      const runName = e.suite?.name || e.key;

      // Tab match
      if (activeTab === "validation" && eType !== "specification_validation") return false;
      if (activeTab === "simulation" && eType !== "simulation") return false;
      if (activeTab === "external" && eType !== "external") return false;

      // Search match
      const matchQ =
        !search ||
        e.key.toLowerCase().includes(search.toLowerCase()) ||
        runName.toLowerCase().includes(search.toLowerCase());

      // Type filter match
      const matchType =
        typeFilter === "all" ||
        (typeFilter === "simulation" && eType === "simulation") ||
        (typeFilter === "validation" && eType === "specification_validation") ||
        (typeFilter === "external" && eType === "external");

      // Status filter match
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" && (e.status === "passed" || e.status === "failed")) ||
        (statusFilter === "blocked" && (e.status === "cancelled" || e.status === "blocked")) ||
        (statusFilter === "failed" && e.status === "failed");

      return matchQ && matchType && matchStatus;
    });
  }, [sortedExecs, activeTab, search, typeFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRuns.length / pageSize) || 1;
  const pagedRuns = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRuns.slice(start, start + pageSize);
  }, [filteredRuns, page, pageSize]);

  // Type chip helper
  const getTypeBadge = (type: string) => {
    if (type === "simulation") {
      return (
        <span className="inline-flex rounded bg-purple-50 px-2 py-0.5 text-2xs font-semibold text-purple-700 border border-purple-200">
          Simulation
        </span>
      );
    }
    if (type === "specification_validation" || type === "validation") {
      return (
        <span className="inline-flex rounded bg-blue-50 px-2 py-0.5 text-2xs font-semibold text-[#3067DB] border border-blue-200">
          Validation
        </span>
      );
    }
    return (
      <span className="inline-flex rounded bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">
        External
      </span>
    );
  };

  // Status badge helper
  const getStatusBadge = (status: string) => {
    if (status === "cancelled" || status === "blocked") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-2xs font-medium text-amber-800 border border-amber-200">
          ⊙ Blocked
        </span>
      );
    }
    const passed = status === "passed";
    return <span className={cn(
      "inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-medium border",
      passed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"
    )}>{status}</span>;
  };

  // Run icon helper
  const getRunIcon = (type: string) => {
    if (type === "simulation") {
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-50 text-purple-600">
          <FlaskConical className="h-3.5 w-3.5" />
        </div>
      );
    }
    if (type === "specification_validation" || type === "validation") {
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-[#3067DB]">
          <Monitor className="h-3.5 w-3.5" />
        </div>
      );
    }
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-50 text-emerald-600">
        <Database className="h-3.5 w-3.5" />
      </div>
    );
  };

  // Format execution timestamps consistently across the list and details.
  const formatRunDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const day = d.getDate();
    let hours = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${month} ${day}, ${hours}:${mins} ${ampm}`;
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header matching Screenshot 4 */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 font-medium">
          <Link to="/projects" className="hover:text-slate-800 transition-colors">Projects</Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <Link to={`/projects/${projectId}`} className="hover:text-slate-800 transition-colors">
            {current?.name || "Project"}
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="text-slate-900 font-semibold">Test Runs</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#3067DB] border border-blue-100">
              <Play className="h-5 w-5 fill-[#3067DB]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Test Runs</h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Execute validations and simulations, and track outcomes with evidence.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => nav(`/settings`)}
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Settings className="h-3.5 w-3.5 text-slate-500 mr-1" />
              <span>Configure Execution</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsNewRunOpen(true)}
              className="bg-[#3067DB] hover:bg-[#2554B8] text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>New Run</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 5 Summary Metric Cards matching Screenshot 4 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Runs */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-50 text-purple-600">
              <Layers className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Runs</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">{totalRuns}</span>
          </div>
        </div>

        {/* Card 2: Passed */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Passed</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">{passedRuns ?? "—"}</span>
          </div>
        </div>

        {/* Card 3: Failed */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-red-50 text-red-600">
              <XCircle className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Failed</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-red-600">{failedRuns ?? "—"}</span>
          </div>
        </div>

        {/* Card 4: Blocked */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-50 text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Blocked</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-amber-600">{blockedRuns ?? "—"}</span>
          </div>
        </div>

        {/* Card 5: Execution Types */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-50 text-purple-600">
              <Database className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Execution Types</span>
          </div>
          <div className="mt-2">
            <span className="text-xs font-semibold text-slate-900 leading-tight block">
              Validation {hasCompleteRunSet ? valCount : "—"} · Simulation {hasCompleteRunSet ? simCount : "—"} · External {hasCompleteRunSet ? extCount : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Row matching Screenshot 4 */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "all"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <FileText className="h-4 w-4" />
            <span>All Runs ({totalRuns})</span>
          </button>

          <button
            onClick={() => setActiveTab("validation")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "validation"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <Monitor className="h-4 w-4" />
            <span>Specification Validation ({hasCompleteRunSet ? valCount : "—"})</span>
          </button>

          <button
            onClick={() => setActiveTab("simulation")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "simulation"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <FlaskConical className="h-4 w-4" />
            <span>Simulation Runs ({hasCompleteRunSet ? simCount : "—"})</span>
          </button>

          <button
            onClick={() => setActiveTab("external")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "external"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <Database className="h-4 w-4" />
            <span>External Runs ({hasCompleteRunSet ? extCount : "—"})</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar matching Screenshot 4 */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative w-full min-w-0 sm:w-auto sm:min-w-64 sm:max-w-sm sm:flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search runs (ID, name, tags...)"
            className="h-9 w-full pl-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Select
            className="h-9 w-36 max-w-full shrink-0 text-xs"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Type: All</option>
            <option value="simulation">Simulation</option>
            <option value="validation">Validation</option>
            <option value="external">External</option>
          </Select>

          <Select
            className="h-9 w-32 max-w-full shrink-0 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Status: All</option>
            <option value="completed">Completed</option>
            <option value="blocked">Blocked</option>
            <option value="failed">Failed</option>
          </Select>

          <Select
            className="h-9 w-36 max-w-full shrink-0 text-xs"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="7">Date: Last 7 Days</option>
            <option value="30">Date: Last 30 Days</option>
            <option value="90">Date: Last 90 Days</option>
            <option value="all">Date: All Time</option>
          </Select>

          <button
            className="shrink-0 rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            title="Filter options"
            aria-label="Filter options"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Master-Detail Layout matching Screenshot 4 */}
      <div ref={tableLayoutRef} className="relative grid min-w-0 grid-cols-1 items-start gap-4 2xl:grid-cols-12">
        <div className={cn("min-w-0 space-y-3", isDetailOpen ? "2xl:col-span-8" : "2xl:col-span-12")}>
          <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[1180px] table-fixed text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="w-36 whitespace-nowrap px-3 py-2.5">Run ID ↑</th>
                  <th className="w-48 whitespace-nowrap px-3 py-2.5">Run Name</th>
                  <th className="w-40 whitespace-nowrap px-3 py-2.5">Type</th>
                  <th className="w-20 whitespace-nowrap px-3 py-2.5 text-center">Tests</th>
                  <th className="w-20 whitespace-nowrap px-3 py-2.5 text-center">Passed</th>
                  <th className="w-20 whitespace-nowrap px-3 py-2.5 text-center">Failed</th>
                  <th className="w-20 whitespace-nowrap px-3 py-2.5 text-center">Skipped</th>
                  <th className="w-32 whitespace-nowrap px-3 py-2.5">Status</th>
                  <th className="w-40 whitespace-nowrap px-3 py-2.5">Started At ↑</th>
                  <th className="w-12 whitespace-nowrap px-2 py-2.5 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedRuns.map((r) => {
                  const isSelected = selectedRun?.id === r.id;
                  const runType = r.execution_type || r.runner || "";
                  const runName = r.suite?.name || r.key;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => {
                        setSelectedRunId(r.id);
                        setIsDetailOpen(true);
                      }}
                      className={cn(
                        "hover:bg-slate-50/80 cursor-pointer transition-colors",
                        isSelected ? "bg-blue-50/40 font-medium" : ""
                      )}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="flex items-center gap-1.5 font-mono text-[#3067DB] font-medium">
                          {getRunIcon(runType)}
                          <span>{r.key}</span>
                        </div>
                      </td>
                      <td className="truncate px-3 py-2.5 font-medium text-slate-900" title={runName}>
                        {runName}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {getTypeBadge(runType)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center font-mono text-slate-800">
                        {r.total}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center font-mono font-medium text-emerald-700">
                        {r.passed}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center font-mono font-medium text-red-600">
                        {r.failed}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center font-mono text-amber-700">
                        {r.skipped}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {getStatusBadge(r.status)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {formatRunDate(r.started_at)}
                      </td>
                      <td className="px-2 py-2.5 text-center text-slate-400 hover:text-slate-600">
                        <MoreVertical className="h-3.5 w-3.5 inline" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Pagination footer matching Screenshot 4 */}
            <div className="p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-white">
              <span>
                Showing {(page - 1) * pageSize + 1} – {Math.min(page * pageSize, filteredRuns.length)} of {filteredRuns.length} runs
              </span>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500">Rows per page: 10</span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {[1, 2, 3].slice(0, totalPages).map((pNum) => (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={cn(
                        "px-2.5 py-0.5 rounded text-xs",
                        page === pNum
                          ? "bg-[#3067DB] text-white font-semibold"
                          : "border border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {pNum}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    aria-label="Next page"
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Test Run Drawer matching Screenshot 4 */}
        {isDetailOpen && selectedRun && (
          <ResponsiveDetailDrawer
            open={isDetailOpen}
            onOpenChange={setIsDetailOpen}
            title={`Execution details: ${selectedRun.key}`}
            anchorRef={tableLayoutRef}
          >
          <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
            {/* Run Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-purple-100 text-purple-700">
                    <FlaskConical className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-900">{selectedRun.key}</span>
                  {getStatusBadge(selectedRun.status)}
                </div>

                <div className="flex items-center gap-1">
                  <button className="p-1 text-slate-400 hover:text-slate-600 rounded" aria-label="More options" title="More options">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setIsDetailOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    title="Close details"
                    aria-label="Close details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-slate-900 mt-2">
                {selectedRun.suite?.name || selectedRun.key}
              </h3>

              {/* Meta row */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase font-medium">Execution Type</span>
                  <div className="mt-0.5">
                    {getTypeBadge(selectedRun.execution_type || selectedRun.runner || "")}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] block uppercase font-medium">Started At</span>
                  <span className="font-mono text-[11px] text-slate-800 font-medium block mt-0.5">
                    {formatRunDate(selectedRun.started_at)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] block uppercase font-medium">Duration</span>
                  <span className="font-mono text-[11px] text-slate-800 font-medium block mt-0.5">
                    {fmtDuration(selectedRun.duration_ms)}
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="border-b border-slate-200 px-4 bg-white">
              <div className="flex space-x-6 text-xs font-medium">
                <button
                  onClick={() => setRunSubTab("overview")}
                  className={cn(
                    "py-2.5 border-b-2 transition-colors",
                    runSubTab === "overview"
                      ? "border-[#3067DB] text-[#3067DB] font-semibold"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  )}
                >
                  Overview
                </button>
                <button
                  onClick={() => setRunSubTab("results")}
                  className={cn(
                    "py-2.5 border-b-2 transition-colors",
                    runSubTab === "results"
                      ? "border-[#3067DB] text-[#3067DB] font-semibold"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  )}
                >
                  Test Results ({selectedRun.total})
                </button>
                <button
                  onClick={() => setRunSubTab("logs")}
                  className={cn(
                    "py-2.5 border-b-2 transition-colors",
                    runSubTab === "logs"
                      ? "border-[#3067DB] text-[#3067DB] font-semibold"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  )}
                >
                  Execution Log
                </button>
                <button
                  onClick={() => setRunSubTab("artifacts")}
                  className={cn(
                    "py-2.5 border-b-2 transition-colors",
                    runSubTab === "artifacts"
                      ? "border-[#3067DB] text-[#3067DB] font-semibold"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  )}
                >
                  Artifacts
                </button>
              </div>
            </div>

            {/* Sub-tab 1: Overview matching Screenshot 4 */}
            {runSubTab === "overview" && (
              <div className="p-4 space-y-5 text-xs">
                {/* Execution Summary with SVG Donut Chart */}
                <div>
                  <span className="font-semibold text-slate-900 text-xs block mb-3">
                    Execution Summary
                  </span>

                  <div className="flex min-w-0 flex-wrap items-center gap-4 sm:flex-nowrap">
                    {/* SVG Donut Chart */}
                    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                        {/* Background track */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#E2E8F0"
                          strokeWidth="9"
                        />
                        {/* Green slice */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#10B981"
                          strokeWidth="9"
                          strokeDasharray="238.76"
                          strokeDashoffset={238.76 * (1 - (selectedRun.passed / Math.max(1, selectedRun.total)))}
                          strokeLinecap="round"
                        />
                        {/* Red slice */}
                        {selectedRun.failed > 0 && (
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            fill="transparent"
                            stroke="#EF4444"
                            strokeWidth="9"
                            strokeDasharray="238.76"
                            strokeDashoffset={238.76 * (1 - (selectedRun.failed / Math.max(1, selectedRun.total)))}
                            transform="rotate(338 50 50)"
                            strokeLinecap="round"
                          />
                        )}
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-lg font-bold text-slate-900 leading-none">{selectedRun.total}</span>
                        <span className="text-[10px] text-slate-500 font-medium">Tests</span>
                      </div>
                    </div>

                    {/* Breakdown List */}
                    <div className="min-w-0 flex-1 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-slate-700">Passed</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-900">
                          {selectedRun.passed} ({((selectedRun.passed / Math.max(1, selectedRun.total)) * 100).toFixed(1)}%)
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <XCircle className="h-3.5 w-3.5 text-red-600" />
                          <span className="text-slate-700">Failed</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-900">
                          {selectedRun.failed} ({((selectedRun.failed / Math.max(1, selectedRun.total)) * 100).toFixed(1)}%)
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-slate-700">Blocked</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-900">{selectedRun.skipped}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-slate-700">Errored</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-900">{selectedRun.errored}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulation Details Table */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs">
                    <Database className="h-3.5 w-3.5 text-[#3067DB]" />
                    <span>Execution Details</span>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-1.5 text-[11px]">
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-500">Runner</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedRun.runner || "—"}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-500">Environment</span>
                      <span className="font-mono text-slate-800">{selectedRun.environment?.name || "—"}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-500">Source</span>
                      <span className="text-slate-800 text-right max-w-xs">{selectedRun.source || "—"}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-500">Commit</span>
                      <span className="font-mono text-[#3067DB]">{selectedRun.commit_sha || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Key Findings matching Screenshot 4 */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs">
                    <FileText className="h-3.5 w-3.5 text-[#3067DB]" />
                    <span>Key Findings</span>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-start gap-2 text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{selectedRun.passed} test results passed.</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-700">
                      <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{selectedRun.failed} failed, {selectedRun.errored} errored, and {selectedRun.skipped} skipped.</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Execution Source: <strong>{selectedRun.source}</strong>
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => rerunMutation.mutate()}
                    loading={rerunMutation.isPending}
                    className="bg-[#3067DB] hover:bg-[#2554B8] text-white"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    <span>Rerun Simulation</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Sub-tab 2: Test Results */}
            {runSubTab === "results" && (
              <div className="p-4 space-y-2 text-xs">
                {selectedRunQuery.isLoading ? <p className="text-slate-500">Loading test results…</p>
                  : selectedRunQuery.isError ? <p className="text-red-700">{selectedRunQuery.error instanceof Error ? selectedRunQuery.error.message : "Unable to load test results."}</p>
                  : detailedRun?.results?.length ? detailedRun.results.map((result) => (
                    <div key={result.id} className="p-2.5 rounded border border-slate-200 bg-white flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-mono text-[#3067DB] font-semibold">{result.test_key || `Test ${result.test_case_id}`}</span>
                        <p className="text-slate-800 truncate">{result.test_title || result.message || "—"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-medium">{result.status}</span>
                        <p className="text-2xs text-slate-500">{fmtDuration(result.duration_ms)}</p>
                      </div>
                    </div>
                  )) : <p className="text-slate-500">No test results are recorded for this execution.</p>}
              </div>
            )}

            {/* Sub-tab 3: Execution Log */}
            {runSubTab === "logs" && (
              <div className="p-4 space-y-2">
                <div className="rounded border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
                  {selectedLogsQuery.isLoading ? "Loading execution log…"
                    : selectedLogsQuery.isError ? (selectedLogsQuery.error instanceof Error ? selectedLogsQuery.error.message : "Unable to load execution log.")
                    : selectedLogsQuery.data?.log || "No execution log is available."}
                </div>
              </div>
            )}

            {/* Sub-tab 4: Artifacts */}
            {runSubTab === "artifacts" && (
              <div className="p-4 space-y-2 text-xs">
                {selectedRunQuery.isLoading ? <p className="text-slate-500">Loading artifacts…</p>
                  : selectedRunQuery.isError ? <p className="text-red-700">{selectedRunQuery.error instanceof Error ? selectedRunQuery.error.message : "Unable to load artifacts."}</p>
                  : detailedRun?.artifacts?.length ? detailedRun.artifacts.map((artifact) => (
                    <a key={artifact.id} href={downloadUrl(`/executions/${selectedRun.id}/artifacts/${artifact.id}`)}
                      className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-[#3067DB]" />
                        <span className="truncate font-mono text-slate-800">{artifact.name}</span>
                      </span>
                      <span className="shrink-0 text-slate-500">{artifact.kind}</span>
                    </a>
                  )) : <p className="text-slate-500">No artifacts are available for this execution.</p>}
              </div>
            )}
          </div>
          </ResponsiveDetailDrawer>
        )}
      </div>

      {/* New Run Dialog */}
      {isNewRunOpen && (
        <NewRunModal
          projectId={projectId}
          onClose={() => {
            setIsNewRunOpen(false);
            qc.invalidateQueries({ queryKey: ["executions"] });
          }}
        />
      )}
    </div>
  );
}

function NewRunModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const toast = useToast();
  const [runType, setRunType] = useState("simulation");
  const [runName, setRunName] = useState("");

  const m = useMutation({
    mutationFn: () =>
      api.post("/executions", {
        project_id: projectId,
        execution_type: runType,
        source: "platform_run",
        log_excerpt: `Started new execution ${runName}`,
      }),
    onSuccess: () => {
      toast.ok("New test execution dispatched successfully");
      onClose();
    },
    onError: toast.error,
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Start New Execution"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!runName.trim()} loading={m.isPending} onClick={() => m.mutate()}>
            Execute
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <Field label="Run Name" htmlFor="new-run-name">
          <Input id="new-run-name" value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="Enter a run name" />
        </Field>
        <Field label="Execution Type" htmlFor="new-run-type">
          <Select id="new-run-type" value={runType} onChange={(e) => setRunType(e.target.value)}>
            <option value="simulation">Simulation</option>
            <option value="specification_validation">Specification Validation</option>
            <option value="external">External Test Run</option>
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}
