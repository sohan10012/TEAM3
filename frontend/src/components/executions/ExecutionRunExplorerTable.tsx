import {
  Download,
  Eye,
  GitCompare,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import type { Execution } from "@/types/models";
import { cn, fmtDate, fmtDuration } from "@/utils/format";

interface ExecutionRunExplorerTableProps {
  executions: Execution[];
  selectedRunId: number | null;
  onSelectRun: (runId: number) => void;
  onOpenCompare: (runId: number) => void;
  onOpenExport: (execution: Execution) => void;
  filterStatus?: string | null;
  filterRunner?: string | null;
}

export function ExecutionRunExplorerTable({
  executions,
  selectedRunId,
  onSelectRun,
  onOpenCompare,
  onOpenExport,
  filterStatus,
  filterRunner,
}: ExecutionRunExplorerTableProps) {
  const [search, setSearch] = useState("");
  const [localStatus, setLocalStatus] = useState<string>("all");
  const [localRunner, setLocalRunner] = useState<string>("all");
  const [sortField, setSortField] = useState<"id" | "started_at" | "duration_ms" | "total">("id");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 12;

  // Filter & sort
  const filteredRuns = useMemo(() => {
    return executions
      .filter((e) => {
        const effStatus = filterStatus || localStatus;
        const matchesStatus =
          effStatus === "all" || !effStatus
            ? true
            : effStatus === "passed"
            ? e.status === "passed"
            : effStatus === "failed"
            ? e.status === "failed" || e.status === "error"
            : effStatus === "blocked"
            ? e.status === "cancelled" || e.status === "blocked"
            : e.status === effStatus;

        const effRunner = filterRunner || localRunner;
        const matchesRunner =
          effRunner === "all" || !effRunner
            ? true
            : (e.runner || "simulation").toLowerCase() === effRunner.toLowerCase();

        const matchesSearch =
          !search.trim() ||
          e.key.toLowerCase().includes(search.toLowerCase()) ||
          (e.suite?.name && e.suite.name.toLowerCase().includes(search.toLowerCase())) ||
          (e.runner && e.runner.toLowerCase().includes(search.toLowerCase()));

        return matchesStatus && matchesRunner && matchesSearch;
      })
      .sort((a, b) => {
        let valA = a[sortField] || 0;
        let valB = b[sortField] || 0;
        if (typeof valA === "string") valA = new Date(valA).getTime() || 0;
        if (typeof valB === "string") valB = new Date(valB).getTime() || 0;
        return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
  }, [executions, search, localStatus, localRunner, filterStatus, filterRunner, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / pageSize));
  const pagedRuns = filteredRuns.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (field: "id" | "started_at" | "duration_ms" | "total") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative w-64">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search run key or suite..."
              className="pl-8 text-xs py-1 h-8"
            />
          </div>

          <Select
            value={localStatus}
            onChange={(e) => {
              setLocalStatus(e.target.value);
              setPage(1);
            }}
            className="w-36 text-xs h-8"
          >
            <option value="all">All Statuses</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed / Errors</option>
            <option value="blocked">Blocked / Cancelled</option>
            <option value="running">Running</option>
          </Select>

          <Select
            value={localRunner}
            onChange={(e) => {
              setLocalRunner(e.target.value);
              setPage(1);
            }}
            className="w-48 text-xs h-8"
          >
            <option value="all">All Runners</option>
            <option value="deterministic_simulation_engine">Deterministic Simulation</option>
            <option value="pytest">Pytest Sandbox</option>
            <option value="playwright">Playwright Web</option>
          </Select>
        </div>

        <div className="text-2xs text-slate-500 font-mono">
          Showing <strong>{filteredRuns.length}</strong> of {executions.length} runs
        </div>
      </div>

      {/* High-Density Data Table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
            <tr>
              <th className="py-2.5 px-3 cursor-pointer select-none" onClick={() => toggleSort("id")}>
                Run ID {sortField === "id" && (sortAsc ? "↑" : "↓")}
              </th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Runner Engine</th>
              <th className="py-2.5 px-3 cursor-pointer select-none" onClick={() => toggleSort("total")}>
                Results Ratio {sortField === "total" && (sortAsc ? "↑" : "↓")}
              </th>
              <th className="py-2.5 px-3 cursor-pointer select-none" onClick={() => toggleSort("duration_ms")}>
                Duration {sortField === "duration_ms" && (sortAsc ? "↑" : "↓")}
              </th>
              <th className="py-2.5 px-3 cursor-pointer select-none" onClick={() => toggleSort("started_at")}>
                Started Timestamp {sortField === "started_at" && (sortAsc ? "↑" : "↓")}
              </th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {pagedRuns.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No execution runs match your search or filter criteria.
                </td>
              </tr>
            ) : (
              pagedRuns.map((e) => {
                const isSelected = selectedRunId === e.id;
                const isPassed = e.status === "passed";
                const isFailed = e.status === "failed" || e.status === "error";
                const total = Math.max(1, e.total);

                return (
                  <tr
                    key={e.id}
                    onClick={() => onSelectRun(e.id)}
                    className={cn(
                      "hover:bg-slate-50/80 transition-colors cursor-pointer",
                      isSelected && "bg-blue-50/60 hover:bg-blue-50/80",
                      isFailed && !isSelected && "bg-red-50/20"
                    )}
                  >
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-blue-700">{e.key}</span>
                      <p className="text-slate-500 text-[11px] truncate max-w-xs mt-0.5">
                        {e.suite?.name || "Ad hoc execution"}
                      </p>
                    </td>

                    <td className="py-2.5 px-3">
                      <span
                        className={cn(
                          "inline-block rounded px-2 py-0.5 text-2xs font-bold uppercase",
                          isPassed
                            ? "bg-emerald-100 text-emerald-800"
                            : isFailed
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {e.status}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="font-mono text-slate-700 text-[11px]">
                        {e.runner || "simulation"}
                      </span>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="w-36 space-y-1">
                        <div className="h-1.5 w-full rounded-full overflow-hidden bg-slate-100 flex">
                          <div style={{ width: `${(e.passed / total) * 100}%` }} className="bg-emerald-500 h-full" />
                          <div style={{ width: `${(e.failed / total) * 100}%` }} className="bg-red-500 h-full" />
                          <div style={{ width: `${((e.errored || 0) / total) * 100}%` }} className="bg-amber-500 h-full" />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>{e.passed}P / {e.failed}F</span>
                          <span>{e.total} total</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 font-mono text-slate-600 tabular-nums">
                      {fmtDuration(e.duration_ms)}
                    </td>

                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {fmtDate(e.started_at || e.created_at)}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(evt) => evt.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectRun(e.id)}
                          className="p-1 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded transition-colors"
                          title="View Run Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenCompare(e.id)}
                          className="p-1 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded transition-colors"
                          title="Compare with other run"
                        >
                          <GitCompare className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenExport(e)}
                          className="p-1 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded transition-colors"
                          title="Export Report"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-500">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
