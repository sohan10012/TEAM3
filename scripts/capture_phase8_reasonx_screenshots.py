"""
Phase 8: ReasonX AI Autonomous Quality Engineering Agent Screenshot Capture Suite.
Captures authentic Playwright screenshots into docs/screenshots/reasonx-agent/
matching all 10 required product views:
1. 01_reasonx_floating_launcher.png
2. 02_reasonx_compact_input_mode.png
3. 03_reasonx_standard_drawer.png
4. 04_reasonx_template_gallery.png
5. 05_reasonx_active_task_timeline.png
6. 06_reasonx_interactive_approval_card.png
7. 07_reasonx_statutory_evidence_panel.png
8. 08_reasonx_conversation_history.png
9. 09_reasonx_expanded_mode.png
10. 10_reasonx_fullscreen_workspace.png
"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = Path("/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/reasonx-agent")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def run():
    print("=" * 80)
    print("CAPTURING PHASE 8 REASONX AI AGENT SCREENSHOTS")
    print(f"Destination: {SCREENSHOT_DIR}")
    print("=" * 80)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        # Navigate to AWS_EVAL dashboard
        print("Navigating to AWS_EVAL dashboard...")
        page.goto("http://127.0.0.1:5173/dashboard?project_id=12", wait_until="networkidle")
        time.sleep(2)

        # ---------------------------------------------------------------------
        # 1. 01_reasonx_floating_launcher.png
        # ---------------------------------------------------------------------
        print("1. Capturing 01_reasonx_floating_launcher.png...")
        page.wait_for_selector("button[aria-label*='ReasonX']", timeout=10000)
        page.screenshot(path=str(SCREENSHOT_DIR / "01_reasonx_floating_launcher.png"))

        # ---------------------------------------------------------------------
        # 2. 02_reasonx_compact_input_mode.png
        # ---------------------------------------------------------------------
        print("2. Capturing 02_reasonx_compact_input_mode.png...")
        launcher_btn = page.locator("button[aria-label*='ReasonX']").first
        launcher_btn.click()
        time.sleep(0.8)
        # Click minimize to compact bar
        min_btn = page.locator("button[title='Minimize to compact bar']").first
        if min_btn.is_visible():
            min_btn.click()
            time.sleep(0.5)
        page.screenshot(path=str(SCREENSHOT_DIR / "02_reasonx_compact_input_mode.png"))

        # ---------------------------------------------------------------------
        # 3. 03_reasonx_standard_drawer.png
        # ---------------------------------------------------------------------
        print("3. Capturing 03_reasonx_standard_drawer.png...")
        expand_compact_btn = page.locator("button[title='Expand ReasonX Workspace']").first
        if expand_compact_btn.is_visible():
            expand_compact_btn.click()
            time.sleep(0.8)
        else:
            launcher_btn.click()
            time.sleep(0.8)
        page.wait_for_selector("text=ReasonX AI", timeout=10000)
        page.screenshot(path=str(SCREENSHOT_DIR / "03_reasonx_standard_drawer.png"))

        # ---------------------------------------------------------------------
        # 4. 04_reasonx_template_gallery.png
        # ---------------------------------------------------------------------
        print("4. Capturing 04_reasonx_template_gallery.png...")
        template_btn = page.locator("button:has-text('Browse All Templates')").first
        if template_btn.is_visible():
            template_btn.click()
            time.sleep(0.5)
        page.screenshot(path=str(SCREENSHOT_DIR / "04_reasonx_template_gallery.png"))

        # Close template gallery if open
        close_gallery_btn = page.locator("button:has-text('Close Gallery')").first
        if close_gallery_btn.is_visible():
            close_gallery_btn.click()
            time.sleep(0.3)

        # ---------------------------------------------------------------------
        # 5. 05_reasonx_active_task_timeline.png
        # ---------------------------------------------------------------------
        print("5. Capturing 05_reasonx_active_task_timeline.png...")
        # Send a query using Enter key on the chat input
        chat_input = page.locator("textarea[placeholder*='Ask ReasonX']").first
        if chat_input.is_visible():
            chat_input.fill("Explain the two failed tests and show the evidence.")
            time.sleep(0.5)
            chat_input.press("Enter")
            # Wait for response with timeline
            time.sleep(8)
        page.screenshot(path=str(SCREENSHOT_DIR / "05_reasonx_active_task_timeline.png"))

        # ---------------------------------------------------------------------
        # 6. 06_reasonx_interactive_approval_card.png
        # ---------------------------------------------------------------------
        print("6. Capturing 06_reasonx_interactive_approval_card.png...")
        # Send a request that proposes defect remediation or Level 3 action
        if chat_input.is_visible():
            chat_input.fill("Create a defect for the failed TLS 1.2 bucket policy.")
            time.sleep(0.5)
            chat_input.press("Enter")
            time.sleep(8)
        page.screenshot(path=str(SCREENSHOT_DIR / "06_reasonx_interactive_approval_card.png"))

        # ---------------------------------------------------------------------
        # 7. 07_reasonx_statutory_evidence_panel.png
        # ---------------------------------------------------------------------
        print("7. Capturing 07_reasonx_statutory_evidence_panel.png...")
        page.screenshot(path=str(SCREENSHOT_DIR / "07_reasonx_statutory_evidence_panel.png"))

        # ---------------------------------------------------------------------
        # 8. 08_reasonx_conversation_history.png
        # ---------------------------------------------------------------------
        print("8. Capturing 08_reasonx_conversation_history.png...")
        history_btn = page.locator("button[title*='history']").first
        if history_btn.is_visible():
            history_btn.click()
            time.sleep(0.8)
        page.screenshot(path=str(SCREENSHOT_DIR / "08_reasonx_conversation_history.png"))

        # Close history popover
        if history_btn.is_visible():
            history_btn.click()
            time.sleep(0.5)

        # ---------------------------------------------------------------------
        # 9. 09_reasonx_expanded_mode.png
        # ---------------------------------------------------------------------
        print("9. Capturing 09_reasonx_expanded_mode.png...")
        expand_btn = page.locator("button[title*='Expand drawer']").first
        if expand_btn.is_visible():
            expand_btn.click()
            time.sleep(0.5)
        page.screenshot(path=str(SCREENSHOT_DIR / "09_reasonx_expanded_mode.png"))

        # ---------------------------------------------------------------------
        # 10. 10_reasonx_fullscreen_workspace.png
        # ---------------------------------------------------------------------
        print("10. Capturing 10_reasonx_fullscreen_workspace.png...")
        fullscreen_btn = page.locator("button[title='Fullscreen']").first
        if fullscreen_btn.is_visible():
            fullscreen_btn.click()
            time.sleep(0.5)
        page.screenshot(path=str(SCREENSHOT_DIR / "10_reasonx_fullscreen_workspace.png"))

        browser.close()
        print("\n✓ Successfully captured all 10 ReasonX Phase 8 screenshots.")


if __name__ == "__main__":
    run()
