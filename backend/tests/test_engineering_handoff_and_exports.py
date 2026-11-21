"""Tests for Engineering Handoff, Role-Based Reports & Complete Project Exports."""
from __future__ import annotations

import io
import json

import openpyxl
import pytest

from app.db.base import session_scope
from app.db.models import Project
from app.services.engineering_handoff import (
    build_automation_agent_report,
    build_complete_project_package,
    build_developer_handoff_report,
    build_executive_management_report,
    build_integration_engineer_report,
    build_product_owner_report,
    build_qa_engineer_report,
    export_granular_slice,
    format_role_markdown,
    generate_multi_sheet_xlsx,
)


@pytest.fixture
def target_project_id(app) -> int:
    with session_scope() as db:
        p = db.query(Project).filter(Project.key.in_(["ASPME3", "ASPME2"])).first()
        if not p:
            p = db.query(Project).first()
        return p.id


def test_role_handoff_reports_authoritative_data(app, target_project_id):
    """Verify all 6 role-based reports generate accurately from persisted records."""
    with session_scope() as db:
        # 1. Developer
        dev = build_developer_handoff_report(db, target_project_id)
        assert dev["report_type"] == "developer_handoff"
        assert dev["requirements_count"] > 0
        assert "requirements" in dev
        assert "acceptance_criteria" in dev["requirements"][0]
        dev_md = format_role_markdown(dev, "developer")
        assert len(dev_md) > 500
        assert "Acceptance Criteria" in dev_md

        # 2. QA
        qa = build_qa_engineer_report(db, target_project_id)
        assert qa["report_type"] == "qa_engineer_report"
        assert "coverage_metrics" in qa
        assert "test_cases" in qa
        qa_md = format_role_markdown(qa, "qa")
        assert len(qa_md) > 200

        # 3. AI Automation Agent
        agent = build_automation_agent_report(db, target_project_id)
        assert agent["report_type"] == "automation_ai_agent_pack"
        assert agent["schema_version"] == "2.0.0"
        assert "agent_instructions" in agent
        assert "demarcation_rules" in agent
        assert "execution_disclaimer" in agent
        agent_md = format_role_markdown(agent, "automation_agent")
        assert "[FACT: SPECIFICATION]" in agent_md

        # 4. Integration
        integ = build_integration_engineer_report(db, target_project_id)
        assert integ["report_type"] == "integration_specification"
        assert "actors_and_systems" in integ
        assert "integration_requirements" in integ

        # 5. Product Owner
        po = build_product_owner_report(db, target_project_id)
        assert po["report_type"] == "product_owner_pack"
        assert "business_objective" in po
        assert "requirements_summary" in po

        # 6. Executive
        exec_rep = build_executive_management_report(db, target_project_id)
        assert exec_rep["report_type"] == "executive_management_report"
        assert "readiness_score" in exec_rep
        assert "score_breakdown" in exec_rep


def test_complete_project_package_schema_v2(app, target_project_id):
    """Verify versioned Complete Project Package satisfies Schema 2.0.0 invariants."""
    with session_scope() as db:
        pkg = build_complete_project_package(db, target_project_id)
        assert pkg["schema_version"] == "2.0.0"
        assert "$schema" in pkg
        assert "project" in pkg
        assert "requirements" in pkg
        assert "acceptance_criteria" in pkg
        assert "test_cases" in pkg
        assert "traceability_matrix" in pkg
        assert "coverage_summary" in pkg
        assert "release_decision" in pkg

        # Check no credentials leaked
        pkg_str = json.dumps(pkg)
        assert "api_key" not in pkg_str.lower()
        assert "secret" not in pkg_str.lower() or "secret_key" not in pkg_str.lower()
        assert "password" not in pkg_str.lower()


def test_multi_sheet_xlsx_workbook_validity(app, target_project_id):
    """Verify multi-sheet XLSX workbook generates correctly and opens with openpyxl."""
    with session_scope() as db:
        xlsx_bytes = generate_multi_sheet_xlsx(db, target_project_id)
        assert len(xlsx_bytes) > 5000

        wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
        expected_sheets = [
            "Executive Summary",
            "Requirements",
            "Acceptance Criteria",
            "Test Cases",
            "Traceability Matrix",
            "Critical Quality Gaps",
        ]
        for sheet_name in expected_sheets:
            assert sheet_name in wb.sheetnames
            ws = wb[sheet_name]
            assert ws.max_row >= 2  # Has header + at least one data row


