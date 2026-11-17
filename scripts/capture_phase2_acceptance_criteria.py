import os
import time
from playwright.sync_api import sync_playwright

OUT_DIR = "/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/phase-2"
DOCS_EVAL_DIR = "/home/Sohan/PROJECTS/tracetest-ai/docs/reports/enterprise-evaluation/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(DOCS_EVAL_DIR, exist_ok=True)

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)

        # -------------------------------------------------------------
        # 1. Desktop Full (1920x1080) - Acceptance Criteria Grouped
        # -------------------------------------------------------------
        print("Capturing 01: Criteria Grouped by Requirement (1920x1080)...")
        ctx_desktop = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = ctx_desktop.new_page()

        # Set Dayforce project (ID: 9) in localStorage
        page.goto("http://127.0.0.1:5173/projects")
        page.wait_for_selector("h1:has-text('Projects')", timeout=15000)
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")

        # Navigate to acceptance-criteria workspace
        page.goto("http://127.0.0.1:5173/acceptance-criteria?project_id=9", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Acceptance Criteria Workspace')", timeout=15000)
        time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/01_criteria_grouped_by_requirement_1920x1080.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/01_criteria_overview.png")

        # -------------------------------------------------------------
        # 2. Desktop Full (1920x1080) - Expanded AC Row (BDD + Grounding)
        # -------------------------------------------------------------
        print("Capturing 02: Criteria Expanded Row (1920x1080)...")
        # Click the first criterion row to expand it
        row = page.locator("div.cursor-pointer:has-text('DAY-')").first
        if row.count() > 0:
            row.click()
            time.sleep(1.5)

        page.screenshot(path=f"{OUT_DIR}/02_criteria_expanded_row_1920x1080.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/02_criteria_expanded_row.png")

        # -------------------------------------------------------------
        # 3. Desktop Full (1920x1080) - Right-side Detail Drawer
        # -------------------------------------------------------------
        print("Capturing 03: Criteria Detail Drawer (1920x1080)...")
        inspect_btn = page.locator("button:has-text('Inspect'), button:has-text('Open Drawer')").first
        if inspect_btn.count() > 0:
            inspect_btn.click()
            time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/03_criteria_detail_drawer_1920x1080.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/03_criteria_drawer.png")
        ctx_desktop.close()

        # -------------------------------------------------------------
        # 4. Standard Laptop (1440x900) - Flat Data Table Mode
        # -------------------------------------------------------------
        print("Capturing 04: Flat Table Mode (1440x900)...")
        ctx_laptop = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx_laptop.new_page()
        page.goto("http://127.0.0.1:5173/projects")
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")
        page.goto("http://127.0.0.1:5173/acceptance-criteria?project_id=9", wait_until="networkidle")
        time.sleep(2)

        # Click "Flat Table" toggle button
        flat_toggle = page.locator("button:has-text('Flat Table')")
        if flat_toggle.count() > 0:
            flat_toggle.click()
            time.sleep(1.5)

        page.screenshot(path=f"{OUT_DIR}/04_criteria_flat_table_1440x900.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/04_criteria_flat_table.png")

        # -------------------------------------------------------------
        # 5. Standard Laptop (1440x900) - Generation Lifecycle Modal
        # -------------------------------------------------------------
        print("Capturing 05: Generation Lifecycle Modal (1440x900)...")
        gen_btn = page.locator("button:has-text('Generate Criteria')").first
        if gen_btn.count() > 0:
            gen_btn.click()
            time.sleep(1.5)

        page.screenshot(path=f"{OUT_DIR}/05_criteria_generation_lifecycle_modal_1440x900.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/05_criteria_generation_modal.png")
        ctx_laptop.close()

        # -------------------------------------------------------------
        # 6. Tablet View (1024x768) - Responsive Matrix
        # -------------------------------------------------------------
        print("Capturing 06: Tablet View (1024x768)...")
        ctx_tablet = browser.new_context(viewport={"width": 1024, "height": 768})
        page = ctx_tablet.new_page()
        page.goto("http://127.0.0.1:5173/projects")
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")
        page.goto("http://127.0.0.1:5173/acceptance-criteria?project_id=9", wait_until="networkidle")
        time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/06_criteria_tablet_1024x768.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/06_criteria_tablet.png")
        ctx_tablet.close()

        # -------------------------------------------------------------
        # 7. Mobile View (390x844 - iPhone 14)
        # -------------------------------------------------------------
        print("Capturing 07: Mobile View (390x844)...")
        ctx_mobile = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        page = ctx_mobile.new_page()
        page.goto("http://127.0.0.1:5173/projects")
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")
        page.goto("http://127.0.0.1:5173/acceptance-criteria?project_id=9", wait_until="networkidle")
        time.sleep(2)

        # Expand a criterion on mobile to verify responsive stacked layout
        first_row = page.locator("div.cursor-pointer:has-text('DAY-')").first
        if first_row.count() > 0:
            first_row.click()
            time.sleep(1.5)

        page.screenshot(path=f"{OUT_DIR}/07_criteria_mobile_390x844.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/07_criteria_mobile.png")
        ctx_mobile.close()

        browser.close()
        print("Successfully captured all 7 Phase 2 acceptance criteria screenshots!")

if __name__ == "__main__":
    run()
