import { screen } from "@testing-library/react";
import { ProductionProjectDashboard } from "@/components/dashboard/ProductionProjectDashboard";
import { ME, mockFetch, renderApp } from "./helpers";

const ECHO_DASHBOARD_DATA = {
  project: {
    id: 5,
    key: "ECHO",
    name: "EchoBox",
    description: "Anonymous conversation platform (AWS Lambda + API Gateway + DynamoDB)",
    health_status: "healthy",
    health_label: "Healthy",
    repository: {
      url: "https://github.com/sohan10012/EchoBox",
      repo_name: "sohan10012/EchoBox",
      branch: "main",
      latest_commit_sha: "b3740a62ad414a141e82146adafb47c4850fd782",
      latest_commit_short: "b3740a62ad",
      last_tested_at: "2026-11-02T22:24:00Z",
    },
    current_environment: {
      id: 16,
      name: "Simulation (Moto)",
      kind: "simulation",
    },
  },
  summary: {
    total_requirements: 21,
    total_clauses: 62,
    total_test_cases: 21,
    tests_per_requirement: 1.0,
    passed_tests: 21,
    passed_pct: 100.0,
    failed_tests: 0,
    failed_pct: 0.0,
    open_defects: 6,
    critical_defects: 1,
    high_defects: 5,
    medium_defects: 0,
    low_defects: 0,
    latest_duration_seconds: 1.92,
    latest_run_id: 217,
    latest_run_key: "EX-000217",
  },
  quality_coverage: {
    requirement_coverage_pct: 100.0,
    requirement_covered_count: 21,
    requirement_total_count: 21,
    clause_coverage_pct: 100.0,
    clause_covered_count: 62,
    clause_total_count: 62,
    test_pass_rate_pct: 100.0,
    pass_rate_passed: 21,
    pass_rate_total: 21,
  },
  latest_execution: {
    id: 217,
    key: "EX-000217",
    status: "passed",
    environment_name: "Simulation (Moto)",
    environment_kind: "simulation",
    started_at: "2026-11-02T22:24:00Z",
    completed_at: "2026-11-02T22:24:00Z",
    duration_seconds: 1.92,
    total_tests: 21,
    passed: 21,
    failed: 0,
    skipped: 0,
    errored: 0,
    runner: "pytest",
    isolation_level: "bwrap",
    junit_url: "/api/v1/executions/217/report.junit",
    html_url: "/api/v1/executions/217/report.html",
  },
  recent_runs: [
    {
      id: 217,
      run_id: "EX-000217",
      commit_short: "b3740a6",
      environment_name: "Simulation (Moto)",
      environment_kind: "simulation",
      result: "passed",
      tests_passed: 21,
      tests_total: 21,
      duration_seconds: 1.92,
      triggered_at: "2026-11-02T22:24:00Z",
    },
    {
      id: 216,
      run_id: "EX-000216",
      commit_short: "a9d2e71",
      environment_name: "Simulation (Moto)",
      environment_kind: "simulation",
      result: "passed",
      tests_passed: 21,
      tests_total: 21,
      duration_seconds: 2.05,
      triggered_at: "2026-11-02T21:56:00Z",
    },
    {
      id: 215,
      run_id: "EX-000215",
      commit_short: "f82c90e",
      environment_name: "Real Code",
      environment_kind: "real",
      result: "failed",
      tests_passed: 17,
      tests_total: 21,
      duration_seconds: 4.61,
      triggered_at: "2026-11-02T20:17:00Z",
    },
  ],
  requirements_tab: {
    total: 21,
    documented: 15,
    inferred: 6,
    awaiting_confirmation: 0,
    unmapped: 0,
    items: [],
  },
  defects_tab: {
    total_open: 6,
    items: [
      {
        id: 3,
        key: "DEF-ECHO-003",
        title: "JWT verification bypass on invalid token",
        severity: "critical",
        status: "open",
        linked_requirement_key: "ECHO-REQ-011",
        detection_run_key: "EX-000215",
      },
      {
        id: 4,
        key: "DEF-ECHO-004",
        title: "Room description length not validated (allows > 500)",
        severity: "high",
        status: "open",
        linked_requirement_key: "ECHO-REQ-003",
        detection_run_key: "EX-000216",
      },
    ],
  },
  configuration: {
    repository_url: "https://github.com/sohan10012/EchoBox",
    branch: "main",
    commit_sha: "b3740a62ad414a141e82146adafb47c4850fd782",
    environments: [
      { id: 16, name: "Simulation (Moto)", kind: "simulation", is_default: true, base_url: null },
    ],
  },
  requirements_status: [
    { status: "Verified", count: 21, coverage_pct: 100.0 },
    { status: "In Review", count: 0, coverage_pct: 0.0 },
    { status: "Not Mapped", count: 0, coverage_pct: 0.0 },
  ],
  recent_activity: [
    {
      id: 1,
      action: "execution.completed",
      title: "New commit tested: b3740a6",
      subtitle: "Run EX-000217 • 21/21 passed",
      relative_time: "2 min ago",
      icon: "commit",
    },
    {
      id: 2,
      action: "execution.completed",
      title: "Test run completed: EX-000217",
      subtitle: "Execution time: 1.92 s • Environment: Simulation (Moto)",
      relative_time: "2 min ago",
      icon: "play",
    },
    {
      id: 3,
      action: "defect.created",
      title: "Defect created: DEF-ECHO-003",
      subtitle: "JWT verification bypass on invalid token",
      relative_time: "47 min ago",
      icon: "defect",
    },
  ],
};

