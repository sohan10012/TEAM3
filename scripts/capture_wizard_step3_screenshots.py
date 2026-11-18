"""Capture Project Creation Wizard Step 2 and Step 3 screenshots with live Playwright."""
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

DOC_PATH = Path("/home/Sohan/Downloads/wellarchitected-security-pillar.pdf")
SCREENSHOT_DIR = Path("docs/screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
BASE_URL = os.environ.get("TRACETEST_FRONTEND_URL", "http://127.0.0.1:5173")

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

        print("Navigating to Projects page at", f"{BASE_URL}/projects")
        page.goto(f"{BASE_URL}/projects", wait_until="networkidle")
        time.sleep(1)

        # Open New Requirements Project dialog
        print("Opening Project Creation Wizard...")
        page.locator('button:has-text("New Requirements Project")').first.click()
        page.wait_for_selector('div[role="dialog"]', state="visible", timeout=6000)
        time.sleep(0.5)

        # Step 1: Fill Project Details
        print("Filling Project Name and Key...")
        name_input = page.locator('input[placeholder*="UPI Dispute"]').first
        name_input.fill("AWS Well-Architected Security")
        time.sleep(0.3)

        key_input = page.locator('input[placeholder*="UPI_DISP"]').first
        key_input.fill("AWS_SEC")
        time.sleep(0.8)

        # Click Next: Document Intake
        print("Clicking Next: Document Intake...")
        next_step2_btn = page.locator('button:has-text("Next: Document Intake")').first
        next_step2_btn.click()
        time.sleep(1)

        # Capture Step 2 screenshot
        print("Capturing Step 2 screenshot...")
        page.screenshot(
            path=str(SCREENSHOT_DIR / "wizard_step2_document_intake.png"),
            full_page=False
        )

        # Upload authentic PDF
        print("Uploading authentic document:", DOC_PATH)
        file_input = page.locator('input[type="file"]')
        file_input.set_input_files(str(DOC_PATH))
        
        # Wait for staging to complete (large 240-page PDF text extraction can take ~15-25s)
        page.wait_for_selector('text=Authentic Document', timeout=60000)
        time.sleep(1)

        page.screenshot(
            path=str(SCREENSHOT_DIR / "wizard_step2_document_staged.png"),
            full_page=False
        )

        # Click Run AI Document Analysis
        print("Clicking Next: Run AI Document Analysis...")
        analyze_btn = page.locator('button:has-text("Next: Run AI Document Analysis")').first
        analyze_btn.click()
        
        # Wait for Step 3 active analysis UI to appear
        page.wait_for_selector('text=TraceTest Context Engine', timeout=10000)
        time.sleep(1.2)

        # Capture Step 3 in-progress screenshot with estimated time and live activity terminal!
        print("Capturing Step 3 in-progress screenshot...")
        page.screenshot(
            path=str(SCREENSHOT_DIR / "wizard_step3_antigravity_analysis_active.png"),
            full_page=False
        )

        # Wait for Step 4 (Human Review & Approval) to appear (up to 90 seconds)
        print("Waiting for AI analysis to complete and navigate to Step 4...")
        page.wait_for_selector('button:has-text("Approve & Create Project")', timeout=90000)
        time.sleep(2.0)

        print("Capturing Step 4 review screenshot...")
        page.screenshot(
            path=str(SCREENSHOT_DIR / "wizard_step4_review_and_approval.png"),
            full_page=False
        )
        print("All screenshots successfully captured!")

        browser.close()

if __name__ == "__main__":
    run()
