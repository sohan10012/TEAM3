import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api } from "@/services/api";
import { cn } from "@/utils/format";

export interface CandidateTestCase {
  temp_id: string;
  requirement_id: number;
  requirement_key?: string;
  requirement_title?: string;
  title: string;
  description: string;
  preconditions: string;
  test_category: string;
  test_data: Record<string, any>;
  steps: Array<{ step: number; action: string; expected: string }>;
  expected_result: string;
  priority: string;
  execution_capability: string;
  clause_keys: string[];
  ac_keys: string[];
  rationale: string;
  confidence: number;
  is_duplicate?: boolean;
  duplicate_of?: string | null;
  target_ac_uncovered?: boolean;
}

export interface TestGenerationPreviewModalProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  uncoveredAcCount?: number;
  onGenerationComplete: () => void;
}

const ALL_CATEGORIES = [
  { id: "positive", label: "Nominal / Positive", icon: "✓", desc: "Happy paths and nominal execution" },
  { id: "negative", label: "Negative", icon: "✕", desc: "Malformed and invalid inputs" },
  { id: "boundary_value", label: "Boundary Value", icon: "↔", desc: "Min/max threshold transitions" },
  { id: "edge_case", label: "Edge Case", icon: "⚡", desc: "Extremes and special characters" },
  { id: "input_validation", label: "Input Validation", icon: "⌕", desc: "Schema, required fields & types" },
  { id: "business_rule", label: "Business Rule", icon: "⚖", desc: "Statutory rules and calculations" },
  { id: "permission_role", label: "Role / Permission", icon: "🛡", desc: "RBAC and unauthorized access" },
  { id: "security", label: "Security", icon: "🔒", desc: "Authentication and payload defense" },
  { id: "error_handling", label: "Error Handling", icon: "⚠", desc: "Graceful recovery and error codes" },
  { id: "integration", label: "Integration", icon: "⇄", desc: "API contracts and payloads" },
];

