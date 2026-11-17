import { Check, ChevronDown, ChevronRight, Loader2, PlayCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils/format";

export interface TaskStepItem {
  step_number: number;
  title: string;
  status: "completed" | "running" | "pending" | "failed" | "awaiting_approval";
  tool?: string;
  elapsed_ms?: number;
  output?: string;
  error?: string;
}

interface ReasonXTaskTimelineProps {
  plan?: Array<{ step: number; title: string; tool?: string; status?: string }>;
  steps?: TaskStepItem[];
  taskType?: string;
  currentStatus?: string;
  currentStep?: number;
}

const HUMAN_TOOL_LABELS: Record<string, string> = {
  inspect_project_health: "Reviewing project health & metrics",
  inspect_requirements: "Inspecting requirements and coverage",
  inspect_test_cases: "Reviewing test suite and specifications",
  inspect_executions: "Investigating execution run results",
  inspect_defects: "Auditing open defects and severity",
  inspect_policies: "Checking compliance and policy rules",
  generate_test_cases: "Formulating test cases",
  create_defect_record: "Drafting defect proposal",
  evaluate_release_readiness: "Evaluating release readiness",
};

export function ReasonXTaskTimeline({
  plan = [],
  steps = [],
  taskType,
  currentStatus,
}: ReasonXTaskTimelineProps) {
  const [expanded, setExpanded] = useState(true);

  if (plan.length === 0 && steps.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 my-2 text-xs transition-all shadow-2xs">
      {/* Header bar */}
      <div
        className="flex items-center justify-between cursor-pointer select-none text-slate-800"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <PlayCircle className="h-4 w-4 text-slate-700 shrink-0" />
          <span className="font-semibold text-xs tracking-tight text-slate-900">
            Execution Plan {taskType ? `· ${taskType.replace(/_/g, " ")}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
              currentStatus === "completed" && "bg-emerald-100 text-emerald-800",
              currentStatus === "awaiting_approval" && "bg-amber-100 text-amber-800",
              currentStatus === "running" && "bg-blue-100 text-blue-800",
              currentStatus === "failed" && "bg-rose-100 text-rose-800"
            )}
          >
            {currentStatus || "Completed"}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Step Timeline */}
      {expanded && (
        <div className="mt-2.5 pt-2 border-t border-slate-200 space-y-2">
          {plan.map((p, idx) => {
            const executedStep = steps.find((s) => s.step_number === p.step || s.tool === p.tool);
            const isCompleted = executedStep?.status === "completed" || p.status === "completed";
            const isRunning = executedStep?.status === "running" || p.status === "running";
            const isFailed = executedStep?.status === "failed";
            const isAwaiting = executedStep?.status === "awaiting_approval";

            const toolLabel = p.tool ? HUMAN_TOOL_LABELS[p.tool] || p.tool.replace(/_/g, " ") : undefined;

            return (
              <div key={idx} className="flex items-start gap-2.5 text-2xs leading-relaxed">
                {/* Step Marker */}
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <Check className="h-2 w-2 stroke-[3]" />
                    </div>
                  ) : isRunning ? (
                    <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                  ) : isFailed ? (
                    <XCircle className="h-3.5 w-3.5 text-rose-500" />
                  ) : isAwaiting ? (
                    <div className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-200 mt-0.5" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-slate-300 mt-0.5" />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "font-medium truncate",
                        isCompleted ? "text-slate-700" : isRunning ? "text-blue-900 font-semibold" : "text-slate-500"
                      )}
                    >
                      {p.title}
                    </span>
                    {executedStep?.elapsed_ms && (
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {executedStep.elapsed_ms}ms
                      </span>
                    )}
                  </div>

                  {toolLabel && (
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {toolLabel}
                    </span>
                  )}

                  {executedStep?.error && (
                    <p className="text-rose-600 text-[10px] mt-0.5 font-mono">{executedStep.error}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
