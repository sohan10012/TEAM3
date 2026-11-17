"""
Comprehensive Screenshot Capture Suite for TraceTest Enterprise.
Captures all authentic browser screenshots across all viewports and features:
1. docs/screenshots/final-product/ (19 screenshots across 5 viewports)
2. docs/screenshots/dashboard-redesign/ (8 executive dashboard screenshots)
3. docs/screenshots/phase-7-amazon-aws/workspace-isolation/ (7 workspace isolation screenshots)
4. docs/screenshots/phase-7-amazon-aws/ (9 AWS real-world evaluation screenshots)
5. docs/screenshots/ (Root directory enterprise overview screenshots)
"""

import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TRACETEST_URL", "http://127.0.0.1:5173")
ROOT_DIR = Path(__file__).resolve().parent.parent
DOCS_SCREENSHOTS = ROOT_DIR / "docs" / "screenshots"
FINAL_PRODUCT_DIR = DOCS_SCREENSHOTS / "final-product"
DASHBOARD_DIR = DOCS_SCREENSHOTS / "dashboard-redesign"
AWS_DIR = DOCS_SCREENSHOTS / "phase-7-amazon-aws"
WORKSPACE_DIR = AWS_DIR / "workspace-isolation"

for d in [FINAL_PRODUCT_DIR, DASHBOARD_DIR, AWS_DIR, WORKSPACE_DIR]:
    d.mkdir(parents=True, exist_ok=True)

