import { Check, Copy, Download, FileCode, FileDown, FileText, Printer, X } from "lucide-react";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/utils/format";

interface TraceabilityExportModalProps {
  projectId: string | number;
  projectKey: string;
  onClose: () => void;
}

export const TraceabilityExportModal: React.FC<TraceabilityExportModalProps> = ({
  projectId,
  projectKey,
  onClose,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<"json" | "csv" | "md" | "html">("md");
  const [copied, setCopied] = useState(false);

  // Fetch report content preview
  const previewQuery = useQuery({
    queryKey: ["traceability-export-preview", projectId, selectedFormat],
    enabled: selectedFormat !== "html",
    queryFn: async () => {
      const res = await fetch(`/api/v1/projects/${projectId}/traceability/export.${selectedFormat}`);
      return res.text();
    },
  });

  const handleCopy = () => {
    if (previewQuery.data) {
      navigator.clipboard.writeText(previewQuery.data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (selectedFormat === "html") {
      window.open(`/api/v1/projects/${projectId}/quality-report.html`, "_blank");
    } else {
      const url = `/api/v1/projects/${projectId}/traceability/export.${selectedFormat}`;
      window.open(url, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 text-xs animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileDown className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Export Enterprise Traceability Dossier
            </h3>
            <span className="font-mono text-2xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {projectKey}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Format Selector Pills */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: "md", label: "Markdown (.md)", icon: FileText, desc: "GitHub & Audit Dossier" },
            { id: "csv", label: "CSV (.csv)", icon: FileCode, desc: "Spreadsheet & Gaps" },
            { id: "json", label: "JSON (.json)", icon: FileCode, desc: "Raw Structured Tree" },
            { id: "html", label: "HTML Dossier", icon: Printer, desc: "Executive Print Ready" },
          ].map((fmt) => {
            const Icon = fmt.icon;
            const isSelected = selectedFormat === fmt.id;
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setSelectedFormat(fmt.id as any)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer",
                  isSelected
                    ? "border-blue-500 bg-blue-50/70 shadow-2xs"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <Icon className={cn("h-4 w-4 mb-1.5", isSelected ? "text-blue-600" : "text-slate-400")} />
                <span className="font-bold text-slate-900 block text-2xs">{fmt.label}</span>
                <span className="text-3xs text-slate-500 block truncate">{fmt.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Preview Console */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-2xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Report Content Preview</span>
            {selectedFormat !== "html" && (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 transition-colors"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Copied!" : "Copy Raw"}</span>
              </button>
            )}
          </div>

          <div className="h-64 rounded-xl border border-slate-200 bg-slate-950 p-3 overflow-y-auto text-2xs font-mono text-slate-300">
            {selectedFormat === "html" ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                <Printer className="h-8 w-8 text-blue-400" />
                <p>The Comprehensive HTML Quality Dossier is optimized for executive print and PDF rendering.</p>
                <p className="text-3xs text-slate-500">Includes all 19 verification sections, charts, and statutory matrices.</p>
              </div>
            ) : previewQuery.isLoading ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                Generating export payload...
              </div>
            ) : (
              <pre className="whitespace-pre-wrap">{previewQuery.data}</pre>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium text-xs hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download {selectedFormat.toUpperCase()} Dossier</span>
          </button>
        </div>
      </div>
    </div>
  );
};
