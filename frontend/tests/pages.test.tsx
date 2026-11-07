import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import DashboardPage from "@/pages/DashboardPage";
import { TraceabilityPage } from "@/pages/InsightPages";
import { TestDetailPage } from "@/pages/TestPages";
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

const PROJECTS = page([{ id: 1, key: "PAY", name: "Payroll Management", description: "", status: "active",
  stats: { requirements: 1, tests: 1, suites: 1, open_defects: 0, members: 1, coverage_pct: 50 } }]);

test("application boots directly into workspace without requiring login", async () => {
  mockFetch([[/auth\/me/, ME], [/projects/, PROJECTS], [/analytics\/dashboard/, { kpis: { total_projects: 1, active_projects: 1, total_requirements: 0, analysed_requirements: 0, total_test_cases: 0, approved_test_cases: 0, pending_reviews: 0, total_executions: 0, pass_rate: 0, failed_executions: 0, open_defects: 0, critical_defects: 0, requirement_coverage: 0 }, charts: { execution_trend: [], result_distribution: [], coverage_by_project: [], defect_severity: [], defect_resolution: [], test_status: [] }, recent_changes: [], recent_executions: [], projects: [] }]]);
  renderApp(<Routes><Route element={<AppShell />}><Route index element={<DashboardPage />} /></Route></Routes>);
  expect(await screen.findByText(/Quality Engineering Workspace/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Work email")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
});

test("navigation shell renders TT wordmark and dynamic active project", async () => {
  const echoProjects = page([{ id: 1, key: "ECHO", name: "EchoBox Platform", description: "", status: "active",
    stats: { requirements: 1, tests: 1, suites: 1, open_defects: 0, members: 1, coverage_pct: 50 } }]);
  mockFetch([[/auth\/me/, ME], [/projects/, echoProjects], [/config/, { environment: "test", llm: { any_configured: false, providers: [] } }], [/notifications/, []]]);
  renderApp(<Routes><Route element={<AppShell />}><Route index element={<p>home</p>} /></Route></Routes>);
  expect(await screen.findByText("TT")).toBeInTheDocument();
  expect(screen.getByText("Enterprise Quality Verification")).toBeInTheDocument();
  expect(await screen.findByTitle("EchoBox Platform")).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "ECHO — EchoBox Platform" })).toBeInTheDocument();
});

test("command palette opens via Cmd+K keyboard shortcut and queries search API", async () => {
  const searchResults = { results: [{ type: "test", id: 42, key: "TC-0042", title: "Verify JWT Signature" }] };
  const calls = mockFetch([
    [/auth\/me/, ME],
    [/projects/, PROJECTS],
    [/config/, { environment: "test", llm: { any_configured: false, providers: [] } }],
    [/notifications/, []],
    [/search/, searchResults],
  ]);
  renderApp(<Routes><Route element={<AppShell />}><Route index element={<p>home</p>} /></Route></Routes>);
  const searchInput = await screen.findByLabelText("Global search");
  expect(searchInput).toHaveAttribute("placeholder", "Search tests, requirements, defects... (⌘K)");

  // Trigger Cmd+K
  await userEvent.keyboard("{Meta>}k{/Meta}");
  expect(searchInput).toHaveFocus();

  // Type query
  await userEvent.type(searchInput, "JWT");
  expect(await screen.findByText("TC-0042")).toBeInTheDocument();
  expect(screen.getByText("Verify JWT Signature")).toBeInTheDocument();
  expect(calls.some((c) => c.url.includes("/search"))).toBe(true);
});

test("dashboard renders KPIs from the analytics API, not constants", async () => {
  const dash = { kpis: { total_projects: 5, active_projects: 5, total_requirements: 68, analysed_requirements: 63, total_test_cases: 266,
    approved_test_cases: 233, pending_reviews: 11, total_executions: 105, pass_rate: 71.7, failed_executions: 99, open_defects: 23,
    critical_defects: 19, requirement_coverage: 87.2 }, charts: { execution_trend: [], result_distribution: [], coverage_by_project: [],
    defect_severity: [], defect_resolution: [], test_status: [] }, recent_changes: [], recent_executions: [], projects: [] };
  const calls = mockFetch([[/auth\/me/, ME], [/projects/, PROJECTS], [/analytics\/dashboard/, dash]]);
  renderApp(<DashboardPage />);
  expect(await screen.findByText("71.7%")).toBeInTheDocument();
  expect(screen.getByText("87.2%")).toBeInTheDocument();
  expect(screen.getByText("19")).toBeInTheDocument();
  expect(calls.some((c) => c.url.includes("/analytics/dashboard"))).toBe(true);
});

test("traceability matrix renders clauses, coverage gaps and links cells to tests", async () => {
  const matrix = { project_ids: [1], clauses: [
    { index: 0, requirement_id: 7, requirement_key: "PAY-REQ-001", clause_key: "PAY-REQ-001.C1", text: "Overtime above 40 hours.", covered: true, ambiguous: false },
    { index: 1, requirement_id: 7, requirement_key: "PAY-REQ-001", clause_key: "PAY-REQ-001.C2", text: "Rounding half up.", covered: false, ambiguous: false }],
    tests: [{ id: 11, key: "TC-PAY-0001", title: "Boundary", status: "approved", state: "failed_execution", test_type: "boundary", last_result: "failed", last_execution_id: 3 }],
    cells: [[0, 0, "failed_execution"]],
    summary: { total_clauses: 2, covered_clauses: 1, untested_clauses: 1, coverage_pct: 50, orphan_tests: [], duplicate_tests: [], impacted_tests: [] } };
  mockFetch([[/auth\/me/, ME], [/traceability/, matrix], [/requirements/, page([])], [/projects/, PROJECTS]]);
  renderApp(<TraceabilityPage />, { route: "/traceability?project_id=1" });
  const table = await screen.findByRole("table", { name: "Traceability matrix" });
  expect(within(table).getByText("Overtime above 40 hours.")).toBeInTheDocument();
  expect(within(table).getByText("untested")).toBeInTheDocument();
  expect(within(table).getByRole("button", { name: /TC-PAY-0001 covers PAY-REQ-001.C1, Approved, last run failed/ })).toBeInTheDocument();
  expect(screen.getByText("50.0%")).toBeInTheDocument();
});

