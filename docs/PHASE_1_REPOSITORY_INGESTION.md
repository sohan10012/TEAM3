# Phase 1: Real Repository Ingestion & Multi-Project Data Isolation

## Executive Summary

Phase 1 investigated and resolved the root causes of repository ingestion failures and cross-project data leakage in TraceTest AI. Previously, imported repositories received generic mobile platform wrapper modules (`ANDROID`, `IOS`, `LINUX`, `MACOS`), spurious documentation requirements (such as table of contents, architecture diagrams, and equation headers), and hardcoded `Reference HCM` enterprise environments.

The ingestion pipeline has been completely refactored with:
1. **Architecture-Aware AST Analysis**: Automatically detects dual-tier architectures (e.g. Flutter client + FastAPI backend) and discovers true architectural modules rather than filesystem artifact directories.
2. **Ground Truth Route & Model Extraction**: Analyzes FastAPI/Python AST trees with `APIRouter(prefix=...)` prefix resolution, extracting exact HTTP methods, synthesized paths, handlers, docstrings, and physical line ranges (`line_start`, `line_end`).
3. **Provenanced & Categorized Requirements**: Discards non-requirement markdown sections and extracts grounded requirements across four distinct classes:
   - `documented` (Approved, 0.95 confidence)
   - `inferred_from_code` (Needs confirmation, 0.85 confidence)
   - `inferred_technical` (Needs confirmation, 0.80 confidence)
   - `operational` (Approved, 0.90 confidence)
4. **Strict Project Data Isolation**: Scopes `Reference HCM` environments exclusively to Dayforce projects, provisions application-specific sandboxes for generic projects, and ensures that newly imported projects start with genuinely zero test cases, zero executions, and zero defects. Existing project data (including all 21 requirements, 21 tests, 9 executions, and 7 defects of EchoBox) is 100% preserved.

---

## 1. Root Cause Analysis

| # | Defect Symptom | Root Cause Code Location | Technical Mechanism |
|---|----------------|--------------------------|---------------------|
| 1 | Generic `ANDROID`, `IOS`, `LINUX`, `MACOS` modules assigned to Cureonix | `backend/app/services/repo_ingest/ast_analyzer.py:16-24` | Naive `[d.name for d in repo_path.iterdir() if d.is_dir()]` sorted root directories alphabetically. In a Flutter repository, the top directories are platform build wrappers (`android`, `ios`, `linux`, `macos`, `web`, `windows`), which were mistakenly registered as functional system modules. |
| 2 | All requirements assigned to single arbitrary module | `backend/app/services/repo_ingest/generic_derivation.py:108` | `default_mod = list(created_modules.values())[0]` defaulted every requirement and endpoint to the first module in alphabetical order (`ANDROID`). |
| 3 | Spurious `📄 TABLE OF CONTENTS`, architecture diagram requirements | `backend/app/services/repo_ingest/generic_derivation.py:92-106` | Naive regex `re.findall(r"^##\s+(.+)$", content, re.MULTILINE)` treated all markdown level-2 headers as business requirements without filtering documentation meta-headers or parsing structured tables/bullet lists. |
| 4 | Leaked `Reference HCM 1.0` environments in non-Dayforce projects | `backend/app/api/routers/projects.py:90-91` | `create_project` unconditionally created two default environments named `"QA — Reference HCM 1.0"` and `"QA — Reference HCM 1.1"` for every project. Furthermore, `EnvIn.kind` defaulted to `"reference_hcm"`. |
| 5 | Missing router prefixes and inaccurate line numbers in AST analysis | `backend/app/services/repo_ingest/ast_analyzer.py:27-50` | The Python AST walker matched `@router.get("/path")` without checking `router = APIRouter(prefix="/api/v1")`, yielding truncated paths like `/query` instead of `/api/v1/query`. Line ranges defaulted to `1-1` without reading AST node `lineno` and `end_lineno`. |

---

## 2. Files and Functions Modified

