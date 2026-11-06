import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import SimulationPage from "@/pages/SimulationPage";
import { ME, mockFetch, page, renderApp } from "./helpers";

const store = new Map<string, string>();
beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any;
  (globalThis as any).EventSource = undefined;
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
});

const MOCK_GOLDEN_POLICIES = {
  total: 5,
  policies: [
    {
      policy_id: "POL001",
      policy_name: "Standard Weekly Overtime (FLSA Standard)",
      jurisdiction: "US-Federal",
      version: "1.0.0",
      description: "Non-exempt employees working in excess of 40 hours shall receive 1.5x.",
      clauses: [{ clause_key: "POL001.C1", text: "Hours exceeding 40 get 1.5x overtime.", category: "compliance" }],
      ambiguities: [{ clause_key: "POL001.C1", term: "promptly", severity: "medium", issue: "Vague time limit", suggestion: "Set exact hours" }],
      acceptance_criteria: ["Given 40 hours worked, When week closes, Then overtime is 0."],
      yaml_spec: "policy_id: POL001\nrules:\n  - rule_id: RULE-W40\n    threshold_hours: 40.0\n    multiplier: 1.5\n",
      parsed_rules: [{ rule_id: "RULE-W40", rule_type: "weekly_threshold", threshold_hours: 40.0, multiplier: 1.5, description: "Weekly OT" }],
      test_matrix: [{ name: "Standard 40h", shifts: [8, 8, 8, 8, 8], expected: { regular: 40.0, ot: 0.0, pay_hours: 40.0 } }],
      edge_cases: [{ name: "Zero hours", shifts: [0], expected: { regular: 0.0, ot: 0.0, pay_hours: 0.0 } }],
    },
    {
      policy_id: "POL002",
      policy_name: "California Daily Overtime",
      jurisdiction: "US-CA",
      version: "1.0.0",
      description: "Daily 8 hours overtime at 1.5x.",
      clauses: [{ clause_key: "POL002.C1", text: "Daily hours over 8 get 1.5x.", category: "compliance" }],
      ambiguities: [],
      acceptance_criteria: ["Given shift > 8h, Then remainder is OT."],
      yaml_spec: "policy_id: POL002\nrules:\n  - rule_id: RULE-D8\n    threshold_hours: 8.0\n    multiplier: 1.5\n",
      parsed_rules: [{ rule_id: "RULE-D8", rule_type: "daily_threshold", threshold_hours: 8.0, multiplier: 1.5, description: "Daily OT" }],
      test_matrix: [{ name: "10h shift", shifts: [10], expected: { regular: 8.0, ot: 2.0, pay_hours: 11.0 } }],
      edge_cases: [],
    },
  ],
};

const MOCK_TRACES = {
  policy_id: "POL001",
  stages: [
    { id: 1, agent: "Ingestion & Document Parser", role: "Document Parser", status: "VERIFIED", latency_ms: 24, tokens: 142, thought: "Document parsed", metrics: { clean_input: true, ast_allowed: true } },
    { id: 2, agent: "Clause Parser Agent", role: "Clause Parser", status: "VERIFIED", latency_ms: 38, tokens: 310, thought: "Clauses decomposed", metrics: {} },
    { id: 3, agent: "Ambiguity Detector Agent", role: "Ambiguity Scanner", status: "FLAGGED", latency_ms: 18, tokens: 195, thought: "1 ambiguity flagged", metrics: {} },
    { id: 4, agent: "Acceptance Criteria Agent", role: "BDD Synthesizer", status: "VERIFIED", latency_ms: 45, tokens: 420, thought: "BDD generated", metrics: {} },
    { id: 5, agent: "Scenario & Edge-Case Agent", role: "Matrix Builder", status: "VERIFIED", latency_ms: 52, tokens: 512, thought: "Edge cases generated", metrics: {} },
    { id: 6, agent: "YAML Rule Spec Agent", role: "No-Code Engine", status: "VERIFIED", latency_ms: 31, tokens: 280, thought: "YAML compiled", metrics: {} },
    { id: 7, agent: "Validator & Gap Checker", role: "AST Allowlist", status: "VERIFIED", latency_ms: 12, tokens: 85, thought: "AST safe", metrics: {} },
    { id: 8, agent: "LLM-as-a-Judge Auditor", role: "Quality Evaluator", status: "VERIFIED", latency_ms: 64, tokens: 490, thought: "Grounding verified", metrics: {} },
    { id: 9, agent: "Safe Interpreter Test Runner", role: "Red-to-Green", status: "VERIFIED", latency_ms: 15, tokens: 0, thought: "Red to green verified", metrics: {} },
  ],
  ast_allowlist_scan_rate: 1.0,
  hallucination_quote_verification_rate: 1.0,
  judge_agreement: 0.98,
  total_latency_ms: 299,
  total_tokens: 1947,
};

