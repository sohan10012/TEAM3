"""Phase 4 Enterprise Execution Intelligence & Results Management tests."""
from __future__ import annotations


def test_execution_metrics_and_governance(qa, admin):
    """Verifies that execution metrics return all 12 real database metrics and breakdowns."""
    projs = qa.get("/projects").json()["items"]
    assert len(projs) > 0
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    metrics_resp = qa.get(f"/projects/{proj_id}/execution-metrics")
    assert metrics_resp.status_code == 200, metrics_resp.text
    data = metrics_resp.json()

    # 12 real database metrics
    assert "total_runs" in data
    assert "latest_run" in data
    assert "total_tests_executed" in data
    assert "unique_tests_executed" in data
    assert "passed_tests" in data
    assert "failed_tests" in data
    assert "blocked_tests" in data
    assert "skipped_tests" in data
    assert "not_executed_tests" in data
    assert "pass_rate" in data
    assert "failure_rate" in data
    assert "avg_duration_ms" in data
    assert "open_defects" in data
    assert "flaky_tests_count" in data

    # Breakdowns
    assert "breakdowns" in data
    assert "by_runner" in data["breakdowns"]
    assert "by_category" in data["breakdowns"]
    assert "by_priority" in data["breakdowns"]
    assert "by_environment" in data["breakdowns"]
    assert "trends" in data
    assert isinstance(data["trends"], list)


def test_flaky_test_intelligence(qa):
    """Verifies evidence-based flaky test detection."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    resp = qa.get(f"/projects/{proj_id}/flaky-tests")
    assert resp.status_code == 200, resp.text
    flaky_list = resp.json()
    assert isinstance(flaky_list, list)

    if flaky_list:
        item = flaky_list[0]
        assert "test_case_id" in item
        assert "test_key" in item
        assert "flip_count" in item
        assert "confidence" in item
        assert "supporting_execution_ids" in item
        assert "recent_statuses" in item


def test_execution_run_comparison(qa):
    """Verifies historical comparison between two execution runs."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    execs_resp = qa.get(f"/executions?project_id={proj_id}&page_size=10")
    assert execs_resp.status_code == 200
    items = execs_resp.json().get("items", [])
    if len(items) >= 2:
        run_a_id = items[0]["id"]
        run_b_id = items[1]["id"]

        comp_resp = qa.get(f"/executions/{run_a_id}/compare/{run_b_id}")
        assert comp_resp.status_code == 200, comp_resp.text
        comp_data = comp_resp.json()

        assert "run_a" in comp_data
        assert "run_b" in comp_data
        assert "delta" in comp_data
        assert "summary" in comp_data
        assert "regressions" in comp_data
        assert "improvements" in comp_data
        assert "persistent_failures" in comp_data
        assert "all_comparisons" in comp_data


