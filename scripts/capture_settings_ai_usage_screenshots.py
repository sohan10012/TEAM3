"""
Settings Redesign: AI Token Usage, Cost Transparency & Provider Management Screenshot Capture Suite.
Captures authentic Playwright screenshots into docs/screenshots/settings-ai-usage/
matching all 10 required views:
1. 01_settings_overview.png
2. 02_ai_providers_verified_health.png
3. 03_ai_usage_kpi_metrics.png
4. 04_token_breakdown_card.png
5. 05_cost_over_time_chart.png
6. 06_provider_model_cost_table.png
7. 07_cost_by_agent_attribution.png
8. 08_cost_by_project_breakdown.png
9. 09_export_modal_or_action.png
10. 10_execution_and_db_health.png
"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = Path("/home/Sohan/PROJECTS/tracetest-ai/docs/screenshots/settings-ai-usage")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def run():
    print("=" * 80)
    print("CAPTURING SETTINGS AI USAGE & COST REDESIGN SCREENSHOTS")
    print(f"Destination: {SCREENSHOT_DIR}")
    print("=" * 80)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 950})
        page = ctx.new_page()

        # Navigate to Settings page
        print("Navigating to Settings page...")
        page.goto("http://127.0.0.1:5173/settings", wait_until="networkidle")
        time.sleep(2.5)

        # ---------------------------------------------------------------------
        # 1. 01_settings_overview.png
        # ---------------------------------------------------------------------
        print("1. Capturing 01_settings_overview.png...")
        page.screenshot(path=str(SCREENSHOT_DIR / "01_settings_overview.png"), full_page=True)

        # ---------------------------------------------------------------------
        # 2. 02_ai_providers_verified_health.png
        # ---------------------------------------------------------------------
        print("2. Capturing 02_ai_providers_verified_health.png (Triggering Groq probe)...")
        # Scroll to AI Providers panel
        prov_panel = page.locator("section:has-text('AI Provider Configuration & Routing')").first
        prov_panel.scroll_into_view_if_needed()
        time.sleep(0.5)

        # Click Test Probe on Groq (second Test Probe button)
        probe_btns = page.locator("button:has-text('Test Probe')")
        if probe_btns.count() >= 2:
            probe_btns.nth(1).click()
            time.sleep(2.0)
        elif probe_btns.count() >= 1:
            probe_btns.first.click()
            time.sleep(2.0)

        prov_panel.screenshot(path=str(SCREENSHOT_DIR / "02_ai_providers_verified_health.png"))

        # ---------------------------------------------------------------------
        # 3. 03_ai_usage_kpi_metrics.png
        # ---------------------------------------------------------------------
        print("3. Capturing 03_ai_usage_kpi_metrics.png...")
        kpi_grid = page.locator("div.grid-cols-2.md\\:grid-cols-3.xl\\:grid-cols-6").first
        kpi_grid.scroll_into_view_if_needed()
        time.sleep(0.5)
        kpi_grid.screenshot(path=str(SCREENSHOT_DIR / "03_ai_usage_kpi_metrics.png"))

        # ---------------------------------------------------------------------
        # 4. 04_token_breakdown_card.png
        # ---------------------------------------------------------------------
        print("4. Capturing 04_token_breakdown_card.png...")
        token_card = page.locator("div:has-text('Token Telemetry Grounding & Verification')").locator("xpath=ancestor::div[contains(@class, 'rounded-lg') and contains(@class, 'border-slate-200')]").first
        token_card.scroll_into_view_if_needed()
        time.sleep(0.5)
        token_card.screenshot(path=str(SCREENSHOT_DIR / "04_token_breakdown_card.png"))

        # ---------------------------------------------------------------------
        # 5. 05_cost_over_time_chart.png
        # ---------------------------------------------------------------------
        print("5. Capturing 05_cost_over_time_chart.png...")
        chart_panel = page.locator("section:has-text('Cost & Token Consumption Over Time')").first
        chart_panel.scroll_into_view_if_needed()
        time.sleep(0.5)
        chart_panel.screenshot(path=str(SCREENSHOT_DIR / "05_cost_over_time_chart.png"))

        # ---------------------------------------------------------------------
        # 6. 06_provider_model_cost_table.png
        # ---------------------------------------------------------------------
        print("6. Capturing 06_provider_model_cost_table.png...")
        models_tab = page.locator("button:has-text('Provider & Model Breakdown')").first
        models_tab.scroll_into_view_if_needed()
        models_tab.click()
        time.sleep(0.6)
        # Capture the tabs section
        tabs_container = page.locator("div.space-y-4:has(button:has-text('Provider & Model Breakdown'))").first
        tabs_container.screenshot(path=str(SCREENSHOT_DIR / "06_provider_model_cost_table.png"))

        # ---------------------------------------------------------------------
        # 7. 07_cost_by_agent_attribution.png
        # ---------------------------------------------------------------------
        print("7. Capturing 07_cost_by_agent_attribution.png...")
        agents_tab = page.locator("button:has-text('Cost by Agent')").first
        agents_tab.click()
        time.sleep(0.6)
        tabs_container.screenshot(path=str(SCREENSHOT_DIR / "07_cost_by_agent_attribution.png"))

        # ---------------------------------------------------------------------
        # 8. 08_cost_by_project_breakdown.png
        # ---------------------------------------------------------------------
        print("8. Capturing 08_cost_by_project_breakdown.png...")
        projects_tab = page.locator("button:has-text('Cost by Project')").first
        projects_tab.click()
        time.sleep(0.6)
        tabs_container.screenshot(path=str(SCREENSHOT_DIR / "08_cost_by_project_breakdown.png"))

        # ---------------------------------------------------------------------
        # 9. 09_export_modal_or_action.png
        # ---------------------------------------------------------------------
        print("9. Capturing 09_export_modal_or_action.png...")
        controls_bar = page.locator("div.bg-white.p-3\\.5.rounded-lg.border.border-slate-200").first
        controls_bar.scroll_into_view_if_needed()
        time.sleep(0.5)
        controls_bar.screenshot(path=str(SCREENSHOT_DIR / "09_export_modal_or_action.png"))

        # ---------------------------------------------------------------------
        # 10. 10_execution_and_db_health.png
        # ---------------------------------------------------------------------
        print("10. Capturing 10_execution_and_db_health.png...")
        exec_db_grid = page.locator("div.grid.gap-6.xl\\:grid-cols-2:has-text('Execution Sandbox')").first
        exec_db_grid.scroll_into_view_if_needed()
        time.sleep(0.5)
        exec_db_grid.screenshot(path=str(SCREENSHOT_DIR / "10_execution_and_db_health.png"))

        print("\nAll 10 authentic screenshots successfully captured in:")
        print(f"{SCREENSHOT_DIR}")
        browser.close()


if __name__ == "__main__":
    run()