export function TestGenerationPreviewModal({
  open,
  onClose,
  projectId,
  uncoveredAcCount = 112,
  onGenerationComplete,
}: TestGenerationPreviewModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  // Workflow state: "config" -> "preview" -> "committed"
  const [stage, setStage] = useState<"config" | "preview" | "committed">("config");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "positive",
    "negative",
    "boundary_value",
    "business_rule",
    "security",
  ]);
  const [targetUncoveredAcs, setTargetUncoveredAcs] = useState<boolean>(true);
  const [candidateTests, setCandidateTests] = useState<CandidateTestCase[]>([]);
  const [selectedTempIds, setSelectedTempIds] = useState<string[]>([]);
  const [autoApprove, setAutoApprove] = useState<boolean>(false);
  const [expandedTempIds, setExpandedTempIds] = useState<string[]>([]);
  const [committedKeys, setCommittedKeys] = useState<string[]>([]);

  // Preview mutation (Stage A)
  const previewM = useMutation({
    mutationFn: async () => {
      return api.post<{
        project_id: number;
        total_candidates: number;
        uncovered_ac_count: number;
        previews: CandidateTestCase[];
      }>(`/projects/${projectId}/generate-tests/preview`, {
        categories: selectedCategories,
        target_uncovered_acs_only: targetUncoveredAcs,
        limit: 18,
      });
    },
    onSuccess: (data) => {
      const candidates = data.previews || [];
      setCandidateTests(candidates);
      // Default to selecting non-duplicate candidates
      setSelectedTempIds(candidates.filter((c) => !c.is_duplicate).map((c) => c.temp_id));
      setStage("preview");
      toast.ok(`Generated ${candidates.length} candidate test specifications for preview.`);
    },
    onError: toast.error,
  });

  // Commit mutation (Stage B)
  const commitM = useMutation({
    mutationFn: async () => {
      const toCommit = candidateTests.filter((c) => selectedTempIds.includes(c.temp_id));
      return api.post<{
        project_id: number;
        created_count: number;
        created_keys: string[];
      }>(`/projects/${projectId}/generate-tests/commit`, {
        test_cases: toCommit,
        auto_approve: autoApprove,
      });
    },
    onSuccess: (data) => {
      setCommittedKeys(data.created_keys || []);
      setStage("committed");
      toast.ok(`Persisted ${data.created_count} verified test cases.`);
      qc.invalidateQueries({ queryKey: ["tests"] });
      qc.invalidateQueries({ queryKey: ["test-metrics", projectId] });
      onGenerationComplete();
    },
    onError: toast.error,
  });

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const selectAllCategories = () => {
    if (selectedCategories.length === ALL_CATEGORIES.length) {
      setSelectedCategories(["positive", "negative"]);
    } else {
      setSelectedCategories(ALL_CATEGORIES.map((c) => c.id));
    }
  };

  const toggleSelectTest = (tempId: string) => {
    setSelectedTempIds((prev) =>
      prev.includes(tempId) ? prev.filter((id) => id !== tempId) : [...prev, tempId]
    );
  };

  const toggleSelectAllTests = () => {
    if (selectedTempIds.length === candidateTests.length) {
      setSelectedTempIds([]);
    } else {
      setSelectedTempIds(candidateTests.map((c) => c.temp_id));
    }
  };

  const toggleExpand = (tempId: string) => {
    setExpandedTempIds((prev) =>
      prev.includes(tempId) ? prev.filter((id) => id !== tempId) : [...prev, tempId]
    );
  };

  const handleReset = () => {
    setStage("config");
    setCandidateTests([]);
    setSelectedTempIds([]);
    setCommittedKeys([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleReset();
          onClose();
        }
      }}
      title={
        stage === "config"
          ? "AI Test Case Generation & Target Alignment"
          : stage === "preview"
          ? `Stage A: Candidate Test Review (${candidateTests.length} Generated)`
          : "Stage B: Verification & Persistence Complete"
      }
      wide
    >
      <div className="space-y-4 text-xs">
        {/* Stage Indicator Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-2xs font-bold font-mono",
                stage === "config"
                  ? "bg-purple-600 text-white"
                  : "bg-emerald-100 text-emerald-800"
              )}
            >
              1
            </span>
            <span className={cn("font-medium", stage === "config" ? "text-slate-900 font-semibold" : "text-slate-500")}>
              Configure Scope
            </span>

            <span className="text-slate-300">→</span>

            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-2xs font-bold font-mono",
                stage === "preview"
                  ? "bg-purple-600 text-white"
                  : stage === "committed"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              2
            </span>
            <span className={cn("font-medium", stage === "preview" ? "text-slate-900 font-semibold" : "text-slate-500")}>
              Safe Preview & Selection
            </span>

            <span className="text-slate-300">→</span>

            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-2xs font-bold font-mono",
                stage === "committed"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              3
            </span>
            <span className={cn("font-medium", stage === "committed" ? "text-slate-900 font-semibold" : "text-slate-500")}>
              Committed to DB
            </span>
          </div>
        </div>

        {/* STEP 1: CONFIGURATION */}
        {stage === "config" && (
          <div className="space-y-4">
            {/* Uncovered AC Priority Callout */}
            {uncoveredAcCount > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-bold text-amber-900">
                      High-Priority Traceability Gap Detected: {uncoveredAcCount} Uncovered Acceptance Criteria
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-amber-950">
                    <input
                      type="checkbox"
                      checked={targetUncoveredAcs}
                      onChange={(e) => setTargetUncoveredAcs(e.target.checked)}
                      className="rounded border-amber-400 text-purple-600 focus:ring-purple-500"
                    />
                    <span>Target Uncovered Criteria First</span>
                  </label>
                </div>
                <p className="text-2xs text-amber-800 leading-relaxed">
                  Phase 2 identified 112 acceptance criteria currently without test case verification. Enabling this option
                  instructs the generator to synthesize grounded tests specifically linked to those exact criteria keys.
                </p>
              </div>
            )}

            {/* Category Multi-Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-700">
                  Select Target Test Categories ({selectedCategories.length} / {ALL_CATEGORIES.length})
                </span>
                <button
                  type="button"
                  onClick={selectAllCategories}
                  className="text-2xs text-purple-700 hover:text-purple-900 font-medium"
                >
                  {selectedCategories.length === ALL_CATEGORIES.length ? "Deselect All" : "Select All 10"}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_CATEGORIES.map((cat) => {
                  const isChecked = selectedCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-all cursor-pointer",
                        isChecked
                          ? "border-purple-300 bg-purple-50/60 shadow-2xs"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      )}
                    >
                      <span className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded text-2xs font-bold font-mono",
                        isChecked ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-500"
                      )}>
                        {cat.icon}
                      </span>
                      <div className="space-y-0.5 overflow-hidden">
                        <p className="font-semibold text-slate-900 truncate">{cat.label}</p>
                        <p className="text-3xs text-slate-500 truncate">{cat.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => previewM.mutate()}
                loading={previewM.isPending}
                disabled={selectedCategories.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                <span>Generate Preview Candidates</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & COMMIT */}
        {stage === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedTempIds.length === candidateTests.length && candidateTests.length > 0}
                  onChange={toggleSelectAllTests}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  id="select-all-candidates"
                />
                <label htmlFor="select-all-candidates" className="font-semibold text-slate-800 cursor-pointer">
                  Select All Candidates ({selectedTempIds.length} of {candidateTests.length} selected)
                </label>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Auto-approve on commit</span>
              </label>
            </div>

            {/* Candidate List */}
            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {candidateTests.map((cand) => {
                const isSelected = selectedTempIds.includes(cand.temp_id);
                const isExpanded = expandedTempIds.includes(cand.temp_id);

                return (
                  <div
                    key={cand.temp_id}
                    className={cn(
                      "rounded-lg border p-3 transition-all",
                      isSelected ? "border-purple-300 bg-white shadow-xs" : "border-slate-200 bg-slate-50/50",
                      cand.is_duplicate && "border-amber-300 bg-amber-50/30"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectTest(cand.temp_id)}
                        className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{cand.title}</span>

                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.2 text-3xs font-semibold text-slate-700 border border-slate-200 capitalize">
                            {cand.test_category?.replace("_", " ")}
                          </span>

                          <span className="font-mono text-3xs text-purple-800 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                            Confidence: {Math.round(cand.confidence * 100)}%
                          </span>

                          {cand.target_ac_uncovered && (
                            <span className="inline-flex items-center gap-1 text-3xs font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                              ★ Targets Uncovered AC: {cand.ac_keys?.join(", ")}
                            </span>
                          )}

                          {cand.is_duplicate && (
                            <span className="inline-flex items-center gap-1 text-3xs font-semibold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded border border-rose-200">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              Similar to {cand.duplicate_of}
                            </span>
                          )}
                        </div>

                        <p className="text-slate-600 text-2xs leading-relaxed">{cand.description}</p>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-3xs text-slate-500 font-mono">
                            {cand.requirement_key} · {cand.steps?.length || 0} steps · {cand.execution_capability}
                          </span>

                          <button
                            type="button"
                            onClick={() => toggleExpand(cand.temp_id)}
                            className="inline-flex items-center gap-1 text-3xs font-medium text-purple-700 hover:text-purple-900"
                          >
                            <span>{isExpanded ? "Hide Details" : "View Steps & Assertions"}</span>
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-slate-100 space-y-2 text-2xs bg-slate-50 p-2.5 rounded">
                            <div className="space-y-1">
                              <span className="font-bold text-slate-700">Preconditions:</span>
                              <p className="text-slate-600">{cand.preconditions}</p>
                            </div>

                            <div className="space-y-1">
                              <span className="font-bold text-slate-700">Steps:</span>
                              <div className="space-y-1 pl-2">
                                {cand.steps?.map((s, idx) => (
                                  <div key={idx} className="flex items-start gap-1.5 text-3xs">
                                    <span className="font-mono text-slate-400">{idx + 1}.</span>
                                    <div>
                                      <p className="font-medium text-slate-800">{s.action}</p>
                                      {s.expected && <p className="text-slate-500 font-medium">↳ {s.expected}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="font-bold text-slate-700">Expected Result:</span>
                              <p className="text-emerald-800 font-medium">{cand.expected_result}</p>
                            </div>

                            <div className="space-y-1">
                              <span className="font-bold text-slate-700">AI Rationale:</span>
                              <p className="text-slate-600">{cand.rationale}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setStage("config")}>
                Back to Configuration
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => commitM.mutate()}
                  loading={commitM.isPending}
                  disabled={selectedTempIds.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  <span>Commit {selectedTempIds.length} Selected Tests</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: COMMITTED CONFIRMATION */}
        {stage === "committed" && (
          <div className="space-y-4 text-center py-4">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Successfully Persisted {committedKeys.length} Test Cases
              </h3>
              <p className="text-xs text-slate-600">
                All selected test specifications have been validated, assigned official keys, and persisted to the database.
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 max-h-36 overflow-y-auto text-left">
              <span className="text-3xs uppercase font-semibold text-slate-500 block mb-1">
                Generated Test Identifiers:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {committedKeys.map((k) => (
                  <span
                    key={k}
                    className="font-mono text-2xs font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Close & View in Workspace
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
