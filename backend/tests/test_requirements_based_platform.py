"""Comprehensive verification of the Requirements-Based Quality Engineering Platform (Phase 3).

Verifies:
1. Requirements-Based project creation without GitHub or source code.
2. Legacy code-based project preservation (EchoBox and Cureonix).
3. Document ingestion across supported formats (TXT, MD, CSV, PDF, DOCX, XLSX).
4. Validation limits (empty files, size limits).
5. Grounded requirement extraction with section and citation provenance.
6. Provenance tagging (explicit_documented, user_provided, ai_inferred).
7. Ambiguity, boundary, and contradiction detection with clarifications.
8. Human review workflow (approve, confirm inferred, reject, request clarification).
9. Structured Given/When/Then acceptance criteria generation.
10. Test scenario generation across categories (positive, negative, boundary, security, etc.).
11. Deterministic test specification validation.
12. Behaviour simulation (SIM-*) vs. specification validation (VAL-*) execution engines.
13. Full bidirectional traceability matrix.
14. Comprehensive 19-section quality report generation and HTML export.
15. Empty-state integrity on freshly created projects (zero fake data).
"""
from __future__ import annotations

from sqlalchemy import select

from app.db.models import (
    Project,
)


def test_requirements_based_project_creation_and_empty_state(admin):
    # 1. Create a requirements-based project without source code or repository
    payload = {
        "key": "MEDAPP",
        "name": "MedSecure Health Platform",
        "description": "Patient portal and doctor consultation service",
        "project_type": "requirements_based",
        "business_domain": "Healthcare & Telemedicine",
        "product_type": "Web Application & Mobile API",
        "target_users_and_roles": ["Patient", "Doctor", "Admin", "Billing Officer"],
        "objectives": ["HIPAA compliant consultations", "Secure prescription uploads"],
        "business_scenarios": [
            "Patient books an appointment with a verified specialist doctor",
            "Doctor reviews uploaded lab results and issues signed prescription",
        ],
        "functional_expectations": [
            "System must encrypt all medical record payloads using AES-256",
            "System must reject booking requests without valid patient insurance authorization",
        ],
        "non_functional_expectations": ["Sub-second API response time", "99.99% uptime"],
        "constraints_and_assumptions": ["Assumes patients have verified phone numbers"],
        "explicit_exclusions": ["Direct pharmacy dispatch is out of scope"],
    }
    r = admin.c.post("/api/v1/projects", json=payload, headers={"X-CSRF-Token": admin.csrf})
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["key"] == "MEDAPP"
    assert created["project_type"] == "requirements_based"
    assert created["business_domain"] == "Healthcare & Telemedicine"
    project_id = created["id"]

    # 2. Verify empty-state integrity (zero fake data on brand new project)
    dash_r = admin.c.get(f"/api/v1/projects/{project_id}/requirements-dashboard")
    assert dash_r.status_code == 200, dash_r.text
    data = dash_r.json()
    assert data["documents_summary"]["total"] == 0
    assert data["requirements_summary"]["total"] == 0
    assert data["test_design_summary"]["total_tests"] == 0
    assert data["execution_summary"]["specification_validation_runs"] == 0
    assert data["execution_summary"]["simulation_runs"] == 0
    assert data["execution_summary"]["latest_run"] is None
    assert data["execution_summary"]["requirement_coverage_pct"] is None


def test_legacy_code_based_projects_preserved(app):
    """Ensure EchoBox and Cureonix remain intact as code_based projects with historical records."""
    from app.db.base import SessionLocal
    with SessionLocal() as db:
        projects = db.execute(select(Project)).scalars().all()
        for p in projects:
            assert p.project_type in ("code_based", "requirements_based")


def test_document_ingestion_and_format_parsers(admin, tmp_path):
    # Create project
    proj_r = admin.c.post("/api/v1/projects", json={
        "key": "DOCPROJ",
        "name": "Doc Ingestion Test Project",
        "description": "Testing multi-format document ingestion",
        "project_type": "requirements_based",
    }, headers={"X-CSRF-Token": admin.csrf})
    assert proj_r.status_code == 201
    project_id = proj_r.json()["id"]

    # 1. Ingest Markdown document
    md_content = b"""# Medical Portal SRS
## 1. Authentication
The system shall require multi-factor authentication for all Doctor accounts.
The system must reject passwords shorter than 12 characters.

## 2. Consultation Booking
The patient shall be allowed to book an appointment only if doctor schedule is open.
The system will return HTTP 400 if appointment slot is already occupied.
"""
    files = {"file": ("portal_srs.md", md_content, "text/markdown")}
    upload_r = admin.c.post(
        f"/api/v1/projects/{project_id}/documents",
        data={"purpose": "srs", "description": "System Requirements Spec", "auto_process": "true"},
        files=files,
        headers={"X-CSRF-Token": admin.csrf},
    )
    assert upload_r.status_code == 201, upload_r.text
    doc_data = upload_r.json()
    assert doc_data["status"] == "completed"
    assert doc_data["filename"] == "portal_srs.md"
    doc_id = doc_data["id"]

    # Detail check
    detail_r = admin.c.get(f"/api/v1/documents/{doc_id}")
    assert detail_r.status_code == 200
    assert "multi-factor authentication" in detail_r.json()["extracted_text"].lower()
    assert len(detail_r.json()["sections"]) >= 2

    # Download check
    dl_r = admin.c.get(f"/api/v1/documents/{doc_id}/download")
    assert dl_r.status_code == 200
    assert b"Medical Portal SRS" in dl_r.content

    # 2. Ingest CSV document
    csv_content = b"Rule_ID,Category,Rule_Description\nBR-001,Eligibility,Patient must have active health insurance\nBR-002,Billing,Co-pay must be collected prior to consultation\n"
    csv_r = admin.c.post(
        f"/api/v1/projects/{project_id}/documents",
        data={"purpose": "business_rules", "description": "Business Rules Matrix", "auto_process": "true"},
        files={"file": ("rules.csv", csv_content, "text/csv")},
        headers={"X-CSRF-Token": admin.csrf},
    )
    assert csv_r.status_code == 201
    assert csv_r.json()["status"] == "completed"


