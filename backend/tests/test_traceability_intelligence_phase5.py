"""Phase 5 Enterprise Traceability Intelligence & Coverage Governance tests."""
from __future__ import annotations

import pytest


def test_traceability_overview_metrics(qa):
    """Verifies that traceability overview returns database-grounded governance metrics."""
    projs = qa.get("/projects").json()["items"]
    assert len(projs) > 0
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    resp = qa.get(f"/projects/{proj_id}/traceability/overview")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Verify requirements metrics
    assert "total_requirements" in data
    assert data["total_requirements"] > 0
    assert "requirements_with_clauses" in data
    assert "fully_covered_requirements" in data
    assert "partially_covered_requirements" in data
    assert "untested_requirements" in data
    assert "requirement_coverage_pct" in data
    assert data["total_requirements"] == data["requirements_with_clauses"] + data["requirements_without_clauses"]
    assert data["total_requirements"] == data["fully_covered_requirements"] + data["partially_covered_requirements"] + data["untested_requirements"]

    # Verify clauses metrics
    assert "total_clauses" in data
    assert data["total_clauses"] >= 0
    assert "clause_coverage_pct" in data

    # Verify AC metrics
    assert "total_acceptance_criteria" in data
    assert "acs_with_linked_tests" in data
    assert "acs_without_linked_tests" in data
    assert data["total_acceptance_criteria"] == data["acs_with_linked_tests"] + data["acs_without_linked_tests"]
    assert "ac_coverage_pct" in data
    assert 0.0 <= data["ac_coverage_pct"] <= 100.0

    # Verify test cases metrics
    assert "total_test_cases" in data
    assert "executed_test_cases" in data
    assert "tests_with_passing_results" in data
    assert "tests_with_failing_results" in data
    assert data["total_test_cases"] == data["executed_test_cases"] + data["tests_never_executed"]
    assert "execution_coverage_pct" in data
    assert 0.0 <= data["execution_coverage_pct"] <= 100.0
    assert "passing_execution_pct" in data
    assert 0.0 <= data["passing_execution_pct"] <= 100.0

    # Verify defects metrics
    assert "open_defects" in data
    assert "data_freshness_timestamp" in data


def test_coverage_health_assessment(qa):
    """Verifies coverage health scoring and transparent calculation breakdown."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    resp = qa.get(f"/projects/{proj_id}/traceability/health")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "status_grade" in data
    assert data["status_grade"] in ("good", "warning", "critical")
    assert "composite_score" in data
    assert 0.0 <= data["composite_score"] <= 100.0
    assert "headline" in data
    assert "summary" in data
    assert "methodology" in data
    assert "components" in data["methodology"]
    assert "requirement_coverage" in data["methodology"]["components"]
    assert "ac_coverage" in data["methodology"]["components"]
    assert "execution_coverage" in data["methodology"]["components"]
    assert "pass_rate" in data["methodology"]["components"]
    assert "defect_penalty" in data["methodology"]["components"]

    assert "critical_uncovered_requirements" in data
    assert "high_risk_uncovered_acs" in data
    assert "unresolved_linked_defects" in data
    assert "key_risks" in data
    assert "recommended_priorities" in data


def test_traceability_hierarchy(qa):
    """Verifies 7-level hierarchy construction from requirements down to defects."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    resp = qa.get(f"/projects/{proj_id}/traceability/hierarchy?page=1&page_size=10")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "nodes" in data
    assert "total" in data
    assert len(data["nodes"]) > 0

    first_req = data["nodes"][0]
    assert first_req["type"] == "requirement"
    assert "clauses" in first_req
    assert "acceptance_criteria" in first_req

    if first_req["clauses"]:
        c = first_req["clauses"][0]
        assert c["type"] == "clause"
        assert "clause_key" in c

    if first_req["acceptance_criteria"]:
        ac = first_req["acceptance_criteria"][0]
        assert ac["type"] == "acceptance_criteria"
        assert "key" in ac
        assert "tests" in ac
        if ac["tests"]:
            t = ac["tests"][0]
            assert t["type"] == "test_case"
            assert "latest_result" in t
            assert "defects" in t


def test_coverage_gaps_detection(qa):
    """Verifies 10-category gap detection engine."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    resp = qa.get(f"/projects/{proj_id}/traceability/gaps")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "total_gaps" in data
    assert data["total_gaps"] > 0
    assert "gaps" in data

    # Check for presence of gaps
    categories = {g["category"] for g in data["gaps"]}
    assert any(c in categories for c in ("ac_no_tests", "clause_no_ac", "req_failing_tests", "req_unresolved_defects", "test_never_executed"))

    sample_gap = data["gaps"][0]
    assert "gap_id" in sample_gap
    assert "category" in sample_gap
    assert "entity_key" in sample_gap
    assert "severity" in sample_gap
    assert "evidence" in sample_gap
    assert "why_it_matters" in sample_gap
    assert "recommended_action" in sample_gap
    assert "navigation_link" in sample_gap


def test_coverage_recommendations(qa):
    """Verifies evidence-grounded recommendations for QA leadership."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    resp = qa.get(f"/projects/{proj_id}/traceability/recommendations")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "recommendations" in data
    assert len(data["recommendations"]) > 0

    first_rec = data["recommendations"][0]
    assert "id" in first_rec
    assert "type" in first_rec
    assert "title" in first_rec
    assert "priority" in first_rec
    assert "evidence" in first_rec
    assert "reason" in first_rec
    assert "proposed_action" in first_rec
    assert "expected_coverage_improvement" in first_rec
    assert first_rec["requires_human_approval"] is True


