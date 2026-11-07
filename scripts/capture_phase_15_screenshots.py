"""
Playwright script to capture all authentic Phase 15 screenshots across 5 viewports
and specific focused views for brand identity and project switcher.
"""
import time
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

OUTPUT_DIR = Path("docs/screenshots/phase-15")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def capture_all():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/chromium",
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        )

        viewports = [
            ("01_dashboard_desktop_1920.png", 1920, 1080),
            ("02_dashboard_desktop_1440.png", 1440, 900),
            ("03_dashboard_laptop_1366.png", 1366, 768),
            ("04_dashboard_tablet_1024.png", 1024, 768),
            ("05_dashboard_mobile_390.png", 390, 844),
        ]

        for filename, width, height in viewports:
            print(f"Capturing {filename} at {width}x{height}...")
            context = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=1,
            )
            page = context.new_page()

            # Pre-set active project to Dayforce (id=9)
            page.goto("http://127.0.0.1:5173/")
            page.evaluate("() => { localStorage.setItem('tracetest.project', '9'); }")
            page.goto("http://127.0.0.1:5173/", wait_until="networkidle")
            time.sleep(1.2)

            # Wait for visible project heading
            page.wait_for_selector('h1:has-text("Dayforce")', state="visible", timeout=10000)
            time.sleep(0.8)

            page.screenshot(
                path=str(OUTPUT_DIR / filename),
                full_page=False
            )
            context.close()

        # -------------------------------------------------------------
        # Screenshot 6: Project Switcher & Operations Menu
        # -------------------------------------------------------------
        print("Capturing 06_project_switcher_open.png...")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto("http://127.0.0.1:5173/")
        page.evaluate("() => { localStorage.setItem('tracetest.project', '9'); }")
        page.goto("http://127.0.0.1:5173/", wait_until="networkidle")
        time.sleep(1.2)

        page.wait_for_selector('h1:has-text("Dayforce")', state="visible", timeout=10000)

        # Click Project Switcher to demonstrate the Apple-inspired popover
        switcher_btn = page.locator('button[aria-label="Project Workspace Selector"]')
        if switcher_btn.is_visible():
            switcher_btn.click()
            time.sleep(0.5)

        page.screenshot(
            path=str(OUTPUT_DIR / "06_project_switcher_open.png"),
            full_page=False
        )
        context.close()

        # -------------------------------------------------------------
        # Screenshot 7: Sidebar Brand Identity Close-up / Overview
        # -------------------------------------------------------------
        print("Capturing 07_sidebar_brand_identity.png...")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto("http://127.0.0.1:5173/")
        page.evaluate("() => { localStorage.setItem('tracetest.project', '9'); }")
        page.goto("http://127.0.0.1:5173/", wait_until="networkidle")
        time.sleep(1.2)

        page.wait_for_selector('h1:has-text("Dayforce")', state="visible", timeout=10000)
        time.sleep(0.5)

        # Capture sidebar brand identity
        page.screenshot(
            path=str(OUTPUT_DIR / "07_sidebar_brand_identity.png"),
            full_page=False
        )
        context.close()

        browser.close()
        print("All Phase 15 screenshots captured successfully!")

if __name__ == "__main__":
    capture_all()
