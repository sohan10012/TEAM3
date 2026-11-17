"""
Phase 8: ReasonX Production-Grade Enterprise Conversational Workspace Redesign
Playwright Screenshot Suite.
Captures authentic screenshots into docs/screenshots/reasonx-redesign/
"""
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUTPUT_DIR = Path("/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/reasonx-redesign")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def capture_all():
    print("=" * 80)
    print("CAPTURING REASONX PRODUCTION REDESIGN SCREENSHOTS")
    print(f"Output Directory: {OUTPUT_DIR}")
    print("=" * 80)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)

        # ---------------------------------------------------------------------
        # Viewport: Desktop 1440 x 900
        # ---------------------------------------------------------------------
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        print("Navigating to AWS_EVAL dashboard...")
        page.goto("http://127.0.0.1:5173/dashboard?project_id=12", wait_until="networkidle")
        time.sleep(2)

        # 1. 01_drawer_standard_empty.png
        print("1. Capturing 01_drawer_standard_empty.png...")
        launcher = page.locator("button[aria-label*='ReasonX']").first
        launcher.click()
        time.sleep(1)

        # Click New Conversation to ensure clean empty state
        new_conv_btn = page.locator("button[title='New conversation']").first
        if new_conv_btn.is_visible():
            new_conv_btn.click()
            time.sleep(0.5)

        page.wait_for_selector("text=How can I help?", timeout=5000)
        page.screenshot(path=str(OUTPUT_DIR / "01_drawer_standard_empty.png"))

        # 2. 02_redesigned_header.png (Element screenshot of the redesigned header)
        print("2. Capturing 02_redesigned_header.png...")
        drawer_header = page.locator("div[role='dialog'] div.flex.h-14").first
        if drawer_header.is_visible():
            drawer_header.screenshot(path=str(OUTPUT_DIR / "02_redesigned_header.png"))
        else:
            page.screenshot(path=str(OUTPUT_DIR / "02_redesigned_header.png"))

        # 3. 03_quick_assistance_project_overview.png
        print("3. Capturing 03_quick_assistance_project_overview.png...")
        page.locator("button:has-text('Project Overview')").first.click()
        time.sleep(0.5)
        page.screenshot(path=str(OUTPUT_DIR / "03_quick_assistance_project_overview.png"))

        # 4. 04_quick_assistance_requirements_coverage.png
        print("4. Capturing 04_quick_assistance_requirements_coverage.png...")
        page.locator("button:has-text('Requirements & Coverage')").first.click()
        time.sleep(0.5)
        page.screenshot(path=str(OUTPUT_DIR / "04_quick_assistance_requirements_coverage.png"))

        # 5. 05_quick_assistance_test_intelligence.png
        print("5. Capturing 05_quick_assistance_test_intelligence.png...")
        page.locator("button:has-text('Test Intelligence')").first.click()
        time.sleep(0.5)
        page.screenshot(path=str(OUTPUT_DIR / "05_quick_assistance_test_intelligence.png"))

        # 6. 06_active_conversation.png (Load an existing active conversation from history)
        print("6. Capturing 06_active_conversation.png...")
        hist_btn = page.locator("button[title='Conversation history']").first
        hist_btn.click()
        time.sleep(0.8)

        # Select a real conversation with full explanation & evidence
        first_conv = page.locator("div:has-text('regression plan')").first
        if not first_conv.is_visible():
            first_conv = page.locator("div.group.relative.flex.items-start").first
        first_conv.click()
        time.sleep(1.5)
        page.screenshot(path=str(OUTPUT_DIR / "06_active_conversation.png"))

        # 7. 07_real_conversation_history.png
        print("7. Capturing 07_real_conversation_history.png...")
        hist_btn.click()
        time.sleep(0.8)
        page.screenshot(path=str(OUTPUT_DIR / "07_real_conversation_history.png"))

        # Close history
        page.locator("button[aria-label='Close history']").first.click()
        time.sleep(0.5)

        # 8. 08_empty_conversation_history.png
        print("8. Capturing 08_empty_conversation_history.png...")

        def handle_empty_convs(route):
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"conversations": []}),
            )

        page.route("**/api/v1/reasonx/projects/*/conversations", handle_empty_convs)
        hist_btn.click()
        time.sleep(1.0)
        page.screenshot(path=str(OUTPUT_DIR / "08_empty_conversation_history.png"))
        page.unroute("**/api/v1/reasonx/projects/*/conversations", handle_empty_convs)

        # Close history
        page.locator("button[aria-label='Close history']").first.click()
        time.sleep(0.5)

        # 9. 09_agent_execution_progress.png
        print("9. Capturing 09_agent_execution_progress.png...")
        # Scroll to view the execution plan timeline in conversation 59
        timeline = page.locator("div:has-text('Execution Plan')").first
        if timeline.is_visible():
            timeline.scroll_into_view_if_needed()
            time.sleep(0.5)
        page.screenshot(path=str(OUTPUT_DIR / "09_agent_execution_progress.png"))

        # 10. 10_human_approval_card.png
        print("10. Capturing 10_human_approval_card.png...")

        # Provide a route interception for messages that contains an approval card
        def handle_approval_messages(route):
            mock_msgs = [
                {
                    "id": 991,
                    "role": "user",
                    "content": "Create a critical defect for the unencrypted S3 bucket policy failure.",
                    "created_at": "2026-11-17T17:30:00Z",
                },
                {
                    "id": 992,
                    "role": "assistant",
                    "content": "I have formulated a persistent defect record to track this critical security vulnerability. Because creating a defect is a Level 3 state-modifying action, please review and confirm execution.",
                    "structured_payload": {
                        "direct_answer": "Level 3 Gate: Defect proposal ready for operator confirmation.",
                        "explanation": "### Defect Specification\n- **Title:** S3 Bucket Enforce TLS 1.2 Policy Defect\n- **Severity:** Critical\n- **Clause Key:** REQ-AWS-0001 (Data in Transit Encryption)\n- **Impact:** Non-compliant buckets allow unencrypted HTTP transport contrary to statutory cloud baseline.",
                        "approval_request": {
                            "task_id": 881,
                            "action": "create_defect",
                            "risk_level": 3,
                            "impact_summary": "Will create a persistent Defect record in project AWS_EVAL with severity Critical.",
                            "payload": {
                                "title": "S3 Bucket Enforce TLS 1.2 Policy Defect",
                                "severity": "critical",
                                "clause_key": "REQ-AWS-0001",
                            },
                        },
                        "confidence_level": "HIGH",
                    },
                    "created_at": "2026-11-17T17:30:02Z",
                },
            ]
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"messages": mock_msgs}),
            )

        page.route("**/api/v1/reasonx/conversations/*/messages", handle_approval_messages)
        # Re-trigger query
        page.evaluate("window.location.hash = '#approval'")
        # Click on conversation item to refetch
        hist_btn.click()
        time.sleep(0.5)
        page.locator("div.group.relative.flex.items-start").first.click()
        time.sleep(1.5)
        page.screenshot(path=str(OUTPUT_DIR / "10_human_approval_card.png"))
        page.unroute("**/api/v1/reasonx/conversations/*/messages", handle_approval_messages)

        # ---------------------------------------------------------------------
        # 11. 11_expanded_desktop_drawer.png (Desktop 1920 x 1080)
        # ---------------------------------------------------------------------
        print("11. Capturing 11_expanded_desktop_drawer.png...")
        ctx_wide = browser.new_context(viewport={"width": 1920, "height": 1080})
        page_wide = ctx_wide.new_page()
        page_wide.goto("http://127.0.0.1:5173/dashboard?project_id=12", wait_until="networkidle")
        time.sleep(1.5)

        # Open launcher
        page_wide.locator("button[aria-label*='ReasonX']").first.click()
        time.sleep(0.8)

        # Click Expand Drawer
        expand_btn = page_wide.locator("button[title='Expand drawer']").first
        if expand_btn.is_visible():
            expand_btn.click()
            time.sleep(0.8)

        page_wide.screenshot(path=str(OUTPUT_DIR / "11_expanded_desktop_drawer.png"))
        ctx_wide.close()

        # ---------------------------------------------------------------------
        # 12. 12_mobile_drawer.png (Mobile 390 x 844)
        # ---------------------------------------------------------------------
        print("12. Capturing 12_mobile_drawer.png...")
        ctx_mobile = browser.new_context(
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        )
        page_mobile = ctx_mobile.new_page()
        page_mobile.goto("http://127.0.0.1:5173/dashboard?project_id=12", wait_until="networkidle")
        time.sleep(1.5)

        # Open launcher
        page_mobile.locator("button[aria-label*='ReasonX']").first.click()
        time.sleep(1.0)
        page_mobile.screenshot(path=str(OUTPUT_DIR / "12_mobile_drawer.png"))
        ctx_mobile.close()

        browser.close()
        print("\nAll 12 authentic ReasonX redesign screenshots captured successfully.")


if __name__ == "__main__":
    capture_all()

