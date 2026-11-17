import { AlertTriangle, Check, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils/format";

export interface ApprovalRequestPayload {
  task_id: number;
  action: string;
  risk_level: number;
  impact_summary: string;
  payload?: Record<string, any>;
}

interface ReasonXApprovalCardProps {
  request: ApprovalRequestPayload;
  onApprove: (taskId: number) => Promise<void>;
  onReject: (taskId: number) => Promise<void>;
}

export function ReasonXApprovalCard({
  request,
  onApprove,
  onReject,
}: ReasonXApprovalCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<"approved" | "rejected" | null>(null);

  const handleApprove = async () => {
    try {
      setSubmitting(true);
      await onApprove(request.task_id);
      setOutcome("approved");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    try {
      setSubmitting(true);
      await onReject(request.task_id);
      setOutcome("rejected");
    } finally {
      setSubmitting(false);
    }
  };

  if (outcome === "approved") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 my-3 text-xs flex items-center gap-2 text-emerald-900 font-medium animate-in fade-in">
        <Check className="h-4 w-4 text-emerald-600" />
        <span>Action approved and successfully committed to database records.</span>
      </div>
    );
  }

  if (outcome === "rejected") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 my-3 text-xs flex items-center gap-2 text-slate-600 animate-in fade-in">
        <X className="h-4 w-4 text-slate-400" />
        <span>Action rejected. No database changes were made.</span>
      </div>
    );
  }

  const isLevel4 = request.risk_level >= 4;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 my-3 text-xs shadow-md transition-all animate-in fade-in duration-200",
        isLevel4
          ? "border-rose-200 bg-rose-50 ring-1 ring-rose-300"
          : "border-amber-200 bg-amber-50 ring-1 ring-amber-300"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            isLevel4 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
          )}
        >
          {isLevel4 ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-slate-900 text-xs">
              {isLevel4 ? "High-Impact Operation Confirmation" : "Persistent Project Change Confirmation"}
            </h4>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                isLevel4 ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
              )}
            >
              Level {request.risk_level} Gate
            </span>
          </div>

          <p className="mt-1 text-slate-700 leading-relaxed font-normal">
            {request.impact_summary}
          </p>

          {/* Action Parameter Details */}
          {request.payload && (
            <div className="mt-2.5 rounded-lg border border-slate-200/80 bg-white/90 p-2.5 text-2xs font-mono text-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">
                Proposed Action Payload: {request.action}
              </span>
              <pre className="overflow-x-auto whitespace-pre-wrap max-h-32 text-slate-700">
                {JSON.stringify(request.payload, null, 2)}
              </pre>
            </div>
          )}

          {/* Dual-Control Approval Controls */}
          <div className="mt-3.5 flex items-center justify-end gap-2.5 border-t border-slate-200/60 pt-3">
            <button
              type="button"
              onClick={handleReject}
              disabled={submitting}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
            >
              Reject & Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={submitting}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-xs active:scale-95 transition-all disabled:opacity-50",
                isLevel4 ? "bg-rose-600 hover:bg-rose-700" : "bg-[#1D4ED8] hover:bg-blue-700"
              )}
            >
              {submitting ? "Executing..." : "Approve & Execute"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
