# TraceTest Platform Architecture & Actual Execution Map

**Author:** Principal AI Engineer & Independent Technical Auditor  
**Date:** 2026-11-11  
**Target Repository:** `/home/Sohan/PROJECTS/tracetest-ai`  
**Evaluation Scope:** Requirements-Based Quality Engineering Workflow  

---

## 1. System Architecture Overview

TraceTest is an enterprise Software Quality Engineering platform designed to transform business specifications, regulatory standards, and operational guidelines into structured requirements, Given/When/Then acceptance criteria, multi-category test cases, deterministic execution simulations, and comprehensive traceability matrices.

### Core Stack Components

| Layer | Technologies | Responsibilities |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS 3.4, TanStack Query v5, Lucide React, Radix UI Primitives | Responsive application shell, project workspaces, document ingestion modals, coverage explorer, simulation dashboards, and ReasonX AI drawer. |
| **Backend** | Python 3.11, FastAPI, Uvicorn, SQLAlchemy 2.0, Pydantic v2, Alembic | RESTful API, authentication & session management, document parsing pipelines, LLM routing & circuit breaking, test generation, and simulation engines. |
| **Database** | SQLite 3 (WAL mode) / PostgreSQL compatible schema | Isolated project records, immutable requirement versions, clause decomposition, acceptance criteria, test cases, execution traces, provider telemetry, and audit logs. |
| **Document Parsers** | `pypdf`, `python-docx`, `openpyxl`, standard `csv` & `markdown` | Multi-format text and table extraction with page and section provenance tracking. |
| **LLM Orchestration** | Custom `app.llm.router` with Multi-Slot Provider Pooling | Routing between primary provider (Groq / `openai/gpt-oss-120b`) and secondary provider (Google Gemini / `gemini-3.1-flash-lite`), circuit breakers, structured JSON repair, secret redaction, and database trace logging (`ProviderTrace`). |
| **Execution Engines** | `app.services.simulation_engine` & `app.execution.sandbox` | Deterministic Given/When/Then contract validation, multi-phase payroll simulation, and defect RCA diagnosis. |

---

## 2. API Endpoints Map (Requirements-Based Workflow)

| Endpoint | HTTP | Purpose | Handler Function |
|---|---|---|---|
| `/api/v1/onboarding/stage-upload` | `POST` | Staging file upload and format extraction | `stage_uploaded_file` |
| `/api/v1/onboarding/analyze` | `POST` | Multi-document AI extraction & insight synthesis | `analyze_onboarding_documents` |
| `/api/v1/onboarding/commit` | `POST` | Commit approved project configuration & initialize docs | `commit_onboarding_project` |
| `/api/v1/projects/{id}/documents` | `POST` | Direct document upload to project storage | `_do_upload_document` |
| `/api/v1/projects/{id}/documents` | `GET` | List project documents with requirement counts | `list_project_documents` |
| `/api/v1/documents/{id}/reprocess` | `POST` | Re-parse document text and re-extract requirements | `reprocess_document` |
| `/api/v1/projects/{id}/analyze-documents` | `POST` | Batch extract requirements across all documents | `analyze_and_extract_project_requirements` |
| `/api/v1/projects/{id}/generate-acceptance-criteria` | `POST` | Generate Given/When/Then acceptance criteria | `generate_acceptance_criteria_for_project` |
| `/api/v1/projects/{id}/generate-test-cases` | `POST` | Synthesize test cases across 10 quality categories | `generate_test_scenarios_for_project` |
| `/api/v1/projects/{id}/validate-specifications` | `POST` | Deterministic contract validation run (`VAL-*`) | `validate_project_specifications` |
| `/api/v1/projects/{id}/run-simulation` | `POST` | Execute multi-scenario policy simulation (`SIM-*`) | `run_project_simulation` |
| `/api/v1/projects/{id}/requirements-dashboard` | `GET` | Aggregate project telemetry, counts, and health | `get_requirements_project_dashboard` |
| `/api/v1/projects/{id}/traceability-matrix` | `GET` | Bidirectional coverage hierarchy and gap analysis | `get_traceability_matrix` |
| `/api/v1/projects/{id}/intelligence-report` | `GET` | Quality Intelligence report, KPIs, and audit ledgers | `get_project_intelligence_report` |
| `/api/v1/projects/{id}/reasonx/chat` | `POST` | Grounded assistant conversation with project context | `chat_reasonx` |