def test_granular_export_all_entities_and_formats(app, target_project_id):
    """Verify granular slices export across CSV, JSON, Markdown, and XLSX."""
    entities = [
        "requirements",
        "acceptance_criteria",
        "test_cases",
        "traceability_matrix",
        "executions",
        "defects",
        "uncovered_requirements",
    ]
    formats = ["csv", "json", "markdown", "xlsx"]

    with session_scope() as db:
        for entity in entities:
            for fmt in formats:
                content, media_type, filename = export_granular_slice(
                    db, target_project_id, entity, fmt=fmt
                )
                assert len(content) > 0, f"Empty export for {entity}.{fmt}"
                assert filename.endswith(f".{fmt}")
                if fmt == "json":
                    parsed = json.loads(content)
                    assert isinstance(parsed, list)
                elif fmt == "xlsx":
                    wb = openpyxl.load_workbook(io.BytesIO(content))
                    assert len(wb.sheetnames) >= 1


def test_project_isolation_in_handoff_exports(app):
    """Verify exporting Project A never includes Project B data."""
    with session_scope() as db:
        projects = db.query(Project).all()
        if len(projects) < 2:
            pytest.skip("Requires at least two projects for isolation test")

        p1, p2 = projects[0], projects[1]
        pkg1 = build_complete_project_package(db, p1.id)
        pkg2 = build_complete_project_package(db, p2.id)

        p1_req_keys = {r["key"] for r in pkg1["requirements"]}
        p2_req_keys = {r["key"] for r in pkg2["requirements"]}

        # Disjoint requirement keys
        assert len(p1_req_keys.intersection(p2_req_keys)) == 0


def test_unexecuted_project_reports_zero_runs_truthfully(app, target_project_id):
    """Verify that unexecuted projects report N/A pass rate rather than 100%."""
    from app.services.engineering_handoff import gather_project_engineering_data
    with session_scope() as db:
        data = gather_project_engineering_data(db, target_project_id)
        exec_rep = build_executive_management_report(db, target_project_id)

        if len(data["executions"]) == 0:
            assert "0 Runs" in exec_rep["key_metrics"]["execution_pass_rate"] or "N/A" in exec_rep["key_metrics"]["execution_pass_rate"]
        else:
            assert "%" in exec_rep["key_metrics"]["execution_pass_rate"]


def test_handoff_api_endpoints_via_testclient(admin, target_project_id):
    """Verify the FastAPI router endpoints respond with 200 and valid payloads."""
    # 1. Developer handoff JSON
    r = admin.get(f"/projects/{target_project_id}/intelligence-report/handoff/developer?format=json")
    assert r.status_code == 200
    data = r.json()
    assert data["report_type"] == "developer_handoff"

    # 2. QA handoff Markdown
    r = admin.get(f"/projects/{target_project_id}/intelligence-report/handoff/qa?format=markdown")
    assert r.status_code == 200
    assert "text/markdown" in r.headers["content-type"]
    assert "QA Test Pack" in r.text

    # 3. AI Agent handoff JSON
    r = admin.get(f"/projects/{target_project_id}/intelligence-report/handoff/automation_agent?format=json")
    assert r.status_code == 200
    assert r.json()["schema_version"] == "2.0.0"

    # 4. Complete Package JSON
    r = admin.get(f"/projects/{target_project_id}/intelligence-report/complete-package?format=json")
    assert r.status_code == 200
    assert r.json()["schema_version"] == "2.0.0"

    # 5. Complete Package XLSX
    r = admin.get(f"/projects/{target_project_id}/intelligence-report/complete-package?format=xlsx")
    assert r.status_code == 200
    assert "openxmlformats" in r.headers["content-type"]

    # 6. Granular Export CSV
    r = admin.get(f"/projects/{target_project_id}/intelligence-report/granular-export?entity=requirements&format=csv")
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert len(r.content) > 100
