# Benchmark Reproducibility & Replication Guide
## Phase 7 — Amazon AWS Independent Real-World Document Evaluation

**Target Organization:** Amazon Web Services (AWS)  
**Evaluation Phase:** Phase 7 — Final Independent Benchmark  
**Date:** November 17, 2026  
**Repository:** `/home/Sohan/PROJECTS/tracetest-ai`  
**Execution Environment:** Linux / POSIX Loopback (`127.0.0.1`)

---

## 1. Prerequisites & Environment Setup

### 1.1 Python Virtual Environment
Ensure Python 3.11+ is installed and active in the local virtual environment:

```bash
cd /home/Sohan/PROJECTS/tracetest-ai
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 1.2 Environment Variables Hygiene
Verify that `.env` is configured with clean provider routing (Gemini primary, Groq judge):

```bash
# Verify active environment variables
grep -E "TRACETEST_PRIMARY_PROVIDER|TRACETEST_JUDGE_PROVIDER|GEMINI_MODEL|GROQ_MODEL" .env
```
Expected output:
```
TRACETEST_PRIMARY_PROVIDER=gemini
TRACETEST_JUDGE_PROVIDER=groq
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=gemini-3.1-pro-preview
GROQ_MODEL=openai/gpt-oss-120b
```

### 1.3 Running Services
Ensure both backend and frontend servers are running:

```bash
# Backend (FastAPI on 127.0.0.1:8000)
cd backend && ../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 &

# Frontend (Vite on 127.0.0.1:5173)
cd frontend && npm run dev &
```

---

## 2. Source Document Verification

Ensure the official AWS source documents exist in `docs/evaluation/phase-7-amazon-aws/source-documents/` with verified cryptographic hashes:

```bash
cd /home/Sohan/PROJECTS/tracetest-ai/docs/evaluation/phase-7-amazon-aws/source-documents
sha256sum *
```

Expected checksums:
```
7e2a463a43b6f3bfb94776512845203254e220b88fbe36d88158c8c7a169a382  wellarchitected-security-pillar.pdf
3b6def5e219dc2b38041e775d2910853736935b23cb0dc4544e6b8557b0b68a8  s3-security-best-practices.html
991e147461b865628514666c1ee66a7f6815dea836b9a5563551d7a36118523f  securityhub-s3-controls.html
```

If missing, re-fetch directly from official AWS endpoints:
```bash
curl -sL https://docs.aws.amazon.com/pdfs/wellarchitected/latest/security-pillar/wellarchitected-security-pillar.pdf -o wellarchitected-security-pillar.pdf
curl -sL https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html -o s3-security-best-practices.html
curl -sL https://docs.aws.amazon.com/securityhub/latest/userguide/s3-controls.html -o securityhub-s3-controls.html
```

---

## 3. Automated End-to-End Benchmark Execution

Execute the standalone Phase 7 automated benchmark runner:

```bash
cd /home/Sohan/PROJECTS/tracetest-ai
PYTHONPATH=backend .venv/bin/python scripts/execute_phase7_amazon_aws_evaluation.py
```

The script will:
1. Initialize the `AWS_EVAL` project and capture the initial empty state.
2. Ingest all 3 official AWS documents and compute content hashes.
3. Extract 32 grounded requirements and 32 atomic clauses.
4. Synthesize 32 Given/When/Then acceptance criteria with quote verification.
5. Generate and dual-control approve 32 test cases.
6. Execute the test suite in the sandbox, recording 30 passes and 2 detected defects (`DEF-AWS-0001`, `DEF-AWS-0002`).
7. Capture 9 authentic browser screenshots into `docs/screenshots/phase-7-amazon-aws/`.
8. Generate `evaluation_results.json`.

---

## 4. Verification & Validation Commands

### 4.1 Automated Backend Isolation Tests
```bash
.venv/bin/pytest backend/tests/test_phase6_project_switcher_isolation.py backend/tests/test_phase6_cleanup_and_isolation.py backend/tests/test_config_hygiene.py backend/tests/test_judge.py backend/tests/test_llm_router.py
```
Expected result: **26 passed**.

### 4.2 Automated Frontend Vitest Suite
```bash
cd frontend && npx vitest run
```
Expected result: **23 passed (5 test files)**.

### 4.3 Database Record Integrity
```bash
PYTHONPATH=backend .venv/bin/python -c '
from app.db.base import session_scope
from app.db.models import Project, Document, Requirement, TestCase, Execution, Defect
with session_scope() as db:
    p = db.query(Project).filter(Project.key == "AWS_EVAL").first()
    print("Project:", p.name, "(ID:", p.id, ")")
    print("Documents:", db.query(Document).filter(Document.project_id == p.id).count())
    print("Requirements:", db.query(Requirement).filter(Requirement.project_id == p.id).count())
    print("Test Cases:", db.query(TestCase).filter(TestCase.project_id == p.id).count())
    print("Executions:", db.query(Execution).filter(Execution.project_id == p.id).count())
    print("Defects:", db.query(Defect).filter(Defect.project_id == p.id).count())
'
```
Expected output:
```
Project: Amazon AWS — Independent Security Documentation Evaluation (ID: 12 )
Documents: 3
Requirements: 32
Test Cases: 32
Executions: 1
Defects: 2
```

### 4.4 Screenshot Inventory Check
```bash
ls -lh docs/screenshots/phase-7-amazon-aws/
```
Expected: 9 PNG files capturing each evaluation stage (`01_aws_empty_workspace_initial_state.png` through `09_aws_project_dashboard_final.png`).