const MOCK_INTERPRETER_RESULT = {
  red_stub: { status: "FAILED", total: 1, passed: 0, failed: 1, results: [] },
  green_actual: { status: "PASSED", total: 1, passed: 1, failed: 0, results: [] },
  mutation_red: { status: "FAILED", total: 1, passed: 0, failed: 1, mutation_applied: "threshold +10h", mutation_killed: true, results: [] },
  summary: { total_tests: 1, passed: 1, failed: 0, red_to_green_verified: true, mutation_detected: true, execution_time_ms: 1.2 },
};

const PROJECTS = page([{
  id: 1, key: "PAY", name: "Payroll Management", description: "", status: "active",
  stats: { requirements: 1, tests: 1, suites: 1, open_defects: 0, members: 1, coverage_pct: 50 },
}]);

test("simulation page renders golden policy presets, pipeline graph, and KPI governance metrics", async () => {
  mockFetch([
    [/simulation\/golden-policies/, MOCK_GOLDEN_POLICIES],
    [/simulation\/agent-traces/, MOCK_TRACES],
    [/simulation\/run-interpreter/, MOCK_INTERPRETER_RESULT],
    [/auth\/me/, ME],
    [/projects/, PROJECTS],
    [/config/, { environment: "test", llm: { any_configured: false, providers: [] } }],
    [/notifications/, []],
  ]);

  renderApp(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="simulation" element={<SimulationPage />} />
      </Route>
    </Routes>,
    { route: "/simulation" }
  );

  // Verify page title and header
  expect(await screen.findByText(/Multi-Agent Simulation & Agent Health Monitoring/)).toBeInTheDocument();

  // Verify KPI cards
  expect(screen.getByText("AST Allowlist Rate")).toBeInTheDocument();
  expect(screen.getByText("Quote Fidelity")).toBeInTheDocument();
  expect(screen.getByText("Judge Agreement")).toBeInTheDocument();
  expect(screen.getByText("Red-to-Green Test")).toBeInTheDocument();

  // Verify golden policy buttons
  expect(await screen.findByText("POL001")).toBeInTheDocument();
  expect(await screen.findByText("POL002")).toBeInTheDocument();

  // Verify agent pipeline stages are present
  expect((await screen.findAllByText("Ingestion & Document Parser")).length).toBeGreaterThan(0);
  expect((await screen.findAllByText("Clause Parser Agent")).length).toBeGreaterThan(0);
  expect((await screen.findAllByText("Safe Interpreter Test Runner")).length).toBeGreaterThan(0);

  // Verify Stage 1 Health Metrics are rendered
  expect(await screen.findByText("Health Metrics:")).toBeInTheDocument();
  expect(await screen.findByText("clean_input:")).toBeInTheDocument();
  expect(await screen.findByText("ast_allowed:")).toBeInTheDocument();

  // Verify Boundary Condition & Edge-Case Matrix is rendered
  expect(await screen.findByText(/Boundary Condition & Edge-Case Matrix/)).toBeInTheDocument();
  expect(await screen.findByText("Zero hours")).toBeInTheDocument();
});

test("simulation page switches tabs and displays YAML rule specification", async () => {
  mockFetch([
    [/simulation\/golden-policies/, MOCK_GOLDEN_POLICIES],
    [/simulation\/agent-traces/, MOCK_TRACES],
    [/simulation\/run-interpreter/, MOCK_INTERPRETER_RESULT],
    [/auth\/me/, ME],
    [/projects/, PROJECTS],
    [/config/, { environment: "test", llm: { any_configured: false, providers: [] } }],
    [/notifications/, []],
  ]);

  renderApp(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="simulation" element={<SimulationPage />} />
      </Route>
    </Routes>,
    { route: "/simulation" }
  );

  // Click on the YAML tab
  const yamlTab = await screen.findByText("No-Code Policy YAML Engine");
  await userEvent.click(yamlTab);

  // Expect YAML specification details
  expect(await screen.findByText("Compiled YAML Specification")).toBeInTheDocument();
  expect(await screen.findByText("RULE-W40")).toBeInTheDocument();
});

