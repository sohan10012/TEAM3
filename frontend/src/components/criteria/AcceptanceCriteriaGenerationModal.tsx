import { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Search,
  FileCheck2,
  AlertCircle,
  Database,
} from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { api } from "@/services/api";
import { cn } from "@/utils/format";

export interface GenerationModalProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  requirementId?: number | null;
  requirementKey?: string;
  onGenerationComplete: () => void;
}

interface Stage {
  number: number;
  title: string;
  description: string;
  icon: any;
}

const STAGES: Stage[] = [
  {
    number: 1,
    title: "Requirement & Clause Ingestion",
    description: "Parsing requirement versions, atomic clauses, and normative text boundaries.",
    icon: Layers,
  },
  {
    number: 2,
    title: "Context Assembly & Guardrails",
    description: "Constructing prompt context, actor roles, and verbatim quotation constraints.",
    icon: ShieldCheck,
  },
  {
    number: 3,
    title: "Structured LLM Generation",
    description: "Invoking structured generation for Given-When-Then behavior models.",
    icon: Sparkles,
  },
  {
    number: 4,
    title: "Verbatim Quotation Verification",
    description: "Strict substring verification of all cited source quotations against clause text.",
    icon: Search,
  },
  {
    number: 5,
    title: "Quote Repair Loop",
    description: "Autonomous multi-turn repair loop for any ungrounded assertions (up to 2 attempts).",
    icon: FileCheck2,
  },
  {
    number: 6,
    title: "Duplicate & Boundary Detection",
    description: "De-duplicating criteria keys, checking invariants, and filtering degraded specs.",
    icon: AlertCircle,
  },
  {
    number: 7,
    title: "Persistence & Audit Recording",
    description: "Committing verified criteria to database and recording immutable audit logs.",
    icon: Database,
  },
];

export function AcceptanceCriteriaGenerationModal({
  open,
  onClose,
  projectId,
  requirementId,
  requirementKey,
  onGenerationComplete,
}: GenerationModalProps) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<{ created_count: number; criteria_keys: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startGeneration = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setActiveStep(1);

    // Progressive stage advancement
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev < 6 ? prev + 1 : prev));
    }, 600);

    try {
      let res: any;
      if (requirementId) {
        res = await api.post(`/requirements/${requirementId}/generate-acceptance-criteria`);
      } else {
        res = await api.post(`/projects/${projectId}/generate-acceptance-criteria`);
      }
      clearInterval(timer);
      setActiveStep(7);
      setResult(res);
      onGenerationComplete();
    } catch (err: any) {
      clearInterval(timer);
      setError(err.message || "Criteria generation failed");
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    if (isRunning) return;
    setActiveStep(0);
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && handleClose()}
      title={
        requirementKey
          ? `Generate Acceptance Criteria: ${requirementKey}`
          : "Enterprise AI Acceptance Criteria Generation"
      }
      wide
    >
      <div className="space-y-6 text-xs">
        <p className="text-slate-600 leading-relaxed">
          {requirementKey
            ? `Execute the transparent 7-stage LLM generation pipeline for requirement ${requirementKey} to derive verified Given-When-Then criteria.`
            : "Derive structured Given-When-Then acceptance criteria across all project requirements with quotation verification and repair loops."}
        </p>

        {/* 7-Stage Pipeline Visualizer */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              7-Stage LLM Intelligence Pipeline
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {activeStep === 0
                ? "Ready to run"
                : activeStep === 7
                ? "Pipeline Complete"
                : `Executing Stage ${activeStep} of 7`}
            </span>
          </div>

          <div className="space-y-2">
            {STAGES.map((s) => {
              const isPast = activeStep > s.number;
              const isCurrent = activeStep === s.number;

              return (
                <div
                  key={s.number}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-2.5 transition-all duration-150",
                    isCurrent
                      ? "border-blue-400 bg-blue-50/60 shadow-2xs"
                      : isPast
                      ? "border-emerald-200 bg-emerald-50/40 text-slate-700"
                      : "border-slate-200/80 bg-white opacity-60 text-slate-400"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
                      isCurrent
                        ? "border-blue-500 bg-blue-600 text-white animate-pulse"
                        : isPast
                        ? "border-emerald-500 bg-emerald-600 text-white"
                        : "border-slate-300 bg-slate-100 text-slate-500"
                    )}
                  >
                    {isPast ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.number}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={cn("font-semibold text-xs", isCurrent ? "text-blue-900" : isPast ? "text-emerald-900" : "text-slate-600")}>
                        {s.title}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 animate-pulse">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      {s.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Success or Error Banner */}
        {result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Generation Successful</span>
            </div>
            <p className="text-xs text-emerald-800">
              Generated <span className="font-bold">{result.created_count}</span> acceptance criteria.
              All specifications passed verbatim quote verification and schema validations.
            </p>
            {result.criteria_keys && result.criteria_keys.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {result.criteria_keys.slice(0, 10).map((k, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-900 border border-emerald-200"
                  >
                    {k}
                  </span>
                ))}
                {result.criteria_keys.length > 10 && (
                  <span className="text-[11px] text-emerald-700 self-center">
                    +{result.criteria_keys.length - 10} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-xs">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              Generation Error
            </span>
            <p className="text-xs text-rose-800">{error}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <Button size="sm" variant="secondary" onClick={handleClose} disabled={isRunning}>
            {result ? "Close" : "Cancel"}
          </Button>

          {!result ? (
            <Button
              size="sm"
              variant="primary"
              loading={isRunning}
              onClick={startGeneration}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-2xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isRunning ? "Running Pipeline..." : "Start Generation Pipeline"}</span>
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
