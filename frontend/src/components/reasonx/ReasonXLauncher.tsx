import { useEffect } from "react";
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
        aria-label={isOpen ? "Close ReasonX AI Assistant" : "Open ReasonX AI Assistant (Alt+R)"}
        title={isOpen ? "Close ReasonX AI (Alt+R)" : "Open ReasonX AI Autonomous Agent (Alt+R)"}
        className={cn(
          "group relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-xl transition-all duration-300 ease-out",
          "focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2",
          "active:scale-95",
          isOpen
            ? "bg-slate-900 text-white shadow-slate-900/30 rotate-90"
            : "bg-gradient-to-tr from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] text-white shadow-blue-600/30 hover:shadow-blue-600/50 hover:scale-105"
        )}
      >
        {/* Subtle Ambient Breathing Glow Ring */}
        <span
          className={cn(
            "absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-60 motion-reduce:hidden",
            isRunning && "opacity-80 animate-pulse",
            isOpen && "opacity-0"
          )}
        />

        {/* Custom ReasonX Emblem Icon */}
        <div className="relative flex items-center justify-center">
          <svg
            className={cn(
              "h-7 w-7 transition-transform duration-300",
              isRunning && "animate-spin motion-reduce:animate-none"
            )}
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Hexagonal Outer Quantum Node */}
            <path
              d="M14 2L24.3923 8V20L14 26L3.6077 20V8L14 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isOpen ? "stroke-slate-300" : "stroke-white/90"}
            />
            {/* Central Neural Nexus Core */}
            <circle cx="14" cy="14" r="3.5" fill="currentColor" />
            {/* Dynamic Synaptic Ray Accents */}
            <line x1="14" y1="5.5" x2="14" y2="10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="17.5" x2="14" y2="22.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="6.5" y1="9.75" x2="11" y2="12.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="17" y1="15.75" x2="21.5" y2="18.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Status Badge: Active Task Running or Approval Alert */}
        {isRunning && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
        )}

        {hasUnreadOrApproval && !isRunning && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
          </span>
        )}
      </button>
    </div>
  );
}
