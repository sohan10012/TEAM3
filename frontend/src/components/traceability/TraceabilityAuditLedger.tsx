import { Search, ShieldCheck } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { TraceabilityAuditEntry } from "@/types/models";
import { fmtDate } from "@/utils/format";

interface TraceabilityAuditLedgerProps {
  projectId: string | number;
}

export const TraceabilityAuditLedger: React.FC<TraceabilityAuditLedgerProps> = ({
  projectId,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("all");

  const auditQuery = useQuery({
    queryKey: ["traceability-audit", projectId],
    queryFn: () =>
      api.get<TraceabilityAuditEntry[]>(`/projects/${projectId}/traceability/audit`, {
        limit: 100,
      }),
  });

  const entries = useMemo(() => auditQuery.data || [], [auditQuery.data]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchesAction = selectedAction === "all" || e.action.includes(selectedAction);
      const matchesSearch =
        !searchQuery ||
        e.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.entity_key && e.entity_key.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.entity_type && e.entity_type.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesAction && matchesSearch;
    });
  }, [entries, selectedAction, searchQuery]);

  return (
    <div className="space-y-4">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Immutable Traceability & Governance Audit Ledger
            </h3>
            <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {entries.length} Events Recorded
            </span>
          </div>
          <p className="text-2xs text-slate-500">
            Cryptographically timestamped audit trail tracking specification creation, relationship linking, review decisions, and defect associations.
          </p>
        </div>
      </div>

      {/* 2. Search & Action Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit trail by key or action..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 text-2xs">
          <span className="text-slate-400 font-medium">Filter Action:</span>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Actions</option>
            <option value="traceability">Traceability Events</option>
            <option value="project">Project Events</option>
            <option value="clarification">Clarification Events</option>
            <option value="auth">Auth Events</option>
          </select>
        </div>
      </div>

      {/* 3. Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {auditQuery.isLoading ? (
            <div className="p-12 text-center text-xs text-slate-500">Loading audit ledger...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">No audit events match your filter.</div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-2xs uppercase tracking-wider text-slate-500 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4 font-semibold w-44">Timestamp</th>
                  <th className="py-2.5 px-3 font-semibold w-48">Action</th>
                  <th className="py-2.5 px-3 font-semibold w-40">Entity</th>
                  <th className="py-2.5 px-3 font-semibold w-24">Actor ID</th>
                  <th className="py-2.5 px-4 font-semibold">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Timestamp */}
                    <td className="py-2 px-4 text-2xs font-mono text-slate-500 whitespace-nowrap">
                      {log.timestamp ? fmtDate(log.timestamp) : "—"}
                    </td>

                    {/* Action */}
                    <td className="py-2 px-3">
                      <span className="font-mono text-2xs font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {log.action}
                      </span>
                    </td>

                    {/* Entity */}
                    <td className="py-2 px-3 text-2xs">
                      <span className="text-slate-600 block uppercase font-bold text-3xs">
                        {log.entity_type}
                      </span>
                      <span className="font-mono font-medium text-slate-800">
                        {log.entity_key || (log.entity_id ? `#${log.entity_id}` : "—")}
                      </span>
                    </td>

                    {/* Actor */}
                    <td className="py-2 px-3 text-2xs font-mono text-slate-500">
                      {log.actor_id ? `User ${log.actor_id}` : "System"}
                    </td>

                    {/* Details */}
                    <td className="py-2 px-4 text-3xs font-mono text-slate-600 truncate max-w-md">
                      {log.details && Object.keys(log.details).length > 0
                        ? JSON.stringify(log.details)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
