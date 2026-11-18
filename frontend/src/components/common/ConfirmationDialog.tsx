import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, Info, Loader2, X } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/utils/format";

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: "danger" | "primary" | "warning";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  intent = "primary",
  loading = false,
  onConfirm,
  children,
}: ConfirmationDialogProps) {
  const isDanger = intent === "danger";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs transition-opacity" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl focus:outline-none"
          )}
        >
          <div className="flex items-start gap-3.5">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                isDanger
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : intent === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-600"
                  : "border-blue-200 bg-blue-50 text-[#1D4ED8]"
              )}
            >
              {isDanger || intent === "warning" ? (
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Info className="h-5 w-5" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-base font-semibold text-slate-900">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-600">
                {description}
              </DialogPrimitive.Description>
            </div>

            <DialogPrimitive.Close
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {children && <div className="mt-4">{children}</div>}

          <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={isDanger ? "danger" : "primary"}
              size="sm"
              disabled={loading}
              onClick={onConfirm}
              className={cn(
                isDanger
                  ? "bg-rose-600 text-white hover:bg-rose-700 border-transparent"
                  : ""
              )}
            >
              {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

