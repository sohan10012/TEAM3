import {
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
  XCircle,
} from "lucide-react";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { cn } from "@/utils/format";

interface AdvancedCoverageMatrixProps {
  projectId: string | number;
}

export const AdvancedCoverageMatrix: React.FC<AdvancedCoverageMatrixProps> = ({
  projectId,
}) => {
  const [matrixType, setMatrixType] = useState<"req_by_ac" | "req_by_test">("req_by_ac");
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 25;
  const [offset, setOffset] = useState(0);

  const [selectedCell, setSelectedCell] = useState<{
    rowKey: string;
    rowTitle: string;
    cellData: any;
  } | null>(null);

  const matrixQuery = useQuery({
    queryKey: ["advanced-matrix", projectId, matrixType, searchQuery, limit, offset],
    queryFn: () =>
      api.get<any>(`/projects/${projectId}/traceability/matrix`, {
        matrix_type: matrixType,
        search: searchQuery || undefined,
        limit,
        offset,
      }),
  });

  const data = matrixQuery.data;

  return (
    <div className="space-y-4">
      {/* 1. Matrix Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
        {/* Matrix Type Switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-2xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMatrixType("req_by_ac");
              setOffset(0);
            }}
            className={cn(
              "px-3 py-1.5 rounded-md transition-all cursor-pointer",
              matrixType === "req_by_ac"
                ? "bg-white text-blue-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Requirement-by-AC Matrix
          </button>
          <button
            type="button"
            onClick={() => {
              setMatrixType("req_by_test");
              setOffset(0);
            }}
            className={cn(
              "px-3 py-1.5 rounded-md transition-all cursor-pointer",
              matrixType === "req_by_test"
                ? "bg-white text-blue-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Requirement-by-Test Matrix
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search requirements in matrix..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-3xs text-slate-600 shrink-0">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Passed
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Failed
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Uncovered
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            Unexecuted
          </span>
        </div>
      </div>

      {/* 2. Matrix Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {matrixQuery.isLoading ? (
            <div className="p-12 text-center text-xs text-slate-500">Loading coverage matrix...</div>
          ) : !data || data.rows.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">No matrix rows available.</div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-2xs uppercase tracking-wider text-slate-500 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4 font-semibold w-72">Requirement</th>
                  <th className="py-2.5 px-3 font-semibold w-24">Priority</th>
                  <th className="py-2.5 px-3 font-semibold">
                    {matrixType === "req_by_ac" ? "Acceptance Criteria Coverage" : "Child Test Suite Outcomes"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((row: any) => (
                  <tr key={row.requirement_id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Requirement Key & Title */}
                    <td className="py-2.5 px-4">
                      <div className="font-mono text-2xs font-bold text-slate-800">{row.requirement_key}</div>
                      <div className="text-slate-700 text-2xs truncate max-w-xs">{row.requirement_title}</div>
                    </td>

                    {/* Priority */}
                    <td className="py-2.5 px-3">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-3xs font-bold uppercase",
                          row.priority === "critical"
                            ? "bg-rose-100 text-rose-800"
                            : row.priority === "high"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {row.priority}
                      </span>
                    </td>

                    {/* Matrix Cells */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.cells.map((cell: any, cIdx: number) => {
                          const isPassed = cell.status === "passed";
                          const isFailed = cell.status === "failed";
                          const isUncovered = cell.status === "uncovered";

                          return (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() =>
                                setSelectedCell({
                                  rowKey: row.requirement_key,
                                  rowTitle: row.requirement_title,
                                  cellData: cell,
                                })
                              }
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-mono font-medium border transition-all cursor-pointer hover:scale-105",
                                isPassed
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                  : isFailed
                                  ? "bg-red-50 text-red-800 border-red-300 hover:bg-red-100"
                                  : isUncovered
                                  ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                              )}
                              title={
                                matrixType === "req_by_ac"
                                  ? `${cell.ac_key}: ${cell.description}`
                                  : `${cell.test_key}: ${cell.status}`
                              }
                            >
                              {isPassed && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                              {isFailed && <XCircle className="h-3 w-3 text-red-600" />}
                              {isUncovered && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                              <span>{matrixType === "req_by_ac" ? cell.ac_key : cell.test_key}</span>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 3. Cell Inspection Modal / Drawer */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4 text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {selectedCell.cellData.ac_key || selectedCell.cellData.test_key}
                </span>
                <span className="text-2xs font-semibold uppercase text-slate-500">
                  Cell Inspection
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-2xs">
              <div>
                <span className="text-slate-400 block">Parent Requirement:</span>
                <span className="font-bold text-slate-900">{selectedCell.rowKey}: {selectedCell.rowTitle}</span>
              </div>

              {selectedCell.cellData.description && (
                <div>
                  <span className="text-slate-400 block">Description:</span>
                  <p className="text-slate-700 mt-0.5">{selectedCell.cellData.description}</p>
                </div>
              )}

              <div>
                <span className="text-slate-400 block">Verification Status:</span>
                <span className="font-semibold text-slate-900 uppercase">
                  {selectedCell.cellData.status}
                </span>
              </div>

              {typeof selectedCell.cellData.test_count === "number" && (
                <div>
                  <span className="text-slate-400 block">Linked Test Count:</span>
                  <span className="font-mono text-slate-900">{selectedCell.cellData.test_count} tests</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
