# TraceTest AI — Frontend & UI Developer Handover Guide

> **Target Audience**: Frontend Software Engineers, UI/UX Designers, and Full-Stack Developers taking over UI enhancements and visual polish for TraceTest AI.  
> **Status**: Production-Ready Base • Clean TypeScript Typecheck (0 Errors) • Vitest Suite Passed (21/21) • Production Build Verified  
> **Updated**: November 2026

---

## 1. Project Overview & UI Architecture

**TraceTest AI** is an enterprise AI software quality engineering platform bridging natural language policy specifications with automated verification, dual-control governance, and sandboxed test execution.

The frontend is a single-page application built on:
- **Framework**: React 18 with Vite 6
- **Language**: TypeScript 5 (Strict Mode enabled, zero `any` leaks in UI core)
- **Styling**: Tailwind CSS v3 with customized enterprise design tokens
- **Component Primitives**: Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-select`, `@radix-ui/react-dropdown-menu`)
- **State & Server Cache**: TanStack React Query v5 (automatic query invalidation, refetching, and optimistic updates)
- **Icons**: Lucide React (`lucide-react`)
- **Data Visualizations**: Recharts
- **Routing**: React Router v6 with `AppShell` layout and hierarchical `ErrorBoundary`

---

## 2. Core Directory Layout

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui.tsx                 # Atomic design system (Button, Badge, Panel, Dialog, Tabs, KV, Notice, Code, Input)
│   │   ├── ErrorBoundary.tsx      # React Error Boundary protecting UI from unhandled child object exceptions
│   │   ├── DataTable.tsx          # Server-paginated, sortable data table with bulk action bar
│   │   ├── Toast.tsx              # Toast notification context and popups
│   │   ├── CommandPalette.tsx     # Global Cmd+K / Ctrl+K search palette
│   │   └── RunProgress.tsx        # Live SSE progress stepper for long-running workflows
│   ├── layouts/
│   │   └── AppShell.tsx           # Global header, persona switcher, workspace picker, sidebar navigation
│   ├── pages/
│   │   ├── SimulationPage.tsx     # 9-Stage Multi-Agent Simulation, YAML Engine, Safe Interpreter
│   │   ├── TestPages.tsx          # Test cases, Detail page, Approval workspace, Suites, Consumer monitoring
│   │   ├── RequirementsPages.tsx  # Requirements intake, clause parser, Gherkin acceptance criteria
│   │   ├── DashboardPage.tsx      # Executive project dashboard, coverage burndown, EchoBox/HCM telemetry
│   │   ├── ExecutionDefectPages.tsx # Execution logs, failure triage, defect management
│   │   ├── ProjectsPage.tsx       # Multi-project switcher and GitHub repository ingest wizard
│   │   └── InsightPages.tsx       # AI evaluation benchmarks, coverage matrix, audit trails
│   ├── services/
│   │   └── api.ts                 # Typed HTTP client wrapper around fetch with CSRF protection
│   ├── hooks/
│   │   ├── useAuth.tsx            # Dual-control role permissions (can("test.write"), can("test.review"))
│   │   ├── useProjects.tsx        # Active project context and workspace switcher state
│   │   └── useListState.tsx       # Standard query param synchronization for tables and filters
│   └── types/
│       └── models.ts              # Canonical TypeScript interfaces matching backend models
```

---

## 3. Key Pages & What Has Been Implemented

### A. Test Details & Sandbox Execution (`/tests/:id`)
* **File**: `frontend/src/pages/TestPages.tsx` -> `TestDetailPage`
* **Features**:
  * **LLM Judge Audit & Reviewer Recommendation Card**: Surfaces adversarial evaluation metrics directly to reviewers:
    * Recommendation status (`RECOMMEND APPROVAL` vs `REVISE / FIX`)
    * Statutory Grounding Score (e.g., `95% Grounded`)
    * Quote Fidelity (verbatim verification against source clauses)
    * AST Allowlist Check (zero unauthorized imports)
    * AI Synthesis Rationale (`t.rationale`)
    * **1-Click Review Assist**: Button auto-populates structured audit notes into reviewer comment field.
  * **1-Click Sandbox Pytest Runner**:
    * Automated tests display a **"Run in Sandbox"** button on the `Script` tab.
    * Executes directly against the **Reference HCM In-Memory Harness** via `POST /api/v1/tests/{id}/run-sandbox`.
    * Instant live execution console showing `PASSED`/`FAILED`, runtime (1ms), standard output, and assertion error traces.

### B. Approval Workspace (`/tests/review`)
* **File**: `frontend/src/pages/TestPages.tsx` -> `ReviewWorkspacePage`
* **Features**:
  * Enforces **Dual-Control Governance**: Only users with `test.review` role (Riley Chen) can approve or reject tests; authors (Alex Kowalski) cannot self-approve.
  * **LLM Judge Verdict Column**: Displays visual consensus recommendations (`Recommend Approve` / `Flagged`) on every row.
  * **Bulk Action Toolbar**: Select multiple tests and click `Approve selected` or `Reject selected`.

