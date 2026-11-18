import { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/utils/format";

export interface FilterBarProps {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  activeCount?: number;
  onReset?: () => void;
  className?: string;
}

export function FilterBar({
  search,
  filters,
  actions,
  activeCount = 0,
  onReset,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between shadow-2xs",
        className
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {search && <div className="w-full sm:w-auto sm:min-w-[240px] max-w-sm">{search}</div>}
        {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
        {activeCount > 0 && onReset && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            className="h-9 text-xs text-slate-500 hover:text-slate-800"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Clear filters ({activeCount})
          </Button>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
}

