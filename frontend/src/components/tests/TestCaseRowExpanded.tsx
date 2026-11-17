import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  FileText,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui";
import type { TestCase } from "@/types/models";
import { cn } from "@/utils/format";

interface TestCaseRowExpandedProps {
  testCase: TestCase;
  executionStatus?: string;
  onOpenDrawer?: () => void;
  onExecute?: () => void;
  isExecuting?: boolean;
}

export function TestCaseRowExpanded({
  testCase,
  executionStatus = "not_executed",
  onOpenDrawer,
  onExecute,
  isExecuting = false,
}: TestCaseRowExpandedProps) {
  const [activeTab, setActiveTab] = useState<"spec" | "context" | "trace" | "exec" | "ai">("spec");

  const steps = (testCase.steps_json || []) as Array<{ step?: number; action: string; expected?: string }>;
  const testData = testCase.test_data || {};
  const hasTestData = Object.keys(testData).length > 0;

  return (
    <div className="border-t border-slate-200 bg-slate-50/70 p-4 space-y-4">
      {/* Sub-navigation tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "spec" as const, label: "Test Specification", count: steps.length },
            { id: "context" as const, label: "Business Context", count: testCase.ac_keys?.length || 0 },
            { id: "trace" as const, label: "Traceability Chain", count: (testCase.clause_keys?.length || 0) + (testCase.ac_keys?.length || 0) },
            { id: "exec" as const, label: "Execution Telemetry", badge: executionStatus },
            { id: "ai" as const, label: "AI Grounding & Rationale", confidence: testCase.confidence },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/90 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                )}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={cn(
                    "rounded-full px-1.5 py-0.2 text-3xs font-mono",
                    isActive ? "bg-slate-100 text-slate-800" : "bg-slate-200/70 text-slate-600"
                  )}>
                    {tab.count}
                  </span>
                )}
                {tab.confidence !== undefined && (
                  <span className="text-3xs font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    {Math.round(tab.confidence * 100)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onExecute && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExecute}
              loading={isExecuting}
              className="bg-white border-slate-300 text-slate-800 hover:bg-slate-100 shadow-2xs text-xs h-7.5"
            >
              <Play className="h-3 w-3 text-emerald-600 mr-1" />
              <span>Run Test Now</span>
            </Button>
          )}

          {onOpenDrawer && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenDrawer}
              className="bg-white border-slate-300 text-slate-800 hover:bg-slate-100 shadow-2xs text-xs h-7.5"
            >
              <ExternalLink className="h-3 w-3 text-blue-600 mr-1" />
              <span>Full Drawer Details</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tab 1: Test Specification */}
      {activeTab === "spec" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            {/* Steps Table */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="bg-slate-100/70 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5 text-slate-600" />
                  <span>Execution Steps Sequence ({steps.length})</span>
                </span>
                <span className="text-3xs text-slate-500 font-mono">
                  Runner: {testCase.automation || "pytest"}
                </span>
              </div>

              {steps.length > 0 ? (
                <div className="divide-y divide-slate-100 text-xs">
                  {steps.map((s, idx) => (
                    <div key={idx} className="p-3 hover:bg-slate-50/50 flex gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xs font-mono font-bold text-slate-600">
                        {s.step || idx + 1}
                      </span>
                      <div className="space-y-1 flex-1">
                        <p className="text-slate-900 font-medium">{s.action}</p>
                        {s.expected && (
                          <p className="text-slate-600 flex items-start gap-1">
                            <span className="text-emerald-600 font-semibold shrink-0">↳ Expected:</span>
                            <span>{s.expected}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-500">
                  No structured steps recorded. Check script or description.
                </div>
              )}
            </div>

            {/* Expected Result Box */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
              <span className="text-2xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1 mb-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>Verifiable Pass Assertion</span>
              </span>
              <p className="text-xs text-emerald-950 font-medium">
                {testCase.expected_result || "Operation completes with verified state persistence and matching schema response."}
              </p>
            </div>
          </div>

          {/* Right Column: Preconditions & Input Data */}
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5 shadow-2xs">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                Preconditions & Prerequisites
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                {testCase.preconditions || "System is active in test environment; required test dataset is initialized."}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                  Test Inputs & Parameters
                </span>
                <span className="text-3xs text-slate-400 font-mono">JSON</span>
              </div>
              {hasTestData ? (
                <pre className="text-3xs font-mono bg-slate-900 text-slate-100 p-2.5 rounded overflow-x-auto max-h-40">
                  {JSON.stringify(testData, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-slate-500 italic">No custom parameters specified.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Business Context */}
      {activeTab === "context" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2 shadow-2xs">
            <span className="text-2xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>Parent Requirement Reference</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {testCase.requirement_key || `REQ-${testCase.requirement_id}`}
              </span>
              <span className="text-2xs text-slate-500">Version {testCase.requirement_version || 1}</span>
            </div>
            <p className="text-xs text-slate-800 leading-relaxed font-medium">
              {testCase.title}
            </p>
            {testCase.description && (
              <p className="text-xs text-slate-600 leading-relaxed">
                {testCase.description}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2 shadow-2xs">
            <span className="text-2xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              <span>Verified Acceptance Criteria Links</span>
            </span>
            {testCase.ac_keys && testCase.ac_keys.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {testCase.ac_keys.map((ack) => (
                  <span
                    key={ack}
                    className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-1 text-2xs font-mono font-semibold text-purple-700 border border-purple-200"
                  >
                    <span>✓</span>
                    <span>{ack}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                ⚠ No specific acceptance criteria mapped to this test case.
              </p>
            )}

            {testCase.source_quote && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <span className="text-3xs font-bold uppercase text-slate-400">Source Quote Grounding</span>
                <blockquote className="mt-1 border-l-2 border-purple-400 pl-2 text-2xs italic text-slate-600">
                  "{testCase.source_quote}"
                </blockquote>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Traceability Chain */}
      {activeTab === "trace" && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
            End-to-End Enterprise Traceability Graph
          </span>

          <div className="flex flex-col md:flex-row md:items-center gap-2 text-xs">
            {/* Requirement Node */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 flex-1 space-y-1">
              <span className="text-3xs font-semibold uppercase text-blue-700">Requirement</span>
              <p className="font-mono font-bold text-slate-900">{testCase.requirement_key || `REQ-${testCase.requirement_id}`}</p>
              <p className="text-3xs text-slate-600 truncate">{testCase.title}</p>
            </div>

            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 self-center hidden md:block" />

            {/* Atomic Clauses Node */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex-1 space-y-1">
              <span className="text-3xs font-semibold uppercase text-slate-600">Atomic Clauses</span>
              <div className="flex flex-wrap gap-1">
                {(testCase.clause_keys || []).map((k) => (
                  <span key={k} className="font-mono text-3xs bg-white px-1.5 py-0.5 rounded border border-slate-300">
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 self-center hidden md:block" />

            {/* Acceptance Criteria Node */}
            <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-2.5 flex-1 space-y-1">
              <span className="text-3xs font-semibold uppercase text-purple-700">Acceptance Criteria</span>
              <div className="flex flex-wrap gap-1">
                {(testCase.ac_keys || []).map((k) => (
                  <span key={k} className="font-mono text-3xs bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded border border-purple-200">
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 self-center hidden md:block" />

            {/* Test Case Node */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 flex-1 space-y-1">
              <span className="text-3xs font-semibold uppercase text-emerald-700">Test Case</span>
              <p className="font-mono font-bold text-emerald-900">{testCase.key}</p>
              <p className="text-3xs text-slate-600">{testCase.test_category}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Execution Telemetry */}
      {activeTab === "exec" && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
              Latest Execution Telemetry
            </span>
            <div className="flex items-center gap-2">
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold border",
                executionStatus === "passed" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                executionStatus === "failed" && "bg-rose-50 text-rose-700 border-rose-200",
                executionStatus === "blocked" && "bg-amber-50 text-amber-800 border-amber-200",
                executionStatus === "not_executed" && "bg-slate-100 text-slate-600 border-slate-200"
              )}>
                {executionStatus === "passed" && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                {executionStatus === "failed" && <XCircle className="h-3 w-3 text-rose-600" />}
                {executionStatus === "blocked" && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                <span className="capitalize">{executionStatus.replace("_", " ")}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="rounded border border-slate-200 bg-slate-50/60 p-3 space-y-1">
              <span className="text-3xs font-semibold uppercase text-slate-500">Expected Outcome</span>
              <p className="text-slate-800">{testCase.expected_result || "Expected nominal state transition."}</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50/60 p-3 space-y-1">
              <span className="text-3xs font-semibold uppercase text-slate-500">Recorded Telemetry Status</span>
              <p className="text-slate-800">
                {executionStatus === "passed"
                  ? "All test step assertions evaluated successfully without contract drift."
                  : executionStatus === "failed"
                  ? "Failure encountered during assertion validation."
                  : "No recent execution captured. Run sandbox or simulation to collect telemetry."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: AI Grounding & Rationale */}
      {activeTab === "ai" && (
        <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              <span>AI Generation Provenance & Verification</span>
            </span>
            <span className="text-2xs font-mono font-semibold text-purple-800">
              Confidence: {Math.round((testCase.confidence || 0.9) * 100)}%
            </span>
          </div>

          <p className="text-xs text-slate-800 leading-relaxed">
            {testCase.rationale || `Deterministically grounded in requirement ${testCase.requirement_key}. Generated across ${testCase.test_category} category.`}
          </p>

          <div className="flex flex-wrap gap-2 text-2xs pt-1">
            <span className="rounded bg-white px-2 py-0.5 border border-purple-200 text-purple-900 font-mono">
              Provider: {testCase.provider || "rule_engine"}
            </span>
            <span className="rounded bg-white px-2 py-0.5 border border-purple-200 text-purple-900 font-mono">
              Model: {testCase.model || "deterministic-generator"}
            </span>
            <span className="rounded bg-white px-2 py-0.5 border border-purple-200 text-purple-900 font-mono">
              Provenance: {testCase.generation_provenance || "ai_generated"}
            </span>
            <span className={cn(
              "rounded px-2 py-0.5 font-semibold border",
              testCase.validation_status === "valid" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
            )}>
              Validation: {testCase.validation_status || "valid"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