### C. Agent Simulation & No-Code YAML Engine (`/simulation`)
* **File**: `frontend/src/pages/SimulationPage.tsx`
* **Features**:
  * **9-Stage Multi-Agent Pipeline Graph**: Real-time status cards for Ingestion, Clause Parser, Ambiguity Scanner, Acceptance Criteria, Scenario Matrix, YAML Rule Spec, AST Validator, LLM Judge, and Safe Interpreter.
  * **Interactive Stage Inspector**:
    * **"Explain Agent"** button on every stage displaying Core Purpose, Mechanism, and Safety Guardrails.
    * Dynamic **Ambiguity & Gap Scanner findings** on Stage 03.
    * **Adversarial Quality Consensus** card on Stage 08.
  * **No-Code Policy YAML Engine Tab**: Decomposed rule specifications with syntax-highlighted YAML view.
  * **Live Safe Interpreter Tab (Red -> Green -> Mutation)**:
    1. *Stub Spec Baseline*: Fails expectedly against empty stubs.
    2. *Generated YAML Spec*: Passes green against compiled threshold rules.
    3. *Mutation Test*: Injects threshold mutation to prove non-tautological test sensitivity (Mutation Killed).
  * **Interactive Shift Calculator**: Allows testers to simulate custom daily shift arrays (e.g. `[10, 10, 10, 10, 8]`) and observe instant overtime / double-time breakdowns.

### D. Global Header & Persona Switcher
* **File**: `frontend/src/layouts/AppShell.tsx`
* **Features**:
  * **Persona Switcher**: Permanently visible in the top header. Allows 1-click switching between **`Alex Kowalski (Operator)`** (authoring permissions) and **`Riley Chen (Reviewer)`** (audit and approval permissions).
  * **Protected by ErrorBoundary**: The root layout and requirement tab outlets are wrapped in `ErrorBoundary` to safely trap rendering exceptions and prevent blank white screens.

---

## 4. UI/UX Enhancement Roadmap (Recommended Next Steps)

For the frontend engineer taking over, here are high-impact areas for aesthetic and functional polish:

### 1. Motion & Transition Polish
- **Library**: `framer-motion` (already in `package.json`).
- **Where to apply**:
  - Add layout animation transitions between stages during the 9-stage simulation run.
  - Smooth slide-over drawer transitions for the Stage Inspector and Test Case detail view.
  - Number counters for KPI metrics on the Executive Dashboard (`/dashboard`).

### 2. Code & YAML Editor Upgrade
- **Current**: Standard `<Textarea>` with monospace styling and `<Code>` preview blocks.
- **Recommended**: Integrate `@monaco-editor/react` or `@uiw/react-codemirror` for syntax-highlighted editing of:
  - Python Pytest test scripts (`TestDetailPage.tsx`).
  - Compiled Policy YAML specifications (`SimulationPage.tsx`).
  - Raw JSON test data fixtures.

### 3. Dark Mode Support
- **Current**: Default enterprise light mode (`bg-slate-50`, `bg-white`, `border-slate-200`).
- **Recommended**: Add a dark theme toggle leveraging Tailwind's `dark:` classes for high-contrast engineering environments.

### 4. Diff Viewer for Requirements & Rules
- **Use Case**: When editing a policy or updating a test specification version.
- **Recommended**: Visual split-view or inline diff viewer highlighting added, removed, and modified clauses or YAML thresholds.

---

## 5. Development & Verification Workflow

### Starting the Local Environment

1. **Start Backend Server** (Terminal 1):
   ```powershell
   $env:PYTHONPATH="backend"
   $env:TRACETEST_ALLOW_WEAK_SANDBOX="1"
   $env:TRACETEST_SINGLE_OPERATOR="true"
   .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

2. **Start Frontend Dev Server** (Terminal 2):
   ```powershell
   npm run dev --prefix frontend
   ```
   Access the UI at: `http://localhost:5173`

### Verifying Code Quality Before Committing

Always run the full frontend verification suite:

```powershell
# 1. TypeScript Strict Typecheck (must be 0 errors)
npm run typecheck --prefix frontend

# 2. Vitest Suite (all 21 unit & component tests must pass)
npm run test --prefix frontend

# 3. Production Vite Build (verifies bundling and rollup chunks)
npm run build --prefix frontend
```

---

## 6. Key Design Invariants to Maintain

1. **Dual-Control Governance ("Four-Eyes Principle")**:
   - Never allow an Operator to approve their own test cases directly without switching to Reviewer.
   - Maintain the permission guards: `can("test.write")` for creation/editing, and `can("test.review")` for approval/rejection.
2. **Safe Child Formatting**:
   - Always format detail objects with JSON serialization or specific field extraction before rendering in React JSX to avoid React child errors.
3. **No Hallucinated Successes**:
   - Always display real status, error tracebacks, and actual durations from API responses.