def run():
    print(f"Starting comprehensive screenshot capture from {BASE_URL}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)

        # =====================================================================
        # 1. FINAL PRODUCT SUITE (docs/screenshots/final-product/)
        # =====================================================================
        print("\n--- Capturing Final Product Suite (docs/screenshots/final-product/) ---")
        ctx_desktop = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = ctx_desktop.new_page()

        # 01. Final Project List
        print("01: Authoritative Project List (1920x1080)...")
        page.goto(f"{BASE_URL}/projects", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Projects')", timeout=15000)
        time.sleep(1.5)
        page.screenshot(path=str(FINAL_PRODUCT_DIR / "01_final_project_list_echo_and_evpay_1920x1080.png"))
        page.screenshot(path=str(DOCS_SCREENSHOTS / "03-project-selection-1920x1080.png"))

        # 02. ECHO Project Dashboard
        print("02: ECHO project dashboard (1920x1080)...")
        page.evaluate("() => localStorage.setItem('tracetest.project', '5')")
        page.goto(f"{BASE_URL}/", wait_until="networkidle")
        time.sleep(2)
        page.screenshot(path=str(FINAL_PRODUCT_DIR / "02_echo_project_dashboard_1920x1080.png"))
        page.screenshot(path=str(DOCS_SCREENSHOTS / "02-main-dashboard-codebased-1920x1080.png"))

        # 03. EV_PAY Project Dashboard
        print("03: EV_PAY project dashboard (1920x1080)...")
        page.evaluate("() => localStorage.setItem('tracetest.project', '11')")
        page.goto(f"{BASE_URL}/", wait_until="networkidle")
        time.sleep(2)
        page.screenshot(path=str(FINAL_PRODUCT_DIR / "03_evpay_project_dashboard_1920x1080.png"))
        page.screenshot(path=str(DOCS_SCREENSHOTS / "04-requirements-project-dashboard-1920x1080.png"))

        # 04. Laptop (1440x900): Project Switcher Active Popover
        print("04: Project switcher active dropdown (1440x900)...")
        ctx_laptop = browser.new_context(viewport={"width": 1440, "height": 900})
        page_laptop = ctx_laptop.new_page()
        page_laptop.goto(f"{BASE_URL}/projects/11", wait_until="networkidle")
        time.sleep(1.5)
        switcher_btn = page_laptop.locator("button[aria-label='Project Workspace Selector'], button[aria-label='Project Workspace'], button[title*='Switch project']").first
        if switcher_btn.count() > 0:
            switcher_btn.click()
            time.sleep(1)
        page_laptop.screenshot(path=str(FINAL_PRODUCT_DIR / "04_project_switcher_popover_1440x900.png"))
        page_laptop.keyboard.press("Escape")
        time.sleep(0.5)

        # 05. Desktop Full (1920x1080): Requirements Workspace (EV_PAY)
        print("05: Requirements workspace (1920x1080)...")
        page.goto(f"{BASE_URL}/requirements?project_id=11", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Requirements')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(FINAL_PRODUCT_DIR / "05_requirements_workspace_1920x1080.png"))
        page.screenshot(path=str(DOCS_SCREENSHOTS / "06-extracted-requirements-1920x1080.png"))

        # 06. Desktop Full (1920x1080): Acceptance Criteria Workspace (EV_PAY)
        print("06: Acceptance criteria workspace (1920x1080)...")
        page.goto(f"{BASE_URL}/acceptance-criteria?project_id=11", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Acceptance Criteria')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(FINAL_PRODUCT_DIR / "06_acceptance_criteria_workspace_1920x1080.png"))
        page.screenshot(path=str(DOCS_SCREENSHOTS / "10-acceptance-criteria-1920x1080.png"))

        # 07. Desktop Full (1920x1080): Test Case Management (EV_PAY)
        print("07: Test case management (1920x1080)...")
        page.goto(f"{BASE_URL}/tests?project_id=11", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Test')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(FINAL_PRODUCT_DIR / "07_test_case_management_1920x1080.png"))
        page.screenshot(path=str(DOCS_SCREENSHOTS / "12-test-cases-1920x1080.png"))

        # 08. Desktop Full (1920x1080): Execution Intelligence Dashboard (ECHO)
        print("08: Execution intelligence dashboard (1920x1080)...")
        page.goto(f"{BASE_URL}/executions?project_id=5", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Execution')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(FINAL_PRODUCT_DIR / "08_execution_intelligence_dashboard_1920x1080.png"))
        page.screenshot(path=str(DOCS_SCREENSHOTS / "18-test-runs-1920x1080.png"))

        # 09. Laptop (1440x900): Execution Detail & Comparison
        print("09: Execution detail and comparison (1440x900)...")
        page_laptop.goto(f"{BASE_URL}/executions?project_id=5", wait_until="networkidle")
        time.sleep(2)
        exec_row = page_laptop.locator("tr.cursor-pointer").first
        if exec_row.count() > 0:
            exec_row.click()
            time.sleep(1.5)
        inspect_btn = page_laptop.locator("button:has-text('Inspect')").first
        if inspect_btn.count() > 0:
            inspect_btn.click()
            time.sleep(1.5)
        page_laptop.screenshot(path=str(FINAL_PRODUCT_DIR / "09_execution_detail_and_comparison_1440x900.png"))
        page_laptop.keyboard.press("Escape")
        time.sleep(0.5)

        # 10. Desktop Full (1920x1080): Traceability Intelligence Overview
        print("10: Traceability Intelligence overview (1920x1080)...")
        page.goto(f"{BASE_URL}/traceability?project_id=11", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Traceability')", timeout=15000)
        time.sleep(2)
        page.screenshot(path=str(FINAL_PRODUCT_DIR / "10_traceability_intelligence_overview_1920x1080.png"))
        page.screenshot(path=str(DOCS_SCREENSHOTS / "11-traceability-matrix-1920x1080.png"))

        # 11. Desktop Full (1920x1080): Coverage Gap Explorer
        print("11: Coverage gap explorer (1920x1080)...")
        gaps_tab = page.locator("button:has-text('Coverage Gaps')").first
        if gaps_tab.count() > 0:
            gaps_tab.click()
            time.sleep(1.5)
        page.screenshot(path=str(FINAL_PRODUCT_DIR / "11_coverage_gap_explorer_1920x1080.png"))

        # 12. Standard PC (1366x768): Advanced Coverage Matrix
        print("12: Advanced coverage matrix (1366x768)...")
        ctx_pc = browser.new_context(viewport={"width": 1366, "height": 768})
        page_pc = ctx_pc.new_page()
        page_pc.goto(f"{BASE_URL}/traceability?project_id=11", wait_until="networkidle")
        time.sleep(2)
        matrix_tab = page_pc.locator("button:has-text('2D Coverage Matrix')").first
        if matrix_tab.count() > 0:
            matrix_tab.click()
            time.sleep(1.5)
        page_pc.screenshot(path=str(FINAL_PRODUCT_DIR / "12_advanced_coverage_matrix_1366x768.png"))

        # 13. Laptop (1440x900): Change Impact Analysis
        print("13: Change-impact analysis (1440x900)...")
        page_laptop.goto(f"{BASE_URL}/traceability?project_id=11", wait_until="networkidle")
        time.sleep(2)
        impact_tab = page_laptop.locator("button:has-text('Change Impact Intelligence')").first
        if impact_tab.count() > 0:
            impact_tab.click()
            time.sleep(1.5)
        page_laptop.screenshot(path=str(FINAL_PRODUCT_DIR / "13_change_impact_analysis_1440x900.png"))

        # 14. Laptop (1440x900): Traceability Governance Audit Ledger
        print("14: Audit ledger (1440x900)...")
        audit_tab = page_laptop.locator("button:has-text('Audit Ledger')").first
        if audit_tab.count() > 0:
            audit_tab.click()
            time.sleep(1.5)
        page_laptop.screenshot(path=str(FINAL_PRODUCT_DIR / "14_audit_ledger_1440x900.png"))

        # 15. Desktop Full (1920x1080): Amazon AWS Real-World Evaluation Project Overview
        print("15: AWS Evaluation Project Overview (1920x1080)...")
        page.evaluate("() => localStorage.setItem('tracetest.project', '12')")
        page.goto(f"{BASE_URL}/", wait_until="networkidle")
        time.sleep(2)
        page.screenshot(path=str(FINAL_PRODUCT_DIR / "15_new_evaluation_project_empty_state_1920x1080.png"))

        # 16. Desktop Full (1920x1080): Document Upload Workspace (Modal open)
        print("16: Document upload workspace modal (1920x1080)...")
        page.goto(f"{BASE_URL}/projects/12", wait_until="networkidle")
        time.sleep(1.5)
        upload_btn = page.locator("button:has-text('Upload Genuine Documents'), button:has-text('Upload Document'), button:has-text('New Document')").first
        if upload_btn.count() > 0:
            upload_btn.click()
            time.sleep(1)
        page.screenshot(path=str(FINAL_PRODUCT_DIR / "16_document_upload_workspace_modal_1920x1080.png"))
        page.keyboard.press("Escape")
        time.sleep(0.5)

        # 17. Laptop (1440x900): Document Processing Progress / Ingested Sources
        print("17: Document processing progress and ingested sources (1440x900)...")
        page_laptop.goto(f"{BASE_URL}/projects/12", wait_until="networkidle")
        time.sleep(2)
        page_laptop.screenshot(path=str(FINAL_PRODUCT_DIR / "17_document_processing_progress_1440x900.png"))

        # 18. Tablet (1024x768): Responsive Tablet Dashboard
        print("18: Responsive tablet dashboard (1024x768)...")
        ctx_tablet = browser.new_context(viewport={"width": 1024, "height": 768})
        page_tablet = ctx_tablet.new_page()
        page_tablet.goto(f"{BASE_URL}/", wait_until="networkidle")
        time.sleep(2)
        page_tablet.screenshot(path=str(FINAL_PRODUCT_DIR / "18_responsive_tablet_dashboard_1024x768.png"))
        page_tablet.screenshot(path=str(DOCS_SCREENSHOTS / "01-overview-1024.png"))
        ctx_tablet.close()

        # 19. Mobile (390x844): Responsive Mobile Dashboard
        print("19: Responsive mobile dashboard (390x844)...")
        ctx_mobile = browser.new_context(viewport={"width": 390, "height": 844})
        page_mobile = ctx_mobile.new_page()
        page_mobile.goto(f"{BASE_URL}/", wait_until="networkidle")
        time.sleep(2)
        page_mobile.screenshot(path=str(FINAL_PRODUCT_DIR / "19_responsive_mobile_dashboard_390x844.png"))
        page_mobile.screenshot(path=str(DOCS_SCREENSHOTS / "01-overview-390.png"))
        ctx_mobile.close()

        # =====================================================================
        # 2. DASHBOARD REDESIGN SUITE (docs/screenshots/dashboard-redesign/)
        # =====================================================================
        print("\n--- Capturing Dashboard Redesign Suite (docs/screenshots/dashboard-redesign/) ---")
        ctx_dash = browser.new_context(viewport={"width": 1440, "height": 900})
        page_dash = ctx_dash.new_page()

        # Switch to All Workspaces for aggregate view
        page_dash.goto(f"{BASE_URL}/", wait_until="networkidle")
        time.sleep(1)
        switcher_btn = page_dash.locator("button[aria-label='Project Workspace Selector']")
        if switcher_btn.count() > 0:
            switcher_btn.click()
            time.sleep(0.5)
            all_option = page_dash.locator("button:has-text('All Project Workspaces')").first
            if all_option.count() > 0:
                all_option.click()
                time.sleep(1.5)

        # 01. Dashboard Aggregate View Overview
        print("D01: Aggregate View Overview...")
        page_dash.screenshot(path=str(DASHBOARD_DIR / "01_dashboard_aggregate_view_overview.png"))
        page_dash.screenshot(path=str(DOCS_SCREENSHOTS / "01-overview-1440.png"))
        page_dash.screenshot(path=str(DOCS_SCREENSHOTS / "01-overview.png"))

        # 02. Dashboard Key Metrics Grid
        print("D02: Key Metrics Grid...")
        page_dash.screenshot(path=str(DASHBOARD_DIR / "02_dashboard_kpi_metrics_grid.png"))

        # 03. Scroll to Analytics Charts Grid
        print("D03: Analytics Charts Grid...")
        page_dash.evaluate("window.scrollTo(0, 500)")
        time.sleep(1)
        page_dash.screenshot(path=str(DASHBOARD_DIR / "03_dashboard_analytics_charts_grid.png"))

        # 04. Actionable Insights
        print("D04: Actionable Insights...")
        page_dash.evaluate("window.scrollTo(0, 1100)")
        time.sleep(1)
        page_dash.screenshot(path=str(DASHBOARD_DIR / "04_dashboard_actionable_insights.png"))

        # 05. Project Quality Table
        print("D05: Project Quality Table...")
        page_dash.evaluate("window.scrollTo(0, 1800)")
        time.sleep(1)
        page_dash.screenshot(path=str(DASHBOARD_DIR / "05_dashboard_project_quality_table.png"))

        # 06. Isolated Dashboard: ECHO
        print("D06: Isolated Dashboard ECHO...")
        switcher_btn.click()
        time.sleep(0.5)
        echo_opt = page_dash.locator("button:has-text('ECHO')").first
        if echo_opt.count() > 0:
            echo_opt.click()
            time.sleep(1.5)
            page_dash.evaluate("window.scrollTo(0, 0)")
            time.sleep(0.5)
            page_dash.screenshot(path=str(DASHBOARD_DIR / "06_dashboard_isolated_echobox.png"))

        # 07. Isolated Dashboard: EV_PAY
        print("D07: Isolated Dashboard EV_PAY...")
        switcher_btn.click()
        time.sleep(0.5)
        ev_opt = page_dash.locator("button:has-text('EV_PAY')").first
        if ev_opt.count() > 0:
            ev_opt.click()
            time.sleep(1.5)
            page_dash.evaluate("window.scrollTo(0, 0)")
            time.sleep(0.5)
            page_dash.screenshot(path=str(DASHBOARD_DIR / "07_dashboard_isolated_evpay.png"))

        # 08. Isolated Dashboard: AWS_EVAL
        print("D08: Isolated Dashboard AWS_EVAL...")
        switcher_btn.click()
        time.sleep(0.5)
        aws_opt = page_dash.locator("button:has-text('AWS_EVAL')").first
        if aws_opt.count() > 0:
            aws_opt.click()
            time.sleep(1.5)
            page_dash.evaluate("window.scrollTo(0, 0)")
            time.sleep(0.5)
            page_dash.screenshot(path=str(DASHBOARD_DIR / "08_dashboard_isolated_aws_eval.png"))

        # =====================================================================
        # 3. WORKSPACE ISOLATION SUITE (docs/screenshots/phase-7-amazon-aws/workspace-isolation/)
        # =====================================================================
        print("\n--- Capturing Workspace Isolation Suite ---")
        page_dash.goto(f"{BASE_URL}/projects", wait_until="networkidle")
        time.sleep(1)
        page_dash.screenshot(path=str(WORKSPACE_DIR / "01_projects_page_authoritative_inventory.png"))

        # Open switcher
        switcher_btn = page_dash.locator("button[aria-label='Project Workspace Selector']")
        switcher_btn.click()
        time.sleep(0.5)
        page_dash.screenshot(path=str(WORKSPACE_DIR / "02_project_switcher_open_aligned.png"))

        # Filter EV
        filter_input = page_dash.locator("input[placeholder='Filter workspaces...']")
        filter_input.fill("EV")
        time.sleep(0.5)
        page_dash.screenshot(path=str(WORKSPACE_DIR / "03_project_switcher_filter_match.png"))

        # Filter CUREON (No legacy)
        filter_input.fill("CUREON")
        time.sleep(0.5)
        page_dash.screenshot(path=str(WORKSPACE_DIR / "04_project_switcher_filter_no_legacy.png"))

        # Select ECHO
        filter_input.fill("")
        time.sleep(0.3)
        echo_opt = page_dash.locator("button:has-text('ECHO')").first
        if echo_opt.count() > 0:
            echo_opt.click()
            time.sleep(1)
            page_dash.screenshot(path=str(WORKSPACE_DIR / "05_project_selected_echobox.png"))

        # Select EV_PAY
        switcher_btn.click()
        time.sleep(0.5)
        ev_opt = page_dash.locator("button:has-text('EV_PAY')").first
        if ev_opt.count() > 0:
            ev_opt.click()
            time.sleep(1)
            page_dash.screenshot(path=str(WORKSPACE_DIR / "06_project_selected_payroll.png"))

        # Select AWS_EVAL
        switcher_btn.click()
        time.sleep(0.5)
        aws_opt = page_dash.locator("button:has-text('AWS_EVAL')").first
        if aws_opt.count() > 0:
            aws_opt.click()
            time.sleep(1)
            page_dash.screenshot(path=str(WORKSPACE_DIR / "07_project_selected_aws_eval.png"))

        # =====================================================================
        # 4. PHASE 7 AMAZON AWS SUITE (docs/screenshots/phase-7-amazon-aws/)
        # =====================================================================
        print("\n--- Capturing Amazon AWS Evaluation Suite ---")
        ctx_aws = browser.new_context(viewport={"width": 1440, "height": 900})
        page_aws = ctx_aws.new_page()

        # 02. Documents intake
        print("AWS 02: Documents intake complete...")
        page_aws.goto(f"{BASE_URL}/requirements?project_id=12", wait_until="networkidle")
        time.sleep(2)
        intake_tab = page_aws.locator("button:has-text('Document Intake')").first
        if intake_tab.count() > 0:
            intake_tab.click()
            time.sleep(1)
        page_aws.screenshot(path=str(AWS_DIR / "02_aws_documents_intake_complete.png"))

        # 03. Requirements matrix view
        print("AWS 03: Requirements matrix view...")
        matrix_tab = page_aws.locator("button:has-text('Requirements Matrix')").first
        if matrix_tab.count() > 0:
            matrix_tab.click()
            time.sleep(1)
        page_aws.screenshot(path=str(AWS_DIR / "03_aws_requirements_matrix_view.png"))

        # 04. Acceptance criteria view
        print("AWS 04: Acceptance criteria view...")
        page_aws.goto(f"{BASE_URL}/acceptance-criteria?project_id=12", wait_until="networkidle")
        time.sleep(2)
        page_aws.screenshot(path=str(AWS_DIR / "04_aws_acceptance_criteria_view.png"))

        # 05. Test cases catalog
        print("AWS 05: Test cases catalog...")
        page_aws.goto(f"{BASE_URL}/tests?project_id=12", wait_until="networkidle")
        time.sleep(2)
        page_aws.screenshot(path=str(AWS_DIR / "05_aws_test_cases_catalog.png"))

        # 06. Test execution results
        print("AWS 06: Test execution results...")
        page_aws.goto(f"{BASE_URL}/executions?project_id=12", wait_until="networkidle")
        time.sleep(2)
        page_aws.screenshot(path=str(AWS_DIR / "06_aws_test_execution_results.png"))

        # 07. Defect triage view
        print("AWS 07: Defect triage view...")
        page_aws.goto(f"{BASE_URL}/defects?project_id=12", wait_until="networkidle")
        time.sleep(2)
        page_aws.screenshot(path=str(AWS_DIR / "07_aws_defect_triage_view.png"))

        # 08. Traceability matrix
        print("AWS 08: Traceability matrix...")
        page_aws.goto(f"{BASE_URL}/traceability?project_id=12", wait_until="networkidle")
        time.sleep(2)
        page_aws.screenshot(path=str(AWS_DIR / "08_aws_traceability_matrix.png"))

        # 09. AWS project dashboard
        print("AWS 09: AWS project dashboard...")
        page_aws.evaluate("() => localStorage.setItem('tracetest.project', '12')")
        page_aws.goto(f"{BASE_URL}/", wait_until="networkidle")
        time.sleep(2)
        page_aws.screenshot(path=str(AWS_DIR / "09_aws_project_dashboard_final.png"))

        # Clean up contexts
        ctx_aws.close()
        ctx_dash.close()
        ctx_pc.close()
        ctx_laptop.close()
        ctx_desktop.close()
        browser.close()
        print("\nAll screenshot suites successfully captured!")

if __name__ == "__main__":
    run()

