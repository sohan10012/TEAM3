# REST API Reference — TraceTest AI

## 1. Overview

TraceTest AI exposes a fully typed REST API conforming to OpenAPI 3.1.0 specifications. All API endpoints are prefixed with `/api/v1` and return JSON payloads.

---

## 2. Core API Endpoints

### 2.0 Authentication & Session
- `POST /api/v1/auth/login`: Authenticate operator and establish session cookie.
- `GET /api/v1/auth/me`: Retrieve current principal identity, roles, and project permissions.
- `POST /api/v1/auth/logout`: Revoke active session.
- `GET /api/v1/auth/csrf`: Retrieve CSRF protection token.

### 2.1 Projects & Documents
- `GET /api/v1/projects`: List accessible projects with calculated coverage and defect statistics.
- `POST /api/v1/projects`: Create a new project workspace (defaults to `requirements_based`).
- `POST /api/v1/projects/import-repo`: Ingest an external repository (e.g. EchoBox), extract architecture, and formulate requirements.
- `GET /api/v1/projects/{id}`: Retrieve project detail including modules, environments, and members.
- `PATCH /api/v1/projects/{id}`: Update project metadata or archive workspace.
- `GET /api/v1/projects/{id}/dashboard`: Telemetry summary for code-based project dashboard.
- `GET /api/v1/projects/{id}/requirements-dashboard`: Telemetry summary for requirements-based project dashboard.
- `POST /api/v1/projects/{id}/documents/upload`: Upload multi-format document (`.pdf`, `.docx`, `.xlsx`, `.csv`, `.txt`, `.md`).
- `GET /api/v1/projects/{id}/documents`: List uploaded documents with parsing status and hash.
- `GET /api/v1/documents/{document_id}`: Retrieve document details, extracted text, and section structure.
- `POST /api/v1/documents/{document_id}/process`: Trigger extraction of requirements from document.

### 2.2 Requirements & Clarifications
- `GET /api/v1/projects/{id}/requirements`: List requirements for a project with clause counts and status.
- `POST /api/v1/projects/{id}/requirements`: Create a new versioned requirement.
- `GET /api/v1/requirements/{id}`: Retrieve requirement detail, active version, clauses, and ambiguity flags.
- `PATCH /api/v1/requirements/{id}`: Update requirement text, creating an immutable `RequirementVersion` snapshot.
- `POST /api/v1/requirements/{id}/analyse`: Trigger AI requirement analysis, clause splitting, and rule extraction.
- `POST /api/v1/requirements/{id}/generate-acs`: Trigger AI acceptance criteria generation.
- `POST /api/v1/requirements/{id}/generate-acceptance-criteria`: Generate structured Given/When/Then acceptance criteria.
- `GET /api/v1/requirements/{id}/clarifications`: List ambiguities, contradictions, and clarification questions.
- `POST /api/v1/requirements/{id}/clarifications`: Create or resolve a clarification question.
- `POST /api/v1/projects/{id}/requirements/batch-approve`: Batch approve or confirm inferred requirements.

### 2.3 Test Cases & Scenario Design
- `GET /api/v1/projects/{id}/tests`: List test cases with filter parameters (type, priority, status).
- `POST /api/v1/projects/{id}/requirements/{req_id}/generate-tests`: Trigger AI test generation.
- `POST /api/v1/projects/{id}/requirements/{req_id}/generate-test-scenarios`: Generate 10-category test scenarios (positive, negative, boundary, security, etc.).
- `GET /api/v1/tests/{id}`: Retrieve test case detail, script source, and validation status.
- `PATCH /api/v1/tests/{id}`: Update test script or metadata (creates `TestCaseVersion`).
- `POST /api/v1/tests/{id}/review`: Review test case (`approve`, `reject`, `request_changes`).

### 2.4 Executions & Behavior Simulation
- `GET /api/v1/projects/{id}/executions`: List executions with duration and pass/fail counts.
- `POST /api/v1/projects/{id}/executions`: Queue a test suite execution against a target environment.
- `GET /api/v1/executions/{key}`: Retrieve execution outcomes, per-test results, and log excerpts.
- `GET /api/v1/executions/{key}/artifacts/{kind}`: Download execution artifacts (logs, JUnit XML, screenshots).
- `GET /api/v1/executions/{key}/report.junit`: Download standard JUnit XML execution report.
- `GET /api/v1/executions/{key}/report.html`: Download interactive standalone HTML execution report.
- `POST /api/v1/projects/{id}/simulations/validate-specifications`: Run deterministic static specification validation (generates `VAL-XXXXXX`).
- `POST /api/v1/projects/{id}/simulations/run-behavior`: Execute behavioral state-machine simulation (generates `SIM-XXXXXX`).
- `GET /api/v1/projects/{id}/simulations/models`: List available domain simulation models.

### 2.5 Traceability & Quality Reports
- `GET /api/v1/projects/{id}/traceability-matrix`: Generate complete bidirectional traceability matrix.
- `POST /api/v1/projects/{id}/quality-reports`: Generate 19-section enterprise quality engineering report.
- `GET /api/v1/projects/{id}/quality-reports`: List historical quality reports for project.
- `GET /api/v1/quality-reports/{report_id}`: Retrieve quality report JSON payload.
- `GET /api/v1/quality-reports/{report_id}/download.html`: Download standalone interactive HTML quality report.

### 2.6 Defects
- `GET /api/v1/projects/{id}/defects`: List defects with severity, priority, and status.
- `POST /api/v1/projects/{id}/defects`: Log a new defect linked to a failed execution result.
- `GET /api/v1/defects/{id}`: Retrieve defect detail, reproduction steps, and AI root-cause analysis.
- `PATCH /api/v1/defects/{id}`: Transition defect status (`triaged`, `in_progress`, `fixed`, `verified`).
- `POST /api/v1/defects/{id}/retest`: Trigger automated retest execution against candidate fix environment.

### 2.7 Settings & Diagnostics
- `GET /api/v1/settings/llm/status`: Return live AI provider health, active models, and circuit breaker states.
- `POST /api/v1/settings/llm/test`: Perform diagnostic test ping against specified provider (`groq`, `gemini`, `ollama`).

---

## 3. Standard Response Format & Error Handling

### Standard Error Envelope
All errors return consistent JSON payloads:
```json
{
  "error": "Bad Request",
  "detail": "Room name cannot exceed 100 characters",
  "status_code": 400
}
```

### HTTP Status Code Conventions
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Input validation error.
- `401 Unauthorized`: Missing or invalid credentials.
- `403 Forbidden`: Caller lacks authorization for entity.
- `404 Not Found`: Target resource does not exist.
- `409 Conflict`: Business rule violation (e.g. duplicate project key).
- `410 Gone`: Ephemeral resource has reached its expiration ceiling.
- `413 Payload Too Large`: Request body exceeds 64KB limit.
- `500 Internal Server Error`: Unhandled server exception.

