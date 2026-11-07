# TraceTest AI — Enterprise Quality Engineering Platform

TraceTest AI is an enterprise-grade AI quality engineering and requirement verification platform. Designed for high-assurance systems and real-world software applications, TraceTest AI transforms requirements into deterministic, traceable, and executable test suites, executes them in isolated sandboxes, identifies genuine application defects, and provides mathematical requirement coverage.

---

## Key Capabilities

1. **Automated Repository Ingestion & Architecture Mapping**:
   - Ingests public and private codebases (demonstrated with [EchoBox](https://github.com/sohan10012/EchoBox.git) and Dayforce HCM reference models).
   - Python AST analysis for action matrix extraction, route mapping, and single-table DynamoDB pattern analysis.
   - Automatic module decomposition and clause generation.

2. **Grounded Requirements Engineering**:
   - Deterministic clause segmentation (`split_clauses`) with persistent clause identifiers (e.g. `ECHO-REQ-001.C1`).
   - Immutable requirement versioning snapshots (`RequirementVersion`) with cryptographic content hashing (`sha256`).
   - Strict 5-tier provenance attribution:
     - `Directly observed in source`
     - `Documented in README or technical documentation`
     - `Inferred from implementation`
     - `External assumption requiring verification`
     - `Unable to verify`
   - Automated ambiguity detection for vague, non-verifiable terms.

3. **Multi-Provider AI Orchestration**:
   - Dual live LLM engines: **Groq** (`openai/gpt-oss-120b`) and **Gemini** (`gemini-2.5-flash`).
   - Multi-key rotation across 3 slots per provider with automatic slot-level exponential backoff and circuit breakers.
   - Deterministic schema validation with max 2 Pydantic self-repair passes.

4. **Defense-in-Depth Execution Sandbox**:
   - Ephemeral POSIX isolation with resource limits (`RLIMIT_CPU`, `RLIMIT_AS`, `RLIMIT_FSIZE`, `RLIMIT_CORE`).
   - Network namespace gating via Linux `unshare -rn` and guard conftests blocking raw socket creation.
   - Multi-tiered execution support:
     - **Tier A**: Static AST and TypeScript build analysis.
     - **Tier B**: Local test-safe in-memory execution harness (`echobox_harness`).
     - **Tier C**: Live cloud integration probing (accurately recording upstream AWS 500 error boundaries).
     - **Browser E2E**: Playwright headless browser automation with console logging and artifact capture.

5. **Defect Management & Mathematical Traceability**:
   - Bidirectional traceability matrix: Requirement $\leftrightarrow$ Clause $\leftrightarrow$ Acceptance Criteria $\leftrightarrow$ Test Case $\leftrightarrow$ Execution $\leftrightarrow$ Defect.
   - Rigorous mathematical coverage calculation ($Coverage = \frac{|Covered\ Clauses|}{|Total\ Clauses|}$).
   - Automated root-cause failure analysis and retest verification workflows.

---

## Real-World Case Study: EchoBox Validation

TraceTest AI was validated against [sohan10012/EchoBox](https://github.com/sohan10012/EchoBox.git), an anonymous-first ephemeral conversation platform.

| Metric | Result |
| :--- | :--- |
| **Project Key** | `ECHO` |
| **Modules Detected** | 8 (`ECHO-ROOMS`, `ECHO-DISCOVERY`, `ECHO-CHAT`, `ECHO-OWNER`, `ECHO-IDENTITY`, `ECHO-EXPIRY`, `ECHO-SECURITY`, `ECHO-FRONTEND`) |
| **Requirements Extracted** | 21 Source-Grounded Requirements |
| **Clauses Segmented** | 62 Atomic Clauses |
| **Acceptance Criteria** | 21 Verifiable Acceptance Criteria |
| **Test Cases Generated** | 21 Automated Pytest / Contract Tests |
| **Tier B Local Execution** | **21 / 21 Passed** (100% pass rate in 1.9s) |
| **Tier C Live AWS Gateway** | **HTTP 500 Recorded** (Blocked upstream infrastructure, documented with request ID `[REQUEST-ID]`) |
| **Browser E2E Tests** | **Passed** (Captured `echobox-frontend-landing.png` and `echobox-join-validation.png`) |
| **Genuine Defects Logged** | 5 Verified Defects (`DEF-ECHO-001` through `DEF-ECHO-005`) |

---

## Quick Start

### 1. Environment Setup

```bash
# Clone repository
git clone https://github.com/sohan10012/TEAM3.git
cd TEAM3

# Python virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt -r backend/requirements-dev.txt

# Frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Configure Credentials

Copy `.env.example` to `.env` and populate your API credentials:

```bash
cp .env.example .env
```

Ensure `GROQ_KEY` and `GEMINI_KEY` are provided. The system automatically rotates across `GROQ_KEY`, `GROQ_KEY2`, `GROQ_KEY3`, and `GEMINI_KEY`, `GEMINI_KEY2`, `GEMINI_KEY3`.

### 3. Run Verification Pipeline

```bash
# Run backend pytest suite
PYTHONPATH=backend pytest backend/tests/

# Run frontend test suite
npm --prefix frontend test -- --run

# Execute full EchoBox end-to-end verification
PYTHONPATH=backend python backend/app/services/echobox_runner.py
```

### 4. Start Development Servers

```bash
# Start backend API (Port 8000)
PYTHONPATH=backend uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Start frontend UI (Port 5173)
npm --prefix frontend run dev
```

Visit `http://localhost:5173` to access the single-operator Dayforce and EchoBox QA Workspace.

---

## Documentation Directory

The complete technical documentation suite is organized across 26 modular guides:

- [Product Overview](PRODUCT_OVERVIEW.md)
- [System Architecture](architecture-legacy.md)
- [Repository Ingestion](REPOSITORY_IMPORT.md)
- [Requirements Engine](REQUIREMENTS_ENGINE.md)
- [Test Generation](TEST_GENERATION.md)
- [AI Provider Configuration](AI_PROVIDER_CONFIGURATION.md)
- [Execution Engine](EXECUTION_ENGINE.md)
- [EchoBox Case Study](ECHOBOX_CASE_STUDY.md)
- [EchoBox Requirements Catalog](ECHOBOX_REQUIREMENTS.md)
- [EchoBox Test Plan](ECHOBOX_TEST_PLAN.md)
- [EchoBox Execution Report](ECHOBOX_EXECUTION_REPORT.md)
- [Defect Management](DEFECT_MANAGEMENT.md)
- [Traceability and Coverage](TRACEABILITY_AND_COVERAGE.md)
- [Integrations Guide](INTEGRATIONS.md)
- [API Reference](API_REFERENCE.md)
- [Database Schema](DATABASE_SCHEMA.md)
- [Security Architecture](SECURITY.md)
- [Testing Guide](TESTING_GUIDE.md)
- [AI Quality Evaluation](AI_EVALUATION.md)
- [Production Deployment](DEPLOYMENT.md)
- [User Guide](USER_GUIDE.md)
- [System Limitations](LIMITATIONS.md)
- [Changelog](CHANGELOG.md)
- [Test Evidence Index](TEST_EVIDENCE_INDEX.md)
- [Milestones & Progress](progress-legacy.md)
- [OpenAPI Specification](openapi.json)

