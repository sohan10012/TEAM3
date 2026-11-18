import { forwardRef, InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/utils/format";

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  shortcutBadge?: string;
  wrapperClassName?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      value,
      onChange,
      onClear,
      placeholder = "Search...",
      shortcutBadge,
      wrapperClassName,
      disabled,
      ...props
    },
    ref
  ) => {
    const hasValue = Boolean(value && String(value).length > 0);

    return (
      <div className={cn("relative flex items-center min-w-[200px]", wrapperClassName)}>
        <Search
          className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none shrink-0"
          aria-hidden="true"
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400",
            "transition-colors hover:border-slate-300 focus:border-[#1D63ED] focus:outline-none focus:ring-2 focus:ring-blue-100",
            "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
            className
          )}
          {...props}
        />
        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="absolute right-2.5 p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Clear search text"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {!hasValue && shortcutBadge && (
          <kbd className="pointer-events-none absolute right-2.5 hidden sm:inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            {shortcutBadge}
          </kbd>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