### 1. `backend/app/services/repo_ingest/ast_analyzer.py`
- Added `FLUTTER_PLATFORM_DIRS = {"android", "ios", "linux", "macos", "windows", "web"}` and `IGNORED_DIRS`.
- Added multi-language mapping: `.py` (Python), `.dart` (Dart), `.js`/`.ts`/`.tsx`/`.jsx` (TypeScript/JavaScript), `.go` (Go), `.rs` (Rust), `.java`/`.kt` (Kotlin/Java), `.swift` (Swift), `.yaml`/`.yml` (YAML), `.sh` (Shell).
- Added framework detection: checks dependencies in `pubspec.yaml` (Flutter), `requirements.txt` / `pyproject.toml` (FastAPI, Flask, Django), and `package.json` (React, Next.js, Express).
- Added `unsupported_files` tracking: cataloged unparsed binary and media assets (`.png`, `.pdf`, `.ico`, `.jpg`, `.ttf`).
- Implemented dual-tier architecture discovery:
  - If `backend/` exists: discovers architectural modules for `backend/routes` (`BACKEND-ROUTES`), `backend/agents` (`BACKEND-AGENTS`), `backend/models` (`BACKEND-MODELS`), `backend/orchestrator` (`BACKEND-ORCHESTR`), `backend/services` (`BACKEND-SERVICES`).
  - If `lib/` exists: discovers architectural modules for `lib/screens` (`FLUTTER-SCREENS`), `lib/services` (`FLUTTER-SERVICES`), `lib/providers` (`FLUTTER-PROVIDER`), `lib/models` (`FLUTTER-MODELS`), `lib/config` (`FLUTTER-CONFIG`), `lib/theme` (`FLUTTER-THEME`).
- Refactored AST endpoint extraction:
  - Resolves `router = APIRouter(prefix="...")` assignments.
  - Combines router prefixes with decorator paths (e.g. `POST /api/v1/export/csv`).
  - Extracts exact `line_start` and `line_end` from AST nodes.
  - Extracts docstrings from function definitions.
  - Associates endpoints with their specific architectural module.

### 2. `backend/app/services/repo_ingest/generic_derivation.py`
- Added `BANNED_DOC_HEADERS` regex to reject table of contents, license, contributing, file structure, and mathematical equation headers.
- Implemented `_extract_documented_features`: parses structured markdown tables (`| Feature | ... |`) and capability bullet lists (`- **Feature**: ...`).
- Implemented requirement classification with explicit confidence and human confirmation state:
  - **Explicit Documented**: status `approved`, confidence `0.95`, origin `documented`.
  - **Inferred Functional (API Endpoints)**: status `needs_confirmation`, confidence `0.85`, origin `inferred_from_code`.
  - **Inferred Technical (Data Contracts / Pydantic Schemas)**: status `needs_confirmation`, confidence `0.80`, origin `inferred_technical`.
  - **Operational Requirements (Health Probes / Containerization)**: status `approved`, confidence `0.90`, origin `operational`.
- Associated extracted requirements with the discovered modules (`BACKEND-ROUTES`, `BACKEND-AGENTS`, `BACKEND-MODELS`, `FLUTTER-SCREENS`, etc.).
- Embedded multi-stage import lifecycle summary (`_import_summary`) with stage statuses and metric counters.

### 3. `backend/app/api/routers/projects.py`
- Scoped `Reference HCM` environments exclusively to Dayforce projects (`key.startswith("DF")` or `"dayforce" in name.lower()`).
- Generic imported projects are provisioned with `{project.name} Sandbox` (`kind="web"`) and `{project.name} Simulation` (`kind="simulation"`).
- Updated `EnvIn.kind` default from `"reference_hcm"` to `"simulation"`.
- Exposed `import_summary` in the `import_repository` API response.

### 4. `backend/tests/test_cureonix_real_ingest.py`
- Authored acceptance test suite validating real Cureonix repository ingestion, AST module discovery, spurious header rejection, environment scoping, and project isolation.

### 5. `docs/openapi.json`
- Regenerated OpenAPI specification to reflect `EnvIn` schema changes.

---

## 3. Ingestion Behavior Comparison

