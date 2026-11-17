import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileDown,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import React, { useState } from "react";
import { CoverageHealthData } from "@/types/models";
import { cn } from "@/utils/format";

interface CoverageHealthAssessmentProps {
  data: CoverageHealthData;
  onOpenGaps?: () => void;
  onOpenRecommendations?: () => void;
  onOpenExport?: () => void;
}

export const CoverageHealthAssessment: React.FC<CoverageHealthAssessmentProps> = ({
  data,
  onOpenGaps,
  onOpenRecommendations,
  onOpenExport,
}) => {
  const [showMethodology, setShowMethodology] = useState(false);

  const gradeBadgeStyles = {
    good: "bg-emerald-100 text-emerald-800 border-emerald-300",
    warning: "bg-amber-100 text-amber-800 border-amber-300",
    critical: "bg-rose-100 text-rose-800 border-rose-300",
  }[data.status_grade];

  const gradeBorderStyles = {
    good: "border-emerald-200 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/30",
    warning: "border-amber-200 bg-gradient-to-r from-amber-50/70 via-white to-amber-50/30",
    critical: "border-rose-200 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/30",
  }[data.status_grade];

  return (
    <div className={cn("p-5 rounded-2xl border shadow-xs space-y-4", gradeBorderStyles)}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Headline & Summary */}
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-2.5">
            {data.status_grade === "good" ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            )}
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {data.headline}
            </h3>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider border",
                gradeBadgeStyles
              )}
            >
              Grade: {data.status_grade}
            </span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {typeof data.summary === "string" ? data.summary : ""}
          </p>
        </div>

        {/* Right: Score Gauge & Action Buttons */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Health Score Pill */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/90 border border-slate-200/80 shadow-2xs min-w-[110px]">
            <span className="text-2xs text-slate-500 font-medium">Health Score</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-slate-900">{data.composite_score}</span>
              <span className="text-2xs font-mono text-slate-400">/100</span>
            </div>
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
              <div
                style={{ width: `${data.composite_score}%` }}
                className={cn(
                  "h-full rounded-full transition-all",
                  data.composite_score >= 80 ? "bg-emerald-500" : data.composite_score >= 60 ? "bg-amber-500" : "bg-rose-500"
                )}
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-1.5">
            {onOpenRecommendations && (
              <button
                type="button"
                onClick={onOpenRecommendations}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>QA Recommendations</span>
              </button>
            )}
            {onOpenGaps && (
              <button
                type="button"
                onClick={onOpenGaps}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span>Coverage Gaps</span>
              </button>
            )}
            {onOpenExport && (
              <button
                type="button"
                onClick={onOpenExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <FileDown className="h-3.5 w-3.5 text-slate-500" />
                <span>Export Dossier</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary Key Risks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        {(data.key_risks || []).map((risk, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded-lg border border-slate-200/80 bg-white/70 text-xs flex items-start gap-2 shadow-2xs"
          >
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span className="text-slate-700 text-2xs leading-relaxed">{risk}</span>
          </div>
        ))}
      </div>

      {/* Expandable Methodology Accordion */}
      <div className="border-t border-slate-200/60 pt-2">
        <button
          type="button"
          onClick={() => setShowMethodology(!showMethodology)}
          className="flex items-center gap-1.5 text-2xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <HelpCircle className="h-3 w-3 text-slate-400" />
          <span>Transparent Health Scoring Methodology & Formula</span>
          {showMethodology ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {showMethodology && data.methodology && (
          <div className="mt-2.5 p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 space-y-2.5 shadow-2xs">
            <div className="font-mono text-2xs bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-800">
              {data.methodology.formula}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-2xs">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-semibold block text-slate-900">Req Coverage</span>
                <span className="text-slate-500">Weight: 25%</span>
                <span className="font-mono block mt-1 text-slate-700">
                  +{data.methodology.components?.requirement_coverage?.pts ?? 0} pts
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-semibold block text-slate-900">AC Coverage</span>
                <span className="text-slate-500">Weight: 25%</span>
                <span className="font-mono block mt-1 text-slate-700">
                  +{data.methodology.components?.ac_coverage?.pts ?? 0} pts
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-semibold block text-slate-900">Execution Cov</span>
                <span className="text-slate-500">Weight: 25%</span>
                <span className="font-mono block mt-1 text-slate-700">
                  +{data.methodology.components?.execution_coverage?.pts ?? 0} pts
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-semibold block text-slate-900">Pass Rate</span>
                <span className="text-slate-500">Weight: 25%</span>
                <span className="font-mono block mt-1 text-slate-700">
                  +{data.methodology.components?.pass_rate?.pts ?? 0} pts
                </span>
              </div>
              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                <span className="font-semibold block">Defect Penalty</span>
                <span className="text-rose-700">4 pts / crit defect</span>
                <span className="font-mono block mt-1 text-rose-800 font-bold">
                  -{data.methodology.components?.defect_penalty?.penalty_pts ?? 0} pts
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
