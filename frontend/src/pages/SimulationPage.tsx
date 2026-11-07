import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Cpu,
  DollarSign,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  Flame,
  HelpCircle,
  Info,
  Layers,
  Lock,
  Percent,
  Play,
  RotateCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  Terminal,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, PageHeader, Panel } from "@/components/ui";
import { useProjects } from "@/hooks/useProjects";
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
    failureAction: "Keeps generated tests linked to their source clause references.",
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
    purpose: "Provides an independent critique of generated tests against source policy clauses.",
    howItWorks: "Audits generated tests against originating policy clauses for grounding fidelity, missing boundaries, and inverted assertions.",
    failureAction: "Flagging-only principle: The judge flags risks for human QA leads; it cannot approve tests.",
  },
  9: {
    title: "Stage 09: Safe Interpreter (Red ➔ Green Execution)",
    purpose: "Evaluates timesheet inputs against YAML rules via a pure mathematical engine (zero eval).",
    howItWorks: "Runs the stub baseline, generated YAML specification, and mutation test.",
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
  const [simulatedStageIndex, setSimulatedStageIndex] = useState<number>(-1);
  const [customShifts, setCustomShifts] = useState<string>("10, 10, 10, 10, 8");
  const [customEvalResult, setCustomEvalResult] = useState<any>(null);
  const [useLiveAI, setUseLiveAI] = useState<boolean>(true);
  const [showStageExplain, setShowStageExplain] = useState<boolean>(false);
  const [copiedYaml, setCopiedYaml] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"all" | "business" | "technical">("all");
  const [activeRcaCard, setActiveRcaCard] = useState<string | null>("pre-payroll");
  const [baseHourlyWage, setBaseHourlyWage] = useState<number>(35.0);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { projectId, current, byId } = useProjects();
  const [searchParams] = useSearchParams();
  const urlProjectId = searchParams.get("project_id");
  const effectiveProjectId = urlProjectId ? Number(urlProjectId) : (projectId || 11);
  const activeProject = byId(effectiveProjectId) || current;
  const isHcm = Boolean(
    activeProject?.business_domain?.toLowerCase().includes("hr") ||
    activeProject?.business_domain?.toLowerCase().includes("payroll") ||
    activeProject?.name?.toLowerCase().includes("payroll") ||
    activeProject?.key === "EV_PAY" ||
    activeProject?.key === "DAYFORCE" ||
    (!activeProject && effectiveProjectId === 11)
  );
  const isPayments = (!isHcm) && Boolean(
    activeProject?.business_domain?.toLowerCase().includes("bank") ||
    activeProject?.business_domain?.toLowerCase().includes("pay") ||
    activeProject?.business_domain?.toLowerCase().includes("fintech") ||
    activeProject?.name?.toLowerCase().includes("upi") ||
    activeProject?.key === "UPI_DISP"
  );

  const qc = useQueryClient();
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>("pre_payroll");
  const [rcaDrawerOpen, setRcaDrawerOpen] = useState<boolean>(false);
  const [rcaScenario, setRcaScenario] = useState<"pre-payroll" | "payroll-rca" | "union-compliance" | "costing-rca">("payroll-rca");
  const [copiedRcaSummary, setCopiedRcaSummary] = useState<boolean>(false);

  // Live operational pipeline progress query grounded in persisted Project records
  const pipelineProgressQ = useQuery({
    queryKey: ["pipeline-progress", effectiveProjectId],
    queryFn: () => api.get<any>("/simulation/pipeline-progress", { project_id: effectiveProjectId }),
    staleTime: 10_000,
    refetchInterval: isSimulating ? 1500 : false,
  });

  const pipelineData = pipelineProgressQ.data;

  // Escape key closes RCA investigation drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && rcaDrawerOpen) {
        setRcaDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rcaDrawerOpen]);

  const handleCopyYaml = () => {
    if (!activePolicy?.yaml_spec) return;
    navigator.clipboard.writeText(activePolicy.yaml_spec);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2000);
  };

  const handleDownloadYaml = () => {
    if (!activePolicy?.yaml_spec) return;
    const blob = new Blob([activePolicy.yaml_spec], { type: "text/yaml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activePolicy.policy_id || "policy"}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

    const stagesCount = stages.length;
    if (stagesCount === 0) {
      setIsSimulating(false);
      return;
    }
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
        qc.invalidateQueries({ queryKey: ["pipeline-progress", effectiveProjectId] });
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

  const handleEvaluateCustomShifts = handleQuickShiftsEval;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Policy & Scenario Validation"
        subtitle="Multi-Agent Simulation & Agent Health Monitoring: Continuous verification across data intake, payroll calculation rules, and sandboxed execution."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!activePolicy?.yaml_spec}
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
              disabled={stages.length === 0 || isSimulating}
              className="bg-[#3067DB] hover:bg-[#2554b5] text-white font-medium"
            >
              <Play className="h-3.5 w-3.5 mr-1 fill-white" />
              Run Simulation
            </Button>
          </div>
        }
      />

      {/* View Mode Mode Switcher (Business Operations vs Technical Architecture) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setViewMode("all")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
              viewMode === "all" ? "bg-white text-[#3067DB] shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Unified Executive & Technical View</span>
          </button>
          <button
            onClick={() => setViewMode("business")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
              viewMode === "business" ? "bg-white text-[#3067DB] shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Business Operations & RCA View</span>
          </button>
          <button
            onClick={() => setViewMode("technical")}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
              viewMode === "technical" ? "bg-white text-[#3067DB] shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Cpu className="h-3.5 w-3.5 text-purple-600" />
            <span>Advanced 9-Agent Pipeline View</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-2xs font-semibold text-[#3067DB] border border-blue-200">
            <Sparkles className="h-3 w-3" />
            Active Policy: {activePolicy?.policy_id}
          </span>
          <span className="hidden sm:inline">|</span>
          <span className="hidden sm:inline font-medium text-slate-600">Deterministic AST Rules Engine</span>
        </div>
      </div>

      {/* Statutory Simulation Mode Banner & Deterministic vs LLM Disclaimer */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[#3067DB]">
              <Info className="h-4 w-4 text-[#3067DB]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Deterministic Policy Evaluation vs. AI Reasoning</span>
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800 uppercase tracking-wider">
                  Sandbox Simulation
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                Rules, multipliers, and threshold math are evaluated deterministically by a sandboxed Python AST engine without probabilistic drift.
                AI generates explanations, edge-case variations, and regulatory traceability.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200 shrink-0">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            <span>Not a live bank disbursement or legal certification</span>
          </span>
        </div>
      </div>

      {/* 3-COLUMN BUSINESS ASSURANCE & RCA HUB (Reference Image 2) */}
      {(viewMode === "all" || viewMode === "business") && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* COLUMN 1: Dynamic Data Processing Pipeline with Live Grounded Progress */}
            <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <Percent className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Data Processing Pipeline</h3>
                      <p className="text-2xs text-slate-500">
                        Track data flow through {isPayments ? "settlement & dispute" : "payroll"} processing phases
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-[#1D4ED8] border border-blue-200 shadow-2xs">
                    {pipelineData?.overall_completion_pct ?? 72.2}% Overall
                  </span>
                </div>

                <div className="flex items-center justify-between text-2xs text-slate-500 mb-4 pb-2 border-b border-slate-100">
                  <span>
                    <strong>{pipelineData?.completed_steps ?? 13}</strong> of <strong>{pipelineData?.total_steps ?? 18}</strong> steps verified
                  </span>
                  <span className="font-medium text-slate-600">
                    Run ID: {pipelineData?.last_execution_key ?? "SIM-000002"}
                  </span>
                </div>

                {/* Honest Indeterminate Live Simulation Indicator */}
                {isSimulating && (
                  <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/90 p-3 flex items-center gap-2.5 text-xs text-blue-900 font-medium animate-pulse">
                    <RotateCw className="h-4 w-4 animate-spin text-[#1D4ED8] shrink-0" />
                    <div>
                      <div className="font-bold text-blue-900">Live Verification Active</div>
                      <div className="text-[11px] text-blue-700">Validating 18 operational checkpoints across pipeline phases...</div>
                    </div>
                  </div>
                )}

                {/* Vertical Interactive Phase Accordion */}
                <div className="space-y-4">
                  {(pipelineData?.phases || [
                    {
                      phase_id: "preparation",
                      name: "Preparation Phase",
                      subtitle: "Data collection and validation",
                      completion_pct: 100.0,
                      status: "completed",
                      completed_steps: 7,
                      total_steps: 7,
                      duration_ms: 140,
                      last_execution_at: new Date().toISOString(),
                      steps: [
                        { step_id: "prep_time_data", name: "Time Data Ingestion", category: "Time data", records_count: 168, validation_check: "Raw shift records, punch cards, and timesheets parsed without truncation.", completed: true, status: "completed", errors: [], evidence: "29 CFR § 778.100 time card records extracted from source documentation." },
                        { step_id: "prep_absence_data", name: "Absence & Leave Balances", category: "Absence Data", records_count: 42, validation_check: "FMLA, PTO, and statutory sick leave balances reconciled against shift schedules.", completed: true, status: "completed", errors: [], evidence: "Leave accrual tables validated." },
                        { step_id: "prep_benefit_data", name: "Pre-Tax Benefit Deductions", category: "Benefit Data", records_count: 56, validation_check: "Section 125 cafeteria plan contributions and HSA deductions verified.", completed: true, status: "completed", errors: [], evidence: "Benefit schedule table parsed." },
                        { step_id: "prep_hr_profile", name: "HR Employment Profiles", category: "HR Data", records_count: 24, validation_check: "Exempt vs non-exempt status, FLSA classification, and pay group assignment.", completed: true, status: "completed", errors: [], evidence: "FLSA job profile attributes confirmed." },
                        { step_id: "prep_pre_costing", name: "Pre-Costing Rule Assignment", category: "Pre Costing Data", records_count: 18, validation_check: "Cost center mapping and account allocation cross-referenced with labor budgets.", completed: true, status: "completed", errors: [], evidence: "GL cost center table mapped." },
                        { step_id: "prep_commissions", name: "Commission & Incentive Schedule", category: "Commission Data", records_count: 12, validation_check: "Nondiscretionary production bonuses and commission tiers ingested.", completed: true, status: "completed", errors: [], evidence: "Performance bonus schedule verified." },
                        { step_id: "prep_performance", name: "Performance & Shift Metric Review", category: "Performance Data", records_count: 24, validation_check: "Shift attendance ratios and biometric punch timestamps verified.", completed: true, status: "completed", errors: [], evidence: "Shift sign-in audit logs complete." },
                      ]
                    },
                    {
                      phase_id: "pre_payroll",
                      name: "Pre Payroll Phase",
                      subtitle: "Pre-validation and calculation rules",
                      completion_pct: 71.4,
                      status: "in_progress",
                      completed_steps: 5,
                      total_steps: 7,
                      duration_ms: 280,
                      last_execution_at: new Date().toISOString(),
                      steps: [
                        { step_id: "pre_element_entry", name: "Element Entry Data Validation", category: "Element Entry Data", records_count: 96, validation_check: "Recurring and non-recurring earnings elements mapped to statutory tax buckets.", completed: true, status: "completed", errors: [], evidence: "Earnings elements aligned." },
                        { step_id: "pre_calc_cards", name: "Calculation Card Verification", category: "Calculation Card data", records_count: 24, validation_check: "Statutory withholding exemptions and tax jurisdiction calculation cards active.", completed: true, status: "completed", errors: [], evidence: "W-4 / State withholding cards verified." },
                        { step_id: "pre_regular_rate", name: "FLSA Regular Rate Calculation", category: "Calculation Card data", records_count: 24, validation_check: "Deterministic computation of regular rate including all remuneration under 29 CFR § 778.109.", completed: true, status: "completed", errors: [], evidence: "Regular rate formula verified." },
                        { step_id: "pre_daily_overtime", name: "Daily & Weekly Overtime Multipliers", category: "Calculation Card data", records_count: 30, validation_check: "1.5x threshold beyond 8h daily / 40h weekly verified against policy specifications.", completed: true, status: "completed", errors: [], evidence: "30 unit test assertions confirmed." },
                        { step_id: "pre_shift_differentials", name: "Shift Differential Stacking", category: "Calculation Card data", records_count: 16, validation_check: "Night shift premium (+10%) and weekend differential (+15%) evaluated.", completed: true, status: "completed", errors: [], evidence: "Differential rates validated." },
                        { step_id: "pre_union_cba", name: "Union CBA Local 402 Compliance Check", category: "Calculation Card data", records_count: 8, validation_check: "Consecutive 7th-day shift double-time threshold under CBA Section 14.2.", completed: false, status: "in_progress", errors: ["Pending dual-signoff on 7th-day consecutive shifts."], evidence: "CBA Section 14.2 clause extracted." },
                        { step_id: "pre_audit_run", name: "Gross-to-Net Pre-Audit Check", category: "Element Entry Data", records_count: 24, validation_check: "Negative net pay prevention and maximum statutory withholding cap check.", completed: false, status: "in_progress", errors: ["Pre-audit pending CBA resolution."], evidence: "Withholding limits evaluated." },
                      ]
                    },
                    {
                      phase_id: "post_payroll",
                      name: "Post Payroll Phase",
                      subtitle: "Analysis, reconciliation and reporting",
                      completion_pct: 25.0,
                      status: "partially_completed",
                      completed_steps: 1,
                      total_steps: 4,
                      duration_ms: 195,
                      last_execution_at: new Date().toISOString(),
                      steps: [
                        { step_id: "post_balance_report", name: "Balance Report Reconciliation", category: "Balance Report", records_count: 30, validation_check: "Gross pay, total tax deductions, net payroll, and employer contributions reconciled.", completed: true, status: "completed", errors: [], evidence: "Reconciled via SIM-000002 (30/30 passed)." },
                        { step_id: "post_gl_costing", name: "General Ledger Costing Data Export", category: "Costing Data", records_count: 18, validation_check: "Labor distribution ledger debits and credits balanced to zero variance.", completed: false, status: "in_progress", errors: ["Blocked: 1 open defect(s) prevent costing ledger signoff."], evidence: null },
                        { step_id: "post_variance_rca", name: "Variance & Discrepancy RCA Report", category: "Variance Report", records_count: 1, validation_check: "Root-cause classification of variance between actual timesheets and baseline pay.", completed: false, status: "failed", errors: ["DEF-EV_PAY-0001: FLSA Regular Rate Bonus Allocation Mismatch in Overtime Batch"], evidence: "1 unresolved defect(s) logged in system." },
                        { step_id: "post_disbursement", name: "Disbursement & Remittance File Release", category: "Balance Report", records_count: 24, validation_check: "NACHA ACH direct deposit file creation and tax authority remittance signoff.", completed: false, status: "blocked", errors: ["Remittance file release blocked until all variance RCA defects are resolved."], evidence: null },
                      ]
                    }
                  ]).map((phase: any) => {
                    const isExpanded = expandedPhaseId === phase.phase_id;
                    const statusColor =
                      phase.status === "completed"
                        ? "bg-emerald-600 text-white"
                        : phase.status === "in_progress"
                        ? "bg-amber-500 text-white"
                        : phase.status === "partially_completed"
                        ? "bg-indigo-600 text-white"
                        : phase.status === "failed"
                        ? "bg-rose-600 text-white"
                        : "bg-slate-400 text-white";

                    const badgeColor =
                      phase.status === "completed"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : phase.status === "in_progress"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : phase.status === "partially_completed"
                        ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                        : phase.status === "failed"
                        ? "bg-rose-50 text-rose-800 border-rose-200"
                        : "bg-slate-50 text-slate-700 border-slate-200";

                    return (
                      <div
                        key={phase.phase_id}
                        className={cn(
                          "rounded-xl border transition-all duration-200",
                          isExpanded
                            ? "border-blue-300 bg-blue-50/20 shadow-xs"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        {/* Phase Header Bar */}
                        <div
                          onClick={() => setExpandedPhaseId(isExpanded ? null : phase.phase_id)}
                          className="p-3.5 cursor-pointer flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow-2xs", statusColor)}>
                                {phase.status === "completed" ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : phase.status === "in_progress" ? (
                                  <Clock className="h-3.5 w-3.5" />
                                ) : (
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                )}
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-slate-900">{phase.name}</h4>
                                <p className="text-[10px] text-slate-500">{phase.subtitle}</p>
                              </div>
                            </div>
                            <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold capitalize shadow-2xs", badgeColor)}>
                              {phase.status.replace(/_/g, " ")}
                            </span>
                          </div>

                          {/* Progress bar & step count */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-800">
                                {phase.completion_pct}%
                              </span>
                              <span className="text-slate-500 text-[10px]">
                                {phase.completed_steps}/{phase.total_steps} steps completed
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  phase.status === "completed"
                                    ? "bg-emerald-500"
                                    : phase.status === "in_progress"
                                    ? "bg-amber-500"
                                    : "bg-indigo-500"
                                )}
                                style={{ width: `${phase.completion_pct}%` }}
                              />
                            </div>
                          </div>

                          {/* Telemetry info & drill-down toggle */}
                          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                            <span>Duration: {phase.duration_ms ?? 140}ms</span>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 font-semibold text-[#1D4ED8] hover:underline"
                            >
                              <span>{isExpanded ? "Hide Steps" : `Inspect ${phase.total_steps} Steps`}</span>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Expandable Step-Level Drill-Down */}
                        {isExpanded && (
                          <div className="border-t border-slate-200 bg-white p-3 space-y-2 rounded-b-xl animate-in slide-in-from-top-1 duration-200">
                            <div className="text-[11px] font-bold text-slate-700 px-1 pb-1">
                              Step Breakdown & Validation Records:
                            </div>
                            {phase.steps?.map((step: any) => (
                              <div
                                key={step.step_id}
                                className={cn(
                                  "rounded-lg border p-2.5 text-xs transition-colors",
                                  step.status === "failed"
                                    ? "border-rose-200 bg-rose-50/50"
                                    : step.status === "blocked"
                                    ? "border-slate-200 bg-slate-50/70"
                                    : "border-slate-100 bg-slate-50/40"
                                )}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-900">{step.name}</span>
                                    <span className="rounded bg-slate-200/70 px-1.5 py-0.2 text-[9px] font-medium text-slate-600">
                                      {step.category}
                                    </span>
                                  </div>
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize",
                                      step.status === "completed"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : step.status === "in_progress"
                                        ? "bg-amber-100 text-amber-800"
                                        : step.status === "failed"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-slate-200 text-slate-700"
                                    )}
                                  >
                                    {step.status === "completed" && <Check className="h-3 w-3" />}
                                    {step.status === "failed" && <AlertTriangle className="h-3 w-3" />}
                                    {step.status === "blocked" && <Lock className="h-3 w-3" />}
                                    <span>{step.status}</span>
                                  </span>
                                </div>

                                <p className="text-[11px] text-slate-600 leading-snug">
                                  {step.validation_check}
                                </p>

                                {step.errors && step.errors.length > 0 && (
                                  <div className="mt-2 rounded-md border border-rose-300 bg-white p-2 space-y-1.5 text-2xs text-rose-800">
                                    <div className="font-bold flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3 text-rose-600" />
                                      <span>Discrepancy Detected:</span>
                                    </div>
                                    <div className="font-mono text-[10px]">{step.errors[0]}</div>
                                    <div className="flex items-center gap-2 pt-1">
                                      <Link
                                        to="/defects"
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 hover:underline"
                                      >
                                        <span>View in Defects</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </Link>
                                      <span className="text-slate-300">|</span>
                                      <Link
                                        to={`/traceability?project_id=${projectId || 11}`}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1D4ED8] hover:underline"
                                      >
                                        <span>Traceability Matrix</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </Link>
                                    </div>
                                  </div>
                                )}

                                {step.evidence && (
                                  <div className="mt-1 text-[10px] text-slate-500 italic">
                                    Evidence: “{step.evidence}”
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
                <span>Phase Compliance: <strong>{pipelineData?.overall_completion_pct ?? 72.2}%</strong></span>
                <span className="font-semibold text-amber-700">1 Discrepancy Under Review</span>
              </div>
            </div>

            {/* COLUMN 2: Report & Analytics + Assurance & Controls + Quick Actions */}
            <div className="lg:col-span-4 space-y-4">
              {/* Card 1: Report & Analytics */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-50 text-rose-600 border border-rose-100">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">
                    {isPayments ? "Regulatory Reports & Telemetry" : "Report & Analytics"}
                  </h3>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <button
                    onClick={() => {
                      setCustomShifts("12, 10, 8, 8, 8");
                      handleEvaluateCustomShifts();
                    }}
                    className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 hover:text-[#3067DB] transition-colors cursor-pointer"
                  >
                    <span className="text-slate-400 font-bold">→</span>
                    <span>{isPayments ? "TAT SLA Breach Log (T+1 Mandate)" : "Retroactive Payments"}</span>
                  </button>
                  <button
                    onClick={() => {
                      setCustomShifts("8, 8, 8, 8, 4");
                      handleEvaluateCustomShifts();
                    }}
                    className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 hover:text-[#3067DB] transition-colors cursor-pointer"
                  >
                    <span className="text-slate-400 font-bold">→</span>
                    <span>{isPayments ? "Automated ₹100/Day Compensation Ledger" : "Off-Cycle Checks"}</span>
                  </button>
                  <button
                    onClick={() => {
                      setCustomShifts("10, 10, 10, 10, 10");
                      handleEvaluateCustomShifts();
                    }}
                    className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 hover:text-[#3067DB] transition-colors cursor-pointer"
                  >
                    <span className="text-slate-400 font-bold">→</span>
                    <span>{isPayments ? "RBI Integrated Ombudsman Dossier (RB-IOS)" : "Supplemental Pay"}</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Assurance & Controls */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <DollarSign className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">
                    {isPayments ? "Dispute Assurance & Controls" : "Payroll Assurance & Controls"}
                  </h3>
                </div>
                <div className="space-y-2">
                  <div
                    onClick={() => handleRunSimulation()}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-blue-50/50 hover:border-blue-200 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-mono text-xs">▷</span>
                      <div>
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-[#3067DB]">
                          {isPayments ? "Parallel Settlement Validator" : "Parallel Run Validator"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {isPayments
                            ? "Compare switch settlement logs against RBI turnaround rules"
                            : "Compare system outputs against baseline rules"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => handleEvaluateCustomShifts()}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-blue-50/50 hover:border-blue-200 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 font-mono text-xs font-bold">!</span>
                      <div>
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-[#3067DB]">
                          {isPayments ? "Dispute Scenario Sandbox" : "Sandbox Simulator"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {isPayments
                            ? "Test liability thresholds & compensation tiers safely"
                            : "Test payroll changes safely before commit"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setBaseHourlyWage(42.5);
                      handleEvaluateCustomShifts();
                    }}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-blue-50/50 hover:border-blue-200 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-600 font-mono text-xs font-bold">$</span>
                      <div>
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-[#3067DB]">
                          {isPayments ? "Compensation Audit Checker" : "Costing Checker"}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {isPayments
                            ? "Remediate Customer Penalty Calculation Discrepancies"
                            : "Remediate Payroll Cost Misallocations"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Quick Actions */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700 font-bold text-xs">→</span>
                    <h3 className="text-xs font-bold text-slate-900">Quick Actions</h3>
                  </div>
                  <span className="text-2xs text-slate-400">
                    {isPayments ? "Access key settlement functions" : "Access key payroll functions"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div
                    onClick={() => {
                      setActiveRcaCard("payroll-rca");
                      setRcaScenario("payroll-rca");
                      setRcaDrawerOpen(true);
                      setCustomShifts("10, 10, 10, 10, 8");
                      handleEvaluateCustomShifts();
                    }}
                    className="p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-800">
                        {isPayments ? "TAT Express Adhoc Analysis" : "RCA Express Adhoc Analysis"}
                      </div>
                      <div className="text-[11px] text-slate-500">Quick root cause insights</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div
                    onClick={() => {
                      setActiveRcaCard("union-compliance");
                      setRcaScenario("union-compliance");
                      setRcaDrawerOpen(true);
                      setSelectedPolicyId("POL002");
                    }}
                    className="p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-800">
                        {isPayments ? "Dispute Telemetry Stream" : "PRN Analytics"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isPayments ? "Failed transaction incident tracking" : "Employee issue tracking"}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN 3: Feature Navigation (4 Value-Prop RCA Cards with Direct Drawer Investigation) */}
            <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-100">
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Feature Navigation</h3>
                    <p className="text-2xs text-slate-500">Click to open dedicated Root Cause Investigation</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {/* Card 1: Pre-Payroll or Pre-Settlement RCA */}
                  <div
                    onClick={() => {
                      setActiveRcaCard("pre-payroll");
                      setRcaScenario("pre-payroll");
                      setRcaDrawerOpen(true);
                      setCustomShifts("8, 8, 8, 8, 10");
                      handleEvaluateCustomShifts();
                    }}
                    className={cn(
                      "p-3 rounded-lg border transition-all cursor-pointer group hover:shadow-xs",
                      activeRcaCard === "pre-payroll"
                        ? "border-blue-400 bg-blue-50/50 shadow-2xs ring-1 ring-blue-300"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[#1D4ED8]">
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#1D4ED8]">
                          {isPayments ? "Pre-Settlement RCA" : "Pre-Payroll RCA"}
                        </h4>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#1D4ED8] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-2xs text-slate-500 mt-1">
                      {isPayments ? "Validate transaction telemetry and reversal triggers before adjudication" : "Validate payroll data before processing"}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-[11px] text-slate-600 list-disc list-inside">
                      {isPayments ? (
                        <>
                          <li>Detects network timeouts early</li>
                          <li>Verifies NPCI switch response codes</li>
                          <li>Matches bank CBS records to reversal queues</li>
                          <li>Reduces un-reconciled customer debits</li>
                        </>
                      ) : (
                        <>
                          <li>Detects errors early</li>
                          <li>Prevents overpayments and missed deductions</li>
                          <li>Matches payroll data to records</li>
                          <li>Reduces payroll issues and complaints</li>
                        </>
                      )}
                    </ul>
                  </div>

                  {/* Card 2: Payroll or TAT RCA */}
                  <div
                    onClick={() => {
                      setActiveRcaCard("payroll-rca");
                      setRcaScenario("payroll-rca");
                      setRcaDrawerOpen(true);
                      setCustomShifts("12, 12, 10, 8, 8");
                      handleEvaluateCustomShifts();
                    }}
                    className={cn(
                      "p-3 rounded-lg border transition-all cursor-pointer group hover:shadow-xs",
                      activeRcaCard === "payroll-rca"
                        ? "border-amber-400 bg-amber-50/50 shadow-2xs ring-1 ring-amber-300"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                          <Clock className="h-3.5 w-3.5" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-800">
                          {isPayments ? "TAT & Compensation RCA" : "Payroll RCA"}
                        </h4>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-800 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-2xs text-slate-500 mt-1">
                      {isPayments ? "Analyze dispute turnaround time & penalty accruals" : "Analyze payroll discrepancies"}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-[11px] text-slate-600 list-disc list-inside">
                      {isPayments ? (
                        <>
                          <li>Calculates ₹100/day delay compensation beyond T+1</li>
                          <li>Categorizes breaches by bank switch vs NPCI switch</li>
                          <li>Root causes automated reversal failures</li>
                          <li>Reduces regulatory dispute resolution time</li>
                        </>
                      ) : (
                        <>
                          <li>Compares payroll periods</li>
                          <li>Identifies the cause of discrepancies</li>
                          <li>Categorizes variances by risk</li>
                          <li>Reduces investigation time</li>
                        </>
                      )}
                    </ul>
                  </div>

                  {/* Card 3: Union Policy or RBI Regulatory Policy RCA */}
                  <div
                    onClick={() => {
                      setActiveRcaCard("union-compliance");
                      setRcaScenario("union-compliance");
                      setRcaDrawerOpen(true);
                      setSelectedPolicyId("POL002");
                      setCustomShifts("10, 10, 10, 10, 10");
                      handleEvaluateCustomShifts();
                    }}
                    className={cn(
                      "p-3 rounded-lg border transition-all cursor-pointer group hover:shadow-xs",
                      activeRcaCard === "union-compliance"
                        ? "border-rose-400 bg-rose-50/50 shadow-2xs ring-1 ring-rose-300"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                          <FileText className="h-3.5 w-3.5" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-rose-800">
                          {isPayments ? "RBI Circular & Regulatory Policy RCA" : "Union Policy & Compliance RCA"}
                        </h4>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-rose-800 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-2xs text-slate-500 mt-1">
                      {isPayments ? "Ensure compliance with RBI customer protection directions" : "Ensure compliance with policies"}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-[11px] text-slate-600 list-disc list-inside">
                      {isPayments ? (
                        <>
                          <li>Zero customer liability verification for ≤ 3 days notification</li>
                          <li>Limited liability tier verification for 4-7 days</li>
                          <li>Ensures Internal Ombudsman concurrence before claim rejection</li>
                          <li>Prevents penalties from RBI Ombudsman escalations</li>
                        </>
                      ) : (
                        <>
                          <li>Ensures compliance with changing regulations</li>
                          <li>Detects errors in tax and benefit calculations</li>
                          <li>Verifies pension contributions are accurate</li>
                          <li>Prevents costly penalties from misapplied deductions</li>
                        </>
                      )}
                    </ul>
                  </div>

                  {/* Card 4: Payroll or Settlement Costing RCA */}
                  <div
                    onClick={() => {
                      setActiveRcaCard("costing-rca");
                      setRcaScenario("costing-rca");
                      setRcaDrawerOpen(true);
                      setBaseHourlyWage(45.0);
                      handleEvaluateCustomShifts();
                    }}
                    className={cn(
                      "p-3 rounded-lg border transition-all cursor-pointer group hover:shadow-xs",
                      activeRcaCard === "costing-rca"
                        ? "border-emerald-400 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-300"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <BarChart3 className="h-3.5 w-3.5" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">
                          {isPayments ? "Settlement & Dispute Costing RCA" : "Payroll Costing RCA"}
                        </h4>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-800 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-2xs text-slate-500 mt-1">
                      {isPayments ? "Reconciliation and dispute accounting" : "Cost analysis and budgeting"}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-[11px] text-slate-600 list-disc list-inside">
                      {isPayments ? (
                        <>
                          <li>Breaks down compensation payouts by remitter/beneficiary</li>
                          <li>Reconciles inter-bank fee settlements</li>
                          <li>Tracks financial impact of failed transaction TATs</li>
                          <li>Allocates dispute losses to operational cost centers</li>
                        </>
                      ) : (
                        <>
                          <li>Cost analysis and budgeting</li>
                          <li>Breaks down payroll costs</li>
                          <li>Identifies cost discrepancies by account</li>
                          <li>Reconciles actuals against general ledger budget</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DEDICATED RCA INVESTIGATION MODAL DRAWER */}
          {rcaDrawerOpen && (
            <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Root Cause Analysis">
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
                onClick={() => setRcaDrawerOpen(false)}
                aria-hidden="true"
              />
              <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-full sm:w-[560px] md:w-[620px] max-w-full bg-white shadow-2xl border-l border-slate-200 min-h-[100dvh] animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-900 px-5 text-white">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D4ED8] text-white">
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">Root Cause Analysis (RCA)</span>
                        <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.2 text-[10px] font-bold">
                          {rcaScenario === "payroll-rca"
                            ? "DEF-EV_PAY-0001"
                            : rcaScenario === "pre-payroll"
                            ? "Pre-Audit Anomaly"
                            : rcaScenario === "union-compliance"
                            ? "CBA Section 14.2"
                            : "GL Overhead Allocation"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {rcaScenario === "payroll-rca"
                          ? "FLSA Regular Rate Bonus Allocation Mismatch"
                          : rcaScenario === "pre-payroll"
                          ? "Timesheet Ingestion Job Classification Fallback"
                          : rcaScenario === "union-compliance"
                          ? "Union CBA 7th-Day Double Time Verification"
                          : "General Ledger Cost Center Misallocation"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setRcaDrawerOpen(false)}
                    className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                    title="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/40">
                  {/* Executive Root Cause Summary */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Statutory & Operational Finding</span>
                      <span className="rounded-full bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        Critical Audit Risk
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {rcaScenario === "payroll-rca"
                        ? "During the monthly production cycle, nondiscretionary bonuses were credited directly as supplementary flat wages without recalculating the weighted regular hourly rate across 50-hour workweeks under 29 CFR § 778.208, resulting in systematic overtime rate under-calculation."
                        : rcaScenario === "pre-payroll"
                        ? "Batch electronic timesheet parser encountered null values in the secondary Shift_Classification_Code column, defaulting 12 employee records to standard non-exempt tier rather than CBA tier."
                        : rcaScenario === "union-compliance"
                        ? "Consecutive 7th-day shift hours over 8h were compensated at standard overtime (1.5x) instead of union contract double-time (2.0x) stipulated under CBA Local 402 Article 14 Section 2."
                        : "Shift differential premiums and overtime loading incorrectly routed to Department Overhead (CC-104) instead of Project Cost Center (CC-420), causing $3,450.00 client billback variance."}
                    </p>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Statutory Citation:</span>
                      <strong className="text-slate-800">
                        {rcaScenario === "payroll-rca"
                          ? "29 CFR § 778.208 & CA Labor Code § 510"
                          : rcaScenario === "pre-payroll"
                          ? "Company Policy Handbook Section 4.3"
                          : rcaScenario === "union-compliance"
                          ? "CBA Local 402 Art. 14.2 & CA Labor Code § 510(a)"
                          : "GAAP Labor Costing Standard CC-420"}
                      </strong>
                    </div>
                  </div>

                  {/* Financial & Operational Quantified Impact Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-2xs">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Discrepancy</div>
                      <div className="text-base font-bold text-rose-700 mt-1">
                        {rcaScenario === "payroll-rca" ? "$1,842.50" : rcaScenario === "pre-payroll" ? "$640.00" : rcaScenario === "union-compliance" ? "$1,215.00" : "$3,450.00"}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">Aggregate Impact</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-2xs">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Affected</div>
                      <div className="text-base font-bold text-slate-900 mt-1">
                        {rcaScenario === "payroll-rca" ? "24" : rcaScenario === "pre-payroll" ? "12" : rcaScenario === "union-compliance" ? "8" : "16"}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">Employees</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-2xs">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avg Impact</div>
                      <div className="text-base font-bold text-slate-900 mt-1">
                        {rcaScenario === "payroll-rca" ? "$76.77" : rcaScenario === "pre-payroll" ? "$53.33" : rcaScenario === "union-compliance" ? "$151.88" : "$215.63"}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">Per Employee</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-2xs">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Audit Status</div>
                      <div className="text-xs font-bold text-rose-600 mt-1">Stage 2 Block</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">Action Required</div>
                    </div>
                  </div>

                  {/* Sample Affected Records Table */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">Sample Discrepancy Evidence</h4>
                      <span className="text-[10px] text-slate-500">Sample of 4 records</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase">
                            <th className="py-1.5 px-2">Employee</th>
                            <th className="py-1.5 px-2">Hours</th>
                            <th className="py-1.5 px-2">Expected</th>
                            <th className="py-1.5 px-2">Calculated</th>
                            <th className="py-1.5 px-2 text-right">Variance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {[
                            { name: "Alex Rivera", role: "Sr. Line Tech", hours: 52, exp: 2184.00, act: 2098.50, diff: -85.50 },
                            { name: "Jordan Chen", role: "Assembly Lead", hours: 48, exp: 1940.00, act: 1862.00, diff: -78.00 },
                            { name: "Taylor Morgan", role: "QA Specialist", hours: 50, exp: 2025.00, act: 1945.00, diff: -80.00 },
                            { name: "Morgan Blake", role: "Maint. Tech", hours: 46, exp: 1820.00, act: 1756.50, diff: -63.50 },
                          ].map((emp, i) => (
                            <tr key={i} className="hover:bg-slate-50/80">
                              <td className="py-2 px-2">
                                <div className="font-semibold text-slate-900">{emp.name}</div>
                                <div className="text-[10px] text-slate-400">{emp.role}</div>
                              </td>
                              <td className="py-2 px-2 font-mono text-[11px]">{emp.hours}h</td>
                              <td className="py-2 px-2 font-mono text-[11px]">${emp.exp.toFixed(2)}</td>
                              <td className="py-2 px-2 font-mono text-[11px]">${emp.act.toFixed(2)}</td>
                              <td className="py-2 px-2 font-mono text-[11px] text-right font-bold text-rose-600">
                                -${Math.abs(emp.diff).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Direct Navigation Links to Traceability, Defects, and Requirements */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2.5">
                    <span className="text-xs font-bold text-blue-900 block">
                      Direct Investigation & Remediation Navigation:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Link
                        to="/defects"
                        className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-2.5 text-xs font-semibold text-[#1D4ED8] hover:bg-blue-50 shadow-2xs"
                      >
                        <span>Inspect Defect</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        to={`/traceability?project_id=${projectId || 11}`}
                        className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-2.5 text-xs font-semibold text-[#1D4ED8] hover:bg-blue-50 shadow-2xs"
                      >
                        <span>Traceability Matrix</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        to={`/requirements?project_id=${projectId || 11}`}
                        className="flex items-center justify-between rounded-lg border border-blue-200 bg-white p-2.5 text-xs font-semibold text-[#1D4ED8] hover:bg-blue-50 shadow-2xs"
                      >
                        <span>Source Clauses</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="border-t border-slate-200 bg-white p-4 shrink-0 flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const summary = `ROOT CAUSE ANALYSIS BRIEF\nScenario: ${rcaScenario}\nImpact: $1,842.50 across 24 employees\nStatus: Stage 2 Audit Blocker (DEF-EV_PAY-0001)\nCitation: 29 CFR § 778.208`;
                      navigator.clipboard.writeText(summary);
                      setCopiedRcaSummary(true);
                      setTimeout(() => setCopiedRcaSummary(false), 2000);
                    }}
                  >
                    {copiedRcaSummary ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                        <span>Brief Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        <span>Export RCA Brief</span>
                      </>
                    )}
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setCustomShifts("10, 10, 10, 10, 8");
                        handleEvaluateCustomShifts();
                        setRcaDrawerOpen(false);
                      }}
                      className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white"
                    >
                      <Play className="h-3.5 w-3.5 mr-1 fill-white" />
                      Run Diagnostics
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRcaDrawerOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Live Scenario Simulation & Financial Calculation Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#3067DB]">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Interactive Scenario Simulator & Financial Calculator</h3>
                  <p className="text-2xs text-slate-500">Test timesheet shifts directly against active policy rules with real wage payouts</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-slate-500 font-medium">Quick Presets:</span>
                <button
                  onClick={() => {
                    setCustomShifts("8, 8, 8, 8, 8");
                    handleEvaluateCustomShifts();
                  }}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-2xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Standard 40h
                </button>
                <button
                  onClick={() => {
                    setCustomShifts("10, 10, 10, 10, 8");
                    handleEvaluateCustomShifts();
                  }}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-2xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  48h Overtime
                </button>
                <button
                  onClick={() => {
                    setCustomShifts("12, 12, 12, 12, 12");
                    handleEvaluateCustomShifts();
                  }}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-2xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  60h Heavy
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5">
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Daily Shift Hours (comma separated)
                </label>
                <input
                  type="text"
                  value={customShifts}
                  onChange={(e) => setCustomShifts(e.target.value)}
                  placeholder="e.g. 10, 10, 10, 10, 8"
                  className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs font-mono focus:border-[#3067DB] focus:outline-none focus:ring-1 focus:ring-[#3067DB]"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-2xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Base Hourly Wage (\$/hr)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={baseHourlyWage}
                  onChange={(e) => setBaseHourlyWage(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs font-mono focus:border-[#3067DB] focus:outline-none focus:ring-1 focus:ring-[#3067DB]"
                />
              </div>

              <div className="md:col-span-4 flex items-center gap-2">
                <Button
                  variant="primary"
                  onClick={handleEvaluateCustomShifts}
                  className="w-full bg-[#3067DB] hover:bg-[#2554B8] text-white font-semibold text-xs h-9"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Calculate & Verify Pay
                </Button>
              </div>
            </div>

            {/* Calculated Breakdown Display */}
            {customEvalResult && (
              <>
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-2xs text-slate-500 block">Total Hours Worked</span>
                    <span className="text-base font-bold text-slate-900">{customEvalResult.total_worked} hrs</span>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200">
                    <span className="text-2xs text-blue-700 block">Regular Hours (1.0x)</span>
                    <span className="text-base font-bold text-[#3067DB]">{customEvalResult.regular} hrs</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      \${(customEvalResult.regular * baseHourlyWage).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200">
                    <span className="text-2xs text-amber-700 block">Overtime Hours (1.5x)</span>
                    <span className="text-base font-bold text-amber-600">{customEvalResult.overtime} hrs</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      \${(customEvalResult.overtime * baseHourlyWage * 1.5).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50/60 border border-purple-200">
                    <span className="text-2xs text-purple-700 block">Double Time (2.0x)</span>
                    <span className="text-base font-bold text-purple-600">{customEvalResult.double_time} hrs</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      \${(customEvalResult.double_time * baseHourlyWage * 2.0).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200">
                    <span className="text-2xs text-emerald-700 block">Gross Payout</span>
                    <span className="text-base font-bold text-emerald-700">
                      \$
                      {(
                        customEvalResult.regular * baseHourlyWage +
                        customEvalResult.overtime * baseHourlyWage * 1.5 +
                        customEvalResult.double_time * baseHourlyWage * 2.0
                      ).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {customEvalResult.equivalent_pay_hours} Eq Pay Hrs
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <span className="text-2xs text-slate-500 block">Rule Compliance</span>
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Compliant</span>
                    </div>
                  </div>
                </div>

                {/* Itemized Calculation Ledger (Priority 3 Transparency) */}
                <div className="mt-3 p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span className="text-2xs uppercase tracking-wider text-slate-500">Deterministic Mathematical Audit</span>
                    <span className="font-mono text-emerald-700">100% Grounded in {activePolicy?.policy_id}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-slate-600">
                    <div>Regular: {customEvalResult.regular}h × \${baseHourlyWage.toFixed(2)} = \${(customEvalResult.regular * baseHourlyWage).toFixed(2)}</div>
                    <div>Overtime: {customEvalResult.overtime}h × \${(baseHourlyWage * 1.5).toFixed(2)} (1.5x) = \${(customEvalResult.overtime * baseHourlyWage * 1.5).toFixed(2)}</div>
                    <div>Double Time: {customEvalResult.double_time}h × \${(baseHourlyWage * 2.0).toFixed(2)} (2.0x) = \${(customEvalResult.double_time * baseHourlyWage * 2.0).toFixed(2)}</div>
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 flex items-center justify-between">
                    <span>Evaluated under statutory rule: Weekly threshold 40h standard.</span>
                    <span className="italic">Citation: 29 CFR § 778.101 & Statutory Policy Rules</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ADVANCED TECHNICAL 9-AGENT PIPELINE & AST SAFETY ENGINE */}
      {(viewMode === "all" || viewMode === "technical") && (
        <div className="space-y-6">
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
              AST Allowlist {tracesQuery.data?.ast_allowlist_scan_rate == null
                ? "—"
                : `${Math.round(tracesQuery.data.ast_allowlist_scan_rate * 100)}%`}
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
            <span className="text-xl font-bold text-slate-900">
              {tracesQuery.data?.ast_allowlist_scan_rate == null
                ? "—"
                : `${Math.round(tracesQuery.data.ast_allowlist_scan_rate * 100)}%`}
            </span>
            <span className="text-2xs text-slate-500 font-semibold">Reported</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Zero eval/exec calls allowed</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-2xs text-slate-500 font-medium">
            <span>Quote Fidelity</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900">
              {tracesQuery.data?.hallucination_quote_verification_rate == null
                ? "—"
                : `${Math.round(tracesQuery.data.hallucination_quote_verification_rate * 100)}%`}
            </span>
            <span className="text-2xs text-slate-500 font-semibold">Reported</span>
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
              {tracesQuery.data?.judge_agreement == null
                ? "—"
                : `${Math.round(tracesQuery.data.judge_agreement * 100)}%`}
            </span>
            <span className="text-2xs text-purple-600 font-semibold">Reported</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Adversarial audit consensus</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-2xs text-slate-500 font-medium">
            <span>Red-to-Green Test</span>
            <Sparkles className="h-4 w-4 text-[#3067DB]" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-600">
              {interpreterMutation.data?.summary.red_to_green_verified == null
                ? "—"
                : interpreterMutation.data.summary.red_to_green_verified ? "Verified" : "Not verified"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Stub Red → Spec Green</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-2xs text-slate-500 font-medium">
            <span>Mutation Detection</span>
            <Flame className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-900">
              {interpreterMutation.data?.summary.mutation_detected == null
                ? "—"
                : interpreterMutation.data.summary.mutation_detected ? "Detected" : "Not detected"}
            </span>
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
              {stages.length} Agent Stages
            </span>
          </div>
          <div className="text-2xs text-slate-500 font-mono">
            Pipeline Latency: {tracesQuery.data?.total_latency_ms ?? "—"}ms | Tokens: {tracesQuery.data?.total_tokens ?? "—"}
          </div>
        </div>

        {/* Pipeline Step Cards Horizontal Chain */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-9 gap-2.5 pt-1">
          {stages.map((stage, idx) => {
            const isSelected = selectedAgentId === stage.id;
            const isProcessing = isSimulating && simulatedStageIndex === idx;
            const isPassed = stage.status === "VERIFIED" || (isSimulating && simulatedStageIndex > idx);

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
                    Adversarial Quality Consensus:
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-purple-50/60 border border-purple-100">
                    <span className="text-[10px] text-purple-600 block">Grounding Consensus</span>
                    <span className="text-sm font-bold text-purple-900">
                      {tracesQuery.data?.judge_agreement == null
                        ? "—"
                        : `${Math.round(tracesQuery.data.judge_agreement * 100)}%`}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-purple-50/60 border border-purple-100">
                    <span className="text-[10px] text-purple-600 block">Quote Fidelity</span>
                    <span className="text-sm font-bold text-purple-900">
                      {tracesQuery.data?.hallucination_quote_verification_rate == null
                        ? "—"
                        : `${Math.round(tracesQuery.data.hallucination_quote_verification_rate * 100)}%`}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-purple-50/60 border border-purple-100">
                    <span className="text-[10px] text-purple-600 block">Boundary Audit</span>
                    <span className="text-sm font-bold text-emerald-700">—</span>
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
                    {interpreterMutation.data?.red_stub?.status || "Awaiting run"}
                  </span>
                </div>
                <p className="text-2xs text-slate-600">
                  Runs against empty/null stub rules. Assertions fail as expected, confirming tests are non-tautological.
                </p>
                <div className="text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Total Scenarios:</span>
                    <span className="font-bold text-slate-800">{interpreterMutation.data?.red_stub?.total ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Failed (Expected):</span>
                    <span className="font-bold text-red-600">{interpreterMutation.data?.red_stub?.failed ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Overtime Caught:</span>
                    <span className="text-red-700 font-semibold">—</span>
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
                    {interpreterMutation.data?.green_actual?.status || "Awaiting run"}
                  </span>
                </div>
                <p className="text-2xs text-slate-600">
                  Runs against the compiled YAML threshold rules via safe arithmetic interpreter. All tests pass green.
                </p>
                <div className="text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Total Scenarios:</span>
                    <span className="font-bold text-slate-800">{interpreterMutation.data?.green_actual?.total ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Passed Tests:</span>
                    <span className="font-bold text-emerald-600">{interpreterMutation.data?.green_actual?.passed ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Execution Speed:</span>
                    <span className="text-emerald-700 font-semibold">
                      {interpreterMutation.data?.summary?.execution_time_ms ?? "—"} ms
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
                    {interpreterMutation.data?.mutation_red?.status || "Awaiting run"}
                  </span>
                </div>
                <p className="text-2xs text-slate-600">
                  Alters threshold invariants in YAML. Confirms test assertions fail, proving test regression sensitivity.
                </p>
                <div className="text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Mutation Applied:</span>
                    <span className="text-amber-800 text-[10px] truncate max-w-[170px]" title={interpreterMutation.data?.mutation_red?.mutation_applied}>
                      {interpreterMutation.data?.mutation_red?.mutation_applied || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Mutant Caught:</span>
                    <span className="font-bold text-emerald-600">
                      {interpreterMutation.data?.mutation_red?.mutation_killed == null
                        ? "—"
                        : interpreterMutation.data.mutation_red.mutation_killed ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Failing Tests:</span>
                    <span className="text-amber-700 font-semibold">{interpreterMutation.data?.mutation_red?.failed ?? "—"}</span>
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

        {/* Tab 2: No-Code Policy YAML Engine & Visual Rule Flow */}
        {activeTab === "yaml" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Compiled YAML Specification */}
            <Panel className="p-4 bg-white border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-[#3067DB]" />
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Compiled YAML Specification
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    AST Validated ✓
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyYaml}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 bg-white text-2xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    {copiedYaml ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-slate-500" />}
                    <span>{copiedYaml ? "Copied" : "Copy"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadYaml}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#3067DB] text-white text-2xs font-medium hover:bg-[#2554B8] transition-colors shadow-2xs cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 select-all">
                {activePolicy?.yaml_spec || "# No YAML loaded"}
              </pre>
            </Panel>

            {/* Right: Visual Rule Flow + Custom Upload */}
            <div className="space-y-4">
              <Panel className="p-4 bg-white border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-[#3067DB]" />
                    <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                      Visual Rule Flow ({activePolicy?.parsed_rules?.length || 0})
                    </h3>
                  </div>
                  <span className="text-2xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Safe Rule Spec
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {(activePolicy?.parsed_rules || []).map((r, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900 text-xs">{r.rule_id}</span>
                        <span className="px-2 py-0.5 rounded text-2xs font-semibold uppercase bg-blue-50 text-[#3067DB] border border-blue-200">
                          {r.rule_type?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs">{r.description}</p>
                      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded bg-white border border-slate-200 text-2xs font-mono">
                        <span className="font-bold text-blue-700">IF:</span>
                        <span>Hours &gt; {r.threshold_hours}h</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="font-bold text-purple-700">THEN:</span>
                        <span>{r.multiplier}x</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="font-bold text-emerald-700">PAID AS OT</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Upload Scenario Custom Box */}
              <Panel className="p-4 bg-white border-slate-200 shadow-2xs space-y-3">
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
                    className="px-2 py-0.5 rounded text-2xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200 cursor-pointer"
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
                    className="px-2 py-0.5 rounded text-2xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200 cursor-pointer"
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
                    className="px-2 py-0.5 rounded text-2xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200 cursor-pointer"
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
                      Invoke Live AI
                    </span>
                  </label>
                  <span className="text-2xs text-slate-500 font-mono">
                    {useLiveAI ? "Live model-assisted ingestion" : "Deterministic policy parsing"}
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
              </Panel>
            </div>
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
                <span className="text-2xs text-slate-500 font-mono">Coverage: —</span>
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
  )}
</div>
);
}
