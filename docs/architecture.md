# System Architecture — TraceTest AI

## 1. High-Level Architecture Overview

TraceTest AI employs a modular, service-oriented architecture with decoupled layers:
- **Presentation Layer**: React 18 SPA with TypeScript 5, Vite 6, Tailwind CSS, Lucide icons, and Recharts.
- **API & Application Layer**: FastAPI running on Python 3.11 with Pydantic v2 schemas and role-based dependency injection.
- **Workflow Orchestration**: LangGraph stateful graph execution with checkpointing for multi-step AI reasoning and retest loops.
- **Data Persistence**: SQLite 3 with Write-Ahead Logging (`WAL`), strict foreign keys, and SQLAlchemy 2.0 ORM.
- **Execution Engine**: Multi-tiered runner executing in isolated POSIX temporary sandboxes with AST allowlist enforcement, Linux network namespace isolation, and Playwright browser drivers.
- **AI Integration Layer**: Failover routing across Groq (`openai/gpt-oss-120b`) and Gemini (`gemini-2.5-flash`) with slot pools, backoff, and circuit breakers.

```
+-------------------------------------------------------------------------------+
|                       Presentation Layer (React 18 + Vite)                    |
|   Overview | Requirements | Test Cases | Review | Executions | Defects | Trace|
+---------------------------------------+---------------------------------------+
                                        | REST / JSON
+---------------------------------------v---------------------------------------+
|                       Application Layer (FastAPI Backend)                     |
|  ProjectsRouter | ReqsRouter | TestsRouter | ExecRouter | DefectsRouter | ... |
+-------------------+-------------------+-------------------+-------------------+
                    |                   |                   |
+-------------------v---+   +-----------v-----------+   +---v-------------------+
|  Requirements Engine  |   |    LangGraph Engine   |   |   Execution Sandbox   |
|  - Clause Splitter    |   | - Analysis Graph      |   | - POSIX Rlimits       |
|  - Ambiguity Scanner  |   | - Generation Graph    |   | - NetNS / Socket Guard|
|  - Verifier & Hasher  |   | - Execution Graph     |   | - Playwright Chromium |
+-----------------------+   +-----------+-----------+   +-----------------------+
                                        |
+---------------------------------------v---------------------------------------+
|                   AI Router & Multi-Slot Provider Pool                        |
|   Groq Pool (3 Keys, gpt-oss-120b) <---> Gemini Pool (3 Keys, 2.5-flash)      |
+-------------------------------------------------------------------------------+
                                        |
+---------------------------------------v---------------------------------------+
|                    Persistence Layer (SQLite WAL + Models)                    |
|   Projects | Modules | Requirements | Clauses | Tests | Executions | Defects  |
+-------------------------------------------------------------------------------+
```

---

## 2. Component Subsystems

### 2.1 Backend Architecture (`backend/app`)

- `app/api/routers/`: Modular REST routers for `projects`, `requirements`, `tests`, `suites`, `executions`, `defects`, `analytics`, `integrations`, and `settings`.
- `app/services/`: Core domain logic:
  - `repo_ingest.py`: Repository clone, directory scanner, AST parser, and requirement generation.
  - `requirements.py`: Versioning, immutable snapshotting, clause diffing, and change impact computation.
  - `tests.py`: Deterministic test validation, script AST checking, and duplication detection.
  - `executions.py`: Execution lifecycle orchestration, artifact persistence, and result aggregation.
  - `defects.py`: Defect tracking, triage status transitions, and GitHub issue sync.
  - `evals.py`: Empirical AI evaluation harness against golden scenarios.
- `app/guardrails/`: Security and determinism filters:
  - `ast_validator.py`: Strict AST allowlist banning dangerous modules, network, and builtins.
  - `clauses.py`: Regex and sentence boundary clause segmentation.
  - `quotes.py`: Verbatim quote verification against source requirement text.
  - `ambiguity.py`: Dictionary and pattern-based ambiguity detector.
  - `duplicates.py`: Jaccard/Levenshtein similarity duplicate suppression.
- `app/execution/sandbox.py`: Ephemeral subprocess runner with `unshare -rn` and resource caps.

### 2.2 Frontend Architecture (`frontend/src`)

- `src/pages/`: Page components for Overview, Requirements, TestCases, ReviewWorkspace, Suites, Executions, Defects, Traceability, Analytics, and Settings.
- `src/components/`: Modular UI building blocks including DataTable, Modal, StatusBadge, MetricCard, CodeEditor, and Layout.
- `src/api/`: Typed API client interfaces generated from backend OpenAPI contracts.
- `src/context/`: Application state management for active project selection and operational notifications.

---

## 3. Data Flow & Security Architecture

1. **Request Lifecycle**:
   - Web requests enter FastAPI through CORS and rate-limiting middleware.
   - Authentication dependencies resolve user principal and check project-level permissions.
   - Database operations execute inside atomic `session_scope()` transaction contexts.
2. **AI Generation Pipeline**:
   - Prompts construct untrusted requirement blocks with explicit XML boundary encapsulation (`<REQUIREMENT>...</REQUIREMENT>`).
   - The AI Router selects healthy provider slots using circuit breaker status and slot-level latency metrics.
   - Generated responses are validated against Pydantic schemas. Invalid outputs trigger automated repair passes (max 2).
3. **Execution Gating**:
   - Tests cannot execute unless their status is `approved` and validation status is `valid`.
   - Before execution, test scripts are re-validated against the AST allowlist.
   - Child processes run in isolated directories with minimal PATH, no Python bytecode generation (`-B`), isolated environment (`-I`), and blocked network sockets.

---

## 4. Scalability & Operational Characteristics

- **Zero External Dependencies**: Operates self-contained on Linux without requiring Redis, RabbitMQ, or external database servers.
- **SQLite WAL Mode**: Provides concurrent read operations while writes execute with immediate consistency.
- **Worker Concurrency**: Long-running executions and evaluations run in background thread pools, reporting progress through persistent database checkpoints.
