import {
  AlertTriangle,
  Lock,
  Sparkles,
  Zap,
} from "lucide-react";
import React from "react";
import { CoverageRecommendation } from "@/types/models";
import { cn } from "@/utils/format";

interface CoverageRecommendationPanelProps {
  recommendations: CoverageRecommendation[];
  projectId: string | number;
  onTargetUncoveredAcs?: () => void;
  onOpenDefects?: () => void;
  onOpenFlaky?: () => void;
}

export const CoverageRecommendationPanel: React.FC<CoverageRecommendationPanelProps> = ({
  recommendations,
  onTargetUncoveredAcs,
  onOpenDefects,
  onOpenFlaky,
}) => {
  return (
    <div className="space-y-4">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              AI-Augmented QA Recommendations Engine
            </h3>
            <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              {recommendations.length} Active Recommendations
            </span>
          </div>
          <p className="text-2xs text-slate-500">
            Evidence-grounded action items to optimize requirement-to-test coverage, resolve defect clusters, and stabilize flaky executions.
          </p>
        </div>
      </div>

      {/* 2. Recommendations Cards Grid */}
      <div className="space-y-3.5">
        {recommendations.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
            All coverage recommendations have been reviewed and applied.
          </div>
        ) : (
          recommendations.map((rec) => (
            <div
              key={rec.id}
              className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-all space-y-3 text-xs"
            >
              {/* Header: Priority & Badges */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider border",
                      rec.priority === "critical"
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : rec.priority === "high"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-blue-100 text-blue-800 border-blue-200"
                    )}
                  >
                    {rec.priority} Priority
                  </span>
                  <span className="font-mono text-2xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {rec.target_entity_key}
                  </span>
                  {rec.ai_assisted && (
                    <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                      <Sparkles className="h-3 w-3" />
                      AI Assisted
                    </span>
                  )}
                  {rec.requires_human_approval && (
                    <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                      <Lock className="h-3 w-3 text-slate-400" />
                      Human Approval Required
                    </span>
                  )}
                </div>

                <div className="text-2xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {rec.expected_coverage_improvement}
                </div>
              </div>

              {/* Title & Evidence */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 leading-snug">{rec.title}</h4>
                <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-2xs">
                  <div>
                    <span className="font-semibold text-slate-700 block">Database Evidence:</span>
                    <p className="text-slate-600 italic">{rec.evidence}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700 block">Governance Reason:</span>
                    <p className="text-slate-600">{rec.reason}</p>
                  </div>
                </div>
              </div>

              {/* Action Banner & Direct Trigger */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-2xs">
                <div className="font-medium text-slate-700">
                  <span className="text-slate-400">Proposed Action: </span>
                  {rec.proposed_action}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {rec.id === "REC-TARGET-UNCOVERED-ACS" && onTargetUncoveredAcs && (
                    <button
                      type="button"
                      onClick={onTargetUncoveredAcs}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Launch Test Generator</span>
                    </button>
                  )}

                  {rec.id === "REC-TRIAGE-FAILURES-DEFECTS" && onOpenDefects && (
                    <button
                      type="button"
                      onClick={onOpenDefects}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      <span>Triage Failures</span>
                    </button>
                  )}

                  {rec.id === "REC-STABILIZE-FLAKY-TESTS" && onOpenFlaky && (
                    <button
                      type="button"
                      onClick={onOpenFlaky}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition-colors shadow-2xs cursor-pointer"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Inspect 9 Flaky Tests</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
