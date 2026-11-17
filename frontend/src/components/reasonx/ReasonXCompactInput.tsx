import { ArrowUp, X } from "lucide-react";
import { useRef, useState } from "react";
import { ReasonXMark } from "@/components/brand/ReasonXMark";
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
    <div className="fixed bottom-6 right-20 z-40 w-[420px] max-w-[calc(100vw-6rem)] animate-in fade-in slide-in-from-bottom-3 duration-200 ease-out">
      <div className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-md ring-1 ring-slate-900/5 transition-all focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-blue-500/20">
        {/* Emblem Trigger */}
        <button
          type="button"
          onClick={onExpand}
          title="Open ReasonX workspace"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition-colors hover:bg-slate-800 focus:outline-none"
        >
          <ReasonXMark size={20} className="bg-transparent border-none shadow-none" />
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
                : "Ask ReasonX a question..."
            }
            disabled={isPending}
            className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!val.trim() || isPending}
            aria-label="Send to ReasonX"
            title="Send query"
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all cursor-pointer",
              val.trim()
                ? "bg-slate-900 text-white shadow-2xs hover:bg-slate-800 active:scale-95"
                : "text-slate-300 disabled:cursor-not-allowed"
            )}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </form>

        {/* Dismiss to Floating Icon Only */}
        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss bar"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
