import { cn } from "@/utils/format";

export interface ReasonXMarkProps {
  size?: number;
  className?: string;
  theme?: "light" | "dark";
}

/**
 * Geometric ReasonX Identity Vector Mark
 * Harmonizes with TraceTestMark using continuous analytical reasoning paths
 * and quality verification micro-nodes.
 */
export function ReasonXMark({
  size = 32,
  className,
  theme = "light",
}: ReasonXMarkProps) {
  const isDark = theme === "dark";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg shadow-2xs select-none",
        "transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none",
        isDark
          ? "bg-slate-900 border border-slate-700/80"
          : "bg-slate-900 border border-slate-800 shadow-slate-900/10",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[82%] h-[82%]"
      >
        <defs>
          <linearGradient id="rxMarkGrad1" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient id="rxMarkGrad2" x1="10" y1="26" x2="26" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>
        {/* Core Reasoning Path (R-arc) */}
        <path
          d="M9 24V8H16.5C19.5376 8 22 10.4624 22 13.5C22 16.5376 19.5376 19 16.5 19H9"
          stroke="url(#rxMarkGrad1)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Cross-Analytical Execution Vector (X-leg) */}
        <path
          d="M15 19L23 24"
          stroke="url(#rxMarkGrad2)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Precision Terminal Nodes */}
        <circle cx="9" cy="8" r="1.5" fill="#93C5FD" />
        <circle cx="23" cy="24" r="1.5" fill="#34D399" />
        <circle cx="16.5" cy="13.5" r="1.25" fill="#60A5FA" />
      </svg>
    </div>
  );
}
