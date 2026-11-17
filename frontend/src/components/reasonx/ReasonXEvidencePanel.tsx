import { ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export interface EvidenceItem {
  source_document?: string;
  page?: number | null;
  section?: string;
  requirement_id?: string;
  quote?: string;
}

interface ReasonXEvidencePanelProps {
  evidence?: EvidenceItem[];
  projectId?: number | null;
}

export function ReasonXEvidencePanel({
  evidence = [],
  projectId,
}: ReasonXEvidencePanelProps) {
  if (!evidence || evidence.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 my-2 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-900 uppercase tracking-wider">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
          Verified Source Grounding & Statutory Evidence
        </span>
        <span className="text-[10px] text-blue-600 font-medium">
          {evidence.length} Cited {evidence.length === 1 ? "Record" : "Records"}
        </span>
      </div>

      <div className="space-y-2 pt-1 border-t border-blue-100">
        {evidence.map((ev, idx) => {
          // Check if requirement_id can link to requirements page
          const reqLink = ev.requirement_id
            ? `/requirements?project_id=${projectId || ""}`
            : null;

          return (
            <div
              key={idx}
              className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs space-y-1 text-2xs leading-relaxed"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <FileText className="h-3 w-3 text-blue-600 shrink-0" />
                  <span className="truncate">{ev.source_document || "Authoritative Project Documentation"}</span>
                </div>

                {ev.requirement_id && reqLink && (
                  <Link
                    to={reqLink}
                    className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-blue-600 hover:text-blue-800 hover:underline shrink-0"
                  >
                    <span>{ev.requirement_id}</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                )}
              </div>

              <div className="text-slate-500 text-[11px] flex items-center gap-2">
                {ev.section && <span>Section: <strong className="text-slate-700">{ev.section}</strong></span>}
                {ev.page && <span>Page: <strong className="text-slate-700">{ev.page}</strong></span>}
              </div>

              {ev.quote && (
                <blockquote className="border-l-2 border-blue-300 pl-2 text-slate-700 italic text-[11px] mt-1 bg-slate-50/60 py-0.5 rounded-r">
                  “{ev.quote}”
                </blockquote>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