| Ingestion Characteristic | Previous Behavior | Corrected Behavior (Phase 1) |
|--------------------------|-------------------|------------------------------|
| **Module Identification** | Alphabetical first 8 directories: `ANDROID`, `IOS`, `LINUX`, `MACOS`, `WEB`, `WINDOWS`, `BACKEND`, `LIB` | Architectural module analysis: `BACKEND-ROUTES`, `BACKEND-AGENTS`, `BACKEND-MODELS`, `BACKEND-ORCHESTR`, `BACKEND-SERVICES`, `FLUTTER-SCREENS`, `FLUTTER-SERVICES`, `FLUTTER-PROVIDER`, `FLUTTER-MODELS`, `FLUTTER-CONFIG`, `FLUTTER-THEME` |
| **Doc Requirements** | Captured markdown headers indiscriminately (e.g. `## 📄 TABLE OF CONTENTS`, `## System Architecture`) | Rejects non-functional sections; extracts documented features from capability tables and bullet points with exact quotes |
| **Endpoint URLs** | Stripped router prefix: `POST /query`, `POST /csv` | Synthesizes full URL via AST prefix inspection: `POST /api/v1/query`, `POST /api/v1/export/csv` |
| **Endpoint Line Ranges** | Hardcoded `1-1` | Exact AST node lines: `lineno` to `end_lineno` (e.g. lines 79-99 in `backend/routes/query.py`) |
| **Requirement Categories** | All marked generic `"functional"` | Segregated into `documented` (0.95), `inferred_from_code` (0.85), `inferred_technical` (0.80), and `operational` (0.90) |
| **Default Environments** | Always inserted `"QA — Reference HCM 1.0"` & `"1.1"` | Scoped HCM only to Dayforce; generic projects receive `{Name} Sandbox` and `{Name} Simulation` |
| **Initial Project State** | Seeded with fake tests and defects | Genuinely zero tests, zero executions, zero defects |
| **Multi-Stage Reporting** | Boolean success/failure only | Multi-stage lifecycle summary: retrieval, commit resolution, discovery, source analysis, module discovery, requirement extraction, database persistence |

---

## 4. Real Cureonix Import Evidence

### Repository Metadata
- **Repository URL**: `https://github.com/sohan10012/Cureonix.git`
- **Target Branch**: `main`
- **Resolved Commit SHA**: `f5f2c9c826409bc8e00d3618d7df80c6252c0715`
- **Discovered Files**: 194 files
- **Detected Languages**: `Dart`, `Python`, `YAML`, `Shell`, `JSON`, `Markdown`
- **Detected Frameworks**: `Flutter`, `FastAPI`
- **Unsupported Assets**: 12 asset files tracked (`.pdf`, `.png`, `.ico`)

### Discovered Architectural Modules
1. `BACKEND-AGENTS`: Multi-Agent Research Pipeline (`backend/agents`)
2. `BACKEND-MODELS`: Pydantic Schemas & Data Contracts (`backend/models`)
3. `BACKEND-ORCHESTR`: Pipeline Orchestrator (`backend/orchestrator`)
4. `BACKEND-ROUTES`: REST API Gateway & Endpoints (`backend/routes`)
5. `BACKEND-SERVICES`: Backend Core & LLM Services (`backend/services`)
6. `FLUTTER-CONFIG`: Client Configuration (`lib/config`)
7. `FLUTTER-MODELS`: Client Data Models (`lib/models`)
8. `FLUTTER-PROVIDER`: State Management & Providers (`lib/providers`)
9. `FLUTTER-SCREENS`: UI Screens & Views (`lib/screens`)
10. `FLUTTER-SERVICES`: Client API & Network Services (`lib/services`)
11. `FLUTTER-THEME`: Theme & Design System (`lib/theme`)

### Extracted Grounded Requirements (Total: 23)

