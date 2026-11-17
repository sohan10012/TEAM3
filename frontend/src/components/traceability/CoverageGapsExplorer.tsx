import {
  AlertCircle,
  ArrowRight,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CoverageGapsData } from "@/types/models";
import { cn } from "@/utils/format";

interface CoverageGapsExplorerProps {
  data: CoverageGapsData;
  projectId: string | number;
  onTargetUncoveredAcs?: () => void;
}

export const CoverageGapsExplorer: React.FC<CoverageGapsExplorerProps> = ({
  data,
  onTargetUncoveredAcs,
}) => {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGaps = useMemo(() => {
    return data.gaps.filter((gap) => {
      const matchesSeverity = severityFilter === "all" || gap.severity === severityFilter;
      const matchesCategory = categoryFilter === "all" || gap.category === categoryFilter;
      const matchesSearch =
        !searchQuery ||
        gap.entity_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gap.business_context.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gap.evidence.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSeverity && matchesCategory && matchesSearch;
    });
  }, [data.gaps, severityFilter, categoryFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* 1. Gap Metrics & Quick Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Coverage Gaps & Quality Risk Register
            </h3>
            <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              {data.total_gaps} Detected Gaps
            </span>
          </div>
          <p className="text-2xs text-slate-500">
            Categorized gaps across atomic clauses, acceptance criteria, test execution runs, and defect linkage.
          </p>
        </div>

        {onTargetUncoveredAcs && (
          <button
            type="button"
            onClick={onTargetUncoveredAcs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors shadow-2xs shrink-0 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Target Uncovered ACs First</span>
          </button>
        )}
      </div>

      {/* 2. Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search gaps by entity key or evidence..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Severity Filter Pills */}
        <div className="flex items-center gap-1.5 text-2xs">
          <span className="text-slate-400 font-medium mr-1">Severity:</span>
          {[
            { id: "all", label: `All (${data.total_gaps})` },
            { id: "critical", label: `Critical (${data.critical_gaps})` },
            { id: "high", label: `High (${data.high_gaps})` },
            { id: "medium", label: `Medium (${data.medium_gaps})` },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setSeverityFilter(pill.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer",
                severityFilter === pill.id
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Category Dropdown */}
        <div className="flex items-center gap-1.5 text-2xs">
          <span className="text-slate-400 font-medium">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All 10 Categories</option>
            <option value="ac_no_tests">AC Without Tests</option>
            <option value="req_failing_tests">Req With Failing Tests</option>
            <option value="req_unresolved_defects">Req With Unresolved Defects</option>
            <option value="test_never_executed">Test Never Executed</option>
            <option value="clause_no_ac">Clause Without AC</option>
            <option value="req_no_clauses">Req Without Clauses</option>
          </select>
        </div>
      </div>

      {/* 3. Gaps Cards List */}
      <div className="space-y-3">
        {filteredGaps.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
            No coverage gaps match your filter criteria.
          </div>
        ) : (
          filteredGaps.map((gap) => (
            <div
              key={gap.gap_id}
              className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-all space-y-2.5 text-xs"
            >
              {/* Header: Key & Badges */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {gap.entity_key}
                  </span>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {gap.category_label}
                  </span>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider border",
                    gap.severity === "critical"
                      ? "bg-rose-100 text-rose-800 border-rose-300"
                      : gap.severity === "high"
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  )}
                >
                  {gap.severity} Severity
                </span>
              </div>

              {/* Context & Evidence */}
              <div className="space-y-1">
                <p className="font-medium text-slate-900">{gap.business_context}</p>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-2xs text-slate-700 space-y-1">
                  <span className="font-semibold block text-slate-800">Verification Evidence:</span>
                  <p className="italic">{gap.evidence}</p>
                </div>
              </div>

              {/* Why It Matters */}
              <div className="flex items-start gap-2 text-2xs text-slate-600 bg-amber-50/40 p-2 rounded-lg border border-amber-100">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-900">Why it matters: </span>
                  <span>{gap.why_it_matters}</span>
                </div>
              </div>

              {/* Footer: Recommended Action & Navigation */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <div className="text-2xs font-medium text-blue-700">
                  <span className="text-slate-500 font-normal">Next Action: </span>
                  {gap.recommended_action}
                </div>
                <Link
                  to={gap.navigation_link}
                  className="inline-flex items-center gap-1 text-2xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <span>Resolve Gap</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