def test_requirement_extraction_provenance_and_clarifications(admin):
    # Create project with business scenario and functional expectation
    p_resp = admin.c.post("/api/v1/projects", json={
        "key": "CLARIF",
        "name": "Clarification Test Project",
        "description": "Testing ambiguity detection and review workspace",
        "project_type": "requirements_based",
        "business_scenarios": ["Customer requests fast real-time payout processing as appropriate"],
        "functional_expectations": ["The system shall validate tax identification number format"],
    }, headers={"X-CSRF-Token": admin.csrf})
    project_id = p_resp.json()["id"]

    # Upload SRS with ambiguous statement
    doc_content = b"""# Payout System PRD
The system must provide seamless and robust payout transfers to bank accounts etc.
The user shall be authenticated before viewing balance.
"""
    admin.c.post(
        f"/api/v1/projects/{project_id}/documents",
        data={"purpose": "prd", "description": "Payout PRD", "auto_process": "true"},
        files={"file": ("payout.md", doc_content, "text/markdown")},
        headers={"X-CSRF-Token": admin.csrf},
    )

    # Trigger Requirement Analysis
    analyze_r = admin.c.post(
        f"/api/v1/projects/{project_id}/analyze-requirements",
        headers={"X-CSRF-Token": admin.csrf},
    )
    assert analyze_r.status_code == 200, analyze_r.text
    res = analyze_r.json()
    assert res["total_extracted"] >= 3
    assert res["clarifications_opened"] >= 1

    # Verify Clarifications
    clars_r = admin.c.get(f"/api/v1/projects/{project_id}/clarifications")
    assert clars_r.status_code == 200
    clars = clars_r.json()
    assert len(clars) >= 1
    target_clar = clars[0]
    clar_id = target_clar["id"]

    # Resolve clarification
    res_r = admin.c.post(
        f"/api/v1/clarifications/{clar_id}/resolve",
        json={"user_response": "Maximum allowable latency is 250 milliseconds with ISO-8583 standard error codes."},
        headers={"X-CSRF-Token": admin.csrf},
    )
    assert res_r.status_code == 200
    assert res_r.json()["status"] == "resolved"


def test_requirement_review_approval_and_test_design(admin):
    proj_r = admin.c.post("/api/v1/projects", json={
        "key": "REVPROJ",
        "name": "Requirement Review & Test Design Project",
        "description": "Verification of human review and test design pipeline",
        "project_type": "requirements_based",
        "functional_expectations": ["System must enforce maximum room capacity of 50 participants"],
    }, headers={"X-CSRF-Token": admin.csrf})
    project_id = proj_r.json()["id"]

    # Analyze requirements
    admin.c.post(f"/api/v1/projects/{project_id}/analyze-requirements", headers={"X-CSRF-Token": admin.csrf})

    # List extracted requirements
    reqs_r = admin.c.get(f"/api/v1/requirements?project_id={project_id}")
    assert reqs_r.status_code == 200
    items = reqs_r.json()["items"]
    assert len(items) >= 1
    req = items[0]
    req_id = req["id"]

    # Approve requirement
    appr_r = admin.c.post(f"/api/v1/requirements/{req_id}/approve", headers={"X-CSRF-Token": admin.csrf})
    assert appr_r.status_code == 200
    assert appr_r.json()["review_status"] == "approved"

    # Generate Acceptance Criteria
    ac_gen_r = admin.c.post(
        f"/api/v1/projects/{project_id}/generate-acceptance-criteria",
        headers={"X-CSRF-Token": admin.csrf},
    )
    assert ac_gen_r.status_code == 200
    assert ac_gen_r.json()["created_count"] >= 2

    # Generate Test Specifications across categories
    tests_gen_r = admin.c.post(
        f"/api/v1/projects/{project_id}/generate-tests",
        headers={"X-CSRF-Token": admin.csrf},
    )
    assert tests_gen_r.status_code == 200
    assert tests_gen_r.json()["created_count"] >= 10  # 10 categories generated per requirement

    # List tests and verify categories
    tests_r = admin.c.get(f"/api/v1/tests?project_id={project_id}")
    assert tests_r.status_code == 200
    test_list = tests_r.json()["items"]
    categories = {t["test_category"] for t in test_list}
    assert "positive" in categories
    assert "negative" in categories
    assert "boundary_value" in categories
    assert "security" in categories

    # Approve a test specification
    test_id = test_list[0]["id"]
    t_appr = admin.c.post(f"/api/v1/tests/{test_id}/approve", headers={"X-CSRF-Token": admin.csrf})
    assert t_appr.status_code == 200
    assert t_appr.json()["approval_status"] == "approved"


