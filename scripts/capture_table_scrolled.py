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

        extracted_tab = page.locator("button:has-text('Extracted Requirements')").first
        if extracted_tab.is_visible():
            extracted_tab.click()
            time.sleep(1.5)

        expand_all_btn = page.locator("button:has-text('Expand All')").first
        if expand_all_btn.is_visible():
            expand_all_btn.click()
            time.sleep(1.5)

        # Scroll down so the expanded detail card is in full view
        page.evaluate("window.scrollBy(0, 420)")
        time.sleep(1)

        page.screenshot(path="docs/reports/phase1_redesign/01b_requirements_expanded_detail.png")
        print("Captured 01b_requirements_expanded_detail.png successfully!")
        browser.close()

if __name__ == "__main__":
    run()

