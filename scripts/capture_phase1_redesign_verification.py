import os
import time
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = "/home/Sohan/PROJECTS/tracetest-ai/docs/reports/phase1_redesign"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Set active project in localStorage
        page.goto("http://127.0.0.1:5173/projects")
        page.wait_for_selector("h1:has-text('Projects')", timeout=15000)
        page.evaluate("() => localStorage.setItem('tracetest.project', '13')")

        # 1. Requirements Management View
        print("Capturing 01: Requirements Management View...")
        page.goto("http://127.0.0.1:5173/requirements?project_id=13", wait_until="networkidle")
        time.sleep(2)
        # Click the first row expand button if available
        expand_btn = page.locator("button[aria-label*='Toggle details']").first
        if expand_btn.count() > 0:
            expand_btn.click()
            time.sleep(1)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/01_requirements_expanded_table.png")

        # 2. Test Cases Management View with 10 categories
        print("Capturing 02: Test Cases Management View...")
        page.goto("http://127.0.0.1:5173/tests?project_id=13", wait_until="networkidle")
        time.sleep(2)
        # Click on 'Boundary Value' category chip
        boundary_chip = page.locator("button:has-text('Boundary Value')").first
        if boundary_chip.count() > 0:
            boundary_chip.click()
            time.sleep(1)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/02_test_cases_10_categories.png")

        # 3. Traceability Explorer with 6-stage chain navigator
        print("Capturing 03: Traceability Explorer...")
        page.goto("http://127.0.0.1:5173/traceability?project_id=13", wait_until="networkidle")
        time.sleep(2)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/03_traceability_chain_navigator.png")

        # 4. Intelligence Report Release Gate
        print("Capturing 04: Intelligence Report Release Gate...")
        page.goto("http://127.0.0.1:5173/intelligence-report?project_id=13", wait_until="networkidle")
        time.sleep(2)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/04_intelligence_report_release_gate.png")

        # 5. Intelligence Report Defects & RCA Tab
        print("Capturing 05: Intelligence Report Defects & RCA Tab...")
        defects_tab = page.locator("button:has-text('Defects & RCA')").first
        if defects_tab.count() > 0:
            defects_tab.click()
            time.sleep(1)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/05_intelligence_report_defects_rca.png")

        # 6. Intelligence Report 10 Test Categories Tab
        print("Capturing 06: Intelligence Report 10 Test Categories Tab...")
        test_design_tab = page.locator("button:has-text('10 Test Categories')").first
        if test_design_tab.count() > 0:
            test_design_tab.click()
            time.sleep(1)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/06_intelligence_report_10_test_categories.png")

        # 7. Intelligence Report Executions Tab
        print("Capturing 07: Intelligence Report Executions Tab...")
        executions_tab = page.locator("button:has-text('Execution Breakdown')").first
        if executions_tab.count() > 0:
            executions_tab.click()
            time.sleep(1)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/07_intelligence_report_executions_breakdown.png")

        browser.close()
        print("All screenshots successfully captured!")

if __name__ == "__main__":
    run()
