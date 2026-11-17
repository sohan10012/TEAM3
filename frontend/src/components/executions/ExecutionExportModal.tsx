import {
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  Printer,
} from "lucide-react";
import { useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { downloadUrl } from "@/services/api";
import type { Execution } from "@/types/models";
import { cn } from "@/utils/format";

interface ExecutionExportModalProps {
  execution: Execution | null;
  onClose: () => void;
}

export function ExecutionExportModal({ execution, onClose }: ExecutionExportModalProps) {
  const [format, setFormat] = useState<"md" | "csv" | "json" | "html">("md");

  if (!execution) return null;

  const exportUrl =
    format === "html"
      ? downloadUrl(`/executions/${execution.id}/report.html`)
      : downloadUrl(`/executions/${execution.id}/export.${format}`);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Export Execution Report (${execution.key})`}
      footer={
        <div className="flex items-center justify-between w-full">
          <Button onClick={onClose}>Cancel</Button>
          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
            onClick={() => setTimeout(onClose, 500)}
          >
            <Download className="h-4 w-4" />
            Download {format.toUpperCase()} Report
          </a>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <p className="text-slate-600">
          Export full execution run results, test metrics, duration telemetry, and logs grounded in authentic database records.
        </p>

        {/* Format Selector Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => setFormat("md")}
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer",
              format === "md"
                ? "border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-600 ring-offset-1 font-semibold"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            <FileText className="h-5 w-5 mb-1.5 text-blue-600" />
            <span>Markdown</span>
            <span className="text-[10px] text-slate-500 font-mono">.md</span>
          </button>

          <button
            type="button"
            onClick={() => setFormat("csv")}
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer",
              format === "csv"
                ? "border-emerald-600 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-600 ring-offset-1 font-semibold"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            <FileSpreadsheet className="h-5 w-5 mb-1.5 text-emerald-600" />
            <span>Spreadsheet</span>
            <span className="text-[10px] text-slate-500 font-mono">.csv</span>
          </button>

          <button
            type="button"
            onClick={() => setFormat("json")}
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer",
              format === "json"
                ? "border-purple-600 bg-purple-50/70 text-purple-900 ring-2 ring-purple-600 ring-offset-1 font-semibold"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            <FileCode className="h-5 w-5 mb-1.5 text-purple-600" />
            <span>Data Payload</span>
            <span className="text-[10px] text-slate-500 font-mono">.json</span>
          </button>

          <button
            type="button"
            onClick={() => setFormat("html")}
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer",
              format === "html"
                ? "border-amber-600 bg-amber-50/70 text-amber-900 ring-2 ring-amber-600 ring-offset-1 font-semibold"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            <Printer className="h-5 w-5 mb-1.5 text-amber-600" />
            <span>Printable HTML</span>
            <span className="text-[10px] text-slate-500 font-mono">.html</span>
          </button>
        </div>

        {/* Content Preview Box */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5 font-mono text-[11px] text-slate-700">
          <div className="text-slate-500 font-sans text-2xs uppercase font-semibold">Report Preview:</div>
          <p># TraceTest Execution Report: {execution.key}</p>
          <p>Status: {execution.status.toUpperCase()} | Runner: {execution.runner}</p>
          <p>Results: {execution.passed} Passed, {execution.failed} Failed, {execution.skipped || 0} Skipped of {execution.total} Total</p>
          <p className="text-slate-500">... includes detailed per-test step sequences, duration telemetry, and logs.</p>
        </div>
      </div>
    </Dialog>
  );
}
