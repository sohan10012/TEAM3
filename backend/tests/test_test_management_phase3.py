from __future__ import annotations

import pytest


def test_test_management_phase3_endpoints(qa, reviewer, admin):
    # 1. Fetch project list and select Dayforce project (or first project)
    projs = qa.get("/projects").json()["items"]
    assert len(projs) > 0
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    # 2. Test GET /projects/{project_id}/test-metrics
    metrics_resp = qa.get(f"/projects/{proj_id}/test-metrics")
    assert metrics_resp.status_code == 200
    metrics = metrics_resp.json()

    # Verify 12 core database-backed metrics
    expected_metric_keys = [
        "total_tests",
        "approved_tests",
        "pending_review",
        "automated_tests",
        "manual_tests",
        "executed_tests",
        "passed_tests",
        "failed_tests",
        "blocked_tests",
        "unexecuted_tests",
        "without_requirement",
        "without_acceptance_criteria",
    ]
    for k in expected_metric_keys:
        assert k in metrics, f"Missing metric key: {k}"
        assert isinstance(metrics[k], int)

    # Verify breakdown fields
    assert "by_category" in metrics
    assert "by_automation" in metrics
    assert "by_priority" in metrics
    assert "by_execution_capability" in metrics
    assert "uncovered_ac_count" in metrics
    assert "total_ac_count" in metrics
    assert "ac_coverage_pct" in metrics
    assert metrics["total_tests"] >= metrics["approved_tests"]

    # 3. Test Two-Stage Test Generation Workflow Stage A: PREVIEW
    preview_resp = qa.post(
        f"/projects/{proj_id}/generate-tests/preview",
        json={
            "categories": ["positive", "negative", "boundary_value", "security"],
            "target_uncovered_acs_only": True,
            "limit": 6,
        },
        headers={"X-CSRF-Token": qa.csrf},
    )
    assert preview_resp.status_code == 200
    preview_data = preview_resp.json()
    assert preview_data["project_id"] == proj_id
    assert "previews" in preview_data
    candidates = preview_data["previews"]
    assert len(candidates) > 0

    first_cand = candidates[0]
    assert "temp_id" in first_cand
    assert "requirement_id" in first_cand
    assert "title" in first_cand
    assert "test_category" in first_cand
    assert "steps" in first_cand
    assert len(first_cand["steps"]) >= 1
    assert "expected_result" in first_cand
    assert "ac_keys" in first_cand
    assert "is_duplicate" in first_cand
    assert "confidence" in first_cand

    # 4. Test Two-Stage Test Generation Workflow Stage B: COMMIT
    # Select 2 candidate tests to commit
    to_commit = candidates[:2]
    commit_resp = qa.post(
        f"/projects/{proj_id}/generate-tests/commit",
        json={
            "test_cases": to_commit,
            "auto_approve": False,
        },
        headers={"X-CSRF-Token": qa.csrf},
    )
    assert commit_resp.status_code == 200
    commit_data = commit_resp.json()
    assert commit_data["project_id"] == proj_id
    assert commit_data["created_count"] == len(to_commit)
    assert len(commit_data["created_keys"]) == len(to_commit)

    created_key = commit_data["created_keys"][0]

    # Verify committed test appears in test list
    list_resp = qa.get(f"/tests?project_id={proj_id}&q={created_key}")
    assert list_resp.status_code == 200
    listed_items = list_resp.json()["items"]
    assert any(t["key"] == created_key for t in listed_items)
    created_tc = next(t for t in listed_items if t["key"] == created_key)
    created_id = created_tc["id"]

    # 5. Test enriched GET /tests/{test_id}
    detail_resp = qa.get(f"/tests/{created_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["id"] == created_id
    assert detail["key"] == created_key

    # Check enriched 12-section drawer data
    assert "requirement" in detail
    assert "clauses" in detail
    assert "acceptance_criteria" in detail
    assert "defects" in detail
    assert "reviews" in detail
    assert "versions" in detail
    assert "recent_results" in detail
    assert "audit_logs" in detail

    # 6. Test POST /tests/{test_id}/execute
    exec_resp = qa.post(
        f"/tests/{created_id}/execute",
        headers={"X-CSRF-Token": qa.csrf},
    )
    assert exec_resp.status_code == 200
    exec_result = exec_resp.json()
    assert "test_case_id" in exec_result
    assert exec_result["test_case_id"] == created_id
    assert exec_result["status"] in ("passed", "failed")
    assert "duration_ms" in exec_result
    assert "comparison" in exec_result

    # 7. Verify that after execution, GET /tests/{test_id} reflects the new execution
    after_exec = qa.get(f"/tests/{created_id}").json()
    assert len(after_exec["recent_results"]) >= 1
    assert after_exec["latest_result"] is not None
    assert after_exec["latest_result"]["status"] == exec_result["status"]