const TEST = { id: 5, key: "TC-PAY-0099", project_id: 1, requirement_id: 7, requirement_key: "PAY-REQ-001", requirement_version: 1,
  clause_keys: ["PAY-REQ-001.C1"], ac_keys: [], title: "Generated boundary test", priority: "high", test_type: "boundary", confidence: 0.9,
  automation: "pytest", status: "pending_review", validation_status: "invalid", version: 1, provider: "groq", model: "openai/gpt-oss-120b",
  duplicate_of: null, quote_verified: true, needs_reapproval_reason: null, updated_at: "2026-11-01T00:00:00Z", steps: [], reviews: [], versions: [],
  recent_results: [], validation_errors: ["Import of 'os' is not allowed (line 1)"], script: "import os", script_hash: "abc", source_quote: "x" };

test("review workspace blocks approval of tests that failed validation", async () => {
  mockFetch([[/auth\/me/, ME], [/tests\/5$/, TEST], [/projects/, PROJECTS]]);
  renderApp(<Routes><Route path="/tests/:id" element={<TestDetailPage />} /></Routes>, { route: "/tests/5" });
  expect(await screen.findByText(/Import of 'os' is not allowed/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Request changes" })).toBeDisabled();
});

test("review decisions post to the API with the reviewer comment", async () => {
  const calls = mockFetch([[/auth\/me/, ME], [/tests\/5\/review/, { ...TEST, status: "approved" }], [/tests\/5$/, { ...TEST, validation_status: "valid", validation_errors: [] }], [/projects/, PROJECTS]]);
  renderApp(<Routes><Route path="/tests/:id" element={<TestDetailPage />} /></Routes>, { route: "/tests/5" });
  await userEvent.type(await screen.findByLabelText("Comment"), "Boundary confirmed");
  await userEvent.click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => expect(calls.some((c) => c.url.endsWith("/tests/5/review") && c.init?.method === "POST")).toBe(true));
  const post = calls.find((c) => c.url.endsWith("/tests/5/review"))!;
  expect(JSON.parse(String(post.init!.body))).toEqual({ decision: "approve", comment: "Boundary confirmed" });
  expect((post.init!.headers as Record<string, string>)["X-CSRF-Token"]).toBeDefined();
});

test("navigation shell exposes every product area", async () => {
  mockFetch([[/auth\/me/, ME], [/projects/, PROJECTS], [/config/, { environment: "test", llm: { any_configured: false, providers: [] } }], [/notifications/, []]]);
  renderApp(<Routes><Route element={<AppShell />}><Route index element={<p>home</p>} /></Route></Routes>);
  const nav = await screen.findByRole("complementary", { name: "Primary" });
  for (const l of ["Dashboard", "Projects", "Requirements", "Test Cases", "Test Runs", "Defects", "Settings"]) {
    expect(within(nav).getByRole("link", { name: l })).toBeInTheDocument();
  }
  expect(await screen.findByText(/AI not configured/)).toBeInTheDocument();
});

test("non-Dayforce generic projects contain zero Dayforce residue in UI", async () => {
  localStorage.setItem("tracetest.project", "2");
  const genericProjects = page([{ id: 2, key: "SMPL", name: "Sample Python Library", description: "Generic library", status: "active",
    stats: { requirements: 0, tests: 0, suites: 0, open_defects: 0, members: 1, coverage_pct: 0 } }]);
  const dash = { kpis: { total_projects: 1, active_projects: 1, total_requirements: 0, analysed_requirements: 0, total_test_cases: 0,
    approved_test_cases: 0, pending_reviews: 0, total_executions: 0, pass_rate: 0, failed_executions: 0, open_defects: 0,
    critical_defects: 0, requirement_coverage: 0 }, charts: { execution_trend: [], result_distribution: [], coverage_by_project: [],
    defect_severity: [], defect_resolution: [], test_status: [] }, recent_changes: [], recent_executions: [], projects: [] };

  mockFetch([
    [/auth\/me/, ME],
    [/projects/, genericProjects],
    [/analytics\/dashboard/, dash],
    [/config/, { environment: "test", llm: { any_configured: false, providers: [] } }],
    [/notifications/, []],
  ]);

  renderApp(
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
      </Route>
    </Routes>
  );

  // AppShell renders Local beta, not Production QE Platform
  expect(await screen.findByText("Local beta")).toBeInTheDocument();
  expect(screen.queryByText(/Production QE Platform/i)).not.toBeInTheDocument();

  // Dashboard with generic project has NO Dayforce text
  expect(await screen.findByText(/Sample Python Library Verification Modules/i)).toBeInTheDocument();
  const dayforceOccurrences = screen.queryAllByText(/Dayforce/i);
  expect(dayforceOccurrences).toHaveLength(0);
});
