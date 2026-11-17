import {
  ArrowRight,
  Bug,
  Sparkles,
  X,
} from "lucide-react";
import React, { useEffect } from "react";
import { Link } from "react-router-dom";

export interface SelectedEntityData {
  type: "requirement" | "clause" | "acceptance_criteria" | "test_case" | "defect";
  id: number;
  key: string;
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  reviewStatus?: string;
  sourceSection?: string;
  sourcePage?: string;
  sourceQuote?: string;
  confidence?: number;
  coverageStatus?: string;
  clauses?: Array<{ id: number; key: string; text: string }>;
  acceptanceCriteria?: Array<{ id: number; key: string; description: string }>;
  tests?: Array<{
    id: number;
    key: string;
    title: string;
    category?: string;
    latest_result?: { status: string; duration_ms?: number } | null;
  }>;
  defects?: Array<{ id: number; key: string; title: string; severity: string; status: string }>;
}

interface TraceabilityDetailDrawerProps {
  entity: SelectedEntityData | null;
  projectId: string | number;
  onClose: () => void;
  onOpenImpactAnalysis?: (reqId: number) => void;
}

export const TraceabilityDetailDrawer: React.FC<TraceabilityDetailDrawerProps> = ({
  entity,
  projectId,
  onClose,
  onOpenImpactAnalysis,
}) => {
  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!entity) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* 1. Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {entity.key}
              </span>
              <span className="text-2xs font-semibold uppercase text-slate-500 tracking-wider">
                {entity.type.replace("_", " ")}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 2. Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
            {/* Title & Metadata */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-snug">{entity.title}</h2>
              {entity.description && (
                <p className="mt-1.5 text-slate-600 leading-relaxed text-2xs">{entity.description}</p>
              )}
            </div>

            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {entity.category && (
                <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {entity.category}
                </span>
              )}
              {entity.priority && (
                <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                  {entity.priority}
                </span>
              )}
              {entity.reviewStatus && (
                <span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Status: {entity.reviewStatus}
                </span>
              )}
            </div>

            {/* Source Provenance Quote */}
            {entity.sourceQuote && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-2xs font-bold text-slate-700 uppercase tracking-wider block">
                  Statutory Source Citation
                </span>
                <p className="text-2xs text-slate-700 italic border-l-2 border-blue-500 pl-2">
                  "{entity.sourceQuote}"
                </p>
                {entity.confidence && (
                  <span className="text-2xs text-slate-400 block pt-0.5">
                    Citation Confidence: {(entity.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )}

            {/* Bidirectional Traceability Sections */}

            {/* Citing Clauses */}
            {entity.clauses && entity.clauses.length > 0 && (
              <div className="space-y-2">
                <span className="text-2xs font-bold text-slate-700 uppercase tracking-wider block">
                  Atomic Clauses ({entity.clauses.length})
                </span>
                <div className="space-y-1.5">
                  {entity.clauses.map((c) => (
                    <div
                      key={c.id}
                      className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 text-2xs"
                    >
                      <span className="font-mono font-bold text-indigo-700 block">{c.key}</span>
                      <p className="text-slate-600 mt-0.5 line-clamp-2">{c.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Acceptance Criteria */}
            {entity.acceptanceCriteria && entity.acceptanceCriteria.length > 0 && (
              <div className="space-y-2">
                <span className="text-2xs font-bold text-slate-700 uppercase tracking-wider block">
                  Acceptance Criteria ({entity.acceptanceCriteria.length})
                </span>
                <div className="space-y-1.5">
                  {entity.acceptanceCriteria.map((a) => (
                    <div
                      key={a.id}
                      className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 text-2xs"
                    >
                      <span className="font-mono font-bold text-purple-700 block">{a.key}</span>
                      <p className="text-slate-600 mt-0.5 line-clamp-2">{a.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Child Tests */}
            {entity.tests && entity.tests.length > 0 && (
              <div className="space-y-2">
                <span className="text-2xs font-bold text-slate-700 uppercase tracking-wider block">
                  Linked Test Cases ({entity.tests.length})
                </span>
                <div className="space-y-1.5">
                  {entity.tests.slice(0, 10).map((t) => (
                    <div
                      key={t.id}
                      className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 text-2xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-800 block">{t.key}</span>
                        <span className="text-slate-600 truncate max-w-xs block">{t.title}</span>
                      </div>
                      {t.latest_result?.status === "passed" ? (
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold shrink-0">
                          Passed
                        </span>
                      ) : t.latest_result?.status === "failed" ? (
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-semibold shrink-0">
                          Failed
                        </span>
                      ) : (
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-medium shrink-0">
                          {t.latest_result?.status || "Unrun"}
                        </span>
                      )}
                    </div>
                  ))}
                  {entity.tests.length > 10 && (
                    <span className="text-2xs text-slate-400 block text-center">
                      + {entity.tests.length - 10} more tests in suite
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Linked Defects */}
            {entity.defects && entity.defects.length > 0 && (
              <div className="space-y-2">
                <span className="text-2xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Bug className="h-3.5 w-3.5 text-rose-600" />
                  Linked Active Defects ({entity.defects.length})
                </span>
                <div className="space-y-1.5">
                  {entity.defects.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/60 text-2xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono font-bold text-rose-900 block">{d.key}</span>
                        <span className="text-rose-800 truncate block">{d.title}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-2xs font-bold uppercase bg-rose-200 text-rose-900 shrink-0">
                        {d.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Sticky Footer Action Controls */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
            {entity.type === "requirement" && onOpenImpactAnalysis && (
              <button
                type="button"
                onClick={() => onOpenImpactAnalysis(entity.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Change Impact</span>
              </button>
            )}

            {entity.type === "requirement" && (
              <Link
                to={`/requirements?project_id=${projectId}&requirement_id=${entity.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                <span>Open in Studio</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}

            {entity.type === "test_case" && (
              <Link
                to={`/tests?project_id=${projectId}&test_id=${entity.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                <span>Open Test Details</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
