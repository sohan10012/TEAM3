import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/utils/format";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  value?: string;
  onValueChange?: (value: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  triggerClassName?: string;
}

export const CustomSelect = forwardRef<HTMLSelectElement, CustomSelectProps>(
  (
    {
      value,
      onValueChange,
      onChange,
      options,
      placeholder,
      ariaLabel,
      className,
      triggerClassName,
      disabled,
      ...props
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onValueChange?.(e.target.value);
      onChange?.(e);
    };

    return (
      <div className={cn("relative inline-flex items-center", className)}>
        <select
          ref={ref}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel || props["aria-label"]}
          className={cn(
            "h-9 appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-800 shadow-2xs transition-colors",
            "hover:border-slate-300 hover:bg-slate-50/50",
            "focus:border-[#3067DB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3067DB]/20",
            "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
            triggerClassName
          )}
          {...props}
        >
          {placeholder && !options.some((opt) => opt.value === "" || opt.value === "ALL" || opt.label.toLowerCase() === placeholder.toLowerCase()) && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400"
          aria-hidden="true"
        />
      </div>
    );
  }
);

CustomSelect.displayName = "CustomSelect";
