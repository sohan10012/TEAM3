import { useEffect } from "react";
import { ReasonXMark } from "@/components/brand/ReasonXMark";
import { cn } from "@/utils/format";

interface ReasonXLauncherProps {
  isOpen: boolean;
  onToggle: () => void;
  isRunning?: boolean;
  hasUnreadOrApproval?: boolean;
}

export function ReasonXLauncher({
  isOpen,
  onToggle,
  isRunning = false,
  hasUnreadOrApproval = false,
}: ReasonXLauncherProps) {
  // Global keyboard shortcut: Alt + R to toggle ReasonX
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggle]);

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 flex items-center gap-2.5 transition-opacity duration-200",
        isOpen ? "z-30 opacity-0 pointer-events-none" : "z-50 opacity-100"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? "Close ReasonX" : "Open ReasonX (Alt+R)"}
        title={isOpen ? "Close ReasonX (Alt+R)" : "Open ReasonX (Alt+R)"}
        className={cn(
          "group relative flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          "active:scale-95 shadow-md hover:shadow-lg",
          isOpen
            ? "bg-slate-900 text-white"
            : "bg-slate-900 text-white hover:bg-slate-800"
        )}
      >
        {/* Subtle Ambient Pulse when running */}
        {isRunning && (
          <span className="absolute -inset-0.5 rounded-xl bg-blue-500/40 animate-pulse" />
        )}

        {/* ReasonX Geometric Mark */}
        <ReasonXMark size={28} className="bg-transparent border-none shadow-none" />

        {/* Status Badge: Active Task Running or Approval Alert */}
        {isRunning && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
        )}

        {hasUnreadOrApproval && !isRunning && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center">
            <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
          </span>
        )}
      </button>
    </div>
  );
}