def test_execution_report_exports(qa):
    """Verifies multi-format report exports (JSON, CSV, Markdown)."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    execs_resp = qa.get(f"/executions?project_id={proj_id}&page_size=5")
    assert execs_resp.status_code == 200
    items = execs_resp.json().get("items", [])
    assert len(items) > 0
    target_ex_id = items[0]["id"]

    # 1. JSON Export
    json_resp = qa.get(f"/executions/{target_ex_id}/export.json")
    assert json_resp.status_code == 200
    assert json_resp.headers["content-type"].startswith("application/json")
    json_data = json_resp.json()
    assert "execution" in json_data
    assert "results" in json_data

    # 2. CSV Export
    csv_resp = qa.get(f"/executions/{target_ex_id}/export.csv")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "Result ID,Test Key" in csv_resp.text

    # 3. Markdown Export
    md_resp = qa.get(f"/executions/{target_ex_id}/export.md")
    assert md_resp.status_code == 200
    assert "text/markdown" in md_resp.headers["content-type"]
    assert "# TraceTest Execution Report" in md_resp.text


def test_enriched_execution_result_and_failure_analysis(qa):
    """Verifies expected vs actual result intelligence and AI failure investigation."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    execs_resp = qa.get(f"/executions?project_id={proj_id}&page_size=5")
    assert execs_resp.status_code == 200
    items = execs_resp.json().get("items", [])
    assert len(items) > 0
    target_ex_id = items[0]["id"]

    # Get results for this execution
    results_resp = qa.get(f"/executions/{target_ex_id}")
    assert results_resp.status_code == 200
    results = results_resp.json().get("results", [])
    assert len(results) > 0
    res_id = results[0]["id"]

    # GET /execution-results/{result_id}
    res_resp = qa.get(f"/execution-results/{res_id}")
    assert res_resp.status_code == 200, res_resp.text
    res_data = res_resp.json()

    assert "comparison_matrix" in res_data
    assert len(res_data["comparison_matrix"]) == 4
    for dim in res_data["comparison_matrix"]:
        assert "dimension" in dim
        assert "expected" in dim
        assert "actual" in dim
        assert "status" in dim

    assert "test_case" in res_data
    assert "execution_history" in res_data

    # POST /execution-results/{result_id}/analyze
    analyze_resp = qa.post(f"/execution-results/{res_id}/analyze", json={}, headers={"X-CSRF-Token": qa.csrf})
    assert analyze_resp.status_code == 200, analyze_resp.text
    analysis_data = analyze_resp.json()

    assert "failure_category" in analysis_data
    assert "root_cause_hypothesis" in analysis_data
    assert "supporting_evidence" in analysis_data
    assert "is_hypothetical" in analysis_data
    assert analysis_data["is_hypothetical"] is True


def test_defect_creation_from_execution_result(qa):
    """Verifies defect creation directly from an execution result."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    # Look for execution with failed results
    execs_resp = qa.get(f"/executions?project_id={proj_id}&page_size=25")
    items = execs_resp.json().get("items", [])
    target_ex_id = None
    target_res_id = None
    for ex in items:
        if ex.get("failed", 0) > 0:
            target_ex_id = ex["id"]
            results_resp = qa.get(f"/executions/{target_ex_id}")
            for r in results_resp.json().get("results", []):
                if r.get("status") in ("failed", "error", "timed_out"):
                    target_res_id = r["id"]
                    break
            if target_res_id:
                break

    if not target_res_id:
        # Fall back to first execution and first result
        target_ex_id = items[0]["id"]
        results_resp = qa.get(f"/executions/{target_ex_id}")
        target_res_id = results_resp.json().get("results", [])[0]["id"]

    payload = {
        "action": "create",
        "title": f"Phase 4 Integration Defect for RES-{target_res_id}",
        "severity": "high",
        "priority": "p1",
        "description": "Observed execution divergence during Phase 4 integration testing.",
        "expected_result": "Simulation calculation should succeed without discrepancies.",
        "actual_result": "Calculation encountered multiplier dispute.",
    }

    create_resp = qa.post(
        f"/execution-results/{target_res_id}/defects",
        json=payload,
        headers={"X-CSRF-Token": qa.csrf},
    )
    assert create_resp.status_code == 200, create_resp.text
    defect_data = create_resp.json()

    assert "id" in defect_data
    assert defect_data["title"] == payload["title"]
    assert defect_data["execution_result_id"] == target_res_id
    assert defect_data["execution_id"] == target_ex_id



def test_test_case_execution_history_endpoint(qa):
    """Verifies GET /tests/{test_id}/execution-history."""
    projs = qa.get("/projects").json()["items"]
    proj = next((p for p in projs if p["key"] == "DAYFORCE"), projs[0])
    proj_id = proj["id"]

    tests_resp = qa.get(f"/tests?project_id={proj_id}&page_size=5")
    assert tests_resp.status_code == 200
    tests = tests_resp.json().get("items", [])
    assert len(tests) > 0
    target_tc_id = tests[0]["id"]

    hist_resp = qa.get(f"/tests/{target_tc_id}/execution-history")
    assert hist_resp.status_code == 200, hist_resp.text
    hist_data = hist_resp.json()

    assert isinstance(hist_data, list)
    if hist_data:
        assert "result_id" in hist_data[0]
        assert "execution_key" in hist_data[0]
        assert "status" in hist_data[0]
        assert "duration_ms" in hist_data[0]
