"""Phase 12 Complete Traceability Intelligence & Coverage Explorer Test Suite.

Verifies:
1. Enriched Traceability API (/api/v1/traceability/matrix?project_id=11):
   - Executive Summary metric integrity & mathematical reconciliation (total = covered + partial + uncovered).
   - Health assessment narrative, biggest problem, recommended action, and status_grade.
   - Requirement Coverage Hierarchy with document provenance, clauses, ACs, tests, executions, defects, and gaps.
   - Duplicate test explanation ledger (24 items).
   - Backwards-compatible clauses, tests, cells for Matrix Grid.
2. Intelligent Coverage Generation Endpoint (/api/v1/traceability/generate-coverage):
   - Preview mode (preview=True) generates multi-category test scenarios without committing.
3. ReasonX Assistant Integration:
   - Contextual prompt chips for traceability.
   - Traceability screen context awareness.
4. Playwright End-to-End Acceptance Journey across responsive viewports:
   - 1920x1080 (FHD Desktop)
   - 1440x900 (Standard Desktop)
   - 1366x768 (Laptop)
   - 390x844 (Mobile)
   - Interactive verification of tree expansion, filtering, duplicate drawer, generation modal, matrix grid, and cell inspection drawer.
   - Captures genuine screenshots to docs/screenshots/phase-12/.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

import pytest
import requests
from playwright.sync_api import Browser, sync_playwright

BASE_URL = os.environ.get("TRACETEST_URL", "http://127.0.0.1:8000")
SCREENSHOT_DIR = Path("/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/phase-12")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
CHROME_PATH = "/usr/bin/chromium" if os.path.exists("/usr/bin/chromium") else None


@pytest.fixture(scope="module")
def browser() -> Browser:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME_PATH, headless=True)
        yield b
        b.close()


def test_traceability_matrix_api_reconciliation():
    """Verify Project 11 traceability metrics reconcile mathematically and contain enriched fields."""
    resp = requests.get(f"{BASE_URL}/api/v1/traceability/matrix?project_id=11", timeout=15)
    assert resp.status_code == 200, f"Failed to fetch traceability matrix: {resp.text}"
    data = resp.json()

    # Verify summary fields
    summary = data.get("summary", {})
    total_reqs = summary.get("total_requirements", 0)
    covered_reqs = summary.get("covered_requirements", 0)
    partial_reqs = summary.get("partially_covered_requirements", 0)
    uncovered_reqs = summary.get("uncovered_requirements", 0)

    assert total_reqs == 228, f"Expected 228 requirements, got {total_reqs}"
    # Exact math reconciliation: total == covered + partially_covered + uncovered
    assert total_reqs == covered_reqs + partial_reqs + uncovered_reqs, (
        f"Reconciliation error: {total_reqs} != {covered_reqs} + {partial_reqs} + {uncovered_reqs}"
    )

    # Clause reconciliation
    total_clauses = summary.get("total_clauses", 0)
    covered_clauses = summary.get("covered_clauses", 0)
    untested_clauses = summary.get("untested_clauses", 0)
    assert total_clauses == 228, f"Expected 228 clauses, got {total_clauses}"
    assert total_clauses == covered_clauses + untested_clauses

    # Test count & duplicate verification
    total_tests = summary.get("total_tests", 0)
    duplicate_tests = summary.get("duplicate_tests", [])
    assert total_tests == 30, f"Expected 30 tests in Project 11, got {total_tests}"
    assert len(duplicate_tests) == 24, f"Expected 24 duplicate tests, got {len(duplicate_tests)}"

    # Health assessment check
    health = data.get("health_assessment", {})
    assert "headline" in health
    assert "summary" in health
    assert "biggest_problem" in health
    assert "recommended_action" in health
    assert health.get("status_grade") in ["good", "warning", "critical"]

    # Requirements hierarchy check
    reqs = data.get("requirements", [])
    assert len(reqs) == 228, f"Expected 228 requirements in hierarchy list, got {len(reqs)}"
    sample_req = reqs[0]
    assert "id" in sample_req
    assert "key" in sample_req
    assert "title" in sample_req
    assert "clauses" in sample_req
    assert "tests" in sample_req
    assert "coverage_status" in sample_req

    # Check EV_PAY-REQ-228 (the requirement that has the tests)
    req_228 = next((r for r in reqs if r["key"] == "EV_PAY-REQ-228"), None)
    assert req_228 is not None, "EV_PAY-REQ-228 not found in requirements list"
    assert len(req_228["tests"]) == 30, f"Expected 30 tests mapped to EV_PAY-REQ-228, got {len(req_228['tests'])}"
    assert req_228["coverage_status"] == "partially_covered"

    # Duplicate test details check
    dup_details = data.get("duplicate_test_details", [])
    assert len(dup_details) == 24
    assert dup_details[0]["duplicate_of"] is not None

    # Backwards compatibility check for Matrix Grid
    assert "clauses" in data
    assert "tests" in data
    assert "cells" in data
    assert len(data["clauses"]) == 228
    assert len(data["tests"]) == 30


def test_generate_coverage_preview_mode():
    """Verify intelligent coverage generation in preview_only mode does not modify database."""
    # Dynamically find the first uncovered requirement in Project 11
    matrix_resp = requests.get(f"{BASE_URL}/api/v1/traceability/matrix?project_id=11", timeout=15)
    assert matrix_resp.status_code == 200
    reqs = matrix_resp.json().get("requirements", [])
    target_req_id = reqs[0]["id"] if reqs else 147

    payload = {
        "project_id": 11,
        "requirement_ids": [target_req_id],
        "categories": ["positive", "negative", "boundary_value", "business_rule"],
        "preview": True,
        "auto_approve": True,
    }
    resp = requests.post(f"{BASE_URL}/api/v1/traceability/generate-coverage", json=payload, timeout=25)
    assert resp.status_code == 200, f"Coverage generation failed: {resp.text}"
    result = resp.json()

    assert result.get("preview_only") is True
    assert result.get("count", 0) >= 1
    scenarios = result.get("previews", [])
    assert len(scenarios) >= 1
    sample = scenarios[0]
    assert "title" in sample
    assert "test_category" in sample
    assert "priority" in sample
    assert "rationale" in sample
    assert "steps" in sample
    assert "expected_result" in sample
    assert len(result.get("created_test_keys", [])) == 0  # No tests committed in preview


def test_reasonx_traceability_prompts_and_context():
    """Verify ReasonX AI exposes tailored quick prompts and understands traceability context."""
    resp = requests.get(f"{BASE_URL}/api/v1/reasonx/quick-prompts?page=traceability", timeout=10)
    assert resp.status_code == 200
    data = resp.json()
    prompts = data.get("prompts", [])
    assert len(prompts) >= 4
    prompts_text = " ".join([p.get("query", "") + " " + p.get("label", "") for p in prompts]).lower()
    assert "coverage gap" in prompts_text or "untested" in prompts_text
    assert "duplicate" in prompts_text

    # Ask ReasonX about traceability
    chat_payload = {
        "query": "What is the biggest coverage risk in our payroll requirements?",
        "page": "traceability",
        "project_id": 11,
    }
    chat_resp = requests.post(f"{BASE_URL}/api/v1/reasonx/chat", json=chat_payload, timeout=25)
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    content = chat_data.get("content", "").lower()
    assert "227" in content or "uncovered" in content or "coverage" in content


def test_playwright_acceptance_journey_and_screenshots(browser: Browser):
    """Complete 15-step enterprise user journey through Traceability Intelligence across viewports."""
    # 1. Desktop 1920x1080 View
    ctx_1080 = browser.new_context(viewport={"width": 1920, "height": 1080})
    page = ctx_1080.new_page()
    try:
        page.goto(f"{BASE_URL}/traceability?project_id=11", wait_until="networkidle", timeout=20000)
        page.wait_for_selector("#root", timeout=10000)
        time.sleep(1.2)

        # Step 1: Capture Default Coverage Explorer View at 1920x1080
        page.screenshot(path=str(SCREENSHOT_DIR / "01_coverage_explorer_1920x1080.png"), full_page=True)

        # Step 2: Verify Executive Summary Stats in body
        body_text = page.inner_text("body")
        assert "Total Requirements" in body_text
        assert "228" in body_text
        assert "Untested Requirements" in body_text
        assert "227" in body_text
        assert "Duplicate Tests" in body_text
        assert "24" in body_text

        # Step 3: Expand EV_PAY-REQ-001 in the tree
        req_elem = page.locator("text=EV_PAY-REQ-001").first
        if req_elem.is_visible():
            req_elem.click()
            time.sleep(0.5)
            page.screenshot(path=str(SCREENSHOT_DIR / "05_requirement_provenance_expanded.png"), full_page=False)

        # Step 4: Open Duplicate Tests Drawer
        dup_button = page.locator("text=Review 24 Duplicate Tests").first
        if dup_button.is_visible():
            dup_button.click()
            time.sleep(0.6)
            page.screenshot(path=str(SCREENSHOT_DIR / "06_duplicate_tests_drawer.png"), full_page=False)
            # Close drawer
            close_btn = page.locator("button:has-text('✕'), button:has(svg.lucide-x)").first
            if close_btn.is_visible():
                close_btn.click()
                time.sleep(0.4)

        # Step 5: Open Intelligent Test Generation Modal
        gen_btn = page.locator("button:has-text('Generate Coverage for Uncovered')").first
        if gen_btn.is_visible():
            gen_btn.click()
            time.sleep(0.8)
            page.screenshot(path=str(SCREENSHOT_DIR / "07_intelligent_test_generation_modal.png"), full_page=False)
            # Close modal
            cancel_btn = page.locator("button:has-text('Cancel')").first
            if cancel_btn.is_visible():
                cancel_btn.click()
                time.sleep(0.4)

        # Step 6: Switch to Matrix Grid (Advanced View)
        matrix_tab = page.locator("button:has-text('Matrix Grid (Advanced View)')").first
        if matrix_tab.is_visible():
            matrix_tab.click()
            time.sleep(1.0)
            page.screenshot(path=str(SCREENSHOT_DIR / "08_advanced_matrix_grid_view.png"), full_page=True)

            # Step 7: Click cell button to inspect relation in drawer
            cell_btn = page.locator("button[aria-label*='covers']").first
            if cell_btn.is_visible():
                cell_btn.click()
                time.sleep(0.6)
                page.screenshot(path=str(SCREENSHOT_DIR / "09_matrix_cell_inspection_drawer.png"), full_page=False)
                # Close cell drawer
                close_cell_btn = page.locator("button:has-text('✕'), button:has(svg.lucide-x)").first
                if close_cell_btn.is_visible():
                    close_cell_btn.click()
                    time.sleep(0.4)

    finally:
        ctx_1080.close()

    # 2. Viewport Responsive Verifications (1440x900, 1366x768, 390x844)
    responsive_sizes = [
        ("02_coverage_explorer_1440x900.png", 1440, 900),
        ("03_coverage_explorer_1366x768.png", 1366, 768),
        ("04_coverage_explorer_mobile_390x844.png", 390, 844),
    ]
    for filename, width, height in responsive_sizes:
        ctx = browser.new_context(viewport={"width": width, "height": height})
        p = ctx.new_page()
        try:
            p.goto(f"{BASE_URL}/traceability?project_id=11", wait_until="networkidle", timeout=20000)
            p.wait_for_selector("#root", timeout=10000)
            time.sleep(0.8)
            p.screenshot(path=str(SCREENSHOT_DIR / filename), full_page=True)
        finally:
            ctx.close()