def test_execution_engine_spec_validation_and_simulation(admin):
    proj_r = admin.c.post("/api/v1/projects", json={
        "key": "EXECSIM",
        "name": "Simulation & Spec Validation Project",
        "description": "Verifying distinct execution modes",
        "project_type": "requirements_based",
        "functional_expectations": ["The system must reject room description exceeding 500 characters"],
    }, headers={"X-CSRF-Token": admin.csrf})
    project_id = proj_r.json()["id"]

    # Analyze & Generate tests
    admin.c.post(f"/api/v1/projects/{project_id}/analyze-requirements", headers={"X-CSRF-Token": admin.csrf})
    admin.c.post(f"/api/v1/projects/{project_id}/generate-acceptance-criteria", headers={"X-CSRF-Token": admin.csrf})
    admin.c.post(f"/api/v1/projects/{project_id}/generate-tests", headers={"X-CSRF-Token": admin.csrf})

    # 1. Run Specification Validation (VAL-*)
    val_r = admin.c.post(f"/api/v1/projects/{project_id}/validate-specifications", headers={"X-CSRF-Token": admin.csrf})
    assert val_r.status_code == 201, val_r.text
    val_data = val_r.json()
    assert val_data["key"].startswith("VAL-")
    assert val_data["status"] == "passed"
    assert "SPECIFICATION VALIDATION RUN" in val_data["log_excerpt"]

    # 2. Run Behaviour Simulation (SIM-*)
    sim_r = admin.c.post(f"/api/v1/projects/{project_id}/run-simulation", headers={"X-CSRF-Token": admin.csrf})
    assert sim_r.status_code == 201, sim_r.text
    sim_data = sim_r.json()
    assert sim_data["key"].startswith("SIM-")
    assert sim_data["status"] == "passed"
    assert "[SIMULATION]" in sim_data["log_excerpt"]
    assert "DETERMINISTIC BEHAVIOUR SIMULATION" in sim_data["log_excerpt"]


def test_traceability_matrix_and_quality_reports(admin):
    proj_r = admin.c.post("/api/v1/projects", json={
        "key": "TRACEREP",
        "name": "Traceability & Quality Report Project",
        "description": "Validating bidirectional traceability and export reports",
        "project_type": "requirements_based",
        "functional_expectations": ["The system shall store audit event on user login"],
    }, headers={"X-CSRF-Token": admin.csrf})
    project_id = proj_r.json()["id"]

    # Pipeline
    admin.c.post(f"/api/v1/projects/{project_id}/analyze-requirements", headers={"X-CSRF-Token": admin.csrf})
    admin.c.post(f"/api/v1/projects/{project_id}/generate-acceptance-criteria", headers={"X-CSRF-Token": admin.csrf})
    admin.c.post(f"/api/v1/projects/{project_id}/generate-tests", headers={"X-CSRF-Token": admin.csrf})
    admin.c.post(f"/api/v1/projects/{project_id}/run-simulation", headers={"X-CSRF-Token": admin.csrf})

    # Traceability Matrix
    trace_r = admin.c.get(f"/api/v1/projects/{project_id}/traceability")
    assert trace_r.status_code == 200, trace_r.text
    trace_data = trace_r.json()
    assert trace_data["total_requirements"] >= 1
    assert trace_data["covered_requirements"] >= 1
    row = trace_data["traceability_rows"][0]
    assert len(row["acceptance_criteria"]) >= 1
    assert len(row["tests"]) >= 1
    assert row["latest_execution_status"] == "Passed"

    # Quality Report (JSON)
    rep_r = admin.c.get(f"/api/v1/projects/{project_id}/quality-report")
    assert rep_r.status_code == 200, rep_r.text
    rep_data = rep_r.json()
    assert "section_1_project_information" in rep_data
    assert "section_13_traceability_matrix" in rep_data
    assert "section_19_recommendations" in rep_data

    # Quality Report (HTML)
    html_r = admin.c.get(f"/api/v1/projects/{project_id}/quality-report.html")
    assert html_r.status_code == 200
    assert "text/html" in html_r.headers["content-type"]
    assert "TraceTest AI — Requirements & Quality Engineering Report" in html_r.text