const CUREONIX_EMPTY_DASHBOARD = {
  project: {
    id: 8,
    key: "CUREON",
    name: "Cureonix Service",
    description: "Cureonix healthcare clinical integration service",
    health_status: "not_tested",
    health_label: "Not Tested",
    repository: {
      url: "https://github.com/cureonix/service",
      repo_name: "cureonix/service",
      branch: "main",
      latest_commit_sha: "c1a2b3d4e5",
      latest_commit_short: "c1a2b3d4e5",
      last_tested_at: null,
    },
    current_environment: {
      id: 18,
      name: "Local Container Sandbox",
      kind: "bwrap",
    },
  },
  summary: {
    total_requirements: 23,
    total_clauses: 32,
    total_test_cases: 0,
    tests_per_requirement: 0.0,
    passed_tests: 0,
    passed_pct: 0.0,
    failed_tests: 0,
    failed_pct: 0.0,
    open_defects: 0,
    critical_defects: 0,
    high_defects: 0,
    medium_defects: 0,
    low_defects: 0,
    latest_duration_seconds: null,
    latest_run_id: null,
    latest_run_key: null,
  },
  quality_coverage: {
    requirement_coverage_pct: 0.0,
    requirement_covered_count: 0,
    requirement_total_count: 23,
    clause_coverage_pct: 0.0,
    clause_covered_count: 0,
    clause_total_count: 32,
    test_pass_rate_pct: null,
    pass_rate_passed: 0,
    pass_rate_total: 0,
  },
  latest_execution: null,
  recent_runs: [],
  requirements_tab: {
    total: 23,
    documented: 18,
    inferred: 5,
    awaiting_confirmation: 0,
    unmapped: 23,
    items: [],
  },
  defects_tab: {
    total_open: 0,
    items: [],
  },
  configuration: {
    repository_url: "https://github.com/cureonix/service",
    branch: "main",
    commit_sha: "c1a2b3d4e5",
    environments: [
      { id: 18, name: "Local Container Sandbox", kind: "bwrap", is_default: true, base_url: null },
    ],
  },
  requirements_status: [
    { status: "Verified", count: 0, coverage_pct: 0.0 },
    { status: "In Review", count: 0, coverage_pct: 0.0 },
    { status: "Not Mapped", count: 23, coverage_pct: 100.0 },
  ],
  recent_activity: [],
};

test("ProductionProjectDashboard renders EchoBox telemetry matching Screenshots 1 & 2", async () => {
  mockFetch([
    [/auth\/me/, ME],
    [/projects\/5\/dashboard/, ECHO_DASHBOARD_DATA],
  ]);

  renderApp(<ProductionProjectDashboard projectId={5} isDetailView={true} />);

  // 1. Header elements
  expect(await screen.findByText("EchoBox")).toBeInTheDocument();
  expect(screen.getByText("Healthy")).toBeInTheDocument();
  expect(screen.getAllByText("Repository").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("Run Tests")).toBeInTheDocument();

  // 2. 5-column metadata
  expect(screen.getByText("sohan10012/EchoBox")).toBeInTheDocument();
  expect(screen.getByText("main")).toBeInTheDocument();
  expect(screen.getByText("b3740a62ad")).toBeInTheDocument();
  expect(screen.getAllByText("Simulation (Moto)").length).toBeGreaterThanOrEqual(1);

  // 3. Test Summary (6 metric cards)
  expect(screen.getByText("62")).toBeInTheDocument(); // atomic clauses
  expect(screen.getByText(/1.0 per requirement/)).toBeInTheDocument();
  expect(screen.getByText("1 Critical")).toBeInTheDocument();
  expect(screen.getAllByText("1.92 s").length).toBeGreaterThanOrEqual(1);

  // 4. Tabs
  expect(screen.getByRole("button", { name: /Recent Runs/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Requirements/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Defects/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Configuration/ })).toBeInTheDocument();

  // 5. Recent runs table row
  expect(screen.getByText("EX-000217")).toBeInTheDocument();

  // 6. Lower section
  expect(screen.getByText(/Execution Details \(EX-000217\)/)).toBeInTheDocument();
  expect(screen.getByText("JUnit (XML)")).toBeInTheDocument();
  expect(screen.getByText("HTML Report")).toBeInTheDocument();
  expect(screen.getByText("Quality & Coverage")).toBeInTheDocument();
  expect(screen.getByText("DEF-ECHO-003")).toBeInTheDocument();
  expect(screen.getAllByText("JWT verification bypass on invalid token").length).toBeGreaterThanOrEqual(1);
});

test("ProductionProjectDashboard displays clean zero-state for freshly imported Cureonix", async () => {
  mockFetch([
    [/auth\/me/, ME],
    [/projects\/8\/dashboard/, CUREONIX_EMPTY_DASHBOARD],
  ]);

  renderApp(<ProductionProjectDashboard projectId={8} isDetailView={true} />);

  // Ingested requirements are real
  expect(await screen.findByText("Cureonix Service")).toBeInTheDocument();
  expect(screen.getByText("Not Tested")).toBeInTheDocument();
  expect(screen.getAllByText("23").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("32")).toBeInTheDocument(); // clauses

  // Strictly 0 tests, 0 defects, and — duration
  expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("No test runs executed yet")).toBeInTheDocument();
  expect(screen.getByText("Zero active defects reported")).toBeInTheDocument();
});
