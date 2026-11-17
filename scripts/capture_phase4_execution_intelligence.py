import os
import time
from playwright.sync_api import sync_playwright

OUT_DIR = "/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/phase-4"
DOCS_EVAL_DIR = "/home/Sohan/PROJECTS/tracetest-ai/docs/reports/enterprise-evaluation/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(DOCS_EVAL_DIR, exist_ok=True)

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)

        # -------------------------------------------------------------
        # 1. Desktop Full (1920x1080) - Execution Intelligence Dashboard Overview
        # -------------------------------------------------------------
        print("Capturing 01: Execution Dashboard Overview (1920x1080)...")
        ctx_desktop = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = ctx_desktop.new_page()

        # Set Dayforce project (ID: 9) in localStorage
        page.goto("http://127.0.0.1:5173/projects")
        page.wait_for_selector("h1:has-text('Projects')", timeout=15000)
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")

        # Navigate to /executions
        page.goto("http://127.0.0.1:5173/executions", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Enterprise Execution Intelligence')", timeout=15000)
        time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/01_execution_dashboard_overview_1920x1080.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/01_phase4_executions_overview.png")

        # -------------------------------------------------------------
        # 2. Desktop Full (1920x1080) - Execution Timeline View
        # -------------------------------------------------------------
        print("Capturing 02: Execution Timeline View (1920x1080)...")
        timeline_btn = page.locator("button:has-text('Timeline View')").first
        if timeline_btn.count() > 0:
            timeline_btn.click()
            time.sleep(1.5)

        page.screenshot(path=f"{OUT_DIR}/02_execution_timeline_1920x1080.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/02_phase4_execution_timeline.png")

        # Switch back to Table View
        table_btn = page.locator("button:has-text('Table View')").first
        if table_btn.count() > 0:
            table_btn.click()
            time.sleep(1)

        # -------------------------------------------------------------
        # 3. Desktop Full (1920x1080) - Execution Run Detail View (Run 37 / SIM-000003)
        # -------------------------------------------------------------
        print("Capturing 03: Execution Run Detail View (1920x1080)...")
        # Click on the first row to view run details
        first_run_row = page.locator("tr.cursor-pointer").first
        if first_run_row.count() > 0:
            first_run_row.click()
            time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/03_execution_run_detail_1920x1080.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/03_phase4_run_detail.png")

        # -------------------------------------------------------------
        # 4. Laptop (1440x900) - Expected vs Actual Result Inspection Modal
        # -------------------------------------------------------------
        print("Capturing 04: Expected vs Actual Result Inspection Modal (1440x900)...")
        # Click "Inspect" button on the first test result row
        inspect_btn = page.locator("button:has-text('Inspect')").first
        if inspect_btn.count() > 0:
            inspect_btn.click()
            time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/04_expected_vs_actual_inspection_1440x900.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/04_phase4_expected_vs_actual_matrix.png")

        # Close the modal
        close_btn = page.locator("button:has-text('Close')").last
        if close_btn.count() > 0:
            close_btn.click()
            time.sleep(1)

        # -------------------------------------------------------------
        # 5. Laptop (1440x900) - Historical Execution Comparison Modal
        # -------------------------------------------------------------
        print("Capturing 05: Historical Execution Comparison Modal (1440x900)...")
        compare_btn = page.locator("button:has-text('Compare Run'), button:has-text('Compare Executions')").first
        if compare_btn.count() > 0:
            compare_btn.click()
            time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/05_historical_run_comparison_1440x900.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/05_phase4_historical_comparison.png")

        # Close comparison modal
        close_btn = page.locator("button:has-text('Close')").last
        if close_btn.count() > 0:
            close_btn.click()
            time.sleep(1)

        # -------------------------------------------------------------
        # 6. Laptop (1440x900) - Flaky Test Intelligence Modal
        # -------------------------------------------------------------
        print("Capturing 06: Flaky Test Intelligence Modal (1440x900)...")
        flaky_btn = page.locator("button:has-text('Flaky Diagnostics'), button:has-text('Inspect Flaky Tests')").first
        if flaky_btn.count() > 0:
            flaky_btn.click()
            time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/06_flaky_test_explorer_1440x900.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/06_phase4_flaky_diagnostics.png")

        # Close flaky modal
        close_btn = page.locator("button:has-text('Close')").last
        if close_btn.count() > 0:
            close_btn.click()
            time.sleep(1)

        # -------------------------------------------------------------
        # 7. Laptop (1440x900) - Execution Report Export Modal
        # -------------------------------------------------------------
        print("Capturing 07: Execution Report Export Modal (1440x900)...")
        export_btn = page.locator("button:has-text('Export Report')").first
        if export_btn.count() > 0:
            export_btn.click()
            time.sleep(1.5)

        page.screenshot(path=f"{OUT_DIR}/07_execution_export_modal_1440x900.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/07_phase4_export_modal.png")

        # Close export modal
        cancel_btn = page.locator("button:has-text('Cancel')").last
        if cancel_btn.count() > 0:
            cancel_btn.click()
            time.sleep(1)

        ctx_desktop.close()

        # -------------------------------------------------------------
        # 8. Tablet (1024x768) - Responsive Tablet Layout
        # -------------------------------------------------------------
        print("Capturing 08: Tablet Layout (1024x768)...")
        ctx_tablet = browser.new_context(viewport={"width": 1024, "height": 768})
        page_tablet = ctx_tablet.new_page()
        page_tablet.goto("http://127.0.0.1:5173/projects")
        page_tablet.wait_for_selector("h1:has-text('Projects')", timeout=15000)
        page_tablet.evaluate("() => localStorage.setItem('tracetest.project', '9')")
        page_tablet.goto("http://127.0.0.1:5173/executions", wait_until="networkidle")
        page_tablet.wait_for_selector("h1:has-text('Enterprise Execution Intelligence')", timeout=15000)
        time.sleep(2)

        page_tablet.screenshot(path=f"{OUT_DIR}/08_executions_tablet_1024x768.png")
        page_tablet.screenshot(path=f"{DOCS_EVAL_DIR}/08_phase4_executions_tablet.png")
        ctx_tablet.close()

        # -------------------------------------------------------------
        # 9. Mobile (390x844) - Responsive Mobile Layout
        # -------------------------------------------------------------
        print("Capturing 09: Mobile Layout (390x844)...")
        ctx_mobile = browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        )
        page_mobile = ctx_mobile.new_page()
        page_mobile.goto("http://127.0.0.1:5173/projects")
        page_mobile.wait_for_selector("h1:has-text('Projects')", timeout=15000)
        page_mobile.evaluate("() => localStorage.setItem('tracetest.project', '9')")
        page_mobile.goto("http://127.0.0.1:5173/executions", wait_until="networkidle")
        page_mobile.wait_for_selector("h1:has-text('Enterprise Execution Intelligence')", timeout=15000)
        time.sleep(2)

        page_mobile.screenshot(path=f"{OUT_DIR}/09_executions_mobile_390x844.png")
        page_mobile.screenshot(path=f"{DOCS_EVAL_DIR}/09_phase4_executions_mobile.png")
        ctx_mobile.close()

        browser.close()
        print("All Phase 4 screenshots successfully captured and saved!")

if __name__ == "__main__":
    run()

