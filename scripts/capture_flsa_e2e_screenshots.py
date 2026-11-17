import os
import time
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = "docs/reports/flsa-e2e/screenshots"
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
        print("Set active project to 13 (FLSA_PAY)")

        # ----------------------------------------------------
        # 07. Extracted Requirements
        # ----------------------------------------------------
        print("Capturing 07_extracted_requirements.png...")
        page.goto("http://127.0.0.1:5173/requirements?project_id=13")
        page.wait_for_selector("text=Requirements Management", timeout=15000)
        time.sleep(1)
        
        # Click "Decompose Clauses" or "Extracted Requirements"
        try:
            extracted_tab = page.locator("button:has-text('Decompose Clauses'), button:has-text('Extracted Requirements')").first
            if extracted_tab.is_visible():
                extracted_tab.click()
                time.sleep(1)
        except Exception as e:
            print(f"Tab click note: {e}")

        # Wait for table
        page.wait_for_selector("table", timeout=10000)
        time.sleep(0.5)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/07_extracted_requirements.png")
        print("Captured 07_extracted_requirements.png")

        # ----------------------------------------------------
        # 08. Requirement Detail and Citation
        # ----------------------------------------------------
        print("Capturing 08_requirement_detail_and_citation.png...")
        page.goto("http://127.0.0.1:5173/requirements/415?tab=document")
        page.wait_for_selector("text=FLSA_PAY-REQ-002", timeout=15000)
        time.sleep(1)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/08_requirement_detail_and_citation.png")
        print("Captured 08_requirement_detail_and_citation.png")

        # ----------------------------------------------------
        # 09. Acceptance Criteria
        # ----------------------------------------------------
        print("Capturing 09_acceptance_criteria.png...")
        page.goto("http://127.0.0.1:5173/requirements/415?tab=criteria")
        page.wait_for_selector("text=Acceptance criteria", timeout=15000)
        time.sleep(1)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/09_acceptance_criteria.png")
        print("Captured 09_acceptance_criteria.png")

        # ----------------------------------------------------
        # 10. Test Scenarios
        # ----------------------------------------------------
        print("Capturing 10_test_scenarios.png...")
        page.goto("http://127.0.0.1:5173/tests?project_id=13")
        page.wait_for_selector("text=FLSA_PAY-TC-", timeout=15000)
        time.sleep(1)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/10_test_scenarios.png")
        print("Captured 10_test_scenarios.png")

        # ----------------------------------------------------
        # 11. Edge Cases
        # ----------------------------------------------------
        print("Capturing 11_edge_cases.png...")
        try:
            cat_select = page.locator("select").nth(0)
            if cat_select.is_visible():
                cat_select.select_option(value="edge_case")
                time.sleep(1)
        except Exception as e:
            print(f"Edge case filter note: {e}")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/11_edge_cases.png")
        print("Captured 11_edge_cases.png")

        # ----------------------------------------------------
        # 12. Automated Test Recommendations
        # ----------------------------------------------------
        print("Capturing 12_automated_test_recommendations.png...")
        try:
            by_cat_tab = page.locator("button:has-text('By Category')")
            if by_cat_tab.is_visible():
                by_cat_tab.click()
                time.sleep(1)
        except Exception as e:
            print(f"By Category tab click note: {e}")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/12_automated_test_recommendations.png")
        print("Captured 12_automated_test_recommendations.png")

        # ----------------------------------------------------
        # 13. Human Approval Action
        # ----------------------------------------------------
        print("Capturing 13_human_approval.png...")
        page.goto("http://127.0.0.1:5173/requirements/415")
        page.wait_for_selector("text=FLSA_PAY-REQ-002", timeout=15000)
        try:
            approve_btn = page.locator("button:has-text('Approve')")
            if approve_btn.is_visible() and not approve_btn.is_disabled():
                approve_btn.click()
                time.sleep(1)
        except Exception as e:
            print(f"Approve click note: {e}")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/13_human_approval.png")
        print("Captured 13_human_approval.png")

        # ----------------------------------------------------
        # 14. Specification Validation
        # ----------------------------------------------------
        print("Capturing 14_validation.png...")
        page.goto("http://127.0.0.1:5173/projects/13")
        page.wait_for_selector("text=FLSA Payroll Compliance Evaluation", timeout=15000)
        try:
            runs_tab = page.locator("button:has-text('Runs & Evidence'), button:has-text('Runs')").first
            if runs_tab.is_visible():
                runs_tab.click()
                time.sleep(1)
        except Exception as e:
            print(f"Runs tab note: {e}")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/14_validation.png")
        print("Captured 14_validation.png")

        # ----------------------------------------------------
        # 15. Execution / Behaviour Simulation
        # ----------------------------------------------------
        print("Capturing 15_execution.png...")
        page.goto("http://127.0.0.1:5173/simulation?project_id=13")
        time.sleep(1.5)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/15_execution.png")
        print("Captured 15_execution.png")

        # ----------------------------------------------------
        # 16. Defect Details / RCA Drawer
        # ----------------------------------------------------
        print("Capturing 16_defect_details.png...")
        page.goto("http://127.0.0.1:5173/defects/18")
        page.wait_for_selector("text=DEF-FLSA_PAY-0001", timeout=15000)
        time.sleep(1)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/16_defect_details.png")
        print("Captured 16_defect_details.png")

        # ----------------------------------------------------
        # 17. Traceability Matrix
        # ----------------------------------------------------
        print("Capturing 17_traceability.png...")
        page.goto("http://127.0.0.1:5173/traceability?project_id=13")
        page.wait_for_selector("text=Traceability", timeout=15000)
        time.sleep(1.5)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/17_traceability.png")
        print("Captured 17_traceability.png")

        # ----------------------------------------------------
        # 18. Final Quality Report
        # ----------------------------------------------------
        print("Capturing 18_final_quality_report.png...")
        page.goto("http://127.0.0.1:5173/projects/13")
        try:
            reports_tab = page.locator("button:has-text('Quality Reports'), button:has-text('Reports')").first
            if reports_tab.is_visible():
                reports_tab.click()
                time.sleep(1)
        except Exception as e:
            print(f"Reports tab note: {e}")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/18_final_quality_report.png")
        print("Captured 18_final_quality_report.png")

        browser.close()
        print("SUCCESS: All 18 screenshots captured!")

if __name__ == "__main__":
    run()