| Requirement Key | Title | Category | Status | Confidence | Origin | Module | Source Provenance |
|-----------------|-------|----------|--------|------------|--------|--------|-------------------|
| `CUREON-REQ-001` | API Endpoint Verification: GET / | functional | needs_confirmation | 0.85 | inferred_from_code | BACKEND-ROUTES | `backend/main.py:15-17` (`f5f2c9c82640`) |
| `CUREON-REQ-002` | API Endpoint Verification: POST /api/v1/export/validate | functional | needs_confirmation | 0.85 | inferred_from_code | BACKEND-ROUTES | `backend/routes/export.py:28-40` (`f5f2c9c82640`) |
| `CUREON-REQ-003` | API Endpoint Verification: POST /api/v1/export/csv | functional | needs_confirmation | 0.85 | inferred_from_code | BACKEND-ROUTES | `backend/routes/export.py:42-55` (`f5f2c9c82640`) |
| `CUREON-REQ-004` | API Endpoint Verification: POST /api/v1/export/bibtex | functional | needs_confirmation | 0.85 | inferred_from_code | BACKEND-ROUTES | `backend/routes/export.py:57-70` (`f5f2c9c82640`) |
| `CUREON-REQ-005` | API Endpoint Verification: POST /api/v1/query | functional | needs_confirmation | 0.85 | inferred_from_code | BACKEND-ROUTES | `backend/routes/query.py:79-99` (`f5f2c9c82640`) |
| `CUREON-REQ-006` | API Endpoint Verification: POST /api/v1/sessions | functional | needs_confirmation | 0.85 | inferred_from_code | BACKEND-ROUTES | `backend/routes/query.py:101-115` (`f5f2c9c82640`) |
| `CUREON-REQ-007` | API Endpoint Verification: GET /api/v1/sessions/{session_id} | functional | needs_confirmation | 0.85 | inferred_from_code | BACKEND-ROUTES | `backend/routes/query.py:117-128` (`f5f2c9c82640`) |
| `CUREON-REQ-008` | API Endpoint Verification: GET /api/v1/sessions | functional | needs_confirmation | 0.85 | inferred_from_code | BACKEND-ROUTES | `backend/routes/query.py:130-140` (`f5f2c9c82640`) |
| `CUREON-REQ-009` | Operational Health Probe: GET /api/v1/health | operational | approved | 0.90 | operational | BACKEND-ROUTES | `backend/routes/query.py:65-77` (`f5f2c9c82640`) |
| `CUREON-REQ-010` | Data Contract: `Settings` Schema | technical | needs_confirmation | 0.80 | inferred_technical | BACKEND-MODELS | `backend/models/settings.py` (`f5f2c9c82640`) |
| `CUREON-REQ-011` | Data Contract: `IntentType` Schema | technical | needs_confirmation | 0.80 | inferred_technical | BACKEND-MODELS | `backend/models/intent.py` (`f5f2c9c82640`) |
| `CUREON-REQ-012` | Data Contract: `EvidenceStrength` Schema | technical | needs_confirmation | 0.80 | inferred_technical | BACKEND-MODELS | `backend/models/evidence.py` (`f5f2c9c82640`) |
| `CUREON-REQ-013` | Data Contract: `DocumentSource` Schema | technical | needs_confirmation | 0.80 | inferred_technical | BACKEND-MODELS | `backend/models/document.py` (`f5f2c9c82640`) |
| `CUREON-REQ-014` | Data Contract: `SourceStatus` Schema | technical | needs_confirmation | 0.80 | inferred_technical | BACKEND-MODELS | `backend/models/source.py` (`f5f2c9c82640`) |
| `CUREON-REQ-015` | Data Contract: `Severity` Schema | technical | needs_confirmation | 0.80 | inferred_technical | BACKEND-MODELS | `backend/models/severity.py` (`f5f2c9c82640`) |
| `CUREON-REQ-016` | Molecule Grounding & Anchor Preservation | functional | approved | 0.95 | documented | BACKEND-AGENTS | `README.md` (`f5f2c9c82640`) |
| `CUREON-REQ-017` | Multi-Source Aggregation (PubMed + Trials + DrugBank) | functional | approved | 0.95 | documented | BACKEND-ROUTES | `README.md` (`f5f2c9c82640`) |
| `CUREON-REQ-018` | Evidence Quality Scoring (EQS) | functional | approved | 0.95 | documented | BACKEND-AGENTS | `README.md` (`f5f2c9c82640`) |
| `CUREON-REQ-019` | Contradiction Detection (NLI + ContraScore) | functional | approved | 0.95 | documented | BACKEND-AGENTS | `README.md` (`f5f2c9c82640`) |
| `CUREON-REQ-020` | 17 Structured Drug-Repurposing Sections | functional | approved | 0.95 | documented | BACKEND-ROUTES | `README.md` (`f5f2c9c82640`) |
| `CUREON-REQ-021` | PDF Export Pre-Validation Safety | functional | approved | 0.95 | documented | BACKEND-ROUTES | `README.md` (`f5f2c9c82640`) |
| `CUREON-REQ-022` | Dual LLM Switching (Gemini & Groq) | functional | approved | 0.95 | documented | BACKEND-SERVICES | `README.md` (`f5f2c9c82640`) |
| `CUREON-REQ-023` | Mobile & Web Dashboard (Flutter) | functional | approved | 0.95 | documented | FLUTTER-SCREENS | `README.md` (`f5f2c9c82640`) |

