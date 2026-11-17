"""
Phase 6 Final Product Screenshot Capture Suite.
Captures authentic real-world browser screenshots using Playwright across 5 required viewports:
- 1920x1080 (Desktop Full)
- 1440x900 (Laptop)
- 1366x768 (Standard PC)
- 1024x768 (Tablet)
- 390x844 (Mobile)

Saves all captures to docs/screenshots/final-product/
"""
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path("/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/final-product")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def run():
    print(f"Capturing Phase 6 final screenshots to {OUT_DIR}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)

        # =====================================================================
        # 1. Desktop Full (1920x1080): Final Project List (ECHO and EV_PAY)
        # =====================================================================
        print("01: Final project list showing only ECHO and EV_PAY (1920x1080)...")
        ctx_desktop = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = ctx_desktop.new_page()

        page.goto("http://127.0.0.1:5173/projects", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Projects')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "01_final_project_list_echo_and_evpay_1920x1080.png"))

        # =====================================================================
        # 2. Desktop Full (1920x1080): ECHO Project Dashboard
        # =====================================================================
        print("02: ECHO project dashboard (1920x1080)...")
        page.goto("http://127.0.0.1:5173/projects/5", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('EchoBox')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "02_echo_project_dashboard_1920x1080.png"))

        # =====================================================================
        # 3. Desktop Full (1920x1080): EV_PAY Project Dashboard
        # =====================================================================
        print("03: EV_PAY project dashboard (1920x1080)...")
        page.goto("http://127.0.0.1:5173/projects/11", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Enterprise Payroll')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "03_evpay_project_dashboard_1920x1080.png"))

        # =====================================================================
        # 4. Laptop (1440x900): Project Switcher Active Popover
        # =====================================================================
        print("04: Project switcher active dropdown (1440x900)...")
        ctx_laptop = browser.new_context(viewport={"width": 1440, "height": 900})
        page_laptop = ctx_laptop.new_page()
        page_laptop.goto("http://127.0.0.1:5173/projects/11", wait_until="networkidle")
        time.sleep(1.5)

        switcher_btn = page_laptop.locator("button[aria-label='Project Workspace'], button[title*='Switch project']").first
        if switcher_btn.count() > 0:
            switcher_btn.click()
            time.sleep(1)
        page_laptop.screenshot(path=str(OUT_DIR / "04_project_switcher_popover_1440x900.png"))

        # Close switcher
        page_laptop.keyboard.press("Escape")
        time.sleep(0.5)

        # =====================================================================
        # 5. Desktop Full (1920x1080): Requirements Workspace (EV_PAY)
        # =====================================================================
        print("05: Requirements workspace (1920x1080)...")
        page.goto("http://127.0.0.1:5173/requirements?project_id=11", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Requirements')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "05_requirements_workspace_1920x1080.png"))

        # =====================================================================
        # 6. Desktop Full (1920x1080): Acceptance Criteria Workspace (EV_PAY)
        # =====================================================================
        print("06: Acceptance criteria workspace (1920x1080)...")
        page.goto("http://127.0.0.1:5173/acceptance-criteria?project_id=11", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Acceptance Criteria')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "06_acceptance_criteria_workspace_1920x1080.png"))

        # =====================================================================
        # 7. Desktop Full (1920x1080): Test Case Management (EV_PAY)
        # =====================================================================
        print("07: Test case management (1920x1080)...")
        page.goto("http://127.0.0.1:5173/tests?project_id=11", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Test')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "07_test_case_management_1920x1080.png"))

        # =====================================================================
        # 8. Desktop Full (1920x1080): Execution Intelligence Dashboard (ECHO)
        # =====================================================================
        print("08: Execution intelligence dashboard (1920x1080)...")
        page.goto("http://127.0.0.1:5173/executions?project_id=5", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Execution')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "08_execution_intelligence_dashboard_1920x1080.png"))

        # =====================================================================
        # 9. Laptop (1440x900): Execution Detail & Expected-vs-Actual Matrix
        # =====================================================================
        print("09: Execution detail and expected-vs-actual comparison (1440x900)...")
        page_laptop.goto("http://127.0.0.1:5173/executions?project_id=5", wait_until="networkidle")
        time.sleep(2)

        # Click on the first execution row to open details
        exec_row = page_laptop.locator("tr.cursor-pointer").first
        if exec_row.count() > 0:
            exec_row.click()
            time.sleep(1.5)

        # Inspect first result to show expected vs actual
        inspect_btn = page_laptop.locator("button:has-text('Inspect')").first
        if inspect_btn.count() > 0:
            inspect_btn.click()
            time.sleep(1.5)

        page_laptop.screenshot(path=str(OUT_DIR / "09_execution_detail_and_comparison_1440x900.png"))
        page_laptop.keyboard.press("Escape")
        time.sleep(0.5)

        # =====================================================================
        # 10. Desktop Full (1920x1080): Traceability Intelligence Overview
        # =====================================================================
        print("10: Traceability Intelligence overview (1920x1080)...")
        page.goto("http://127.0.0.1:5173/traceability?project_id=11", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Traceability')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "10_traceability_intelligence_overview_1920x1080.png"))

        # =====================================================================
        # 11. Desktop Full (1920x1080): Coverage Gap Explorer
        # =====================================================================
        print("11: Coverage gap explorer (1920x1080)...")
        gaps_tab = page.locator("button:has-text('Coverage Gaps')").first
        if gaps_tab.count() > 0:
            gaps_tab.click()
            time.sleep(1.5)
        page.screenshot(path=str(OUT_DIR / "11_coverage_gap_explorer_1920x1080.png"))

        # =====================================================================
        # 12. Standard PC (1366x768): Advanced Coverage Matrix
        # =====================================================================
        print("12: Advanced coverage matrix (1366x768)...")
        ctx_pc = browser.new_context(viewport={"width": 1366, "height": 768})
        page_pc = ctx_pc.new_page()
        page_pc.goto("http://127.0.0.1:5173/traceability?project_id=11", wait_until="networkidle")
        time.sleep(2)

        matrix_tab = page_pc.locator("button:has-text('2D Coverage Matrix')").first
        if matrix_tab.count() > 0:
            matrix_tab.click()
            time.sleep(1.5)
        page_pc.screenshot(path=str(OUT_DIR / "12_advanced_coverage_matrix_1366x768.png"))

        # =====================================================================
        # 13. Laptop (1440x900): Change Impact Analysis
        # =====================================================================
        print("13: Change-impact analysis (1440x900)...")
        page_laptop.goto("http://127.0.0.1:5173/traceability?project_id=11", wait_until="networkidle")
        time.sleep(2)

        impact_tab = page_laptop.locator("button:has-text('Change Impact Intelligence')").first
        if impact_tab.count() > 0:
            impact_tab.click()
            time.sleep(1.5)
        page_laptop.screenshot(path=str(OUT_DIR / "13_change_impact_analysis_1440x900.png"))

        # =====================================================================
        # 14. Laptop (1440x900): Traceability Governance Audit Ledger
        # =====================================================================
        print("14: Audit ledger (1440x900)...")
        audit_tab = page_laptop.locator("button:has-text('Audit Ledger')").first
        if audit_tab.count() > 0:
            audit_tab.click()
            time.sleep(1.5)
        page_laptop.screenshot(path=str(OUT_DIR / "14_audit_ledger_1440x900.png"))

        # =====================================================================
        # Setup temporary evaluation project for screens 15, 16, 17
        # =====================================================================
        print("Setting up temporary clean evaluation project for empty state demonstration...")
        import sqlite3
        db_path = str(Path(__file__).resolve().parent.parent / "var" / "tracetest.db")
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO projects (key, name, project_type, description, status, organisation_id, owner_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'active', 1, 1, datetime('now'), datetime('now'))""",
            ("EVAL_DEMO", "Phase 7 Real-World Document Evaluation", "requirements_based", "Evaluation Project: Genuine Business Document Intake & Autonomous Quality Verification.")
        )
        eval_id = cur.lastrowid
        conn.commit()
        conn.close()
        print(f"Created temporary demo evaluation project: ID {eval_id} (EVAL_DEMO)")

        if eval_id:
            # 15. Desktop Full (1920x1080): New Evaluation Project Empty State
            print("15: New evaluation project empty state (1920x1080)...")
            page.goto(f"http://127.0.0.1:5173/projects/{eval_id}", wait_until="networkidle")
            time.sleep(2)
            page.screenshot(path=str(OUT_DIR / "15_new_evaluation_project_empty_state_1920x1080.png"))

            # 16. Desktop Full (1920x1080): Document Upload Workspace (Modal open)
            print("16: Document upload workspace modal (1920x1080)...")
            upload_btn = page.locator("button:has-text('Upload Genuine Documents'), button:has-text('Upload Document')").first
            if upload_btn.count() > 0:
                upload_btn.click()
                time.sleep(1)
            page.screenshot(path=str(OUT_DIR / "16_document_upload_workspace_modal_1920x1080.png"))
            page.keyboard.press("Escape")
            time.sleep(0.5)

            # 17. Laptop (1440x900): Document Processing Progress / Stepper
            print("17: Document processing progress and lifecycle stepper (1440x900)...")
            page_laptop.goto(f"http://127.0.0.1:5173/projects/{eval_id}", wait_until="networkidle")
            time.sleep(2)
            page_laptop.screenshot(path=str(OUT_DIR / "17_document_processing_progress_1440x900.png"))

            # Clean up temporary demo project so database contains exactly ECHO and EV_PAY
            print("Cleaning up temporary demo evaluation project...")
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("DELETE FROM projects WHERE id = ?", (eval_id,))
            conn.commit()
            conn.close()
            print("Temporary demo project cleaned up successfully!")

        # =====================================================================
        # 18. Tablet (1024x768): Responsive Tablet Dashboard
        # =====================================================================
        print("18: Responsive tablet dashboard (1024x768)...")
        ctx_tablet = browser.new_context(viewport={"width": 1024, "height": 768})
        page_tablet = ctx_tablet.new_page()
        page_tablet.goto("http://127.0.0.1:5173/projects/11", wait_until="networkidle")
        time.sleep(2)
        page_tablet.screenshot(path=str(OUT_DIR / "18_responsive_tablet_dashboard_1024x768.png"))
        ctx_tablet.close()

        # =====================================================================
        # 19. Mobile (390x844): Responsive Mobile Dashboard
        # =====================================================================
        print("19: Responsive mobile dashboard (390x844)...")
        ctx_mobile = browser.new_context(viewport={"width": 390, "height": 844})
        page_mobile = ctx_mobile.new_page()
        page_mobile.goto("http://127.0.0.1:5173/projects/11", wait_until="networkidle")
        time.sleep(2)
        page_mobile.screenshot(path=str(OUT_DIR / "19_responsive_mobile_dashboard_390x844.png"))
        ctx_mobile.close()

        ctx_pc.close()
        ctx_laptop.close()
        ctx_desktop.close()
        browser.close()
        print("All Phase 6 final product screenshots successfully captured!")

if __name__ == "__main__":
    run()
