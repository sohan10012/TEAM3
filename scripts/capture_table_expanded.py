import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page.goto("http://127.0.0.1:5173/requirements?project_id=13")
        page.wait_for_selector("text=Requirements", timeout=15000)
        time.sleep(1)

        # Click Extracted Requirements tab
        extracted_tab = page.locator("button:has-text('Extracted Requirements')").first
        if extracted_tab.is_visible():
            extracted_tab.click()
            time.sleep(1.5)

        # Wait for table
        page.wait_for_selector("table", timeout=10000)

        # Click "Expand All"
        expand_all_btn = page.locator("button:has-text('Expand All')").first
        if expand_all_btn.is_visible():
            expand_all_btn.click()
            time.sleep(1.5)

        page.screenshot(path="docs/reports/phase1_redesign/01_requirements_expanded_table.png")
        print("Captured 01_requirements_expanded_table.png successfully!")
        browser.close()

if __name__ == "__main__":
    run()