test("header includes 1-click simulation navigation button", async () => {
  mockFetch([
    [/auth\/me/, ME],
    [/projects/, PROJECTS],
    [/config/, { environment: "test", llm: { any_configured: false, providers: [] } }],
    [/notifications/, []],
  ]);

  renderApp(
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<p>Dashboard</p>} />
      </Route>
    </Routes>
  );

  // Header 1-click button
  const simLink = await screen.findByTitle("Interactive Multi-Agent Simulation & Agent Health Monitoring");
  expect(simLink).toBeInTheDocument();
  expect(simLink).toHaveAttribute("href", "/simulation");
});

test("simulation page supports custom scenario compilation and updates active policy", async () => {
  const customIngestResult = {
    policy_id: "POL-CUSTOM",
    policy_name: "Custom CBA 35h Ingested Policy",
    jurisdiction: "US-Federal",
    description: "Custom CBA agreement",
    clauses: [{ clause_key: "POL-CUSTOM.C1", text: "Overtime after 35h", category: "compliance" }],
    ambiguities: [],
    acceptance_criteria: ["Given 35h worked, excess is OT"],
    yaml_spec: "policy_id: POL-CUSTOM\nrules:\n  - rule_id: RULE-W35\n    threshold_hours: 35.0\n",
    parsed_spec: { rules: [{ rule_id: "RULE-W35", rule_type: "weekly_threshold", threshold_hours: 35.0, multiplier: 1.5, description: "CBA 35h" }] },
    test_scenarios: [{ name: "Standard 35h", shifts: [7, 7, 7, 7, 7], expected: { regular: 35.0, ot: 0.0, pay_hours: 35.0 } }],
    edge_cases: [{ name: "Zero hours", shifts: [0], expected: { regular: 0.0, ot: 0.0, pay_hours: 0.0 } }],
    agent_traces: MOCK_TRACES.stages,
  };

  mockFetch([
    [/simulation\/golden-policies/, MOCK_GOLDEN_POLICIES],
    [/simulation\/agent-traces/, MOCK_TRACES],
    [/simulation\/ingest-policy/, customIngestResult],
    [/simulation\/run-interpreter/, MOCK_INTERPRETER_RESULT],
    [/auth\/me/, ME],
    [/projects/, PROJECTS],
    [/config/, { environment: "test", llm: { any_configured: false, providers: [] } }],
    [/notifications/, []],
  ]);

  renderApp(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="simulation" element={<SimulationPage />} />
      </Route>
    </Routes>,
    { route: "/simulation" }
  );

  // Switch to YAML tab
  const yamlTab = await screen.findByText("No-Code Policy YAML Engine");
  await userEvent.click(yamlTab);

  // Click a preset button to prefill custom text
  const cbaPresetBtn = await screen.findByText("Preset: CBA 35h Workweek");
  await userEvent.click(cbaPresetBtn);

  // Click Compile Custom Policy to YAML & Run
  const compileBtn = await screen.findByText("Compile Custom Policy to YAML & Run");
  await userEvent.click(compileBtn);

  // Expect custom policy active badge
  expect(await screen.findByText("Custom Ingested Policy Active")).toBeInTheDocument();
  expect(await screen.findByText("RULE-W35")).toBeInTheDocument();
});

test("interactive timesheet calculator computes regular, overtime, and pay hours accurately", async () => {
  mockFetch([
    [/simulation\/golden-policies/, MOCK_GOLDEN_POLICIES],
    [/simulation\/agent-traces/, MOCK_TRACES],
    [/simulation\/run-interpreter/, MOCK_INTERPRETER_RESULT],
    [/auth\/me/, ME],
    [/projects/, PROJECTS],
    [/config/, { environment: "test", llm: { any_configured: false, providers: [] } }],
    [/notifications/, []],
  ]);

  renderApp(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="simulation" element={<SimulationPage />} />
      </Route>
    </Routes>,
    { route: "/simulation" }
  );

  // Default shifts "10, 10, 10, 10, 8" (48h total under POL001: 40h reg, 8h OT, 52h pay)
  const calcBtn = await screen.findByRole("button", { name: "Calculate Pay Hours" });
  await userEvent.click(calcBtn);

  // Expect calculated breakdown
  expect(await screen.findByText("48h")).toBeInTheDocument();
  expect(await screen.findByText("40h")).toBeInTheDocument();
  expect(await screen.findByText("8h")).toBeInTheDocument();
  expect(await screen.findByText("52h")).toBeInTheDocument();
});

