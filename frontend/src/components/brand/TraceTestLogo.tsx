import { cn } from "@/utils/format";

export interface TraceTestLogoProps {
  variant?: "sidebar" | "full" | "symbol" | "compact";
  theme?: "light" | "dark";
  compact?: boolean;
  projectName?: string;
  className?: string;
  markClassName?: string;
}

/**
 * Geometric Trace & Verification Mark
 * Symbol combines a continuous requirement trace path with a precision quality verification check.
 */
export function TraceTestMark({
  size = 32,
  theme = "light",
  className,
}: {
  size?: number;
  theme?: "light" | "dark";
  className?: string;
}) {
  const isDark = theme === "dark";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg shadow-2xs select-none",
        "transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none",
        "group-hover:border-blue-500/40 group-hover:shadow-[0_0_10px_rgba(59,130,246,0.2)]",
        "group-active:scale-[0.97]",
        isDark
          ? "bg-slate-900 border border-slate-700/80"
          : "bg-slate-900 border border-slate-800 shadow-slate-900/10",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[84%] h-[84%]"
      >
        <defs>
          <linearGradient id="ttMarkTrace" x1="6" y1="8" x2="26" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id="ttMarkVerify" x1="8" y1="20" x2="29" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="60%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>
        {/* Requirement Specification Trace Route */}
        <path
          d="M7 11H21C22.6569 11 24 12.3431 24 14V15"
          stroke="url(#ttMarkTrace)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Central Decomposition Trace Line */}
        <path
          d="M14.5 11V21"
          stroke="url(#ttMarkTrace)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Verification Checkmark */}
        <path
          d="M8.5 19.5L14.5 25.5L27.5 11"
          stroke="url(#ttMarkVerify)"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Micro-precision terminal nodes */}
        <circle cx="7" cy="11" r="1.75" fill="#93C5FD" />
        <circle cx="27.5" cy="11" r="1.85" fill="#34D399" />
      </svg>
    </div>
  );
}

/**
 * Enterprise TraceTest Wordmark and Branding Component
 */
export function TraceTestLogo({
  variant = "sidebar",
  theme = "light",
  compact = false,
  projectName,
  className,
  markClassName,
}: TraceTestLogoProps) {
  const isCompact = compact || variant === "compact";
  const isDark = theme === "dark";

  if (variant === "symbol") {
    return <TraceTestMark size={32} theme={theme} className={markClassName} />;
  }

  return (
    <div className={cn("group flex items-center gap-2.5 min-w-0 select-none", className)}>
      <TraceTestMark size={32} theme={theme} className={markClassName} />

      {!isCompact && (
        <div className="flex min-w-0 flex-col leading-tight">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                "text-sm font-bold tracking-tight",
                isDark ? "text-white" : "text-slate-900"
              )}
            >
              TraceTest
            </span>
            {projectName && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium border truncate max-w-[90px]",
                  isDark
                    ? "bg-slate-800 text-blue-300 border-slate-700"
                    : "bg-blue-50 text-[#1D4ED8] border-blue-200/60"
                )}
                title={projectName}
              >
                {projectName.length > 12 ? projectName.slice(0, 10) + "…" : projectName}
              </span>
            )}
          </div>
          <span
            className={cn(
              "text-[10px] font-medium tracking-tight truncate",
              isDark ? "text-slate-400" : "text-slate-500"
            )}
          >
            AI-Powered Quality Engineering
          </span>
        </div>
      )}
    </div>
  );
}
