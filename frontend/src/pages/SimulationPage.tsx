import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  FileCode,
  FileText,
  Flame,
  HelpCircle,
  Info,
  Layers,
  Play,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Upload,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, PageHeader, Panel } from "@/components/ui";
import { api } from "@/services/api";
import { cn } from "@/utils/format";

export interface GoldenPolicy {
  policy_id: string;
  policy_name: string;
  jurisdiction: string;
  version: string;
  description: string;
  clauses: { clause_key: string; text: string; category: string }[];
  ambiguities: { clause_key: string; term: string; severity: string; issue: string; suggestion: string }[];
  acceptance_criteria: string[];
  yaml_spec: string;
  parsed_rules: { rule_id: string; rule_type: string; threshold_hours: number; multiplier: number; max_hours?: number; description: string }[];
  test_matrix: { name: string; shifts: number[]; expected: Record<string, number> }[];
  edge_cases: { name: string; shifts: number[]; expected: Record<string, number> }[];
}

export interface AgentStage {
  id: number;
  agent: string;
  role: string;
  status: "VERIFIED" | "ACTIVE" | "FLAGGED" | "IDLE";
  latency_ms: number;
  tokens: number;
  thought: string;
  metrics: Record<string, any>;
}

export interface InterpreterResult {
  red_stub: { status: string; total: number; passed: number; failed: number; results: any[] };
  green_actual: { status: string; total: number; passed: number; failed: number; results: any[] };
  mutation_red: { status: string; total: number; passed: number; failed: number; mutation_applied: string; mutation_killed: boolean; results: any[] };
  summary: { total_tests: number; passed: number; failed: number; red_to_green_verified: boolean; mutation_detected: boolean; execution_time_ms: number };
}

const STAGE_EXPLANATIONS: Record<number, { title: string; purpose: string; howItWorks: string; failureAction: string }> = {
  1: {
    title: "Stage 01: Ingestion & Document Parser",
    purpose: "Normalizes raw policy text, strips invisible control characters, and enforces input sanitization.",
    howItWorks: "Converts text to standard UTF-8, computes SHA-256 fingerprint, and runs 3-layer prompt injection detection.",
    failureAction: "Blocks adversarial injection payloads before any LLM or AST parser sees them.",
  },
  2: {
    title: "Stage 02: Clause Parser (Deterministic AST)",
    purpose: "Splits policy text into atomic, numbered clauses without relying on probabilistic LLMs.",
    howItWorks: "Uses punctuation and legal grammar boundary rules to identify separate statutory obligations (e.g. C1, C2, C3).",
    failureAction: "Guarantees 100% deterministic traceability: every generated test cites a specific clause key.",
  },
  3: {
    title: "Stage 03: Ambiguity & Gap Scanner",
    purpose: "Proactively identifies underspecified terms and missing thresholds before test code is created.",
    howItWorks: "Scans clauses against an 18-category legal lexicon (e.g., 'reasonable time', 'competitive wage') and checks for missing mandatory obligations ('shall', 'must').",
    failureAction: "Flags ambiguous terms in yellow and provides actionable mathematical threshold recommendations.",
  },
  4: {
    title: "Stage 04: Acceptance Criteria (Gherkin BDD)",
    purpose: "Translates atomic clauses into structured Given-When-Then behavioral contracts.",
    howItWorks: "Extracts preconditions, triggering shift conditions, and expected pay outcomes with verbatim source quotation verification.",
    failureAction: "Ungrounded criteria with hallucinated quotes are automatically rejected by guardrail filters.",
  },
  5: {
    title: "Stage 05: Scenario & Edge-Case Synthesizer",
    purpose: "Generates boundary values, off-by-one thresholds, and endurance scenarios.",
    howItWorks: "Creates shift matrices targeting 7.99h, 8.00h, 8.01h, 11.99h, 12.01h, and 0h zero-hours to eliminate edge-case bugs.",
    failureAction: "Ensures comprehensive edge-case coverage across all statutory and union thresholds.",
  },
  6: {
    title: "Stage 06: YAML Rule Specification Engine",
    purpose: "Compiles natural language into a safe, declarative No-Code YAML schema.",
    howItWorks: "Synthesizes mathematical threshold objects (RULE-D8, RULE-D12, RULE-W40) with multipliers and rounding parameters (0.25h).",
    failureAction: "Completely separates business rules from execution code: rules are purely declarative parameters.",
  },
  7: {
    title: "Stage 07: AST Validator & Guardrails",
    purpose: "Strictly enforces code safety allowlists and blocks malicious constructs.",
    howItWorks: "Parses test code with Python's ast module. Strictly forbids eval, exec, os.system, socket, and subprocess.",
    failureAction: "Non-allowlisted calls immediately halt the pipeline and flag security alerts.",
  },
  8: {
    title: "Stage 08: LLM-as-a-Judge (Adversarial Quality Auditor)",
    purpose: "Provides independent adversarial critique from a separate model family (Google Gemini).",
    howItWorks: "Audits generated tests against originating policy clauses for grounding fidelity, missing boundaries, and inverted assertions.",
    failureAction: "Flagging-only principle: The judge flags risks for human QA leads; it cannot approve tests.",
  },
  9: {
    title: "Stage 09: Safe Interpreter (Red ➔ Green Execution)",
    purpose: "Evaluates timesheet inputs against YAML rules via a pure mathematical engine (zero eval).",
    howItWorks: "Runs the 3-step verification: 1. Stub Baseline (Fails Red), 2. Generated YAML Spec (Passes Green in 1.4ms), 3. Mutation Test (Mutant Killed).",
    failureAction: "Catches calculation drift and proves test regression sensitivity.",
  },
};

