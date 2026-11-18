import { CheckCircle2, Circle, Clock, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/utils/format";

export interface PipelineStep {
  id: string;
  label: string;
  desc?: string;
  status: "pending" | "running" | "done" | "failed";
  elapsedMs?: number;
}

interface PipelineStepperProps {
  steps: PipelineStep[];
  currentStepId?: string;
  className?: string;
}

export function PipelineStepper({ steps, currentStepId, className }: PipelineStepperProps) {
  const [timers, setTimers] = useState<Record<string, number>>({});

  useEffect(() => {
    // Track elapsed time for actively running step
    const activeStep = steps.find((s) => s.status === "running");
    if (!activeStep) return;

    const start = Date.now();
    const interval = setInterval(() => {
      setTimers((prev) => ({
        ...prev,
        [activeStep.id]: Math.floor((Date.now() - start) / 1000),
      }));
    }, 500);

    return () => clearInterval(interval);
  }, [steps, currentStepId]);

  return (
    <div className={cn("space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-xs", className)}>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Pipeline Execution
      </div>
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isPending = step.status === "pending";
          const isRunning = step.status === "running";
          const isDone = step.status === "done";
          const isFailed = step.status === "failed";
          const elapsedSec = step.elapsedMs ? Math.round(step.elapsedMs / 1000) : (timers[step.id] ?? 0);

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start justify-between gap-3 p-2.5 rounded-md border transition-all duration-200",
                isRunning && "border-blue-200 bg-blue-50/50 shadow-xs",
                isDone && "border-slate-100 bg-slate-50/30",
                isFailed && "border-red-200 bg-red-50/40",
                isPending && "border-transparent text-slate-400"
              )}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {isRunning && <Loader2 className="h-4 w-4 animate-spin text-[#1D63ED]" />}
                  {isDone && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  {isFailed && <XCircle className="h-4 w-4 text-red-600" />}
                  {isPending && <Circle className="h-4 w-4 text-slate-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-mono text-slate-400">0{idx + 1}</span>
                    <span
                      className={cn(
                        "text-xs font-medium truncate",
                        isRunning ? "text-blue-900 font-semibold" : isDone ? "text-slate-800" : isFailed ? "text-red-900" : "text-slate-500"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {step.desc && (
                    <p className="mt-0.5 text-2xs text-slate-500 line-clamp-1">{step.desc}</p>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2 text-2xs font-mono">
                {(isDone || isRunning) && elapsedSec > 0 && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="h-3 w-3" />
                    {elapsedSec}s
                  </span>
                )}
                {isRunning && (
                  <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-[#1D63ED] animate-pulse">
                    RUNNING
                  </span>
                )}
                {isDone && (
                  <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                    PASS
                  </span>
                )}
                {isFailed && (
                  <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                    FAIL
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
