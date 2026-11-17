import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  FileCheck,
  FileCode,
  FileText,
  Layers,
  XCircle,
} from "lucide-react";
import React from "react";
import { TraceabilityOverviewData } from "@/types/models";
import { cn } from "@/utils/format";

interface TraceabilityOverviewMetricsProps {
  data: TraceabilityOverviewData;
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  onOpenGapsTab?: () => void;
}

export const TraceabilityOverviewMetrics: React.FC<TraceabilityOverviewMetricsProps> = ({
  data,
  activeFilter = "all",
  onFilterChange,
  onOpenGapsTab,
}) => {
  return (
    <div className="space-y-4">
      {/* 1. Header with Freshness Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Database Governance Telemetry</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="text-2xs font-mono text-slate-400">Project: {data.project_key}</span>
        </div>
        <div className="flex items-center gap-1.5 text-2xs text-slate-400">
          <Clock className="h-3 w-3" />
          <span>Last Reconciled: {new Date(data.data_freshness_timestamp).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* 2. Uncovered AC Alert Banner if Gaps Exist */}
      {data.acs_without_linked_tests > 0 && (
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Acceptance Criteria Gap Detected: </span>
              <span>
                {data.acs_without_linked_tests} of {data.total_acceptance_criteria} criteria ({data.ac_coverage_pct}% covered) have zero test cases.
              </span>
            </div>
          </div>
          {onOpenGapsTab && (
            <button
              type="button"
              onClick={onOpenGapsTab}
              className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold text-2xs hover:bg-amber-700 transition-colors shrink-0 cursor-pointer"
            >
              Inspect {data.acs_without_linked_tests} Gaps →
            </button>
          )}
        </div>
      )}

      {/* 3. 12-Metric Real Database Governance Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Total Requirements */}
        <div
          onClick={() => onFilterChange && onFilterChange("all")}
          className={cn(
            "p-3 rounded-xl border bg-white shadow-2xs transition-all cursor-pointer hover:shadow-xs",
            activeFilter === "all" ? "ring-2 ring-blue-500 border-blue-300" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
            <span className="font-medium truncate">Requirements</span>
            <FileText className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{data.total_requirements}</div>
          <div className="text-2xs text-emerald-600 font-medium mt-0.5">
            {data.requirement_coverage_pct}% covered
          </div>
        </div>

        {/* Metric 2: Atomic Clauses */}
        <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
            <span className="font-medium truncate">Clauses</span>
            <FileCode className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{data.total_clauses}</div>
          <div className="text-2xs text-indigo-600 font-medium mt-0.5">
            {data.clause_coverage_pct}% extracted
          </div>
        </div>

        {/* Metric 3: Total ACs */}
        <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
            <span className="font-medium truncate">Acceptance Criteria</span>
            <FileCheck className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{data.total_acceptance_criteria}</div>
          <div className="text-2xs text-purple-600 font-medium mt-0.5">
            {data.acs_with_linked_tests} tested ({data.ac_coverage_pct}%)
          </div>
        </div>

        {/* Metric 4: Uncovered ACs */}
        <div
          onClick={onOpenGapsTab}
          className={cn(
            "p-3 rounded-xl border shadow-2xs transition-all cursor-pointer hover:shadow-xs",
            data.acs_without_linked_tests > 0
              ? "border-amber-200 bg-amber-50/50 hover:border-amber-300"
              : "border-slate-200 bg-white"
          )}
        >
          <div className="flex items-center justify-between text-2xs text-amber-800 mb-1">
            <span className="font-medium truncate">Uncovered ACs</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-700">{data.acs_without_linked_tests}</div>
          <div className="text-2xs text-amber-800 font-medium mt-0.5">Coverage gap →</div>
        </div>

        {/* Metric 5: Total Test Cases */}
        <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
            <span className="font-medium truncate">Test Cases</span>
            <Layers className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{data.total_test_cases}</div>
          <div className="text-2xs text-slate-500 font-medium mt-0.5">100% automated</div>
        </div>

        {/* Metric 6: Executed Tests */}
        <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
            <span className="font-medium truncate">Tests Executed</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-700">{data.executed_test_cases}</div>
          <div className="text-2xs text-blue-600 font-medium mt-0.5">
            {data.execution_coverage_pct}% run rate
          </div>
        </div>

        {/* Metric 7: Passing Executions */}
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
          <div className="flex items-center justify-between text-2xs text-emerald-800 mb-1">
            <span className="font-medium truncate">Latest Passed</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700">{data.tests_with_passing_results}</div>
          <div className="text-2xs text-emerald-700 font-medium mt-0.5">
            {data.passing_execution_pct}% pass rate
          </div>
        </div>

        {/* Metric 8: Failing Executions */}
        <div
          onClick={() => onFilterChange && onFilterChange("failed")}
          className={cn(
            "p-3 rounded-xl border shadow-2xs transition-all cursor-pointer hover:shadow-xs",
            data.tests_with_failing_results > 0
              ? "border-red-200 bg-red-50/50 hover:border-red-300"
              : "border-slate-200 bg-white"
          )}
        >
          <div className="flex items-center justify-between text-2xs text-red-800 mb-1">
            <span className="font-medium truncate">Latest Failed</span>
            <XCircle className="h-3.5 w-3.5 text-red-600" />
          </div>
          <div className="text-xl font-bold text-red-700">{data.tests_with_failing_results}</div>
          <div className="text-2xs text-red-700 font-medium mt-0.5">Simulation regression</div>
        </div>

        {/* Metric 9: Open Defects */}
        <div
          onClick={() => onFilterChange && onFilterChange("with_defects")}
          className={cn(
            "p-3 rounded-xl border shadow-2xs transition-all cursor-pointer hover:shadow-xs",
            data.open_defects > 0
              ? "border-rose-200 bg-rose-50/50 hover:border-rose-300"
              : "border-slate-200 bg-white"
          )}
        >
          <div className="flex items-center justify-between text-2xs text-rose-800 mb-1">
            <span className="font-medium truncate">Open Defects</span>
            <Bug className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-rose-700">{data.open_defects}</div>
          <div className="text-2xs text-rose-700 font-medium mt-0.5">Active investigation</div>
        </div>

        {/* Metric 10: Fully Covered Reqs */}
        <div
          onClick={() => onFilterChange && onFilterChange("fully_covered")}
          className={cn(
            "p-3 rounded-xl border bg-white shadow-2xs transition-all cursor-pointer hover:shadow-xs",
            activeFilter === "fully_covered" ? "ring-2 ring-emerald-500 border-emerald-300" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
            <span className="font-medium truncate">Fully Covered</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{data.fully_covered_requirements}</div>
          <div className="text-2xs text-slate-500 font-medium mt-0.5">
            {data.full_requirement_coverage_pct}% of total
          </div>
        </div>

        {/* Metric 11: Partially Covered Reqs */}
        <div
          onClick={() => onFilterChange && onFilterChange("partially_covered")}
          className={cn(
            "p-3 rounded-xl border bg-white shadow-2xs transition-all cursor-pointer hover:shadow-xs",
            activeFilter === "partially_covered" ? "ring-2 ring-amber-500 border-amber-300" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
            <span className="font-medium truncate">Partially Covered</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{data.partially_covered_requirements}</div>
          <div className="text-2xs text-amber-600 font-medium mt-0.5">Pending criteria</div>
        </div>

        {/* Metric 12: Untested Reqs */}
        <div
          onClick={() => onFilterChange && onFilterChange("uncovered")}
          className={cn(
            "p-3 rounded-xl border bg-white shadow-2xs transition-all cursor-pointer hover:shadow-xs",
            activeFilter === "uncovered" ? "ring-2 ring-red-500 border-red-300" : "border-slate-200"
          )}
        >
          <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
            <span className="font-medium truncate">Untested Reqs</span>
            <XCircle className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900">{data.untested_requirements}</div>
          <div className="text-2xs text-slate-400 font-medium mt-0.5">Zero test cases</div>
        </div>
      </div>

      {/* 4. Multi-Segment Distribution Progress Bar */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-800">Requirement Verification Distribution</span>
          <span className="font-mono text-2xs text-slate-500">
            {data.total_requirements} Total Specifications
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden shadow-inner">
          <div
            style={{ width: `${(data.fully_covered_requirements / (data.total_requirements || 1)) * 100}%` }}
            className="bg-emerald-500 transition-all"
            title={`Fully Covered: ${data.fully_covered_requirements}`}
          />
          <div
            style={{ width: `${(data.partially_covered_requirements / (data.total_requirements || 1)) * 100}%` }}
            className="bg-amber-400 transition-all"
            title={`Partially Covered: ${data.partially_covered_requirements}`}
          />
          <div
            style={{ width: `${(data.untested_requirements / (data.total_requirements || 1)) * 100}%` }}
            className="bg-slate-300 transition-all"
            title={`Untested: ${data.untested_requirements}`}
          />
        </div>
        <div className="flex items-center justify-between text-2xs text-slate-500 pt-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Fully Covered ({data.fully_covered_requirements})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Partially Covered ({data.partially_covered_requirements})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Untested ({data.untested_requirements})
            </span>
          </div>
          <span className="font-medium text-slate-700">
            AC Verification Rate: {data.ac_coverage_pct}%
          </span>
        </div>
      </div>
    </div>
  );
};
