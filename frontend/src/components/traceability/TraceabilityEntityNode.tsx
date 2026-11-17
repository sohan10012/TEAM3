import {
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  FileCode,
  FileText,
  Layers,
  XCircle,
} from "lucide-react";
import React from "react";
import { cn } from "@/utils/format";

interface TraceabilityEntityNodeProps {
  type: "requirement" | "clause" | "acceptance_criteria" | "test_case" | "defect";
  id: number;
  entityKey: string;
  title: string;
  category?: string;
  priority?: string;
  status?: string;
  coverageStatus?: "fully_covered" | "partially_covered" | "uncovered";
  latestResult?: {
    status: string;
    duration_ms?: number;
  } | null;
  childCount?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClick?: () => void;
  isSelected?: boolean;
}

export const TraceabilityEntityNode: React.FC<TraceabilityEntityNodeProps> = ({
  type,
  entityKey,
  title,
  category,
  priority,
  coverageStatus,
  latestResult,
  childCount,
  isExpanded,
  onToggleExpand,
  onClick,
  isSelected,
}) => {
  const getIcon = () => {
    switch (type) {
      case "requirement":
        return <FileText className="h-4 w-4 text-blue-600 shrink-0" />;
      case "clause":
        return <FileCode className="h-3.5 w-3.5 text-indigo-600 shrink-0" />;
      case "acceptance_criteria":
        return <FileCheck className="h-3.5 w-3.5 text-purple-600 shrink-0" />;
      case "test_case":
        return <Layers className="h-3.5 w-3.5 text-slate-600 shrink-0" />;
      case "defect":
        return <Bug className="h-3.5 w-3.5 text-rose-600 shrink-0" />;
    }
  };

  const getCoverageBadge = () => {
    if (!coverageStatus) return null;
    switch (coverageStatus) {
      case "fully_covered":
        return (
          <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Fully Covered
          </span>
        );
      case "partially_covered":
        return (
          <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Partially Covered
          </span>
        );
      case "uncovered":
        return (
          <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-red-100 text-red-800 border border-red-200">
            Untested
          </span>
        );
    }
  };

  const getExecutionBadge = () => {
    if (!latestResult) return null;
    if (latestResult.status === "passed") {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3" />
          <span>Passed {latestResult.duration_ms ? `(${latestResult.duration_ms}ms)` : ""}</span>
        </span>
      );
    }
    if (["failed", "error", "timed_out"].includes(latestResult.status)) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-red-50 text-red-700 border border-red-200">
          <XCircle className="h-3 w-3" />
          <span>Failed</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
        <Clock className="h-3 w-3" />
        <span>{latestResult.status}</span>
      </span>
    );
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs cursor-pointer group",
        isSelected
          ? "border-blue-500 bg-blue-50/70 shadow-xs"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Expand/Collapse Toggle */}
        {onToggleExpand ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}

        {/* Type Icon */}
        {getIcon()}

        {/* Stable Entity Key */}
        <span className="font-mono text-2xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 shrink-0">
          {entityKey}
        </span>

        {/* Business Title */}
        <span className="text-slate-900 font-medium truncate max-w-md" title={title}>
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Category Pill */}
        {category && (
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-2xs font-medium bg-slate-100 text-slate-600">
            {category}
          </span>
        )}

        {/* Priority Badge */}
        {priority && (
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-2xs font-semibold uppercase",
              priority === "critical"
                ? "bg-rose-100 text-rose-800"
                : priority === "high"
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-700"
            )}
          >
            {priority}
          </span>
        )}

        {/* Coverage Status Badge */}
        {getCoverageBadge()}

        {/* Execution Result Badge */}
        {getExecutionBadge()}

        {/* Child Count */}
        {typeof childCount === "number" && (
          <span className="text-2xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {childCount} items
          </span>
        )}

        {/* Drill-Down Action Chevron */}
        <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-blue-600 transition-colors" />
      </div>
    </div>
  );
};
