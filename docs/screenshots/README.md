# TraceTest Product Screenshots & Screen Index

This directory contains pristine desktop, laptop, and responsive screenshots captured directly from the live, running TraceTest AI platform (`http://127.0.0.1:8000`) with authentic enterprise data (EV_PAY: Enterprise Payroll & Overtime Compliance Evaluation, Dayforce Enterprise HCM, and EchoBox).

All primary desktop captures use standard enterprise viewports:
- **Primary Desktop Resolution:** `1920 × 1080` (Full HD Desktop)
- **Secondary Laptop Resolution:** `1440 × 900` (Modern Enterprise Laptop)
- **Responsive Captures:** `1024 × 768` (Tablet) and `390 × 844` (Mobile)

---

## Enterprise Desktop Screen Index (1920×1080 & 1440×900)

| # | Screen Name | Route / View | Primary Filename (1920×1080) | Secondary Filename (1440×900) | Description & Status |
|:---|:---|:---|:---|:---|:---|
| 01 | **Login / Authentication** | `/login` → `/` | [`01-login-auth-1920x1080.png`](./01-login-auth-1920x1080.png) | [`01-login-auth-1440x900.png`](./01-login-auth-1440x900.png) | Single-operator mode (`TRACETEST_SINGLE_OPERATOR=true`) automatically authorizes Lead QA Operator; `/login` cleanly redirects to the workspace overview. |
| 02 | **Main Dashboard (Code-Based)** | `/` (EchoBox) | [`02-main-dashboard-codebased-1920x1080.png`](./02-main-dashboard-codebased-1920x1080.png) | [`02-main-dashboard-codebased-1440x900.png`](./02-main-dashboard-codebased-1440x900.png) | Code-based project overview displaying Git commit status (`b3740a6`), DynamoDB/Cognito infrastructure metrics, pass rate, defect counts, and traceability. |
| 03 | **Project Selection** | `/projects` | [`03-project-selection-1920x1080.png`](./03-project-selection-1920x1080.png) | [`03-project-selection-1440x900.png`](./03-project-selection-1440x900.png) | Multi-workspace catalog displaying Dayforce (Requirements-based), EV_PAY Payroll Compliance, WFMQ, EchoBox, and Cureonix projects. |
| 04 | **Requirements Project Dashboard** | `/` (Dayforce) | [`04-requirements-project-dashboard-1920x1080.png`](./04-requirements-project-dashboard-1920x1080.png) | [`04-requirements-project-dashboard-1440x900.png`](./04-requirements-project-dashboard-1440x900.png) | Requirements-based workspace dashboard aggregating document processing stages, clause coverage, test cases, and recent execution passes. |
| 05 | **Document Upload / Intake** | `/requirements` (Intake) | [`05-document-intake-1920x1080.png`](./05-document-intake-1920x1080.png) | [`05-document-intake-1440x900.png`](./05-document-intake-1440x900.png) | Document ingestion workspace showing uploaded multi-format files (PDF, DOCX, XLSX, Markdown), document purposes (PRD, SRS, Business Rules), parsing status, and extraction actions. |
| 06 | **Extracted Requirements** | `/requirements` (Extracted) | [`06-extracted-requirements-1920x1080.png`](./06-extracted-requirements-1920x1080.png) | [`06-extracted-requirements-1440x900.png`](./06-extracted-requirements-1440x900.png) | Normalized atomic requirements list filtered by category (Functional, Compliance, Security, Data), priority, and source document attribution. |
| 07 | **Requirement Details** | `/requirements/91` | [`07-requirement-details-1920x1080.png`](./07-requirement-details-1920x1080.png) | [`07-requirement-details-1440x900.png`](./07-requirement-details-1440x900.png) | In-depth requirement inspection (`DAY-REQ-001`) showing version history, atomic clauses (C1, C2), source quotes, business objectives, and linked test coverage. |
| 08 | **Analysis Insights** | `/requirements` (Insights) | [`08-analysis-insights-1920x1080.png`](./08-analysis-insights-1920x1080.png) | [`08-analysis-insights-1440x900.png`](./08-analysis-insights-1440x900.png) | Automated requirement intelligence view detailing business rule classifications, non-functional constraints, and module associations. |
| 09 | **Ambiguity & Clarifications** | `/requirements` (Clarifications) | [`09-ambiguity-clarifications-1920x1080.png`](./09-ambiguity-clarifications-1920x1080.png) | [`09-ambiguity-clarifications-1440x900.png`](./09-ambiguity-clarifications-1440x900.png) | Cross-document contradiction detection workspace flagging conflicting overtime rates (1.5x vs 2.0x), probation periods (90d vs 30d), and timeout boundaries with suggested resolutions. |
| 10 | **Acceptance Criteria** | `/requirements/91` (AC Tab) | [`10-acceptance-criteria-1920x1080.png`](./10-acceptance-criteria-1920x1080.png) | [`10-acceptance-criteria-1440x900.png`](./10-acceptance-criteria-1440x900.png) | Formal Gherkin Given-When-Then behavioral specifications derived from clauses with verbatim quote validation and confidence scoring. |
| 11 | **Traceability Matrix** | `/traceability` | [`11-traceability-matrix-1920x1080.png`](./11-traceability-matrix-1920x1080.png) | [`11-traceability-matrix-1440x900.png`](./11-traceability-matrix-1440x900.png) | Bidirectional audit grid mapping Document → Requirement → Atomic Clause → Acceptance Criterion → Test Case → Execution Run → Defect. |
| 12 | **Test Cases** | `/tests` | [`12-test-cases-1920x1080.png`](./12-test-cases-1920x1080.png) | [`12-test-cases-1440x900.png`](./12-test-cases-1440x900.png) | Comprehensive test repository filtered by category (positive, negative, boundary, edge-case), automation engine, and approval status. |
| 13 | **Test Case Details** | `/tests/413` | [`13-test-case-details-1920x1080.png`](./13-test-case-details-1920x1080.png) | [`13-test-case-details-1440x900.png`](./13-test-case-details-1440x900.png) | Full test specification (`TC-001`) with preconditions, concrete test data, execution steps, expected outcomes, and AST security validation status. |
| 14 | **Test Validation (Review Workspace)** | `/tests/review` | [`14-test-validation-review-1920x1080.png`](./14-test-validation-review-1920x1080.png) | [`14-test-validation-review-1440x900.png`](./14-test-validation-review-1440x900.png) | Quality gate and human-in-the-loop review workspace enforcing author/reviewer separation, bulk approvals, change requests, and rejection tracking. |
| 15 | **Agent Simulation** | `/simulation` | [`15-agent-simulation-1920x1080.png`](./15-agent-simulation-1920x1080.png) | [`15-agent-simulation-1440x900.png`](./15-agent-simulation-1440x900.png) | 7-stage multi-agent pipeline monitoring latency, token consumption, agent thoughts, judge agreement metrics, and quote grounding fidelity. |
| 16 | **Policy YAML Engine** | `/simulation` (YAML Editor) | [`16-policy-yaml-engine-1920x1080.png`](./16-policy-yaml-engine-1920x1080.png) | [`16-policy-yaml-engine-1440x900.png`](./16-policy-yaml-engine-1440x900.png) | Interactive No-Code declarative policy editor synthesizing natural language into structured YAML rules (`daily_threshold`, `weekly_threshold`, `multiplier`). |
| 17 | **Behaviour Simulation** | `/simulation` (Test Runner) | [`17-behaviour-simulation-1920x1080.png`](./17-behaviour-simulation-1920x1080.png) | [`17-behaviour-simulation-1440x900.png`](./17-behaviour-simulation-1440x900.png) | Deterministic arithmetic simulation engine executing shifts against Stub (Red), Actual Policy (Green), and Injected Mutant (Killed Red). |
| 18 | **Test Runs** | `/executions` | [`18-test-runs-1920x1080.png`](./18-test-runs-1920x1080.png) | [`18-test-runs-1440x900.png`](./18-test-runs-1440x900.png) | Historical execution ledger displaying test runs, pass/fail counts, execution duration, and environment configuration. |
| 19 | **Execution Details** | `/executions/12` | [`19-execution-details-1920x1080.png`](./19-execution-details-1920x1080.png) | [`19-execution-details-1440x900.png`](./19-execution-details-1440x900.png) | Granular test run inspection (`RUN-024`) with individual test case outcomes, stack traces, console stdout/stderr, and artifact downloads. |
| 20 | **Defect Management** | `/defects` | [`20-defect-management-1920x1080.png`](./20-defect-management-1920x1080.png) | [`20-defect-management-1440x900.png`](./20-defect-management-1440x900.png) | Bug tracking interface with severity levels (Critical, High, Medium), reproduction steps, linked test cases, and status transitions. |
| 21 | **Quality Analytics** | `/analytics` | [`21-quality-analytics-1920x1080.png`](./21-quality-analytics-1920x1080.png) | [`21-quality-analytics-1440x900.png`](./21-quality-analytics-1440x900.png) | Enterprise analytics dashboard tracking weekly pass-rate trends, defect resolution velocity, clause coverage by project, and release readiness. |
| 22 | **Project Settings** | `/settings` | [`22-project-settings-1920x1080.png`](./22-project-settings-1920x1080.png) | [`22-project-settings-1440x900.png`](./22-project-settings-1440x900.png) | Platform configuration interface for LLM providers (Groq, Gemini, Ollama, Mock), multi-slot concurrency, security sandboxes, and audit log policies. |
| 23 | **Project Intelligence Report** | `/intelligence-report` | [`23-project-intelligence-report-1920x1080.png`](./23-project-intelligence-report-1920x1080.png) | [`23-project-intelligence-report-1440x900.png`](./23-project-intelligence-report-1440x900.png) | Executive-grade Project Intelligence Report featuring high-level compliance KPI (95% implementation), Stage 1/Stage 2 readiness bars, clause maturity, PDCA skill tracker, and prioritized Critical Gaps table with severity and effort estimates. |
| 24 | **ReasonX Assistant Open Drawer** | Global FAB Drawer | [`24-reasonx-drawer-open-1920x1080.png`](./24-reasonx-drawer-open-1920x1080.png) | [`24-reasonx-drawer-open-1440x900.png`](./24-reasonx-drawer-open-1440x900.png) | Full-height (`100dvh`) ReasonX enterprise AI assistant drawer, triggered via the circular 56px FAB launcher with brand avatar, featuring one-click quick prompt chips, multiline expanding prompt input, and grounded contextual analysis. |
| 25 | **Policy Validation & RCA Drawer** | `/simulation` (RCA Drawer) | [`25-policy-validation-rca-drawer-1920x1080.png`](./25-policy-validation-rca-drawer-1920x1080.png) | [`25-policy-validation-rca-drawer-1440x900.png`](./25-policy-validation-rca-drawer-1440x900.png) | Live Policy & Scenario Validation with live 3-stage Data Processing Pipeline progress (Preparation 100%, Pre-Payroll 72.2% with step drill-down) and slide-out Root Cause Analysis (RCA) Investigation Drawer displaying $1,842.50 aggregate variance across 24 impacted employees. |

