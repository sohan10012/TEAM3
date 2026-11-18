import { ReactNode } from "react";
import { cn } from "@/utils/format";

export interface SectionCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  interactive?: boolean;
  onClick?: () => void;
}

export function SectionCard({
  title,
  subtitle,
  badge,
  actions,
  children,
  className,
  headerClassName,
  bodyClassName,
  interactive,
  onClick,
}: SectionCardProps) {
  const Component = onClick ? "button" : "section";

  return (
    <Component
      onClick={onClick}
      className={cn(
        "flex flex-col min-w-0 rounded-xl border border-slate-200 bg-white transition-all duration-150",
        interactive || onClick
          ? "cursor-pointer hover:border-slate-300 hover:shadow-xs text-left"
          : "",
        className
      )}
    >
      {(title || subtitle || actions || badge) && (
        <header
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-3.5",
            headerClassName
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {title && (
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
                {title}
              </h3>
            )}
            {badge && <div className="shrink-0">{badge}</div>}
            {subtitle && (
              <span className="hidden sm:inline text-xs text-slate-500 font-normal">
                {subtitle}
              </span>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn("min-w-0 p-4 sm:p-5", bodyClassName)}>{children}</div>
    </Component>
  );
}

