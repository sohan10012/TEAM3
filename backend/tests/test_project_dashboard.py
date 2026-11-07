"""Tests for Project Dashboard telemetry, aggregation, and report generation."""
from __future__ import annotations

import pytest
from sqlalchemy.orm import sessionmaker

from app.core.config import REPO_ROOT
from app.db.base import make_engine
from app.services.project_dashboard import (
    get_project_dashboard_data,
)


def get_real_db_session():
    """Returns a session bound to the real application database var/tracetest.db."""
    real_db_path = REPO_ROOT / "var" / "tracetest.db"
    if not real_db_path.exists():
        pytest.skip("Production database var/tracetest.db not found")
    engine = make_engine(f"sqlite:///{real_db_path}")
    Session = sessionmaker(bind=engine)
    return Session()


def test_get_project_dashboard_echobox_real_db():
    """Verify aggregated dashboard telemetry for EchoBox (project 5) in var/tracetest.db."""
    with get_real_db_session() as db:
        data = get_project_dashboard_data(db, 5)

        # 1. Project Header & Metadata
        p = data["project"]
        assert p["id"] == 5
        assert "EchoBox" in p["name"]
        assert p["health_status"] == "healthy"
        assert p["repository"]["branch"] == "main"
        assert p["repository"]["url"] is not None

        # 2. Test Summary (6 metric cards)
        s = data["summary"]
        assert s["total_requirements"] == 21
        assert s["total_clauses"] == 62
        assert s["total_test_cases"] == 21
        assert s["tests_per_requirement"] == 1.0
        assert s["open_defects"] == 6
        assert s["critical_defects"] == 1
        assert s["latest_duration_seconds"] is not None
        assert s["latest_duration_seconds"] > 0

        # 3. Quality & Coverage
        q = data["quality_coverage"]
        assert q["requirement_coverage_pct"] == 100.0
        assert q["requirement_covered_count"] == 21
        assert q["clause_covered_count"] == 47
        assert q["clause_coverage_pct"] == 75.8
        assert q["test_pass_rate_pct"] == 100.0

        # 4. Tabs & Details
        assert len(data["recent_runs"]) == 9
        assert data["requirements_tab"]["total"] == 21
        assert data["defects_tab"]["total_open"] == 6
        assert len(data["defects_tab"]["items"]) == 6
        assert len(data["configuration"]["environments"]) >= 1

        # 5. Execution Details Card & Reports
        latest_ex = data["latest_execution"]
        assert latest_ex is not None
        assert latest_ex["junit_url"].startswith("/api/v1/executions/")
        assert latest_ex["html_url"].startswith("/api/v1/executions/")

        # 6. Requirements Status & Recent Activity
        req_status = {item["status"]: item["count"] for item in data["requirements_status"]}
        assert "Verified" in req_status
        assert req_status["Verified"] == 21
        assert len(data["recent_activity"]) > 0


def test_get_project_dashboard_cureonix_empty_state_real_db():
    """Verify clean empty-state integrity for freshly imported Cureonix (project 8) in var/tracetest.db."""
    with get_real_db_session() as db:
        data = get_project_dashboard_data(db, 8)

        # 1. Real Ingested Requirements & Clauses
        p = data["project"]
        assert p["id"] == 8
        assert "Cureonix" in p["name"]
        assert p["health_status"] == "not_tested"

        # 2. Summary must show ZERO tests, ZERO runs, ZERO defects, and None duration
        s = data["summary"]
        assert s["total_requirements"] == 23
        assert s["total_clauses"] == 32
        assert s["total_test_cases"] == 0
        assert s["tests_per_requirement"] == 0.0
        assert s["passed_tests"] == 0
        assert s["failed_tests"] == 0
        assert s["open_defects"] == 0
        assert s["critical_defects"] == 0
        assert s["latest_duration_seconds"] is None
        assert s["latest_run_id"] is None
        assert s["latest_run_key"] is None

        # 3. Quality & Coverage must have None pass rate (rendered as '—' on UI)
        q = data["quality_coverage"]
        assert q["requirement_coverage_pct"] == 0.0
        assert q["clause_coverage_pct"] == 0.0
        assert q["test_pass_rate_pct"] is None
        assert q["pass_rate_passed"] == 0
        assert q["pass_rate_total"] == 0

        # 4. Runs and Execution Details must be empty
        assert len(data["recent_runs"]) == 0
        assert data["latest_execution"] is None

        # 5. Open defects must be zero
        assert data["defects_tab"]["total_open"] == 0
        assert len(data["defects_tab"]["items"]) == 0


def test_project_dashboard_api_endpoints(admin):
    """Test REST API endpoint GET /projects/{id}/dashboard."""
    # List projects in test environment
    proj_resp = admin.get("/projects?page_size=10")
    assert proj_resp.status_code == 200
    items = proj_resp.json()["items"]
    assert len(items) > 0
    target_project = items[0]

    r_dash = admin.get(f"/projects/{target_project['id']}/dashboard")
    assert r_dash.status_code == 200
    res_dash = r_dash.json()
    assert res_dash["project"]["id"] == target_project["id"]
    assert "summary" in res_dash
    assert "quality_coverage" in res_dash
    assert "requirements_tab" in res_dash
    assert "defects_tab" in res_dash
    assert "configuration" in res_dash

    # Non-existent project -> 404
    r_404 = admin.get("/projects/999999/dashboard")
    assert r_404.status_code == 404


def test_junit_and_html_report_generation(admin):
    """Test JUnit XML and HTML report endpoints for execution runs."""
    # Find an execution in the test environment
    ex_resp = admin.get("/executions?page_size=1")
    assert ex_resp.status_code == 200
    ex_items = ex_resp.json()["items"]
    if not ex_items:
        pytest.skip("No executions in test suite")

    target_ex = ex_items[0]
    ex_id = target_ex["id"]
    ex_key = target_ex["key"]

    # JUnit report
    r_junit = admin.get(f"/executions/{ex_id}/report.junit")
    assert r_junit.status_code == 200
    assert "application/xml" in r_junit.headers.get("content-type", "")
    assert b"<testsuites" in r_junit.content

    # HTML report
    r_html = admin.get(f"/executions/{ex_id}/report.html")
    assert r_html.status_code == 200
    assert "text/html" in r_html.headers.get("content-type", "")
    assert b"<!DOCTYPE html>" in r_html.content
    assert b"TraceTest AI" in r_html.content
    assert ex_key.encode() in r_html.content