---

## 5. Multi-Project Data Isolation Verification

A rigorous database audit confirmed total isolation between existing projects and newly imported projects:

```
Database Verification Matrix (var/tracetest.db):
+-----------------+---------------+----------------+----------------+
| Metric / Table  | EchoBox (P-5) | Cureonix (P-8) | Status         |
+-----------------+---------------+----------------+----------------+
| Modules         | 8             | 11             | ISOLATED       |
| Requirements    | 21            | 23             | ISOLATED       |
| Test Cases      | 21            | 0              | CLEAN (ZERO)   |
| Test Suites     | 0             | 0              | CLEAN (ZERO)   |
| Test Executions | 9             | 0              | CLEAN (ZERO)   |
| Defects         | 7             | 0              | CLEAN (ZERO)   |
| Environments    | 4 (EchoBox)   | 2 (Cureonix)   | ZERO HCM LEAK  |
+-----------------+---------------+----------------+----------------+
```

### EchoBox Preservation Proof
EchoBox records remain intact:
- 21 requirements grounded in EchoBox AWS API specifications.
- 21 automated test cases.
- 9 test execution records (including `EX-ECHO-LIVE-002` covering 15 live AWS operations).
- 7 defects (including verified `DEF-ECHO-LIVE-001` and `DEF-ECHO-005`).
- 4 specialized execution environments (`EchoBox Real Code SUT`, `EchoBox AWS Live`, `EchoBox Local Test Harness`, `EchoBox In-Memory Simulation Harness`).

---

## 6. Verification and Test Suite Results

All quality and security checks pass with zero failures:

1. **Pytest Suite (`backend/tests`)**:
   - `159 passed, 1 skipped, 1 xfailed in 27.38s`
   - Includes dedicated acceptance suite `test_cureonix_real_ingest.py` (4/4 passed).
2. **Type Checking (`mypy`)**:
   - `Success: no issues found in 70 source files`
3. **Linter (`ruff`)**:
   - `All checks passed!`
4. **Documentation & Security Suite (`verify_docs.py`)**:
   - `[1/8]` Required docs: PASS (33/33 files)
   - `[2/8]` Internal markdown links: PASS
   - `[3/8]` OpenAPI endpoint coverage: PASS
   - `[4/8]` Schema documentation: PASS (36 tables)
   - `[5/8]` Security invariants (loopback bind, fail-closed sandbox): PASS
   - `[6/8]` Secret hygiene: PASS (zero leaked credentials)
   - `[7/8]` Source code file paths: PASS
   - `[8/8]` Entity and fault counts: PASS
5. **Frontend Suite (`npm --prefix frontend test -- --run`)**:
   - `2 test files passed, 13 tests passed`
6. **Frontend Build (`npm --prefix frontend run build`)**:
   - Production bundle compiled in `3.11s` with 0 TypeScript errors.

---

## 7. Remaining Limitations & Phase 2 Outlook

- **Document Upload Interface (Phase 2)**: The architecture is prepared to ingest external PRD, SRS, and API specification files (`.pdf`, `.md`, `.json`, `.yaml`) and associate them with existing requirements without confusing source-inferred vs document-specified items. The frontend upload UI and backend document parser will be delivered in Phase 2.
- **Autonomous Test Case Generation (Phase 3)**: Cureonix test cases will be generated in Phase 3 using the LLM generation pipeline grounded in the 23 discovered requirements.
- **Execution Sandbox (Phase 4)**: The execution environment for Cureonix (FastAPI tests + Flutter integration tests) will be executed in a fail-closed bubblewrap sandbox in Phase 4.

