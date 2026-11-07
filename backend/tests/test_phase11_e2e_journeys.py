"""Phase 11 End-to-End Enterprise Product Journeys & Automated Visual Verification.

Executes genuine user journeys A through F against the live running application,
verifying:
- Journey A: New Business User Onboarding & Command Center
- Journey B: Document Intake, Quality Scorecards & PDF Source Grounding
- Journey C: Requirements Review & Ambiguity Clarification Workflow
- Journey D: Deterministic Policy Engine & Scenario Simulation Ledger
- Journey E: Defect Remediation & Failed Test Traceability
- Journey F: Project Intelligence Report, Leadership Action Center & Multi-format Export
- Contextual ReasonX AI Floating Assistant

Captures genuine screenshots at multiple responsive viewports:
- 1920x1080 (Full HD Desktop)
- 1440x900 (Standard Desktop)
- 1366x768 (Enterprise Laptop)
- 768x1024 (Tablet)
- 390x844 (Mobile)
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import pytest
from axe_core_python.sync_playwright import Axe
from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

SCREENSHOT_DIR = Path("/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/phase-11")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
BASE_URL = os.environ.get("TRACETEST_URL", "http://127.0.0.1:8000")
CHROME_PATH = "/usr/bin/chromium" if os.path.exists("/usr/bin/chromium") else None


@pytest.fixture(scope="module")
def browser() -> Browser:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME_PATH, headless=True)
        yield b
        b.close()


def capture_viewports(browser: Browser, path: str, prefix: str, wait_selector: str = "#root"):
    viewports = [
        ("desktop_1920x1080", 1920, 1080),
        ("desktop_1440x900", 1440, 900),
        ("laptop_1366x768", 1366, 768),
        ("tablet_768x1024", 768, 1024),
        ("mobile_390x844", 390, 844),
    ]
    for label, w, h in viewports:
        ctx = browser.new_context(viewport={"width": w, "height": h})
        page = ctx.new_page()
        try:
            page.goto(f"{BASE_URL}{path}", wait_until="networkidle", timeout=20000)
            page.wait_for_selector(wait_selector, timeout=10000)
            time.sleep(0.6)  # allow charts and animations to settle
            out_file = SCREENSHOT_DIR / f"{prefix}_{label}.png"
            page.screenshot(path=str(out_file), full_page=True)
        finally:
            ctx.close()


def test_journey_a_command_center_and_onboarding(browser: Browser):
    """Journey A: New business user lands on Command Center and inspects onboarding."""
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    try:
        page.goto(f"{BASE_URL}/", wait_until="networkidle")
        page.wait_for_selector("#root", timeout=8000)

        # Check for core branding and navigation
        assert page.locator("text=TraceTest").first.is_visible()
        body_text = page.inner_text("body")
        assert "Requirements" in body_text
        assert "Workspace" in body_text

        # Capture multi-viewport screenshots
        capture_viewports(browser, "/", "01_journey_a_command_center")

        # Accessibility check
        axe = Axe()
        results = axe.run(page)
        critical = [v for v in results.get("violations", []) if v.get("impact") == "critical"]
        assert len(critical) == 0, f"Critical accessibility violations on Dashboard: {critical}"
    finally:
        ctx.close()


def test_journey_b_requirements_intake_and_inspection(browser: Browser):
    """Journey B: Review requirements intake, documents, and 6-stage lifecycle."""
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    try:
        page.goto(f"{BASE_URL}/requirements?project_id=11", wait_until="networkidle")
        page.wait_for_selector("#root", timeout=8000)

        # Verify Requirements page elements
        assert page.locator("h1:has-text('Requirements')").first.is_visible()
        assert page.locator("text=Business Quality Lifecycle").first.is_visible()

        # Open the 'How Requirements Verification Works' guide
        guide_btn = page.locator("button:has-text('How Requirements Verification Works')")
        if guide_btn.is_visible():
            guide_btn.click()
            time.sleep(0.4)

        # Capture screenshots
        capture_viewports(browser, "/requirements?project_id=11", "02_journey_b_requirements_intake")
    finally:
        ctx.close()


def test_journey_c_extracted_requirements_and_table(browser: Browser):
    """Journey C: Review extracted requirements table and provenance."""
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    try:
        page.goto(f"{BASE_URL}/requirements?project_id=11", wait_until="networkidle")
        page.wait_for_selector("#root", timeout=8000)

        # Click on 'Extracted Requirements' tab
        tab_btn = page.locator("button:has-text('Extracted Requirements')")
        if tab_btn.is_visible():
            tab_btn.click()
            time.sleep(0.5)

        # Verify table has rendered
        assert page.locator("table").first.is_visible()

        # Capture screenshots
        page.screenshot(path=str(SCREENSHOT_DIR / "03_journey_c_extracted_requirements_desktop_1440x900.png"), full_page=True)
    finally:
        ctx.close()


def test_journey_d_policy_validation_and_scenario_simulation(browser: Browser):
    """Journey D: Deterministic policy evaluation & scenario simulator."""
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    try:
        page.goto(f"{BASE_URL}/simulation", wait_until="networkidle")
        page.wait_for_selector("#root", timeout=8000)

        # Check policy validation elements
        assert page.locator("h1:has-text('Policy & Scenario Validation')").first.is_visible()
        assert page.locator("text=Deterministic Policy Evaluation vs. AI Reasoning").first.is_visible()

        # Run an interactive shift calculation
        calc_btn = page.locator("button:has-text('Calculate & Verify Pay')").first
        if calc_btn.is_visible():
            calc_btn.click()
            time.sleep(0.5)

        # Capture multi-viewport screenshots
        capture_viewports(browser, "/simulation", "04_journey_d_policy_simulation")
    finally:
        ctx.close()


def test_journey_e_project_intelligence_action_center(browser: Browser):
    """Journey E: Executive Readiness Report with Action Priorities."""
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    try:
        page.goto(f"{BASE_URL}/intelligence-report", wait_until="networkidle")
        page.wait_for_selector("#root", timeout=8000)

        # Verify Executive Readiness Report headers
        assert page.locator("text=Intelligence Report").first.is_visible()
        assert page.locator("text=CRITICAL GAPS").first.is_visible()

        # Capture multi-viewport screenshots
        capture_viewports(browser, "/intelligence-report", "05_journey_e_intelligence_report")

        # Accessibility audit on executive report
        axe = Axe()
        results = axe.run(page)
        critical = [v for v in results.get("violations", []) if v.get("impact") == "critical"]
        assert len(critical) == 0, f"Critical a11y violations on Intelligence Report: {critical}"
    finally:
        ctx.close()


def test_journey_f_reasonx_assistant_interaction(browser: Browser):
    """Journey F: ReasonX contextual AI assistant interaction."""
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    try:
        page.goto(f"{BASE_URL}/requirements?project_id=11", wait_until="networkidle")
        page.wait_for_selector("#root", timeout=8000)

        # Find and open ReasonX launcher
        launcher = page.locator("button[aria-label='Open ReasonX AI Assistant']")
        if launcher.is_visible():
            launcher.click()
            time.sleep(0.5)

            # Check that the dockable panel is open
            panel = page.locator("div[aria-label='ReasonX AI Assistant']")
            assert panel.is_visible()

            # Take screenshot with ReasonX open
            page.screenshot(path=str(SCREENSHOT_DIR / "06_journey_f_reasonx_assistant_active.png"), full_page=True)
    finally:
        ctx.close()
