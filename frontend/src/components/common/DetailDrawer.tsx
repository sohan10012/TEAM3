import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { cn } from "@/utils/format";

export interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const widthClasses = {
  sm: "w-[min(28rem,calc(100vw-1rem))]",
  md: "w-[min(36rem,calc(100vw-1rem))]",
  lg: "w-[min(46rem,calc(100vw-1rem))]",
  xl: "w-[min(56rem,calc(100vw-1rem))]",
};

export function DetailDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  badge,
  children,
  footer,
  width = "md",
  className,
}: DetailDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs transition-opacity" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex flex-col border-l border-slate-200 bg-white shadow-2xl focus:outline-none animate-in slide-in-from-right duration-200",
            widthClasses[width],
            className
          )}
        >
          {/* Header */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5 sm:px-6 bg-white">
            <div className="min-w-0 flex-1 pr-3">
              <div className="flex items-center gap-2">
                <DialogPrimitive.Title className="truncate text-base font-semibold text-slate-900">
                  {title}
                </DialogPrimitive.Title>
                {badge && <div className="shrink-0">{badge}</div>}
              </div>
              {subtitle && (
                <DialogPrimitive.Description className="truncate text-xs text-slate-500 mt-0.5">
                  {subtitle}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-white">
            {children}
          </div>

          {/* Sticky Footer */}
          {footer && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 sm:px-6 flex items-center justify-end gap-2.5">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

