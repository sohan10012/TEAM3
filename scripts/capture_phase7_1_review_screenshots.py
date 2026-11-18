"""Capture Project Creation Wizard Step 4 Human Review & Approval screenshots with live Playwright."""
import os
import shutil
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

DOC_PATH = Path("/home/Sohan/Downloads/wellarchitected-security-pillar.pdf")
SCREENSHOT_DIR = Path("docs/screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
ARTIFACT_DIR = Path("/home/Sohan/.gemini/antigravity/brain/32c82c0a-e899-481f-ab1b-a4620b97c627")
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
        page.locator('button:has-text("Next: Document Intake")').first.click()
        time.sleep(1)

        # Upload authentic PDF
        print("Uploading authentic document:", DOC_PATH)
        file_input = page.locator('input[type="file"]')
        file_input.set_input_files(str(DOC_PATH))
        
        # Wait for staging to complete
        page.wait_for_selector('text=Authentic Document', timeout=60000)
        time.sleep(1)

        # Click Run AI Document Analysis
        print("Clicking Next: Run AI Document Analysis...")
        page.locator('button:has-text("Next: Run AI Document Analysis")').first.click()
        
        # Wait for Step 3 active analysis UI to appear
        page.wait_for_selector('text=TraceTest Context Engine', timeout=10000)
        print("Analysis pipeline in progress...")

        # Wait for Step 4 (Human Review & Approval) to appear (up to 90 seconds)
        print("Waiting for AI analysis to complete and navigate to Step 4...")
        page.wait_for_selector('button:has-text("Approve & Create Project")', timeout=90000)
        time.sleep(2.0)

        # 1. Step 4 Business Rules Tab
        # Click on first rule's confidence badge to open the 5-factor scoring popover
        print("Clicking confidence badge to open 5-factor scoring popover...")
        conf_badges = page.locator('button:has-text("% Confidence")')
        if conf_badges.count() > 0:
            conf_badges.first.click()
            time.sleep(0.5)

        rules_shot = SCREENSHOT_DIR / "wizard_step4_review_and_approval.png"
        page.screenshot(path=str(rules_shot), full_page=False)
        shutil.copy(rules_shot, ARTIFACT_DIR / "wizard_step4_review_and_approval.png")
        shutil.copy(rules_shot, SCREENSHOT_DIR / "wizard_step4_rules_expanded.png")
        shutil.copy(rules_shot, ARTIFACT_DIR / "wizard_step4_rules_expanded.png")
        print("Captured Step 4 Business Rules screenshot!")

        # 2. Step 4 Business Scenarios Tab
        print("Clicking Business Scenarios tab...")
        page.locator('button:has-text("Business Scenarios")').first.click()
        time.sleep(0.8)

        scenarios_shot = SCREENSHOT_DIR / "wizard_step4_scenarios_traceability.png"
        page.screenshot(path=str(scenarios_shot), full_page=False)
        shutil.copy(scenarios_shot, ARTIFACT_DIR / "wizard_step4_scenarios_traceability.png")
        print("Captured Step 4 Business Scenarios screenshot!")

        # 3. Step 4 Cross-Doc Insights Tab (Single-Document Evaluation)
        print("Clicking Cross-Doc Insights tab...")
        page.locator('button:has-text("Cross-Doc Insights")').first.click()
        time.sleep(0.8)

        insights_shot = SCREENSHOT_DIR / "wizard_step4_cross_doc_single_doc.png"
        page.screenshot(path=str(insights_shot), full_page=False)
        shutil.copy(insights_shot, ARTIFACT_DIR / "wizard_step4_cross_doc_single_doc.png")
        print("Captured Step 4 Cross-Doc Insights screenshot!")

        browser.close()
        print("All Phase 7.1 screenshots captured and artifacts synchronized!")


if __name__ == "__main__":
    run()