def test_advanced_coverage_matrix(qa):
    """Verifies 2D coverage matrix generation across Req-by-AC and Req-by-Test."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    # Test Req-by-AC
    resp_ac = qa.get(f"/projects/{proj_id}/traceability/matrix?matrix_type=req_by_ac&limit=10")
    assert resp_ac.status_code == 200, resp_ac.text
    data_ac = resp_ac.json()
    assert data_ac["matrix_type"] == "req_by_ac"
    assert "rows" in data_ac
    assert len(data_ac["rows"]) > 0

    # Test Req-by-Test
    resp_test = qa.get(f"/projects/{proj_id}/traceability/matrix?matrix_type=req_by_test&limit=10")
    assert resp_test.status_code == 200, resp_test.text
    data_test = resp_test.json()
    assert data_test["matrix_type"] == "req_by_test"


def test_traceability_audit_ledger_and_recording(qa):
    """Verifies audit ledger retrieval and event recording."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    # 1. Fetch audit ledger
    resp = qa.get(f"/projects/{proj_id}/traceability/audit")
    assert resp.status_code == 200, resp.text
    ledger = resp.json()
    assert isinstance(ledger, list)

    # 2. Record new traceability event
    post_resp = qa.post(
        f"/projects/{proj_id}/traceability/audit",
        json={
            "action": "traceability.relationship_reviewed",
            "entity_type": "requirement",
            "entity_id": 91,
            "entity_key": "DAY-REQ-001",
            "details": {"reviewer": "qa_lead", "status": "verified"},
        },
        headers={"X-CSRF-Token": qa.csrf},
    )
    assert post_resp.status_code == 200, post_resp.text
    entry = post_resp.json()
    assert entry["action"] == "traceability.relationship_reviewed"
    assert entry["entity_key"] == "DAY-REQ-001"


def test_requirement_and_ac_impact_analysis(qa):
    """Verifies downstream change impact analysis on requirements and acceptance criteria."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    # 1. Get a requirement
    reqs = qa.get(f"/requirements?project_id={proj_id}&page_size=5").json()["items"]
    target_req = reqs[0]
    req_id = target_req["id"]

    impact_resp = qa.get(f"/requirements/{req_id}/impact-analysis")
    assert impact_resp.status_code == 200, impact_resp.text
    impact_data = impact_resp.json()

    assert "requirement_key" in impact_data or "requirement" in impact_data
    assert "affected_clauses" in impact_data
    assert "affected_acceptance_criteria" in impact_data
    assert "affected_test_cases" in impact_data
    assert "revalidation_instructions" in impact_data

    # 2. Get an acceptance criterion
    acs = qa.get(f"/requirements/{req_id}/acceptance-criteria").json()
    if acs:
        ac_id = acs[0]["id"]
        ac_impact_resp = qa.get(f"/acceptance-criteria/{ac_id}/impact-analysis")
        assert ac_impact_resp.status_code == 200, ac_impact_resp.text
        ac_data = ac_impact_resp.json()
        assert ac_data["ac_id"] == ac_id
        assert "linked_tests" in ac_data
        assert "revalidation_instructions" in ac_data


def test_traceability_export_formats(qa):
    """Verifies multi-format report export in JSON, CSV, and Markdown."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    # 1. JSON
    json_resp = qa.get(f"/projects/{proj_id}/traceability/export.json")
    assert json_resp.status_code == 200
    assert "application/json" in json_resp.headers["content-type"]
    assert "attachment" in json_resp.headers["content-disposition"]
    assert "overview" in json_resp.json()

    # 2. CSV
    csv_resp = qa.get(f"/projects/{proj_id}/traceability/export.csv")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "attachment" in csv_resp.headers["content-disposition"]
    assert "COVERAGE GAPS" in csv_resp.text

    # 3. Markdown
    md_resp = qa.get(f"/projects/{proj_id}/traceability/export.md")
    assert md_resp.status_code == 200
    assert "text/markdown" in md_resp.headers["content-type"]
    assert "attachment" in md_resp.headers["content-disposition"]
    assert "# TraceTest Traceability Intelligence" in md_resp.text


def test_project_scoping_and_isolation(qa):
    """Verifies cross-project boundary security."""
    invalid_resp = qa.get("/projects/999999/traceability/overview")
    assert invalid_resp.status_code in (404, 403)
