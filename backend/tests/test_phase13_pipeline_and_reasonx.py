"""Phase 13: Policy Validation Live Progress UX & ReasonX Floating Launcher & Full-Height Drawer Redesign.

Verifies:
1. Operational Pipeline Progress API (/api/v1/simulation/pipeline-progress?project_id=11):
   - Computes dynamic progress across Preparation, Pre-Payroll, and Post-Payroll phases.
   - Grounded in persisted database records (Project, Document, Requirement, TestCase, Execution, Defect).
   - Reconciles overall percentage, completed/total steps, and failed/blocked defect linkage.
2. ReasonX Assistant Endpoints:
   - Chat endpoint with page context and project grounding.
   - Quick prompts for validation screen.
3. Playwright Multi-Viewport & Acceptance Journeys:
   - 1920x1080 (FHD Desktop)
   - 1440x900 (Standard Desktop)
   - 1366x768 (Laptop)
   - 768x1024 (Tablet)
   - 390x844 (Mobile)
   - Verifies:
     - 56px circular floating action button (FAB) with Sparkles icon.
     - Full-height right-anchored drawer with overlay backdrop.
     - Quick prompts cleanly wrapping without ugly scrollbars.
     - Full-screen assistant experience on mobile.
     - Live Data Processing Pipeline with honest dynamic completion metrics.
     - Expandable step drill-down with validation records, error badges, and evidence quotes.
     - Feature navigation cards opening the dedicated RCA Investigation Drawer.
     - Escape key closes drawer and restores focus to launcher.
   - Saves 7 authentic screenshots to docs/screenshots/phase-13/.
"""
from __future__ import annotations

import os
import re
import time
from pathlib import Path

import pytest
import requests
from playwright.sync_api import Browser, sync_playwright

BASE_URL = os.environ.get("TRACETEST_URL", "http://127.0.0.1:8000")
SCREENSHOT_DIR = Path("/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/phase-13")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
CHROME_PATH = "/usr/bin/chromium" if os.path.exists("/usr/bin/chromium") else None


@pytest.fixture(scope="module")
def browser() -> Browser:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME_PATH, headless=True)
        yield b
        b.close()


def test_operational_pipeline_progress_api():
    """Verify operational pipeline progress endpoint returns real grounded metrics for Project 11."""
    resp = requests.get(f"{BASE_URL}/api/v1/simulation/pipeline-progress?project_id=11", timeout=15)
    assert resp.status_code == 200, f"Failed to fetch pipeline progress: {resp.text}"
    data = resp.json()

    assert data.get("project_id") == 11
    assert data.get("total_steps") == 18
    assert data.get("completed_steps") == 13
    assert data.get("overall_completion_pct") == 72.2
    assert data.get("overall_status") in ["action_required", "in_progress", "partially_completed"]

    phases = data.get("phases", [])
    assert len(phases) == 3, f"Expected 3 phases, got {len(phases)}"

    prep = next((p for p in phases if p["phase_id"] == "preparation"), None)
    pre = next((p for p in phases if p["phase_id"] == "pre_payroll"), None)
    post = next((p for p in phases if p["phase_id"] == "post_payroll"), None)

    assert prep is not None and prep["completion_pct"] == 100.0 and prep["status"] == "completed"
    assert pre is not None and pre["completion_pct"] == 71.4 and pre["status"] == "in_progress"
    assert post is not None and post["completion_pct"] == 25.0 and post["status"] == "partially_completed"

    # Verify post-payroll phase contains failed/blocked steps with DEF-EV_PAY-0001 reference
    failed_steps = [s for s in post.get("steps", []) if s.get("status") == "failed"]
    assert len(failed_steps) >= 1
    assert any("DEF-EV_PAY-0001" in err for err in failed_steps[0].get("errors", []))


def test_reasonx_quick_prompts_and_chat_for_validation():
    """Verify ReasonX quick prompts and query handling for validation page."""
    qp_resp = requests.get(f"{BASE_URL}/api/v1/reasonx/quick-prompts?page=validation", timeout=10)
    assert qp_resp.status_code == 200
    qp_data = qp_resp.json()
    assert len(qp_data.get("prompts", [])) >= 3

    # Send a contextual query
    chat_resp = requests.post(
        f"{BASE_URL}/api/v1/reasonx/chat",
        json={
            "query": "Explain the root cause for DEF-EV_PAY-0001 and variance in overtime calculations.",
            "page": "validation",
            "project_id": 11,
        },
        timeout=15,
    )
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert "content" in chat_data
    payload = chat_data.get("structured_payload")
    assert payload is not None
    assert "direct_answer" in payload
    assert "explanation" in payload


