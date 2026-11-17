import os
import time
from playwright.sync_api import sync_playwright

OUT_DIR = "/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/phase-5"
DOCS_EVAL_DIR = "/home/Sohan/PROJECTS/tracetest-ai/docs/reports/enterprise-evaluation/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(DOCS_EVAL_DIR, exist_ok=True)

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)

        # -------------------------------------------------------------
        # 1. Desktop Full (1920x1080) - Hierarchy & Executive Dashboard
        # -------------------------------------------------------------
        print("Capturing 01: Traceability Hierarchy & Governance Dashboard (1920x1080)...")
        ctx_desktop = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = ctx_desktop.new_page()

        page.goto("http://127.0.0.1:5173/traceability?project_id=9", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Traceability Intelligence')", timeout=15000)
        time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/01_traceability_hierarchy_1920x1080.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/01_phase5_traceability_hierarchy.png")

        # -------------------------------------------------------------
        # 2. Desktop Full (1920x1080) - Traceability Detail Drawer
        # -------------------------------------------------------------
        print("Capturing 02: Traceability Detail Drawer (1920x1080)...")
        node = page.locator("div.cursor-pointer:has-text('DAY-REQ-001')").first
        if node.count() > 0:
            node.click()
            time.sleep(1.5)

        page.screenshot(path=f"{OUT_DIR}/02_traceability_detail_drawer_1920x1080.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/02_phase5_traceability_detail_drawer.png")

        # Close the drawer with Escape key
        page.keyboard.press("Escape")
        time.sleep(1)

        # -------------------------------------------------------------
        # 3. Desktop Full (1920x1080) - Coverage Gaps Explorer
        # -------------------------------------------------------------
        print("Capturing 03: Coverage Gaps Explorer (1920x1080)...")
        gaps_tab = page.locator("button:has-text('Coverage Gaps')").first
        if gaps_tab.count() > 0:
            gaps_tab.click()
            time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/03_coverage_gaps_explorer_1920x1080.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/03_phase5_coverage_gaps_explorer.png")

        ctx_desktop.close()

        # -------------------------------------------------------------
        # 4. Laptop (1440x900) - 2D Coverage Matrix
        # -------------------------------------------------------------
        print("Capturing 04: 2D Coverage Matrix (1440x900)...")
        ctx_laptop = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx_laptop.new_page()

        page.goto("http://127.0.0.1:5173/traceability?project_id=9", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Traceability Intelligence')", timeout=15000)
        time.sleep(1.5)

        matrix_tab = page.locator("button:has-text('2D Coverage Matrix')").first
        if matrix_tab.count() > 0:
            matrix_tab.click()
            time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/04_2d_coverage_matrix_1440x900.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/04_phase5_2d_coverage_matrix.png")

        # -------------------------------------------------------------
        # 5. Laptop (1440x900) - Change Impact Intelligence
        # -------------------------------------------------------------
        print("Capturing 05: Change Impact Intelligence (1440x900)...")
        impact_tab = page.locator("button:has-text('Change Impact Intelligence')").first
        if impact_tab.count() > 0:
            impact_tab.click()
            time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/05_change_impact_intelligence_1440x900.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/05_phase5_change_impact_analysis.png")

        # -------------------------------------------------------------
        # 6. Laptop (1440x900) - QA Recommendations
        # -------------------------------------------------------------
        print("Capturing 06: QA Recommendations (1440x900)...")
        rec_tab = page.locator("button:has-text('QA Recommendations')").first
        if rec_tab.count() > 0:
            rec_tab.click()
            time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/06_qa_recommendations_1440x900.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/06_phase5_qa_recommendations.png")

        # -------------------------------------------------------------
        # 7. Laptop (1440x900) - Audit Ledger
        # -------------------------------------------------------------
        print("Capturing 07: Governance Audit Ledger (1440x900)...")
        audit_tab = page.locator("button:has-text('Audit Ledger')").first
        if audit_tab.count() > 0:
            audit_tab.click()
            time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/07_audit_ledger_1440x900.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/07_phase5_audit_ledger.png")

        ctx_laptop.close()

        # -------------------------------------------------------------
        # 8. Tablet (1024x768) - Responsive Tablet View
        # -------------------------------------------------------------
        print("Capturing 08: Responsive Tablet View (1024x768)...")
        ctx_tablet = browser.new_context(viewport={"width": 1024, "height": 768})
        page = ctx_tablet.new_page()

        page.goto("http://127.0.0.1:5173/traceability?project_id=9", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Traceability Intelligence')", timeout=15000)
        time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/08_traceability_tablet_1024x768.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/08_phase5_traceability_tablet.png")

        ctx_tablet.close()

        # -------------------------------------------------------------
        # 9. Mobile (390x844) - Responsive Mobile View
        # -------------------------------------------------------------
        print("Capturing 09: Responsive Mobile View (390x844)...")
        ctx_mobile = browser.new_context(viewport={"width": 390, "height": 844})
        page = ctx_mobile.new_page()

        page.goto("http://127.0.0.1:5173/traceability?project_id=9", wait_until="networkidle")
        page.wait_for_selector("h1:has-text('Traceability Intelligence')", timeout=15000)
        time.sleep(2)

        page.screenshot(path=f"{OUT_DIR}/09_traceability_mobile_390x844.png")
        page.screenshot(path=f"{DOCS_EVAL_DIR}/09_phase5_traceability_mobile.png")

        ctx_mobile.close()
        browser.close()
        print("Successfully captured and saved all 9 Phase 5 screenshots!")

if __name__ == "__main__":
    run()