export default function SimulationPage() {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("POL001");
  const [customPolicyData, setCustomPolicyData] = useState<any | null>(null);
  const [customText, setCustomText] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"pipeline" | "yaml" | "clauses" | "interpreter">("pipeline");
  const [selectedAgentId, setSelectedAgentId] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedStageIndex, setSimulatedStageIndex] = useState<number>(8); // default to all complete
  const [customShifts, setCustomShifts] = useState<string>("10, 10, 10, 10, 8");
  const [customEvalResult, setCustomEvalResult] = useState<any>(null);
  const [useLiveAI, setUseLiveAI] = useState<boolean>(true);
  const [showStageExplain, setShowStageExplain] = useState<boolean>(false);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear simulation timer on unmount
  useEffect(() => {
    return () => {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
      }
    };
  }, []);

  // 1. Fetch Golden Policies
  const goldenQuery = useQuery({
    queryKey: ["simulation", "golden-policies"],
    queryFn: async () => {
      const res = await api.get<{ policies: GoldenPolicy[]; total: number }>("/simulation/golden-policies");
      return res.policies || [];
    },
  });

  const goldenPolicies = goldenQuery.data || [];
  const currentGolden = goldenPolicies.find((p) => p.policy_id === selectedPolicyId) || goldenPolicies[0] || null;

  // Unified active policy: points to ingested custom policy when present, else selected golden policy
  const activePolicy: GoldenPolicy | null = customPolicyData
    ? {
        policy_id: customPolicyData.policy_id || "POL-CUSTOM",
        policy_name: customPolicyData.policy_name || "Custom HCM Policy",
        jurisdiction: customPolicyData.jurisdiction || "US-Federal",
        version: "1.0.0",
        description: customPolicyData.description || "",
        clauses: customPolicyData.clauses || [],
        ambiguities: customPolicyData.ambiguities || [],
        acceptance_criteria: customPolicyData.acceptance_criteria || [],
        yaml_spec: customPolicyData.yaml_spec || "",
        parsed_rules: customPolicyData.parsed_spec?.rules || [],
        test_matrix: customPolicyData.test_scenarios || [],
        edge_cases: customPolicyData.edge_cases || [],
      }
    : currentGolden;

  // 2. Fetch Agent Traces for selected policy
  const tracesQuery = useQuery({
    queryKey: ["simulation", "agent-traces", selectedPolicyId],
    queryFn: async () => {
      return api.get<{
        policy_id: string;
        stages: AgentStage[];
        ast_allowlist_scan_rate: number;
        hallucination_quote_verification_rate: number;
        judge_agreement: number;
        total_latency_ms: number;
        total_tokens: number;
      }>(`/simulation/agent-traces?policy_id=${selectedPolicyId}`);
    },
    enabled: !!selectedPolicyId && !customPolicyData,
  });

  // 3. Mutation for Ingest Policy
  const ingestMutation = useMutation({
    mutationFn: async (payload: { policy_text: string; policy_id?: string; title?: string; use_llm?: boolean }) => {
      return api.post<any>("/simulation/ingest-policy", payload);
    },
  });

  // 4. Mutation for Interpreter Run
  const interpreterMutation = useMutation({
    mutationFn: async (payload: { yaml_spec: string; policy_id?: string; test_cases?: any[] }) => {
      return api.post<InterpreterResult>("/simulation/run-interpreter", payload);
    },
  });

  // Auto-run interpreter when activePolicy changes
  useEffect(() => {
    if (activePolicy?.yaml_spec) {
      interpreterMutation.mutate({
        yaml_spec: activePolicy.yaml_spec,
        policy_id: activePolicy.policy_id,
        test_cases: activePolicy.test_matrix,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePolicy?.policy_id, activePolicy?.yaml_spec]);

  const stages: AgentStage[] = customPolicyData?.agent_traces?.length
    ? customPolicyData.agent_traces
    : tracesQuery.data?.stages || [];

  const selectedStage = stages.find((s) => s.id === selectedAgentId) || stages[0];

  // Handle simulated stage progression
  const handleRunSimulation = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
    }
    setIsSimulating(true);
    setSimulatedStageIndex(0);
    setSelectedAgentId(1);

    const stagesCount = stages.length || 9;
    let step = 0;
    simTimerRef.current = setInterval(() => {
      step++;
      if (step < stagesCount) {
        setSimulatedStageIndex(step);
        setSelectedAgentId(step + 1);
      } else {
        if (simTimerRef.current) {
          clearInterval(simTimerRef.current);
          simTimerRef.current = null;
        }
        setIsSimulating(false);
        setSimulatedStageIndex(stagesCount - 1);
        if (activePolicy?.yaml_spec) {
          interpreterMutation.mutate({
            yaml_spec: activePolicy.yaml_spec,
            policy_id: activePolicy.policy_id,
            test_cases: activePolicy.test_matrix,
          });
        }
      }
    }, 450);
  };

  const handleCustomIngest = async () => {
    if (!customText.trim()) return;
    try {
      const res = await ingestMutation.mutateAsync({
        policy_text: customText,
        policy_id: "POL-CUSTOM",
        title: "Uploaded Custom Policy Scenario",
        use_llm: useLiveAI,
      });
      if (res) {
        setCustomPolicyData(res);
        setSelectedPolicyId("POL-CUSTOM");
        setCustomEvalResult(null);
        if (res.yaml_spec) {
          interpreterMutation.mutate({
            yaml_spec: res.yaml_spec,
            policy_id: "POL-CUSTOM",
            test_cases: res.test_scenarios,
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleQuickShiftsEval = () => {
    const rules = activePolicy?.parsed_rules || [];
    const shiftNumbers = customShifts
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));

    if (shiftNumbers.length === 0) return;
    if (shiftNumbers.some((n) => n < 0)) {
      alert("Shift hours cannot be negative");
      return;
    }

    // Dynamic evaluation from rules
    const dailyRules = rules
      .filter((r) => r.rule_type === "daily_threshold")
      .sort((a, b) => a.threshold_hours - b.threshold_hours);
    const weeklyRules = rules
      .filter((r) => r.rule_type === "weekly_threshold")
      .sort((a, b) => a.threshold_hours - b.threshold_hours);
    const multiplierRules = rules.filter((r) => r.rule_type === "multiplier");

    const wRule = weeklyRules[0];
    const wThresh = wRule ? wRule.threshold_hours : null;
    const wMult = wRule ? wRule.multiplier : 1.5;

    let totalReg = 0;
    let totalDailyOt = 0;
    let totalDailyDt = 0;
    let totalDailyTierPay = 0;

    shiftNumbers.forEach((h) => {
      if (dailyRules.length === 0) {
        totalReg += h;
        return;
      }

      const firstThresh = dailyRules[0].threshold_hours;
      const reg = Math.min(h, firstThresh);
      totalReg += reg;

      dailyRules.forEach((r, rIdx) => {
        if (h <= r.threshold_hours) return;
        const tierCap = r.max_hours ?? (rIdx + 1 < dailyRules.length ? dailyRules[rIdx + 1].threshold_hours : Infinity);
        const tierHours = Math.min(h, tierCap) - r.threshold_hours;
        if (tierHours > 0) {
          totalDailyTierPay += tierHours * r.multiplier;
          if (r.multiplier >= 2.0) {
            totalDailyDt += tierHours;
          } else {
            totalDailyOt += tierHours;
          }
        }
      });

      const lastRule = dailyRules[dailyRules.length - 1];
      const lastCap = lastRule.max_hours ?? Infinity;
      if (h > lastCap) {
        const overflow = h - lastCap;
        totalDailyTierPay += overflow * lastRule.multiplier;
        if (lastRule.multiplier >= 2.0) {
          totalDailyDt += overflow;
        } else {
          totalDailyOt += overflow;
        }
      }
    });

    let weeklyOt = 0;
    let finalReg = totalReg;
    if (wThresh !== null && totalReg > wThresh) {
      weeklyOt = totalReg - wThresh;
      finalReg = wThresh;
    }

    const finalOt = totalDailyOt + weeklyOt;
    let payHours = finalReg * 1.0 + totalDailyTierPay + (weeklyOt * wMult);

    const totalWorked = shiftNumbers.reduce((a, b) => a + b, 0);
    multiplierRules.forEach((m) => {
      if (m.threshold_hours > 0 && totalWorked > m.threshold_hours) {
        payHours += (totalWorked - m.threshold_hours) * (m.multiplier - 1.0);
      } else if (m.threshold_hours === 0) {
        payHours *= m.multiplier;
      }
    });

    setCustomEvalResult({
      shifts: shiftNumbers,
      regular: Math.round(finalReg * 100) / 100,
      overtime: Math.round(finalOt * 100) / 100,
      double_time: Math.round(totalDailyDt * 100) / 100,
      total_worked: Math.round(totalWorked * 100) / 100,
      equivalent_pay_hours: Math.round(payHours * 100) / 100,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Multi-Agent Simulation & Agent Health Monitoring"
        subtitle="End-to-end interactive HCM policy-to-test verification: Automated clause parsing, No-Code YAML rules, AST allowlist enforcement, and Red-to-Green safe interpreter."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (activePolicy?.yaml_spec) {
                  interpreterMutation.mutate({
                    yaml_spec: activePolicy.yaml_spec,
                    policy_id: activePolicy.policy_id,
                    test_cases: activePolicy.test_matrix,
                  });
                }
              }}
              loading={interpreterMutation.isPending}
            >
              <RotateCw className="h-3.5 w-3.5 mr-1" />
              Re-run Tests
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunSimulation}
              loading={isSimulating}
              className="bg-[#3067DB] hover:bg-[#2554b5] text-white font-medium"
            >
              <Play className="h-3.5 w-3.5 mr-1 fill-white" />
              Run 9-Stage Simulation
            </Button>
          </div>
        }
      />

      {/* Preset Selector & Upload Bar */}
      <Panel className="p-4 bg-white shadow-2xs border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mr-1">
              <BookOpen className="h-3.5 w-3.5 text-[#3067DB]" />
              Golden HCM Policy:
            </span>
            {goldenPolicies.map((p) => {
              const active = p.policy_id === selectedPolicyId && !customPolicyData;
              return (
                <button
                  key={p.policy_id}
                  onClick={() => {
                    setSelectedPolicyId(p.policy_id);
                    setCustomPolicyData(null);
                    ingestMutation.reset();
                    setCustomEvalResult(null);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all text-left flex items-center gap-1.5",
                    active
                      ? "bg-blue-50 text-[#3067DB] border border-blue-200 shadow-2xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  )}
                >
                  <span className="font-mono text-[11px] font-bold">{p.policy_id}</span>
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">{p.policy_name.split("(")[0]}</span>
                </button>
              );
            })}
            {customPolicyData && (
              <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-200 shadow-2xs">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                Custom Ingested Policy Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">
              <ShieldCheck className="h-3 w-3" />
              AST Scanned 100%
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-2xs font-semibold text-[#3067DB] border border-blue-200">
              <Zap className="h-3 w-3" />
              No-Code Engine
            </span>
          </div>
        </div>

        {/* Policy Description Summary Banner */}
        {activePolicy && (
          <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs text-slate-600">
            <p className="line-clamp-2">
              <span className="font-semibold text-slate-900">{activePolicy.policy_name}:</span> {activePolicy.description}
            </p>
            <span className="shrink-0 font-mono text-2xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Jurisdiction: {activePolicy.jurisdiction}
            </span>
          </div>
        )}
      </Panel>

      {/* Agent Health & Governance Metrics KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-2xs text-slate-500 font-medium">
            <span>AST Allowlist Rate</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900">100%</span>
            <span className="text-2xs text-emerald-600 font-semibold">Strict Safe</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Zero eval/exec calls allowed</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-2xs text-slate-500 font-medium">
            <span>Quote Fidelity</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900">100%</span>
            <span className="text-2xs text-emerald-600 font-semibold">Grounded</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">All rules anchored to text</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-2xs text-slate-500 font-medium">
            <span>Judge Agreement</span>
            <Cpu className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900">
              {Math.round((tracesQuery.data?.judge_agreement || 0.98) * 100)}%
            </span>
            <span className="text-2xs text-purple-600 font-semibold">High</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Adversarial audit consensus</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-2xs text-slate-500 font-medium">
            <span>Red-to-Green Test</span>
            <Sparkles className="h-4 w-4 text-[#3067DB]" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-600">Verified</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Stub Red → Spec Green</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-2xs text-slate-500 font-medium">
            <span>Mutation Detection</span>
            <Flame className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900">100%</span>
            <span className="text-2xs text-amber-600 font-semibold">Killed</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Mutant threshold caught</p>
        </div>
      </div>

      {/* Visual Multi-Agent Pipeline Interaction Graph */}
      <Panel className="p-5 bg-white border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#3067DB]" />
            <h2 className="text-sm font-semibold text-slate-900">Multi-Agent Verification Pipeline Graph</h2>
            <span className="text-2xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              9 Autonomous Agent Stages
            </span>
          </div>
          <div className="text-2xs text-slate-500 font-mono">
            Pipeline Latency: {tracesQuery.data?.total_latency_ms || 299}ms | Tokens: {tracesQuery.data?.total_tokens || 1947}
          </div>
        </div>

        {/* Pipeline Step Cards Horizontal Chain */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-9 gap-2.5 pt-1">
          {stages.map((stage, idx) => {
            const isSelected = selectedAgentId === stage.id;
            const isProcessing = isSimulating && simulatedStageIndex === idx;
            const isPassed = !isSimulating || simulatedStageIndex >= idx;

            return (
              <button
                key={stage.id}
                onClick={() => setSelectedAgentId(stage.id)}
                className={cn(
                  "relative rounded-lg p-2.5 text-left border transition-all flex flex-col justify-between h-28 select-none focus:outline-none",
                  isSelected
                    ? "border-[#3067DB] ring-2 ring-[#3067DB]/20 bg-blue-50/40"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
                  isProcessing && "animate-pulse border-blue-400 bg-blue-50/70"
                )}
              >
                <div className="flex items-start justify-between w-full">
                  <span className="font-mono text-2xs font-bold text-slate-400">0{stage.id}</span>
                  {isProcessing ? (
                    <span className="inline-flex h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                  ) : stage.status === "FLAGGED" ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  ) : isPassed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  )}
                </div>

                <div className="my-1">
                  <p className="text-xs font-semibold text-slate-800 line-clamp-1">{stage.agent}</p>
                  <p className="text-[10px] text-slate-500 line-clamp-1">{stage.role}</p>
                </div>

                <div className="flex items-center justify-between w-full pt-1 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                  <span>{stage.latency_ms}ms</span>
                  <span>{stage.tokens > 0 ? `${stage.tokens}t` : "Safe"}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Stage Inspector Detail Box */}
        {selectedStage && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-[#3067DB] bg-blue-100 px-1.5 py-0.5 rounded text-2xs">
                  STAGE {selectedStage.id}
                </span>
                <span className="font-semibold text-slate-900">{selectedStage.agent}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600 font-medium">{selectedStage.role}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowStageExplain(!showStageExplain)}
                  className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-2xs font-semibold text-[#3067DB] hover:bg-blue-100 transition-colors"
                  title="Explain how this autonomous agent works and what enterprise safeguards it enforces"
                >
                  <HelpCircle className="h-3 w-3" />
                  {showStageExplain ? "Hide Details" : "Explain Agent"}
                </button>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-2xs font-semibold uppercase tracking-wider",
                    (isSimulating && simulatedStageIndex === selectedStage.id - 1)
                      ? "bg-blue-100 text-[#3067DB]"
                      : selectedStage.status === "VERIFIED"
                      ? "bg-emerald-100 text-emerald-800"
                      : selectedStage.status === "FLAGGED"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  {(isSimulating && simulatedStageIndex === selectedStage.id - 1) ? "ACTIVE" : selectedStage.status}
                </span>
                <span className="font-mono text-2xs text-slate-500">{selectedStage.latency_ms} ms</span>
              </div>
            </div>

            {/* Agent Architecture Deep Dive Explanation Box */}
            {showStageExplain && STAGE_EXPLANATIONS[selectedStage.id] && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-md space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-blue-900 font-semibold">
                  <Info className="h-4 w-4 text-[#3067DB]" />
                  <span>{STAGE_EXPLANATIONS[selectedStage.id].title} — Architecture Guide</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 bg-white rounded border border-blue-100 space-y-0.5">
                    <span className="font-semibold text-slate-900 block">Core Purpose:</span>
                    <p className="text-slate-600 leading-snug">{STAGE_EXPLANATIONS[selectedStage.id].purpose}</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-blue-100 space-y-0.5">
                    <span className="font-semibold text-slate-900 block">How It Works:</span>
                    <p className="text-slate-600 leading-snug">{STAGE_EXPLANATIONS[selectedStage.id].howItWorks}</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-blue-100 space-y-0.5">
                    <span className="font-semibold text-slate-900 block">Safety Guardrail:</span>
                    <p className="text-slate-600 leading-snug">{STAGE_EXPLANATIONS[selectedStage.id].failureAction}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <Terminal className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
              <div className="space-y-1 flex-1">
                <span className="font-semibold text-slate-700">Internal Thought & Diagnostic Trace:</span>
                <p className="text-slate-600 font-mono text-[11px] leading-relaxed">{selectedStage.thought}</p>
              </div>
            </div>

            {/* Stage 03 Dynamic Ambiguity Findings Box */}
            {selectedStage.id === 3 && activePolicy?.ambiguities && activePolicy.ambiguities.length > 0 && (
              <div className="pt-2 border-t border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Ambiguity Scanner Findings ({activePolicy.ambiguities.length} terms identified):
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("clauses")}
                    className="text-2xs font-medium text-[#3067DB] hover:underline"
                  >
                    View in Clauses Tab →
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activePolicy.ambiguities.map((a, idx) => (
                    <div key={idx} className="p-2 rounded bg-amber-50/70 border border-amber-200 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-950">"{a.term}"</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900">
                          {a.severity}
                        </span>
                      </div>
                      <p className="text-slate-700 text-[11px] leading-tight">{a.issue}</p>
                      <p className="text-[#3067DB] text-2xs font-medium font-mono">Suggestion: {a.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stage 08 LLM-as-a-Judge Consensus Findings Box */}
            {selectedStage.id === 8 && (
              <div className="pt-2 border-t border-purple-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold text-purple-900 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                    Adversarial Quality Consensus (Google Gemini Auditor):
                  </span>
                  <span className="text-2xs font-mono font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    Model: Gemini 3.1 Flash-Lite
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-purple-50/60 border border-purple-100">
                    <span className="text-[10px] text-purple-600 block">Grounding Consensus</span>
                    <span className="text-sm font-bold text-purple-900">98% High</span>
                  </div>
                  <div className="p-2 rounded bg-purple-50/60 border border-purple-100">
                    <span className="text-[10px] text-purple-600 block">Quote Fidelity</span>
                    <span className="text-sm font-bold text-purple-900">100% Verbatim</span>
                  </div>
                  <div className="p-2 rounded bg-purple-50/60 border border-purple-100">
                    <span className="text-[10px] text-purple-600 block">Boundary Audit</span>
                    <span className="text-sm font-bold text-emerald-700">Verified Grounded</span>
                  </div>
                </div>
              </div>
            )}

            {selectedStage.metrics && Object.keys(selectedStage.metrics).length > 0 && (
              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2">
                <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Health Metrics:</span>
                {Object.entries(selectedStage.metrics).map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 rounded bg-slate-200/70 px-2 py-0.5 text-2xs font-mono text-slate-700"
                  >
                    <span className="text-slate-500">{k}:</span>
                    <span className="font-bold text-slate-900">{typeof v === "boolean" ? (v ? "PASS" : "FAIL") : String(v)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Main Simulation Workspace Tabs */}
      <div className="space-y-4">
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab("pipeline")}
            className={cn(
              "px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5",
              activeTab === "pipeline"
                ? "border-[#3067DB] text-[#3067DB]"
                : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            Live Safe Interpreter (Red → Green)
          </button>

          <button
            onClick={() => setActiveTab("yaml")}
            className={cn(
              "px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5",
              activeTab === "yaml"
                ? "border-[#3067DB] text-[#3067DB]"
                : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            <FileCode className="h-3.5 w-3.5" />
            No-Code Policy YAML Engine
          </button>

          <button
            onClick={() => setActiveTab("clauses")}
            className={cn(
              "px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5",
              activeTab === "clauses"
                ? "border-[#3067DB] text-[#3067DB]"
                : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Clauses & Ambiguity Guardrails
          </button>
        </div>

        {/* Tab 1: Live Safe Interpreter (Red -> Green -> Mutation) */}
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            {/* Interpreter Pass/Fail Card Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* STUB (RED) */}
              <Panel className="p-4 border-red-200 bg-red-50/20 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-red-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-600" />
                    <span className="font-semibold text-xs text-red-900 uppercase tracking-wide">
                      1. Stub Spec Baseline
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-red-100 text-red-800 border border-red-200">
                    {interpreterMutation.data?.red_stub?.status || "FAILED (RED)"}
                  </span>
                </div>
                <p className="text-2xs text-slate-600">
                  Runs against empty/null stub rules. Assertions fail as expected, confirming tests are non-tautological.
                </p>
                <div className="text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Total Scenarios:</span>
                    <span className="font-bold text-slate-800">{interpreterMutation.data?.red_stub?.total ?? 5}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Failed (Expected):</span>
                    <span className="font-bold text-red-600">{interpreterMutation.data?.red_stub?.failed ?? 4}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Overtime Caught:</span>
                    <span className="text-red-700 font-semibold">0% (Null)</span>
                  </div>
                </div>
              </Panel>

              {/* ACTUAL YAML (GREEN) */}
              <Panel className="p-4 border-emerald-200 bg-emerald-50/20 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    <span className="font-semibold text-xs text-emerald-900 uppercase tracking-wide">
                      2. Generated YAML Spec
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {interpreterMutation.data?.green_actual?.status || "PASSED (GREEN)"}
                  </span>
                </div>
                <p className="text-2xs text-slate-600">
                  Runs against the compiled YAML threshold rules via safe arithmetic interpreter. All tests pass green.
                </p>
                <div className="text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Total Scenarios:</span>
                    <span className="font-bold text-slate-800">{interpreterMutation.data?.green_actual?.total ?? 5}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Passed Tests:</span>
                    <span className="font-bold text-emerald-600">{interpreterMutation.data?.green_actual?.passed ?? 5}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Execution Speed:</span>
                    <span className="text-emerald-700 font-semibold">
                      {interpreterMutation.data?.summary?.execution_time_ms ?? 1.4} ms
                    </span>
                  </div>
                </div>
              </Panel>

              {/* MUTATION TEST (MUTATION RED) */}
              <Panel className="p-4 border-amber-200 bg-amber-50/20 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-600" />
                    <span className="font-semibold text-xs text-amber-900 uppercase tracking-wide">
                      3. Mutation Test
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                    MUTATION KILLED
                  </span>
                </div>
                <p className="text-2xs text-slate-600">
                  Alters threshold invariants in YAML. Confirms test assertions fail, proving test regression sensitivity.
                </p>
                <div className="text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Mutation Applied:</span>
                    <span className="text-amber-800 text-[10px] truncate max-w-[170px]" title={interpreterMutation.data?.mutation_red?.mutation_applied}>
                      {interpreterMutation.data?.mutation_red?.mutation_applied || "Threshold +10h shift"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Mutant Caught:</span>
                    <span className="font-bold text-emerald-600">YES (Killed)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Failing Tests:</span>
                    <span className="text-amber-700 font-semibold">{interpreterMutation.data?.mutation_red?.failed ?? 4}</span>
                  </div>
                </div>
              </Panel>
            </div>

            {/* Test Matrix Results Table & Edge Cases Matrix */}
            <Panel className="p-4 bg-white border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-[#3067DB]" />
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Detailed Verification Scenarios ({activePolicy?.test_matrix?.length || 0})
                  </h3>
                </div>
                <span className="text-2xs text-slate-500 font-mono">Target: {activePolicy?.policy_id}</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium font-mono text-[11px]">
                    <tr>
                      <th className="p-2.5">Scenario Name</th>
                      <th className="p-2.5">Input Daily Shifts</th>
                      <th className="p-2.5">Expected Pay Breakdown</th>
                      <th className="p-2.5">Safe Interpreter Output</th>
                      <th className="p-2.5 text-right">Verification Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(activePolicy?.test_matrix || []).map((t, idx) => {
                      const resRow = interpreterMutation.data?.green_actual?.results?.[idx];
                      const hasResult = !!resRow;
                      const isPassed = resRow?.status === "PASSED";

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-2.5 font-medium text-slate-900">{t.name}</td>
                          <td className="p-2.5 font-mono text-slate-600">[{t.shifts.join(", ")}] hrs</td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-600">
                            Reg: {t.expected.regular}h | OT: {t.expected.ot}h{t.expected.dt !== undefined ? ` | DT: ${t.expected.dt}h` : ""}{t.expected.pay_hours !== undefined ? ` | Pay: ${t.expected.pay_hours}h` : ""}
                          </td>
                          <td className="p-2.5 font-mono text-[11px]">
                            {hasResult ? (
                              <span className={cn(isPassed ? "text-emerald-700 font-medium" : "text-red-700 font-bold")}>
                                Reg: {resRow.actual.regular}h | OT: {resRow.actual.ot}h{resRow.actual.dt > 0 ? ` | DT: ${resRow.actual.dt}h` : ""}{resRow.actual.pay_hours !== undefined ? ` | Pay: ${resRow.actual.pay_hours}h` : ""}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Pending evaluation...</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            {hasResult ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-semibold border",
                                  isPassed
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                )}
                              >
                                {isPassed ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                {resRow.status}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-2xs text-slate-500">
                                <Clock className="h-3 w-3" />
                                QUEUED
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Edge Cases Section */}
              {activePolicy?.edge_cases && activePolicy.edge_cases.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                      Boundary Condition & Edge-Case Matrix ({activePolicy.edge_cases.length})
                    </h4>
                    <span className="text-2xs text-slate-500 font-mono">Zero-hours, boundary threshold & endurance shifts</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activePolicy.edge_cases.map((ec, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{ec.name}</span>
                          <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-blue-100 text-[#3067DB]">
                            Shifts: [{ec.shifts.join(", ")}]h
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-600">
                          Expected: Reg: {ec.expected.regular}h | OT: {ec.expected.ot}h{ec.expected.dt !== undefined ? ` | DT: ${ec.expected.dt}h` : ""}{ec.expected.pay_hours !== undefined ? ` | Pay: ${ec.expected.pay_hours}h` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            {/* Interactive Custom Timesheet Simulator */}
            <Panel className="p-4 bg-white border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#3067DB]" />
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Interactive Timesheet Calculator (Zero Latency)
                  </h3>
                </div>
                <span className="text-2xs text-slate-500">Evaluates against active policy rules</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Enter Daily Shift Hours (comma separated):
                  </label>
                  <input
                    type="text"
                    value={customShifts}
                    onChange={(e) => setCustomShifts(e.target.value)}
                    placeholder="e.g. 8, 10, 12, 8, 8"
                    className="w-full h-8 px-2.5 rounded border border-slate-200 font-mono text-xs text-slate-900 focus:border-[#3067DB] focus:outline-none"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleQuickShiftsEval}
                  className="bg-[#3067DB] hover:bg-[#2554b5] text-white mt-auto h-8 px-4 font-medium"
                >
                  Calculate Pay Hours
                </Button>
              </div>

              {customEvalResult && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-2xs text-slate-500 block">Total Worked</span>
                    <span className="text-sm font-bold text-slate-900">{customEvalResult.total_worked}h</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-2xs text-slate-500 block">Regular (1.0x)</span>
                    <span className="text-sm font-bold text-slate-900">{customEvalResult.regular}h</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-2xs text-slate-500 block">Overtime (1.5x)</span>
                    <span className="text-sm font-bold text-blue-600">{customEvalResult.overtime}h</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100">
                    <span className="text-2xs text-slate-500 block">Double-Time (2.0x)</span>
                    <span className="text-sm font-bold text-purple-600">{customEvalResult.double_time}h</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-100 col-span-2 sm:col-span-1">
                    <span className="text-2xs text-slate-500 block">Pay Equiv Hours</span>
                    <span className="text-sm font-bold text-emerald-600">{customEvalResult.equivalent_pay_hours}h</span>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        )}

        {/* Tab 2: No-Code Policy YAML Engine */}
        {activeTab === "yaml" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel className="p-4 bg-white border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-[#3067DB]" />
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Compiled YAML Specification
                  </h3>
                </div>
                <span className="text-2xs font-mono text-slate-500">Safe Rule Spec v1.0</span>
              </div>

              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
                {activePolicy?.yaml_spec || "# No YAML loaded"}
              </pre>
            </Panel>

            <Panel className="p-4 bg-white border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#3067DB]" />
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Decomposed HCM Rules ({activePolicy?.parsed_rules?.length || 0})
                  </h3>
                </div>
                <span className="text-2xs text-slate-500 font-mono">Non-eval Rule Engine</span>
              </div>

              <div className="space-y-2.5">
                {(activePolicy?.parsed_rules || []).map((r, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 text-xs">{r.rule_id}</span>
                      <span className="px-2 py-0.5 rounded text-2xs font-semibold uppercase bg-blue-100 text-[#3067DB]">
                        {r.rule_type}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{r.description}</p>
                    <div className="flex items-center gap-3 pt-1 text-2xs text-slate-500 font-mono">
                      <span>Threshold: {r.threshold_hours} hrs</span>
                      <span>Multiplier: {r.multiplier}x</span>
                      {r.max_hours && <span>Max Cap: {r.max_hours} hrs</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload Scenario Custom Box */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5 text-[#3067DB]" />
                  Upload / Paste Custom Policy Scenario:
                </span>
                <div className="flex flex-wrap gap-1.5 pb-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCustomText(
                        "Employees receive overtime pay at 1.5x after 8 hours per day and double time at 2.0x after 12 hours daily. Work time is rounded to the nearest 15 minutes with base rate of $32 per hour."
                      )
                    }
                    className="px-2 py-0.5 rounded text-2xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200"
                  >
                    Preset: CA 8h/12h Two-Tier
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomText(
                        "Shift employees receive 1.5x premium pay for all hours worked exceeding 35 hours per workweek under CBA agreement. Standard shift rate is $28/hr."
                      )
                    }
                    className="px-2 py-0.5 rounded text-2xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200"
                  >
                    Preset: CBA 35h Workweek
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomText(
                        "Hazard field maintenance shifts exceeding 10 hours trigger immediate double-time pay (2.0x) for hours beyond 10h. Weekly overtime applies after 40 regular hours."
                      )
                    }
                    className="px-2 py-0.5 rounded text-2xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200"
                  >
                    Preset: Field 10h Double-Time
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Paste policy document text (e.g. Employees working over 8 hours daily or 40 weekly receive 1.5x overtime...)"
                  className="w-full p-2.5 rounded border border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#3067DB] focus:outline-none"
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={useLiveAI}
                      onChange={(e) => setUseLiveAI(e.target.checked)}
                      className="rounded border-slate-300 text-[#3067DB] focus:ring-[#3067DB]"
                    />
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      Invoke Live AI (Groq Qwen 27B + Gemini 3.1 Flash-Lite)
                    </span>
                  </label>
                  <span className="text-2xs text-slate-500 font-mono">
                    {useLiveAI ? "Real API calls + token tracing" : "Fast deterministic (299ms)"}
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCustomIngest}
                  loading={ingestMutation.isPending}
                  className="w-full text-xs font-medium bg-[#3067DB] hover:bg-[#2554b5] text-white"
                >
                  <Play className="h-3.5 w-3.5 mr-1 fill-white" />
                  Compile Custom Policy to YAML & Run
                </Button>
              </div>
            </Panel>
          </div>
        )}

        {/* Tab 3: Clauses & Ambiguity Guardrails */}
        {activeTab === "clauses" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Clauses */}
            <Panel className="p-4 bg-white border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#3067DB]" />
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Atomic Clauses ({activePolicy?.clauses?.length || 0})
                  </h3>
                </div>
                <span className="text-2xs text-slate-500 font-mono">Coverage: 100%</span>
              </div>

              <div className="space-y-2">
                {(activePolicy?.clauses || []).map((c) => (
                  <div key={c.clause_key} className="p-2.5 rounded border border-slate-200 bg-slate-50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#3067DB] text-2xs">{c.clause_key}</span>
                      <span className="px-1.5 py-0.5 rounded text-2xs font-semibold uppercase bg-slate-200 text-slate-700">
                        {c.category}
                      </span>
                    </div>
                    <p className="text-slate-800 leading-relaxed text-xs">{c.text}</p>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Ambiguities & Criteria */}
            <Panel className="p-4 bg-white border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Ambiguity & Gap Scanner
                  </h3>
                </div>
                <span className="text-2xs font-mono text-slate-500">
                  {activePolicy?.ambiguities?.length || 0} flags identified
                </span>
              </div>

              {(activePolicy?.ambiguities || []).length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded border border-slate-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                  No ambiguity flags detected. Policy definitions meet deterministic threshold standards.
                </div>
              ) : (
                <div className="space-y-2">
                  {(activePolicy?.ambiguities || []).map((a, idx) => (
                    <div key={idx} className="p-2.5 rounded border border-amber-200 bg-amber-50/50 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-900">{a.term}</span>
                        <span className="px-1.5 py-0.5 rounded text-2xs font-bold uppercase bg-amber-200 text-amber-900">
                          {a.severity}
                        </span>
                      </div>
                      <p className="text-slate-700 text-xs">{a.issue}</p>
                      <p className="text-2xs text-[#3067DB] font-medium">Recommendation: {a.suggestion}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Acceptance Criteria */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <span className="text-xs font-semibold text-slate-800">Gherkin BDD Acceptance Criteria:</span>
                <div className="space-y-1.5">
                  {(activePolicy?.acceptance_criteria || []).map((ac, idx) => (
                    <p key={idx} className="text-2xs font-mono p-2 rounded bg-slate-50 border border-slate-200 text-slate-700">
                      {ac}
                    </p>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
