"""
Phase 7 Workspace Isolation & Dashboard Redesign Screenshot Capture Suite.
Captures authentic screenshots of:
1. Workspace Isolation reconciliation (docs/screenshots/phase-7-amazon-aws/workspace-isolation/)
2. Dashboard Redesign (docs/screenshots/dashboard-redesign/)
"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

WORKSPACE_DIR = Path("/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/phase-7-amazon-aws/workspace-isolation")
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

DASHBOARD_DIR = Path("/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/dashboard-redesign")
DASHBOARD_DIR.mkdir(parents=True, exist_ok=True)

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        # ---------------------------------------------------------------------
        # PART A: Workspace Isolation Reconciliation
        # ---------------------------------------------------------------------
        print("Capturing Part A: Workspace Isolation...")

        # 01. Projects Page: Authoritative Inventory
        print("  01_projects_page_authoritative_inventory.png...")
        page.goto("http://127.0.0.1:5173/projects", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Projects')", timeout=10000)
        time.sleep(1)
        page.screenshot(path=str(WORKSPACE_DIR / "01_projects_page_authoritative_inventory.png"))

        # 02. Project Switcher Open Aligned
        print("  02_project_switcher_open_aligned.png...")
        switcher_btn = page.locator("button[aria-label='Project Workspace Selector']")
        switcher_btn.click()
        time.sleep(0.5)
        page.screenshot(path=str(WORKSPACE_DIR / "02_project_switcher_open_aligned.png"))

        # 03. Project Switcher Filter Match
        print("  03_project_switcher_filter_match.png...")
        filter_input = page.locator("input[placeholder='Filter workspaces...']")
        filter_input.fill("EV")
        time.sleep(0.5)
        page.screenshot(path=str(WORKSPACE_DIR / "03_project_switcher_filter_match.png"))

        # 04. Project Switcher Filter No Legacy (CUREON)
        print("  04_project_switcher_filter_no_legacy.png...")
        filter_input.fill("CUREON")
        time.sleep(0.5)
        page.screenshot(path=str(WORKSPACE_DIR / "04_project_switcher_filter_no_legacy.png"))

        # 05. Project Selected EchoBox
        print("  05_project_selected_echobox.png...")
        filter_input.fill("")
        time.sleep(0.3)
        echo_option = page.locator("button:has-text('ECHO')").first
        echo_option.click()
        time.sleep(1)
        page.screenshot(path=str(WORKSPACE_DIR / "05_project_selected_echobox.png"))

        # 06. Project Selected Enterprise Payroll (EV_PAY)
        print("  06_project_selected_payroll.png...")
        switcher_btn.click()
        time.sleep(0.5)
        evpay_option = page.locator("button:has-text('EV_PAY')").first
        evpay_option.click()
        time.sleep(1)
        page.screenshot(path=str(WORKSPACE_DIR / "06_project_selected_payroll.png"))

        # ---------------------------------------------------------------------
        # PART B: Dashboard Redesign
        # ---------------------------------------------------------------------
        print("Capturing Dashboard Redesign Screenshots...")

        # Switch to All Workspaces for aggregate view
        switcher_btn.click()
        time.sleep(0.5)
        all_option = page.locator("button:has-text('All Project Workspaces')").first
        all_option.click()
        time.sleep(1.5)

        # 01. Dashboard Aggregate View Overview
        print("  01_dashboard_aggregate_view_overview.png...")
        page.goto("http://127.0.0.1:5173/", wait_until="networkidle")
        time.sleep(2)
        page.screenshot(path=str(DASHBOARD_DIR / "01_dashboard_aggregate_view_overview.png"))

        # 02. Dashboard Key Metrics
        print("  02_dashboard_kpi_metrics_grid.png...")
        page.screenshot(path=str(DASHBOARD_DIR / "02_dashboard_kpi_metrics_grid.png"))

        # 03. Scroll to Analytics Charts Grid
        print("  03_dashboard_analytics_charts_grid.png...")
        page.evaluate("window.scrollTo(0, 500)")
        time.sleep(1)
        page.screenshot(path=str(DASHBOARD_DIR / "03_dashboard_analytics_charts_grid.png"))

        # 04. Actionable Insights & Recent Activity
        print("  04_dashboard_actionable_insights.png...")
        page.evaluate("window.scrollTo(0, 1100)")
        time.sleep(1)
        page.screenshot(path=str(DASHBOARD_DIR / "04_dashboard_actionable_insights.png"))

        # 05. QA Journey & Project Quality Table
        print("  05_dashboard_project_quality_table.png...")
        page.evaluate("window.scrollTo(0, 1800)")
        time.sleep(1)
        page.screenshot(path=str(DASHBOARD_DIR / "05_dashboard_project_quality_table.png"))

        # 06. Isolated Dashboard: ECHO
        print("  06_dashboard_isolated_echobox.png...")
        switcher_btn = page.locator("button[aria-label='Project Workspace Selector']")
        switcher_btn.click()
        time.sleep(0.5)
        echo_option = page.locator("button:has-text('ECHO')").first
        echo_option.click()
        time.sleep(1.5)
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(0.5)
        page.screenshot(path=str(DASHBOARD_DIR / "06_dashboard_isolated_echobox.png"))

        # 07. Isolated Dashboard: EV_PAY
        print("  07_dashboard_isolated_evpay.png...")
        switcher_btn.click()
        time.sleep(0.5)
        evpay_option = page.locator("button:has-text('EV_PAY')").first
        evpay_option.click()
        time.sleep(1.5)
        page.screenshot(path=str(DASHBOARD_DIR / "07_dashboard_isolated_evpay.png"))

        browser.close()
        print("All screenshots successfully captured!")

if __name__ == "__main__":
    run()