---

## 3. Operation Classification (Audit Standard)

As mandated by the independent audit protocol, every stage of the Requirements-Based pipeline is categorized according to its actual execution mechanism:

- **A. Real LLM Invocation:** Dynamic neural model inference via API.
- **B. Deterministic Processing:** Algorithmic rules, AST/regex parsing, heuristic classification.
- **C. Static/Hardcoded Output:** Invariant constants returned regardless of input.
- **D. Seeded/Mock Response:** Demo fixtures or canned responses.
- **E. Cached Response:** Previously computed result served from hash cache.
- **F. Unavailable or Failed:** Service unreachable or misconfigured.

### Detailed Component Classification Table

| Workflow Stage | Operational Component | Classification | Technical Evidence & Code Implementation |
|---|---|:---:|---|
| **Document Intake & Parsing** | PDF / DOCX / TXT parser | **B. Deterministic** | `app.services.document_processor`: `parse_pdf` utilizes `pypdf` to extract text streams, de-hyphenate words, and detect sections. |
| **AI Onboarding Analysis** | Rule & Scenario Extraction | **A. Real LLM** | `app.services.project_onboarding`: `analyze_onboarding_documents` calls `router.generate(task="onboarding_analysis", ...)` returning `OnboardingAnalysisOut`. |
| **Source Quote Verification** | Anti-hallucination guard | **B. Deterministic** | `app.guardrails.quotes`: `verify_quote` matches extracted LLM quotes against normalized source text. |
| **Requirement Extraction** | Document text to requirements | **B. Deterministic** | `app.services.requirement_intelligence`: `extract_requirements_from_text` tokenizes sentences, filters modal auxiliaries ("shall", "must"), and checks length. |
| **Requirement Categorization** | Functional / Security / Rules | **B. Deterministic** | `app.services.requirement_intelligence`: `_classify_category` matches domain keyword lists (`CATEGORY_KEYWORDS`). |
| **Clause Decomposition** | Sentence & sub-clause splitting | **B. Deterministic** | `app.guardrails.clauses`: `split_clauses` parses text into discrete `.C1`, `.C2` clause keys and normalized hashes. |
| **Ambiguity & Gap Detection** | Vague term identification | **B. Deterministic** | `app.guardrails.ambiguity`: `detect_ambiguity` scans text using regex patterns (`AMBIGUITY_PATTERNS`). |
| **Acceptance Criteria Gen** | Given/When/Then synthesis | **B. Deterministic** | `app.services.test_design`: `generate_acceptance_criteria_for_project` creates AC1 (nominal) and AC2 (boundary) via rule engine templates. |
| **Test Scenario Generation** | 10-category test synthesis | **B. Deterministic** | `app.services.test_design`: `generate_test_scenarios_for_project` instantiates 10 category templates (positive, negative, boundary, security, etc.). |
| **Automated Test Recs** | Execution mapping | **B. Deterministic** | Derived directly from `TestCase` models with execution targets (`specification_validation` or `simulation`). |
| **Human Review & Approval** | Status mutations & audit trail | **User-Driven** | `app.services.audit`: Records actor ID, timestamp, and action metadata in `audit_logs` table. |
| **Specification Validation** | Contract validation (`VAL-*`) | **B. Deterministic** | `app.services.test_design`: `validate_project_specifications` executes schema and precondition assertions on criteria. |
| **Policy Simulation** | Payroll behavior simulation | **B. Deterministic** | `app.services.simulation_engine`: Simulates multi-phase rules (Preparation, Pre-Payroll, Post-Payroll), evaluating discrepancies. |
| **Traceability Hierarchy** | Matrix & coverage explorer | **B. Deterministic** | SQL join traversal from `Document` &rarr; `Requirement` &rarr; `AcceptanceCriterion` &rarr; `TestCase` &rarr; `Execution` &rarr; `Defect`. |
| **ReasonX AI Copilot** | Interactive assistant drawer | **A. Real LLM** | `app.services.reasonx`: `chat_reasonx` calls `router.generate(task="reasonx_chat", ...)` with live project context. |
| **Quality Report Generation** | Dossier & executive export | **B. Deterministic** | `app.services.project_intelligence`: Computes ISO compliance KPIs, readiness gates, and discrepancy audit ledgers. |

