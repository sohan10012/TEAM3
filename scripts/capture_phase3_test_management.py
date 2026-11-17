import os
import time
from playwright.sync_api import sync_playwright

OUT_DIR = "/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/phase-3"
DOCS_EVAL_DIR = "/home/Sohan/PROJECTS/tracetest-ai/docs/reports/enterprise-evaluation/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(DOCS_EVAL_DIR, exist_ok=True)

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)

        # -------------------------------------------------------------
        # 1. Desktop Full (1920x1080) - Test Management Grouped by Requirement
        # -------------------------------------------------------------
        print("Capturing 01: Test Management Grouped by Requirement (1920x1080)...")
        ctx_desktop = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = ctx_desktop.new_page()

        # Set Dayforce project (ID: 9) in localStorage
        page.goto("http://127.0.0.1:5173/projects")
        page.wait_for_selector("h1:has-text('Projects')", timeout=15000)
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")

        # Navigate to /tests
        page.goto("http://127.0.0.1:5173/tests", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Test Management & Quality Intelligence')", timeout=15000)
        time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/01_tests_grouped_by_requirement_1920x1080.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/01_phase3_tests_overview.png")

        # -------------------------------------------------------------
        # 2. Desktop Full (1920x1080) - Expanded Test Case Row (5 Structured Sub-tabs)
        # -------------------------------------------------------------
        print("Capturing 02: Test Case Expanded Row (1920x1080)...")
        # Click the first test row or title to expand it
        row_title = page.locator("p.font-medium.truncate:has-text('Verify')").first
        if row_title.count() > 0:
            row_title.click()
            time.sleep(1.5)

        page.screenshot(path=f"{OUT_DIR}/02_tests_expanded_row_1920x1080.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/02_phase3_tests_expanded_row.png")

        # -------------------------------------------------------------
        # 3. Desktop Full (1920x1080) - Right-side Test Detail Drawer (12 Sections)
        # -------------------------------------------------------------
        print("Capturing 03: Test Detail Drawer (1920x1080)...")
        eye_btn = page.locator("button[title='Open details drawer'], button:has-text('Full Drawer Details')").first
        if eye_btn.count() > 0:
            eye_btn.click()
            time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/03_test_detail_drawer_1920x1080.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/03_phase3_test_drawer.png")
        ctx_desktop.close()

        # -------------------------------------------------------------
        # 4. Standard Laptop (1440x900) - Independent Test Case Explorer Flat Table
        # -------------------------------------------------------------
        print("Capturing 04: Independent Test Case Explorer Flat Table (1440x900)...")
        ctx_laptop = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx_laptop.new_page()
        page.goto("http://127.0.0.1:5173/projects")
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")
        page.goto("http://127.0.0.1:5173/tests", wait_until="networkidle")
        time.sleep(2)

        # Click "Independent Explorer Table" toggle button
        flat_toggle = page.locator("button:has-text('Independent Explorer Table')")
        if flat_toggle.count() > 0:
            flat_toggle.click()
            time.sleep(1.5)

        page.screenshot(path=f"{OUT_DIR}/04_tests_explorer_flat_table_1440x900.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/04_phase3_tests_flat_table.png")

        # -------------------------------------------------------------
        # 5. Standard Laptop (1440x900) - Two-Stage Test Generation Preview Modal
        # -------------------------------------------------------------
        print("Capturing 05: Two-Stage Test Generation Preview Modal (1440x900)...")
        gen_btn = page.locator("button:has-text('AI Test Generation')").first
        if gen_btn.count() > 0:
            gen_btn.click()
            time.sleep(1.5)

            # Click Generate Preview Candidates inside modal
            gen_cand_btn = page.locator("button:has-text('Generate Preview Candidates')").first
            if gen_cand_btn.count() > 0:
                gen_cand_btn.click()
                time.sleep(2.5)

        page.screenshot(path=f"{OUT_DIR}/05_test_generation_preview_modal_1440x900.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/05_phase3_test_gen_modal.png")
        ctx_laptop.close()

        # -------------------------------------------------------------
        # 6. Tablet Landscape (1024x768)
        # -------------------------------------------------------------
        print("Capturing 06: Tablet Landscape (1024x768)...")
        ctx_tablet = browser.new_context(viewport={"width": 1024, "height": 768})
        page = ctx_tablet.new_page()
        page.goto("http://127.0.0.1:5173/projects")
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")
        page.goto("http://127.0.0.1:5173/tests", wait_until="networkidle")
        time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/06_tests_tablet_1024x768.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/06_phase3_tests_tablet.png")
        ctx_tablet.close()

        # -------------------------------------------------------------
        # 7. Mobile Portrait (390x844 - iPhone 14 Pro style)
        # -------------------------------------------------------------
        print("Capturing 07: Mobile Portrait (390x844)...")
        ctx_mobile = browser.new_context(
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
        )
        page = ctx_mobile.new_page()
        page.goto("http://127.0.0.1:5173/projects")
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")
        page.goto("http://127.0.0.1:5173/tests", wait_until="networkidle")
        time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/07_tests_mobile_390x844.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/07_phase3_tests_mobile.png")
        ctx_mobile.close()

        browser.close()
        print("Phase 3 Screenshots capture successfully completed!")

if __name__ == "__main__":
    run()
