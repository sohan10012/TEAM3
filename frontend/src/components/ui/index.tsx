import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { AlertTriangle, Inbox, Loader2, X } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ApiError } from "@/services/api";
import { cn, label } from "@/utils/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover disabled:bg-slate-300",
  secondary: "bg-white text-ink border border-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  outline: "bg-white text-ink border border-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-white text-red-700 border border-red-300 hover:bg-red-50",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: "sm" | "md"; loading?: boolean }>(
  ({ className, variant = "secondary", size = "md", loading, children, disabled, ...p }, ref) => (
    <button ref={ref} disabled={disabled || loading}
      className={cn("inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring disabled:cursor-not-allowed",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm", variants[variant], className)} {...p}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  ));
Button.displayName = "Button";

const field = "w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-ink placeholder:text-slate-400 " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:bg-slate-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) =>
  <input ref={ref} className={cn(field, "h-9", className)} {...p} />);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, "py-2 leading-relaxed", className)} {...p} />);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...p }, ref) =>
    <select ref={ref} className={cn(field, "h-9 pr-7", className)} {...p}>{children}</select>);
Select.displayName = "Select";

export function Field({ label: l, htmlFor, error, hint, children }: { label: string; htmlFor?: string; error?: string;
  hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">{l}</label>
      {children}
      {error ? <p className="text-xs text-red-700" role="alert">{error}</p> :
        hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

const tone: Record<string, string> = {
  passed: "bg-emerald-50 text-emerald-800 ring-emerald-200", approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  verified: "bg-emerald-50 text-emerald-800 ring-emerald-200", closed: "bg-slate-100 text-slate-700 ring-slate-200",
  valid: "bg-emerald-50 text-emerald-800 ring-emerald-200", completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  connected: "bg-emerald-50 text-emerald-800 ring-emerald-200", analysed: "bg-blue-50 text-blue-800 ring-blue-200",
  failed: "bg-red-50 text-red-800 ring-red-200", error: "bg-red-50 text-red-800 ring-red-200",
  invalid: "bg-red-50 text-red-800 ring-red-200", rejected: "bg-red-50 text-red-800 ring-red-200",
  critical: "bg-red-600 text-white ring-red-600", high: "bg-orange-50 text-orange-800 ring-orange-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200", low: "bg-slate-100 text-slate-700 ring-slate-200",
  timed_out: "bg-red-50 text-red-800 ring-red-200", reopened: "bg-red-50 text-red-800 ring-red-200",
  open: "bg-orange-50 text-orange-800 ring-orange-200", pending_review: "bg-amber-50 text-amber-800 ring-amber-200",
  needs_reapproval: "bg-purple-50 text-purple-800 ring-purple-200", changed: "bg-purple-50 text-purple-800 ring-purple-200",
  changes_requested: "bg-amber-50 text-amber-800 ring-amber-200", recommended: "bg-violet-50 text-violet-800 ring-violet-200",
  awaiting_review: "bg-violet-50 text-violet-800 ring-violet-200", degraded: "bg-amber-50 text-amber-800 ring-amber-200",
  running: "bg-blue-50 text-blue-800 ring-blue-200", queued: "bg-slate-100 text-slate-700 ring-slate-200",
  historical_import: "bg-slate-100 text-slate-600 ring-slate-200", platform_run: "bg-blue-50 text-blue-800 ring-blue-200",
  ci: "bg-teal-50 text-teal-800 ring-teal-200", draft: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function Badge({ value, children, className }: { value?: string | null; children?: ReactNode; className?: string }) {
  const v = value ?? "";
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-2xs font-medium ring-1 ring-inset",
      tone[v] ?? "bg-slate-100 text-slate-700 ring-slate-200", className)}>
      {children ?? (v === "historical_import" ? "Historical import" : v === "platform_run" ? "Platform run" :
        v === "ci" ? "CI" : label(v))}
    </span>
  );
}

export const Key = ({ children, className }: { children: ReactNode; className?: string }) =>
  <span className={cn("font-mono text-xs text-slate-600", className)}>{children}</span>;

export function Panel({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode;
  children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-xs text-slate-600 leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) =>
  <div className={cn("animate-pulse rounded bg-slate-200/70", className)} aria-hidden />;

export function LoadingBlock({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-2" role="status" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <Inbox className="h-7 w-7 text-slate-400" aria-hidden />
      <p className="mt-2 text-sm font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-slate-600">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = error instanceof ApiError ? error : null;
  const denied = e?.status === 403;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{denied ? "You don't have access to this" : e?.status === 404 ? "Not found" :
            "This couldn't be loaded"}</p>
          <p className="mt-0.5 text-red-800">{e?.message ?? String((error as Error)?.message ?? error)}</p>
          {e?.traceId && <p className="mt-1 font-mono text-2xs text-red-700">Trace ID {e.traceId}</p>}
        </div>
        {onRetry && !denied && <Button size="sm" onClick={onRetry}>Retry</Button>}
      </div>
    </div>
  );
}

export function Dialog({ open, onOpenChange, title, description, children, footer, wide }: { open: boolean;
  onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; footer?: ReactNode;
  wide?: boolean }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
        <DialogPrimitive.Content className={cn("fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2",
          "-translate-y-1/2 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl focus:outline-none",
          wide ? "max-w-3xl" : "max-w-lg")}>
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-3">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold text-ink">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="mt-0.5 text-sm text-slate-600">
                {description}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
              <X className="h-4 w-4" /></DialogPrimitive.Close>
          </div>
          <div className="space-y-4 px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Tabs({ tabs, value, onValueChange }: { tabs: { value: string; label: ReactNode; content: ReactNode }[];
  value?: string; onValueChange?: (v: string) => void }) {
  return (
    <TabsPrimitive.Root defaultValue={tabs[0]?.value} value={value} onValueChange={onValueChange}>
      <TabsPrimitive.List className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Sections">
        {tabs.map((t) => (
          <TabsPrimitive.Trigger key={t.value} value={t.value}
            className="-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-slate-600 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring data-[state=active]:border-accent data-[state=active]:font-medium data-[state=active]:text-ink">
            {t.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((t) => <TabsPrimitive.Content key={t.value} value={t.value} className="focus:outline-none">
        {t.content}</TabsPrimitive.Content>)}
    </TabsPrimitive.Root>
  );
}

export function Stat({ label: l, value, hint, onClick, intent }: { label: string; value: ReactNode; hint?: ReactNode;
  onClick?: () => void; intent?: "bad" | "good" }) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className={cn("rounded-lg border border-slate-200 bg-white px-4 py-3 text-left",
      onClick && "transition-colors hover:border-accent-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring")}>
      <div className="text-xs text-slate-600">{l}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums text-ink", intent === "bad" && "text-red-700",
        intent === "good" && "text-emerald-700")}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </C>
  );
}

export function KV({ items, wide, stacked }: { items: [string, ReactNode][]; wide?: boolean; stacked?: boolean }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-2 text-sm", wide && "lg:grid-cols-2")}>
      {items.map(([k, v]) => (
        <div key={k} className={cn("flex min-w-0 gap-2 border-b border-slate-100 pb-1.5", stacked && "flex-col gap-0.5")}>
          <dt className={cn("shrink-0 text-slate-500", stacked ? "text-xs" : "w-32")}>{k}</dt><dd className="min-w-0 flex-1 break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export const Code = ({ children, className }: { children: ReactNode; className?: string }) =>
  <pre className={cn("max-h-96 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800", className)}>{children}</pre>;

export function Notice({ tone: t = "info", children }: { tone?: "info" | "warn" | "danger"; children: ReactNode }) {
  return <div className={cn("rounded-md border px-3 py-2 text-sm",
    t === "info" && "border-blue-200 bg-blue-50 text-blue-900", t === "warn" && "border-amber-200 bg-amber-50 text-amber-900",
    t === "danger" && "border-red-200 bg-red-50 text-red-900")} role={t === "danger" ? "alert" : "status"}>{children}</div>;
}