---

## Responsive Viewport Captures

In addition to the Full HD and laptop captures, responsive views across key breakpoints (1440px, 1024px, 390px) are captured and verified against horizontal layout shifts:

- `01-overview-*.png` (Workspace Overview at 1440, 1024, 390)
- `02-requirements-*.png` (Requirements Intake & Hierarchy at 1440, 1024, 390)
- `03-tests-*.png` (Test Suite Repository at 1440, 1024, 390)
- `04-approval-workspace-*.png` (Review & Quality Gates at 1440, 1024, 390)
- `05-suites-*.png` (Test Suites Catalog at 1440, 1024, 390)
- `06-executions-*.png` (Execution Ledger at 1440, 1024, 390)
- `07-defects-*.png` (Defect Management at 1440, 1024, 390)
- `08-traceability-*.png` (Traceability Matrix at 1440, 1024, 390)
- `09-analytics-*.png` (Quality Analytics at 1440, 1024, 390)
- `10-settings-*.png` (Settings & Configuration at 1440, 1024, 390)

---

## Phase-Specific Capture Archives

- [`phase-11/`](./phase-11/): 10 captures documenting the End-to-End Business User Journey, Project Intelligence Report, ReasonX assistance, and Navigation Overhaul.
- [`phase-12/`](./phase-12/): 9 captures documenting the Complete Traceability Matrix & Coverage Explorer overhaul (Clause drill-down, impact analysis, orphan detection, duplicate resolution).
- [`phase-13/`](./phase-13/): 7 captures documenting the Policy Validation Live Progress pipeline, Pre-Payroll step expansion, RCA investigation drawer, circular 56px FAB, and full-height ReasonX drawer.
