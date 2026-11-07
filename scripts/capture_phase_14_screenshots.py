"""Playwright automation to execute Phase 14 AI-assisted onboarding and capture all 7 screenshots."""
import time
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = Path("docs/screenshots/phase-14")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/chromium",
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 920},
            device_scale_factor=1,
        )
        page = context.new_page()

        print("Navigating to TraceTest Projects page...")
        page.goto("http://127.0.0.1:5173/projects", wait_until="networkidle")
        time.sleep(1)

        # Open New Requirements Project dialog
        print("Opening Project Creation Wizard...")
        page.locator('button:has-text("New Requirements Project")').click()
        page.wait_for_selector('div[role="dialog"]', state="visible", timeout=5000)
        time.sleep(0.8)

        # ---------------------------------------------------------------------
        # SCREENSHOT 1: Mode Selection & Project Info
        # ---------------------------------------------------------------------
        print("Capturing 01_onboarding_mode_selection_and_project_info.png...")
        page.screenshot(
            path=str(SCREENSHOT_DIR / "01_onboarding_mode_selection_and_project_info.png"),
            full_page=False
        )

        # ---------------------------------------------------------------------
        # SCREENSHOT 2: Document Upload & UPI Preload
        # ---------------------------------------------------------------------
        print("Navigating to Step 2 (Document Intake)...")
        page.locator('button:has-text("Next: Ingest Documents")').click()
        time.sleep(0.5)

        print("Clicking Preload 3 RBI Circulars...")
        page.locator('button:has-text("Preload 3 RBI Circulars")').click()
        page.wait_for_selector('text=Staged Documents (3)', timeout=8000)
        time.sleep(0.8)

        print("Capturing 02_document_upload_and_upi_preload.png...")
        page.screenshot(
            path=str(SCREENSHOT_DIR / "02_document_upload_and_upi_preload.png"),
            full_page=False
        )

        # ---------------------------------------------------------------------
        # SCREENSHOT 3: AI Document Analysis Progress
        # ---------------------------------------------------------------------
        print("Clicking Run AI Document Analysis...")
        page.locator('button:has-text("Run AI Document Analysis")').click()
        time.sleep(0.6)  # Capture during progress animation

        print("Capturing 03_ai_document_analysis_progress.png...")
        page.screenshot(
            path=str(SCREENSHOT_DIR / "03_ai_document_analysis_progress.png"),
            full_page=False
        )

        # Wait for Step 4 (Human Review & Approval)
        print("Waiting for AI analysis completion and Step 4 review...")
        page.wait_for_selector('button:has-text("Approve & Create Project")', timeout=15000)
        time.sleep(1.0)

        # ---------------------------------------------------------------------
        # SCREENSHOT 4: Human Review - Business Rules & Invariants
        # ---------------------------------------------------------------------
        print("Capturing 04_human_review_and_business_rules.png...")
        page.screenshot(
            path=str(SCREENSHOT_DIR / "04_human_review_and_business_rules.png"),
            full_page=False
        )

        # ---------------------------------------------------------------------
        # SCREENSHOT 5: Human Review - Roles & Scenarios
        # ---------------------------------------------------------------------
        print("Switching to Roles & Personas tab...")
        page.locator('button:has-text("Roles & Personas")').click()
        time.sleep(0.8)

        print("Capturing 05_human_review_roles_and_scenarios.png...")
        page.screenshot(
            path=str(SCREENSHOT_DIR / "05_human_review_roles_and_scenarios.png"),
            full_page=False
        )

        # ---------------------------------------------------------------------
        # SCREENSHOT 6: Cross-Document Insights & ReasonX Grounding
        # ---------------------------------------------------------------------
        print("Switching to Cross-Doc Insights tab...")
        page.locator('button:has-text("Cross-Doc Insights")').click()
        time.sleep(0.8)

        # Open ReasonX on one of the rules or via button
        print("Asking ReasonX AI...")
        page.locator('button:has-text("Business Rules & TAT")').click()
        time.sleep(0.5)
        # Click the first "Ask ReasonX" button
        page.locator('button:has-text("Ask ReasonX")').first.click()
        page.wait_for_selector('text=ReasonX AI Regulatory Assistant', timeout=8000)
        # Wait for explanation text to load
        time.sleep(1.2)

        print("Capturing 06_cross_document_intelligence_and_reasonx.png...")
        page.screenshot(
            path=str(SCREENSHOT_DIR / "06_cross_document_intelligence_and_reasonx.png"),
            full_page=False
        )

        # Close ReasonX modal
        print("Closing ReasonX modal...")
        page.locator('button:has-text("Close")').click()
        time.sleep(0.6)

        # ---------------------------------------------------------------------
        # SCREENSHOT 7: UPI Project Dashboard Launched
        # ---------------------------------------------------------------------
        print("Confirming approval checkbox and creating project...")
        # Check approval checkbox
        page.locator('input[type="checkbox"]').check()
        time.sleep(0.4)

        # Click Approve & Create Project
        page.locator('button:has-text("Approve & Create Project")').click()
        
        # Wait for redirect to project dashboard
        print("Waiting for navigation to project dashboard...")
        page.wait_for_url(lambda url: "/projects/" in url and "/projects" != url, timeout=15000)
        time.sleep(2.0)

        print("Capturing 07_upi_project_dashboard_launched.png...")
        page.screenshot(
            path=str(SCREENSHOT_DIR / "07_upi_project_dashboard_launched.png"),
            full_page=False
        )

        print("All 7 screenshots captured successfully in docs/screenshots/phase-14/!")
        browser.close()

if __name__ == "__main__":
    run()

