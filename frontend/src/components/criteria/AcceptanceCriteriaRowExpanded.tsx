import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  User,
  Activity,
  FileCheck2,
  Copy,
  Check,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Criterion } from "@/types/models";
import { cn } from "@/utils/format";

export interface AcceptanceCriteriaRowExpandedProps {
  criterion: Criterion;
  onInspect: (criterion: Criterion) => void;
  onReview?: (criterion: Criterion, decision: "approve" | "reject" | "request_clarification", comment?: string) => void;
  onEdit?: (criterion: Criterion) => void;
}

export function AcceptanceCriteriaRowExpanded({
  criterion: a,
  onInspect,
  onReview,
  onEdit,
}: AcceptanceCriteriaRowExpandedProps) {
  const [copiedGherkin, setCopiedGherkin] = useState(false);

  // Construct Gherkin representation
  const gherkinText = `Scenario: ${a.key} - ${a.description}
  Given ${a.preconditions || "preconditions are met"}
  When ${a.actor || "actor"} ${(a.action || "performs operation").toLowerCase()}
  Then ${a.expected_behaviour || "expected behaviour occurs"}
  ${a.expected_output ? `And output matches: ${a.expected_output}` : ""}`;

  const handleCopyGherkin = () => {
    navigator.clipboard.writeText(gherkinText);
    setCopiedGherkin(true);
    setTimeout(() => setCopiedGherkin(false), 2000);
  };

  const confidencePct = Math.round((a.confidence || 0) * 100);
  const confidenceColor =
    confidencePct >= 90
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : confidencePct >= 75
      ? "text-blue-700 bg-blue-50 border-blue-200"
      : "text-amber-700 bg-amber-50 border-amber-200";

  return (
    <div className="border-t border-slate-200 bg-slate-50/70 p-5 space-y-5 animate-in fade-in-50 duration-150">
      {/* Top Banner: Quick Summary & Copy Gherkin */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700">Specification Type:</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-medium text-slate-800 border border-slate-200 shadow-2xs">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            Behavior-Driven Acceptance Criterion
          </span>
          {a.provider && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600 border border-slate-200">
              <Sparkles className="h-3 w-3 text-purple-500" />
              {a.provider}
              {a.model ? ` / ${a.model}` : ""}
            </span>
          )}
          <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 font-semibold text-[11px]", confidenceColor)}>
            {confidencePct}% Confidence
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCopyGherkin}
            className="h-7 text-xs bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs"
            title="Copy Gherkin Feature Scenario"
          >
            {copiedGherkin ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-medium">Copied BDD</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-500" />
                <span>Copy Gherkin</span>
              </>
            )}
          </Button>

          {onEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEdit(a)}
              className="h-7 text-xs bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs"
            >
              <Edit3 className="h-3.5 w-3.5 text-slate-500" />
              <span>Edit</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={() => onInspect(a)}
            className="h-7 text-xs bg-white hover:bg-slate-50 text-blue-700 border-blue-200 shadow-2xs font-medium"
          >
            <span>Open Drawer</span>
            <ChevronRight className="h-3.5 w-3.5 text-blue-500" />
          </Button>
        </div>
      </div>

      {/* Grid: Left Column (BDD & Business Context) | Right Column (Grounding & Test Coverage) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: BDD Specification (8 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-blue-600" />
              Given - When - Then Specification (BDD)
            </h4>

            {/* GIVEN */}
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 uppercase tracking-wider">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                GIVEN (Preconditions & Inputs)
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-normal">
                {a.preconditions || "System is online with default configurations."}
              </p>
              {Array.isArray(a.input_conditions) && a.input_conditions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 pt-1">
                  {a.input_conditions.map((item: any, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-700 border border-slate-200"
                    >
                      <span className="font-semibold text-slate-500">{typeof item === "object" ? item.field || "param" : "input"}:</span>
                      <span>{typeof item === "object" ? item.condition || JSON.stringify(item) : String(item)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* WHEN */}
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                WHEN (Actor Action & Trigger)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100/70 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  <User className="h-3 w-3 text-amber-700" />
                  {a.actor || "Authenticated Actor"}
                </span>
                <span className="text-xs text-slate-800 font-medium">
                  {a.action || a.description}
                </span>
              </div>
            </div>

            {/* THEN */}
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                THEN (Expected State & Output)
              </div>
              <p className="text-xs text-slate-800 leading-relaxed font-normal">
                {a.expected_behaviour}
              </p>
              {a.expected_output && (
                <div className="mt-2 rounded bg-emerald-50/50 border border-emerald-100 p-2 text-[11px] text-emerald-900 font-mono">
                  <span className="font-semibold text-emerald-700">Verified Output: </span>
                  {a.expected_output}
                </div>
              )}
              {Array.isArray(a.validation_conditions) && a.validation_conditions.length > 0 && (
                <ul className="mt-2 space-y-1 pl-4 list-disc text-xs text-slate-600">
                  {a.validation_conditions.map((vc, i) => (
                    <li key={i} className="leading-snug">{vc}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Grounding, Traceability & Test Coverage (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Source Grounding Box */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5 text-teal-600" />
                Source Grounding & Evidence
              </h4>
              {a.quote_verified ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Verbatim Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                  Model-Inferred
                </span>
              )}
            </div>

            <blockquote
              className={cn(
                "rounded-lg border-l-3 p-2.5 text-xs italic leading-relaxed",
                a.quote_verified
                  ? "border-emerald-500 bg-emerald-50/30 text-slate-800"
                  : "border-amber-400 bg-amber-50/30 text-slate-700"
              )}
            >
              "{a.source_quote || a.description}"
            </blockquote>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 font-medium">Cited Clauses:</span>
              {(Array.isArray(a.clause_keys) ? a.clause_keys : [a.clause_keys]).filter(Boolean).map((ck, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-700"
                >
                  {ck}
                </span>
              ))}
            </div>

            {a.rationale && (
              <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 text-xs text-slate-600 space-y-1">
                <span className="font-semibold text-slate-700 block">AI Rationale:</span>
                <p className="leading-relaxed">{a.rationale}</p>
              </div>
            )}
          </div>

          {/* Test Coverage Box */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                Test Coverage
              </h4>
              <span className="text-xs font-semibold text-slate-600">
                {a.linked_test_count || 0} Test{(a.linked_test_count || 0) !== 1 ? "s" : ""} Linked
              </span>
            </div>

            {(a.linked_test_count || 0) > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {(a.linked_test_keys || []).map((tKey, idx) => (
                    <Link
                      key={idx}
                      to={`/tests?search=${encodeURIComponent(tKey)}`}
                      className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200/80 px-2 py-1 font-mono text-xs font-medium text-indigo-800 hover:bg-indigo-100 transition-colors"
                    >
                      <span>{tKey}</span>
                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </Link>
                  ))}
                  {(a.linked_test_count || 0) > (a.linked_test_keys || []).length && (
                    <span className="text-[11px] text-slate-500 self-center">
                      +{(a.linked_test_count || 0) - (a.linked_test_keys || []).length} more
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Fully verified by automated test specifications.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50/40 p-3 text-center space-y-1">
                <p className="text-xs font-medium text-rose-800">
                  No automated tests linked to this criterion yet
                </p>
                <p className="text-[11px] text-rose-600">
                  Generate test scenarios or link existing tests under Quality Engineering.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review Actions Footer (if pending review) */}
      {onReview && a.review_status !== "approved" && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Review Criterion:</span>
            <span className="text-xs text-slate-400">Current status is {a.review_status}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const comment = prompt("Enter clarification inquiry / details for this criterion:");
                if (comment) onReview(a, "request_clarification", comment);
              }}
              className="h-8 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Request Clarification</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const comment = prompt("Enter rejection reason:");
                if (comment) onReview(a, "reject", comment);
              }}
              className="h-8 text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
            >
              <span>Reject</span>
            </Button>

            <Button
              size="sm"
              variant="primary"
              onClick={() => onReview(a, "approve", "Approved by QA review")}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Approve Criterion</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

