import { Check, ChevronDown, ChevronRight, Loader2, Sparkles, XCircle } from "lucide-react";
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
}

export function ReasonXTaskTimeline({
  plan = [],
  steps = [],
  taskType,
  currentStatus,
}: ReasonXTaskTimelineProps) {
  const [expanded, setExpanded] = useState(true);

  if (plan.length === 0 && steps.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 my-2 text-xs transition-all shadow-xs">
      {/* Header bar */}
      <div
        className="flex items-center justify-between cursor-pointer select-none text-slate-800"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#1D4ED8] text-white">
            <Sparkles className="h-3 w-3" />
          </div>
          <span className="font-semibold text-xs tracking-tight text-slate-900">
            Autonomous Execution Plan {taskType ? `· ${taskType.replace(/_/g, " ").toUpperCase()}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
              currentStatus === "completed" && "bg-emerald-100 text-emerald-800",
              currentStatus === "awaiting_approval" && "bg-amber-100 text-amber-800 animate-pulse",
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
        <div className="mt-3 pt-2 border-t border-blue-100/80 space-y-2">
          {plan.map((p, idx) => {
            const executedStep = steps.find((s) => s.step_number === p.step || s.tool === p.tool);
            const isCompleted = executedStep?.status === "completed" || p.status === "completed";
            const isRunning = executedStep?.status === "running" || p.status === "running";
            const isFailed = executedStep?.status === "failed";
            const isAwaiting = executedStep?.status === "awaiting_approval";

            return (
              <div key={idx} className="flex items-start gap-2.5 text-2xs leading-relaxed">
                {/* Step Marker */}
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </div>
                  ) : isRunning ? (
                    <Loader2 className="h-4 w-4 text-[#1D4ED8] animate-spin" />
                  ) : isFailed ? (
                    <XCircle className="h-4 w-4 text-rose-500" />
                  ) : isAwaiting ? (
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 mt-1" />
                  ) : (
                    <div className="h-2.5 w-2.5 rounded-full bg-slate-300 mt-1" />
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

                  {p.tool && (
                    <span className="font-mono text-[9px] text-blue-600/80 block mt-0.5">
                      Tool: {p.tool}
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
