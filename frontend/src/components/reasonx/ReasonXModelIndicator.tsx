import { Cpu, Zap } from "lucide-react";
import { cn } from "@/utils/format";

interface ReasonXModelIndicatorProps {
  model?: string;
  provider?: string;
  latencyMs?: number;
  workflowStage?: string;
}

export function ReasonXModelIndicator({
  model = "gemini-3.8-flash",
  provider = "gemini",
  latencyMs,
  workflowStage,
}: ReasonXModelIndicatorProps) {
  const isPro = model.includes("pro") || model.includes("120b");

  return (
    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
      {workflowStage ? (
        <span className="flex items-center gap-1.5 text-blue-700 bg-blue-50 border border-blue-200/80 rounded-md px-1.5 py-0.5 font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
          {workflowStage}
        </span>
      ) : null}

      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 border font-medium",
          isPro
            ? "bg-purple-50 text-purple-800 border-purple-200"
            : "bg-blue-50 text-blue-800 border-blue-200"
        )}
        title={`Routed via ${provider.toUpperCase()}`}
      >
        {isPro ? <Cpu className="h-3 w-3 text-purple-600" /> : <Zap className="h-3 w-3 text-blue-600" />}
        <span>{model}</span>
      </span>

      {latencyMs ? (
        <span className="text-slate-400">({latencyMs}ms)</span>
      ) : null}
    </div>
  );
}
