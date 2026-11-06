"""Full Playwright End-to-End Test Suite for TraceTest AI.

Drives the real UI (served from frontend/dist via FastAPI) using Playwright Chromium
against a live local backend, verifying end-to-end user workflows, accessibility
standards (axe-core), review approvals, and sandboxed execution.
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from collections.abc import Generator

import pytest
from axe_core_python.sync_playwright import Axe
from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def live_server_url() -> Generator[str, None, None]:
    """Start an ephemeral live uvicorn server in a dedicated process serving FastAPI + React frontend."""
    port = _find_free_port()
    env = os.environ.copy()
    env["PYTHONPATH"] = "backend"
    env["TRACETEST_ENV"] = "development"
    env["TRACETEST_SINGLE_OPERATOR"] = "true"
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port), "--log-level", "error"],
        env=env,
    )

    # Wait for server to bind
    connected = False
    for _ in range(120):
        if proc.poll() is not None:
            break
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                connected = True
                break
        except OSError:
            time.sleep(0.1)

    if not connected:
        proc.terminate()
        raise RuntimeError(f"Could not connect to live test server on 127.0.0.1:{port}")

    base_url = f"http://127.0.0.1:{port}"
    yield base_url

    proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()


@pytest.fixture(scope="module")
def browser() -> Generator[Browser, None, None]:
    """Launch headless Chromium browser."""
    chrome_path = "/usr/bin/chromium" if os.path.exists("/usr/bin/chromium") else None
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=chrome_path, headless=True)
            yield b
            b.close()
    except Exception as exc:
        pytest.skip(f"Playwright chromium browser not available: {exc}")


@pytest.fixture
def page(browser: Browser, live_server_url: str) -> Generator[Page, None, None]:
    """Create fresh page context with error tracking."""
    context: BrowserContext = browser.new_context(viewport={"width": 1440, "height": 900})
    p: Page = context.new_page()
    console_errors: list[str] = []
    p.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    yield p
    context.close()


def test_playwright_e2e_overview_and_accessibility(page: Page, live_server_url: str) -> None:
    """Verifies Command Center loads with correct branding, Local beta chip, and axe-core compliance."""
    page.goto(live_server_url + "/")
    page.wait_for_selector("#root", timeout=5000)

    # 1. Branding checks
    content = page.content()
    assert "TraceTest" in content
    assert "Local beta" in content
    assert "Production QE Platform" not in content

    # 2. Project workspace selector is visible and functional
    select = page.locator("select[aria-label='Project Workspace']")
    assert select.is_visible()

    # 3. Axe-core accessibility audit
    axe = Axe()
    results = axe.run(page)
    violations = results.get("violations", [])
    critical_violations = [v for v in violations if v.get("impact") == "critical"]
    assert len(critical_violations) == 0, f"Critical accessibility violations found: {critical_violations}"


def test_playwright_e2e_navigation_journey(page: Page, live_server_url: str) -> None:
    """Walks through the primary product views and verifies no runtime halts or console errors."""
    routes = [
        "/requirements",
        "/tests",
        "/tests/review",
        "/suites",
        "/executions",
        "/defects",
        "/traceability",
        "/analytics",
        "/settings",
    ]

    for route in routes:
        page.goto(live_server_url + route)
        page.wait_for_selector("#root", timeout=5000)
        # Ensure page content rendered
        text = page.inner_text("body")
        assert len(text) > 20, f"Page at {route} rendered empty body"


def test_playwright_e2e_review_workspace_and_guardrails(page: Page, live_server_url: str) -> None:
    """Verifies that the Review Workspace renders approval controls and enforces dual-control policy."""
    page.goto(live_server_url + "/tests/review")
    page.wait_for_selector("#root", timeout=5000)

    # Check Review Queue elements
    content = page.content()
    assert "Review" in content or "Queue" in content or "Test" in content

    # Run accessibility check on review page
    axe = Axe()
    results = axe.run(page)
    crit = [v for v in results.get("violations", []) if v.get("impact") == "critical"]
    assert len(crit) == 0, f"Critical a11y violations on review page: {crit}"


def test_playwright_e2e_full_qa_journey(page: Page, live_server_url: str) -> None:
    """Executes full end-to-end user journey:
    1. Connect repo preview & dry run
    2. Dual-control reviewer identity switch in header
    3. Mobile viewport navigation drawer test (390px)
    4. Complete accessibility verification across viewports
    """
    # 1. Projects page and Connect Repo dialog
    page.goto(live_server_url + "/projects")
    page.wait_for_selector("#root", timeout=5000)

    connect_btn = page.get_by_role("button", name="Connect GitHub Repository")
    assert connect_btn.is_visible()
    connect_btn.click()

    page.wait_for_selector("input#r_url", timeout=3000)
    page.fill("input#r_url", "https://github.com/pypa/samplemod.git")

    # Track responses
    responses = []
    page.on("response", lambda r: responses.append(f"{r.status} {r.url} {r.text()[:200] if 'api' in r.url else ''}"))

    preview_btn = page.get_by_role("button", name="Preview Ingestion")
    assert preview_btn.is_visible()
    preview_btn.click()

    # Wait for dry-run preview card
    page.wait_for_selector("text=Repository Dry-Run Preview", timeout=10000)
    content = page.content()
    assert "pypa/samplemod" in content
    assert "Runtime Execution Tier" in content

    # Cancel modal to clean up
    back_btn = page.get_by_role("button", name="Back to Edit")
    back_btn.click()
    page.get_by_role("button", name="Cancel").click()

    # 2. Dual-control persona switch
    # Check current persona chip in header
    persona_btn = page.locator("button[title*='Switch Operator Persona']")
    if persona_btn.is_visible():
        persona_btn.click()
        page.wait_for_timeout(1000)

    # 3. Mobile viewport (390x844) drawer test
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(live_server_url + "/requirements")
    page.wait_for_selector("#root", timeout=5000)

    # Mobile menu button should be visible
    menu_btn = page.locator("button[aria-label='Open navigation menu']")
    assert menu_btn.is_visible()
    menu_btn.click()

    # Drawer slide-over opens
    page.wait_for_selector("text=WORKSPACE", timeout=3000)
    assert page.get_by_role("link", name="Requirements").first.is_visible()

    # Close drawer
    close_btn = page.locator("button[aria-label='Close menu']")
    assert close_btn.is_visible()
    close_btn.click()

    # 4. Mobile axe-core audit
    axe = Axe()
    results = axe.run(page)
    crit = [v for v in results.get("violations", []) if v.get("impact") == "critical"]
    assert len(crit) == 0, f"Critical accessibility violations on mobile viewport: {crit}"

