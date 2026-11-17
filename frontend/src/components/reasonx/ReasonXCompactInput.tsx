import { ArrowUp, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/utils/format";

interface ReasonXCompactInputProps {
  onSubmit: (query: string) => void;
  onExpand: () => void;
  onDismiss: () => void;
  projectName?: string;
  isPending?: boolean;
}

export function ReasonXCompactInput({
  onSubmit,
  onExpand,
  onDismiss,
  projectName,
  isPending = false,
}: ReasonXCompactInputProps) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = val.trim();
    if (!query || isPending) return;
    setVal("");
    onSubmit(query);
  };

  return (
    <div className="fixed bottom-6 right-24 z-40 w-[420px] max-w-[calc(100vw-7rem)] animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="relative flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-2xl backdrop-blur-md ring-1 ring-slate-900/5 transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
        {/* Emblem Trigger */}
        <button
          type="button"
          onClick={onExpand}
          title="Expand ReasonX Workspace"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1D4ED8] transition-colors hover:bg-blue-100 focus:outline-none"
        >
          <Sparkles className="h-4 w-4" />
        </button>

        {/* Natural Language Input */}
        <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-1.5 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={
              projectName
                ? `Ask ReasonX about ${projectName}...`
                : "Ask ReasonX to investigate, plan, or execute..."
            }
            disabled={isPending}
            className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!val.trim() || isPending}
            aria-label="Send to ReasonX"
            title="Execute query"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
              val.trim()
                ? "bg-[#1D4ED8] text-white shadow-xs hover:bg-blue-700 active:scale-95"
                : "text-slate-300 hover:text-slate-500 disabled:cursor-not-allowed"
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>

        {/* Dismiss to Floating Icon Only */}
        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss compact bar"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scope Pill Footnote */}
      <div className="mt-1 flex items-center justify-between px-2 text-[10px] text-slate-400">
        <span className="truncate">Active Project Scope: <strong className="text-slate-600 font-medium">{projectName || "Global"}</strong></span>
        <span>Enter to execute</span>
      </div>
    </div>
  );
}