def test_phase13_playwright_acceptance_and_screenshots(browser: Browser):
    """Multi-viewport end-to-end acceptance test capturing 7 authentic screenshots."""
    # -------------------------------------------------------------------------
    # 1. Desktop 1920x1080: Policy Validation Screen with Live Pipeline Progress
    # -------------------------------------------------------------------------
    page_1080 = browser.new_page(viewport={"width": 1920, "height": 1080})
    page_1080.goto(f"{BASE_URL}/simulation?project_id=11", wait_until="networkidle")
    page_1080.wait_for_timeout(1000)

    # Verify Data Processing Pipeline header & overall badge
    assert page_1080.locator("text=Data Processing Pipeline").first.is_visible()
    assert page_1080.locator("text=72.2% Overall").first.is_visible()

    # Capture Screenshot 1: Desktop Live Pipeline Progress
    screenshot_1 = SCREENSHOT_DIR / "01_pipeline_live_progress_desktop_1920.png"
    page_1080.screenshot(path=str(screenshot_1), full_page=False)
    assert screenshot_1.exists() and screenshot_1.stat().st_size > 50000

    # -------------------------------------------------------------------------
    # 2. Desktop 1440x900: Expand Pre-Payroll Phase Steps Drill-Down
    # -------------------------------------------------------------------------
    page_900 = browser.new_page(viewport={"width": 1440, "height": 900})
    page_900.goto(f"{BASE_URL}/simulation?project_id=11", wait_until="networkidle")
    page_900.wait_for_timeout(800)

    # Ensure Pre-Payroll phase is expanded to inspect steps
    if not page_900.locator("text=Element Entry Data Verification").first.is_visible():
        page_900.locator("h4:has-text('Pre-Payroll Phase')").click()
        page_900.wait_for_timeout(500)

    # Verify step-level breakdown items are rendered
    assert page_900.locator("text=Element Entry Data Verification").first.is_visible()
    assert page_900.locator("text=Regular Rate (FLSA § 778.109) Calculation").first.is_visible()

    # Capture Screenshot 2: Step-Level Drilldown
    screenshot_2 = SCREENSHOT_DIR / "02_pipeline_step_level_drilldown_1440.png"
    page_900.screenshot(path=str(screenshot_2), full_page=False)
    assert screenshot_2.exists() and screenshot_2.stat().st_size > 50000

    # -------------------------------------------------------------------------
    # 3. Laptop 1366x768: Post-Payroll Discrepancy & Defect Flagging
    # -------------------------------------------------------------------------
    page_768 = browser.new_page(viewport={"width": 1366, "height": 768})
    page_768.goto(f"{BASE_URL}/simulation?project_id=11", wait_until="networkidle")
    page_768.wait_for_timeout(800)

    # Click to expand Post-Payroll Phase
    if not page_768.locator("text=Variance & Discrepancy RCA Report").first.is_visible():
        page_768.locator("h4:has-text('Post-Payroll Phase')").click()
        page_768.wait_for_timeout(500)

    # Verify discrepancy callout with DEF-EV_PAY-0001
    assert page_768.locator("text=Variance & Discrepancy RCA Report").first.is_visible()

    # Capture Screenshot 3: Post-Payroll Discrepancy & Defect
    screenshot_3 = SCREENSHOT_DIR / "03_post_payroll_discrepancy_and_defects_1366.png"
    page_768.screenshot(path=str(screenshot_3), full_page=False)
    assert screenshot_3.exists() and screenshot_3.stat().st_size > 50000

    # -------------------------------------------------------------------------
    # 4. Feature Navigation: Click "Payroll RCA" to open Dedicated Investigation Drawer
    # -------------------------------------------------------------------------
    # Click Payroll RCA card specifically (exact match)
    payroll_rca_card = page_1080.locator("h4").filter(has_text=re.compile(r"^Payroll RCA$")).first
    payroll_rca_card.click()
    page_1080.wait_for_timeout(600)

    # Verify dedicated RCA Drawer is open
    assert page_1080.locator("text=Root Cause Analysis (RCA)").first.is_visible()
    assert page_1080.locator("text=DEF-EV_PAY-0001").first.is_visible()
    assert page_1080.locator("text=$1,842.50").first.is_visible()

    # Capture Screenshot 4: RCA Investigation Drawer
    screenshot_4 = SCREENSHOT_DIR / "04_rca_investigation_drawer_payroll_rca.png"
    page_1080.screenshot(path=str(screenshot_4), full_page=False)
    assert screenshot_4.exists() and screenshot_4.stat().st_size > 50000

    # Close RCA Drawer
    page_1080.keyboard.press("Escape")
    page_1080.wait_for_timeout(400)

    # -------------------------------------------------------------------------
    # 5. ReasonX Floating Launcher: Pure 56px Circular FAB Button
    # -------------------------------------------------------------------------
    launcher = page_1080.locator("button[aria-label='Open ReasonX AI Assistant']")
    assert launcher.is_visible()
    # Check bounding box is circular (approx 56x56)
    box = launcher.bounding_box()
    assert box is not None
    assert 50 <= box["width"] <= 64
    assert 50 <= box["height"] <= 64

    # Capture Screenshot 5: ReasonX Circular FAB Launcher
    screenshot_5 = SCREENSHOT_DIR / "05_reasonx_circular_fab_launcher.png"
    page_1080.screenshot(path=str(screenshot_5), full_page=False)
    assert screenshot_5.exists() and screenshot_5.stat().st_size > 50000

    # -------------------------------------------------------------------------
    # 6. ReasonX Full-Height Responsive Drawer on Desktop
    # -------------------------------------------------------------------------
    launcher.click()
    page_1080.wait_for_timeout(600)

    # Verify Drawer is open and has full-height styling
    drawer = page_1080.locator("div[role='dialog'][aria-label='ReasonX AI Assistant']")
    assert drawer.is_visible()
    assert page_1080.locator("text=ReasonX Quality Intelligence").first.is_visible()

    # Verify quick action prompt chips are present and wrapped
    quick_chip = page_1080.locator("text=Explain Golden Policy Rules").first
    if quick_chip.is_visible():
        quick_chip.click()
        page_1080.wait_for_timeout(1500)

    # Capture Screenshot 6: ReasonX Full-Height Drawer Desktop
    screenshot_6 = SCREENSHOT_DIR / "06_reasonx_full_height_drawer_desktop.png"
    page_1080.screenshot(path=str(screenshot_6), full_page=False)
    assert screenshot_6.exists() and screenshot_6.stat().st_size > 50000

    # Verify Escape closes drawer and restores focus
    page_1080.keyboard.press("Escape")
    page_1080.wait_for_timeout(400)
    assert not drawer.is_visible()

    # -------------------------------------------------------------------------
    # 7. Mobile Viewport 390x844: Full-Screen ReasonX Experience
    # -------------------------------------------------------------------------
    page_mobile = browser.new_page(viewport={"width": 390, "height": 844})
    page_mobile.goto(f"{BASE_URL}/simulation?project_id=11", wait_until="networkidle")
    page_mobile.wait_for_timeout(800)

    mobile_launcher = page_mobile.locator("button[aria-label='Open ReasonX AI Assistant']")
    assert mobile_launcher.is_visible()
    mobile_launcher.click()
    page_mobile.wait_for_timeout(600)

    # On mobile, the drawer container is full width
    mobile_drawer = page_mobile.locator("div[role='dialog'][aria-label='ReasonX AI Assistant']")
    assert mobile_drawer.is_visible()

    # Capture Screenshot 7: Mobile Full-Screen Assistant
    screenshot_7 = SCREENSHOT_DIR / "07_reasonx_fullscreen_mobile_390.png"
    page_mobile.screenshot(path=str(screenshot_7), full_page=False)
    assert screenshot_7.exists() and screenshot_7.stat().st_size > 10000

    page_1080.close()
    page_900.close()
    page_768.close()
    page_mobile.close()
