import {
  CheckCircle2,
  Info,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { ChangeImpactData } from "@/types/models";
import { cn } from "@/utils/format";

interface ChangeImpactAnalysisProps {
  projectId: string | number;
  initialRequirementId?: number;
  requirements?: Array<{ id: number; key: string; title: string }>;
}

export const ChangeImpactAnalysis: React.FC<ChangeImpactAnalysisProps> = ({
  initialRequirementId,
  requirements = [],
}) => {
  const [selectedReqId, setSelectedReqId] = useState<number>(
    initialRequirementId || requirements[0]?.id || 91
  );

  const impactQuery = useQuery({
    queryKey: ["requirement-impact", selectedReqId],
    enabled: !!selectedReqId,
    queryFn: () => api.get<ChangeImpactData>(`/requirements/${selectedReqId}/impact-analysis`),
  });

  const data = impactQuery.data;

  return (
    <div className="space-y-4">
      {/* 1. Header & Requirement Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Specification Change Impact Intelligence
            </h3>
          </div>
          <p className="text-2xs text-slate-500">
            Predicts the downstream ripple effect on clauses, acceptance criteria, test cases, and historical execution evidence.
          </p>
        </div>

        {/* Requirement Selector */}
        {requirements.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xs text-slate-500 font-medium">Select Specification:</span>
            <select
              value={selectedReqId}
              onChange={(e) => setSelectedReqId(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs truncate"
            >
              {requirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.key}: {r.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 2. Loading / Impact Overview Card */}
      {impactQuery.isLoading ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
          Calculating downstream impact footprint...
        </div>
      ) : !data ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
          No impact analysis available for this requirement.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Executive Impact Banner */}
          <div
            className={cn(
              "p-5 rounded-2xl border shadow-xs space-y-3",
              data.impact_level === "critical"
                ? "border-rose-200 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/30"
                : data.impact_level === "high"
                ? "border-amber-200 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/30"
                : "border-blue-200 bg-gradient-to-r from-blue-50/80 via-white to-blue-50/30"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={cn(
                    "h-5 w-5",
                    data.impact_level === "critical"
                      ? "text-rose-600"
                      : data.impact_level === "high"
                      ? "text-amber-600"
                      : "text-blue-600"
                  )}
                />
                <h4 className="text-sm font-bold text-slate-900">
                  {data.requirement_key}: Downstream Impact Footprint
                </h4>
              </div>
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider border",
                  data.impact_level === "critical"
                    ? "bg-rose-100 text-rose-900 border-rose-300"
                    : data.impact_level === "high"
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-blue-100 text-blue-900 border-blue-300"
                )}
              >
                {data.impact_level || "HIGH"} Impact Level
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{data.summary}</p>
          </div>

          {/* 3. Downstream Footprint Count Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-2xs text-slate-500 block truncate">Affected Clauses</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {data.affected_clauses?.length ?? 0}
              </span>
              <span className="text-3xs text-indigo-600 mt-0.5 block">Statutory language</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-2xs text-slate-500 block truncate">Affected ACs</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {data.affected_acceptance_criteria?.length ?? 0}
              </span>
              <span className="text-3xs text-purple-600 mt-0.5 block">Behavior criteria</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-2xs text-slate-500 block truncate">Affected Tests</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {data.affected_test_cases?.length ?? 0}
              </span>
              <span className="text-3xs text-blue-600 mt-0.5 block">Automated suites</span>
            </div>

            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 shadow-2xs">
              <span className="text-2xs text-amber-800 block truncate">Stale Executions</span>
              <span className="text-xl font-bold text-amber-700 mt-1 block">
                {data.affected_executions_count ?? 0}
              </span>
              <span className="text-3xs text-amber-800 mt-0.5 block">Potentially obsolete</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-2xs text-slate-500 block truncate">Linked Defects</span>
              <span className="text-xl font-bold text-rose-700 mt-1 block">
                {data.affected_defects?.length ?? 0}
              </span>
              <span className="text-3xs text-rose-600 mt-0.5 block">Related bug reports</span>
            </div>
          </div>

          {/* 4. Immutable Execution Evidence Policy Notice */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 text-blue-900 text-xs flex items-start gap-2.5 shadow-2xs">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Enterprise Integrity Guarantee: </span>
              <span>
                Historical execution runs and test results remain strictly immutable. When specifications change, downstream executions are marked as potentially stale—they are never silently modified or deleted.
              </span>
            </div>
          </div>

          {/* 5. Revalidation Checklist */}
          {data.revalidation_instructions && data.revalidation_instructions.length > 0 && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5 text-xs">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-2xs block">
                Mandatory Revalidation Checklist Before Signoff
              </span>
              <div className="space-y-1.5">
                {data.revalidation_instructions.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-2xs text-slate-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
