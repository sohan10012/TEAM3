"""Script to capture enterprise desktop screenshots across 22 product screens
at both 1920x1080 and 1440x900 viewports.
"""
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TRACETEST_URL", "http://127.0.0.1:8001")
OUT_DIR = Path(__file__).resolve().parents[1] / "docs" / "screenshots"
OUT_DIR.mkdir(parents=True, exist_ok=True)

VIEWPORTS = [
    (1920, 1080, "1920x1080"),
    (1440, 900, "1440x900"),
]

def capture_all():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium")

        for width, height, vp_label in VIEWPORTS:
            print(f"\n==========================================")
            print(f" Capturing Viewport: {vp_label} ({width}x{height})")
            print(f"==========================================")

            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()

            # Set Dayforce (ID 9) as default active project
            page.goto(BASE_URL + "/")
            page.wait_for_load_state("networkidle")
            page.evaluate("() => localStorage.setItem('tracetest.project', '9')")
            page.reload()
            page.wait_for_load_state("networkidle")
            time.sleep(1)

            # 1. Login / Authentication
            print("[1/22] Capturing Login / Authentication...")
            page.goto(BASE_URL + "/login")
            page.wait_for_load_state("networkidle")
            time.sleep(0.5)
            page.screenshot(path=str(OUT_DIR / f"01-login-auth-{vp_label}.png"))

            # 2. Main Dashboard (Code-Based Workspace - EchoBox ID 5)
            print("[2/22] Capturing Main Dashboard (Code-Based Workspace)...")
            page.evaluate("() => localStorage.setItem('tracetest.project', '5')")
            page.goto(BASE_URL + "/")
            page.wait_for_load_state("networkidle")
            time.sleep(1)
            page.screenshot(path=str(OUT_DIR / f"02-main-dashboard-codebased-{vp_label}.png"))

            # Switch back to Dayforce (Requirements-Based Workspace - ID 9)
            page.evaluate("() => localStorage.setItem('tracetest.project', '9')")

            # 3. Project Selection
            print("[3/22] Capturing Project Selection...")
            page.goto(BASE_URL + "/projects")
            page.wait_for_load_state("networkidle")
            time.sleep(0.8)
            page.screenshot(path=str(OUT_DIR / f"03-project-selection-{vp_label}.png"))

            # 4. Requirements-Based Project Dashboard
            print("[4/22] Capturing Requirements-Based Project Dashboard...")
            page.goto(BASE_URL + "/")
            page.wait_for_load_state("networkidle")
            time.sleep(1)
            page.screenshot(path=str(OUT_DIR / f"04-requirements-project-dashboard-{vp_label}.png"))

            # 5. Document Upload / Intake
            print("[5/22] Capturing Document Upload / Intake...")
            page.goto(BASE_URL + "/requirements")
            page.wait_for_load_state("networkidle")
            time.sleep(0.8)
            # Ensure "Document Intake" tab is selected
            intake_tab = page.locator("button:has-text('Document Intake')").first
            if intake_tab.count():
                intake_tab.click()
                time.sleep(0.5)
            page.screenshot(path=str(OUT_DIR / f"05-document-intake-{vp_label}.png"))

            # 6. Extracted Requirements
            print("[6/22] Capturing Extracted Requirements...")
            extracted_tab = page.locator("button:has-text('Extracted Requirements')").first
            if extracted_tab.count():
                extracted_tab.click()
                time.sleep(0.8)
            page.screenshot(path=str(OUT_DIR / f"06-extracted-requirements-{vp_label}.png"))

            # 7. Requirement Details
            print("[7/22] Capturing Requirement Details...")
            page.goto(BASE_URL + "/requirements/91")
            page.wait_for_load_state("networkidle")
            time.sleep(0.8)
            page.screenshot(path=str(OUT_DIR / f"07-requirement-details-{vp_label}.png"))

            # 8. Analysis Insights
            print("[8/22] Capturing Analysis Insights...")
            page.goto(BASE_URL + "/requirements")
            page.wait_for_load_state("networkidle")
            time.sleep(0.5)
            insights_tab = page.locator("button:has-text('Analysis Insights')").first
            if insights_tab.count():
                insights_tab.click()
                time.sleep(0.8)
            page.screenshot(path=str(OUT_DIR / f"08-analysis-insights-{vp_label}.png"))

            # 9. Ambiguity and Clarification Management
            print("[9/22] Capturing Ambiguity and Clarification Management...")
            clar_tab = page.locator("button:has-text('Clarifications & Contradictions')").first
            if clar_tab.count():
                clar_tab.click()
                time.sleep(0.8)
            page.screenshot(path=str(OUT_DIR / f"09-ambiguity-clarifications-{vp_label}.png"))

            # 10. Acceptance Criteria
            print("[10/22] Capturing Acceptance Criteria...")
            page.goto(BASE_URL + "/requirements/91")
            page.wait_for_load_state("networkidle")
            time.sleep(0.5)
            ac_tab = page.locator("button:has-text('Acceptance Criteria')").first
            if ac_tab.count():
                ac_tab.click()
                time.sleep(0.8)
            page.screenshot(path=str(OUT_DIR / f"10-acceptance-criteria-{vp_label}.png"))

            # 11. Traceability Matrix
            print("[11/22] Capturing Traceability Matrix...")
            page.goto(BASE_URL + "/traceability")
            page.wait_for_load_state("networkidle")
            time.sleep(1)
            page.screenshot(path=str(OUT_DIR / f"11-traceability-matrix-{vp_label}.png"))

            # 12. Test Cases
            print("[12/22] Capturing Test Cases...")
            page.goto(BASE_URL + "/tests")
            page.wait_for_load_state("networkidle")
            time.sleep(1)
            page.screenshot(path=str(OUT_DIR / f"12-test-cases-{vp_label}.png"))

            # 13. Test Case Details
            print("[13/22] Capturing Test Case Details...")
            page.goto(BASE_URL + "/tests/413")
            page.wait_for_load_state("networkidle")
            time.sleep(0.8)
            page.screenshot(path=str(OUT_DIR / f"13-test-case-details-{vp_label}.png"))

            # 14. Test Validation (Approval & Governance Workspace)
            print("[14/22] Capturing Test Validation (Review Workspace)...")
            page.goto(BASE_URL + "/tests/review")
            page.wait_for_load_state("networkidle")
            time.sleep(1)
            page.screenshot(path=str(OUT_DIR / f"14-test-validation-review-{vp_label}.png"))

            # 15. Agent Simulation (Multi-Agent Pipeline)
            print("[15/22] Capturing Agent Simulation...")
            page.goto(BASE_URL + "/simulation")
            page.wait_for_load_state("networkidle")
            time.sleep(1.2)
            page.screenshot(path=str(OUT_DIR / f"15-agent-simulation-{vp_label}.png"))

            # 16. Policy YAML Engine
            print("[16/22] Capturing Policy YAML Engine...")
            yaml_heading = page.locator("h2:has-text('No-Code Policy YAML Engine')").first
            if yaml_heading.count():
                yaml_heading.scroll_into_view_if_needed()
                time.sleep(0.5)
            page.screenshot(path=str(OUT_DIR / f"16-policy-yaml-engine-{vp_label}.png"))

            # 17. Behaviour Simulation (Timesheet Evaluator & Red-to-Green Test Runner)
            print("[17/22] Capturing Behaviour Simulation...")
            sim_heading = page.locator("h2:has-text('Red-to-Green Table-Driven Test Runner')").first
            if sim_heading.count():
                sim_heading.scroll_into_view_if_needed()
                time.sleep(0.5)
            page.screenshot(path=str(OUT_DIR / f"17-behaviour-simulation-{vp_label}.png"))

            # 18. Test Runs
            print("[18/22] Capturing Test Runs...")
            page.goto(BASE_URL + "/executions")
            page.wait_for_load_state("networkidle")
            time.sleep(1)
            page.screenshot(path=str(OUT_DIR / f"18-test-runs-{vp_label}.png"))

            # 19. Execution Details
            print("[19/22] Capturing Execution Details...")
            page.goto(BASE_URL + "/executions/12")
            page.wait_for_load_state("networkidle")
            time.sleep(0.8)
            page.screenshot(path=str(OUT_DIR / f"19-execution-details-{vp_label}.png"))

            # 20. Defect Management
            print("[20/22] Capturing Defect Management...")
            page.goto(BASE_URL + "/defects")
            page.wait_for_load_state("networkidle")
            time.sleep(1)
            page.screenshot(path=str(OUT_DIR / f"20-defect-management-{vp_label}.png"))

            # 21. Quality Analytics
            print("[21/22] Capturing Quality Analytics...")
            page.goto(BASE_URL + "/analytics")
            page.wait_for_load_state("networkidle")
            time.sleep(1.2)
            page.screenshot(path=str(OUT_DIR / f"21-quality-analytics-{vp_label}.png"))

            # 22. Project Settings
            print("[22/22] Capturing Project Settings...")
            page.goto(BASE_URL + "/settings")
            page.wait_for_load_state("networkidle")
            time.sleep(0.8)
            page.screenshot(path=str(OUT_DIR / f"22-project-settings-{vp_label}.png"))

            context.close()

        browser.close()
    print("\n✓ Successfully captured all enterprise desktop screenshots!")

if __name__ == "__main__":
    capture_all()

