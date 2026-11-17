import os
import time
from playwright.sync_api import sync_playwright

OUT_DIR = "/home/Sohan/PROJECTS/tracetest-ai/docs/reports/enterprise-evaluation/screenshots"
DOCS_SCREENSHOTS = "/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(DOCS_SCREENSHOTS, exist_ok=True)

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)

        # 1. Desktop Full (1920x1080) - Requirements Overview
        print("Capturing 01: Requirements Overview (1920x1080)...")
        ctx_desktop = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = ctx_desktop.new_page()

        # Set Dayforce project (ID: 9) in localStorage
        page.goto("http://127.0.0.1:5173/projects")
        page.wait_for_selector("h1:has-text('Projects')", timeout=15000)
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")

        # Navigate to requirements
        page.goto("http://127.0.0.1:5173/requirements?project_id=9", wait_until="networkidle")
        time.sleep(2)

        # Switch to "Extracted Requirements" tab if not active
        extracted_tab = page.locator("button:has-text('Extracted Requirements')").first
        if extracted_tab.count() > 0:
            extracted_tab.click()
            time.sleep(1.5)

        page.screenshot(path=f"{OUT_DIR}/01_requirements_overview_1920x1080.png")
        page.screenshot(path=f"{DOCS_SCREENSHOTS}/01_requirements_overview.png")

        # 2. Desktop Full (1920x1080) - Expanded Row
        print("Capturing 02: Requirements Expanded Row (1920x1080)...")
        # Click first expand chevron
        expand_btn = page.locator("button[title*='details'], button[aria-expanded]").first
        if expand_btn.count() > 0:
            expand_btn.click()
            time.sleep(2)
        page.screenshot(path=f"{OUT_DIR}/02_requirements_expanded_row_1920x1080.png")
        page.screenshot(path=f"{DOCS_SCREENSHOTS}/02_requirements_expanded.png")

        # 3. Desktop Full (1920x1080) - Right-side Detail Drawer
        print("Capturing 03: Requirement Detail Drawer (1920x1080)...")
        # Click Inspect button on the first row
        inspect_btn = page.locator("button:has-text('Inspect'), button[title*='Inspect']").first
        if inspect_btn.count() > 0:
            inspect_btn.click()
            time.sleep(2)
        page.screenshot(path=f"{OUT_DIR}/03_requirement_detail_drawer_1920x1080.png")
        page.screenshot(path=f"{DOCS_SCREENSHOTS}/03_requirement_drawer.png")
        ctx_desktop.close()

        # 4. Standard Laptop (1440x900) - Overview & Drawer
        print("Capturing 04: Standard Laptop (1440x900)...")
        ctx_laptop = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx_laptop.new_page()
        page.goto("http://127.0.0.1:5173/projects")
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")
        page.goto("http://127.0.0.1:5173/requirements?project_id=9", wait_until="networkidle")
        time.sleep(2)
        extracted_tab = page.locator("button:has-text('Extracted Requirements')").first
        if extracted_tab.count() > 0:
            extracted_tab.click()
            time.sleep(1.5)
        page.screenshot(path=f"{OUT_DIR}/04_requirements_overview_1440x900.png")

        inspect_btn = page.locator("button:has-text('Inspect'), button[title*='Inspect']").first
        if inspect_btn.count() > 0:
            inspect_btn.click()
            time.sleep(2)
        page.screenshot(path=f"{OUT_DIR}/05_requirements_detail_drawer_1440x900.png")
        ctx_laptop.close()

        # 5. Tablet View (1024x768)
        print("Capturing 06: Tablet View (1024x768)...")
        ctx_tablet = browser.new_context(viewport={"width": 1024, "height": 768})
        page = ctx_tablet.new_page()
        page.goto("http://127.0.0.1:5173/projects")
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")
        page.goto("http://127.0.0.1:5173/requirements?project_id=9", wait_until="networkidle")
        time.sleep(2)
        extracted_tab = page.locator("button:has-text('Extracted Requirements')").first
        if extracted_tab.count() > 0:
            extracted_tab.click()
            time.sleep(1.5)
        page.screenshot(path=f"{OUT_DIR}/06_requirements_tablet_1024x768.png")
        ctx_tablet.close()

        # 6. Mobile View (390x844 - iPhone 14 / Mobile standard)
        print("Capturing 07: Mobile View (390x844)...")
        ctx_mobile = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        page = ctx_mobile.new_page()
        page.goto("http://127.0.0.1:5173/projects")
        page.evaluate("() => localStorage.setItem('tracetest.project', '9')")
        page.goto("http://127.0.0.1:5173/requirements?project_id=9", wait_until="networkidle")
        time.sleep(2)
        extracted_tab = page.locator("button:has-text('Extracted Requirements')").first
        if extracted_tab.count() > 0:
            extracted_tab.click()
            time.sleep(1.5)
        page.screenshot(path=f"{OUT_DIR}/07_requirements_mobile_390x844.png")
        page.screenshot(path=f"{DOCS_SCREENSHOTS}/07_requirements_mobile.png")
        ctx_mobile.close()

        browser.close()
        print("Successfully captured all 7 enterprise requirements screenshots!")

if __name__ == "__main__":
    run()
