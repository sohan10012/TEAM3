"""Capture pristine laptop view screenshots across major screens at 1440px and 1280px and run axe-core accessibility audits.

Usage: python scripts/capture_screenshots.py --base http://127.0.0.1:8000 --chrome /usr/bin/chromium
"""
import argparse
import json
from pathlib import Path

from axe_core_python.sync_playwright import Axe
from playwright.sync_api import sync_playwright

SCREENS = [
    ("01-overview", "/", None),
    ("02-requirements", "/requirements", None),
    ("03-tests", "/tests", None),
    ("04-approval-workspace", "/tests/review", None),
    ("05-suites", "/suites", None),
    ("06-executions", "/executions", None),
    ("07-defects", "/defects", None),
    ("08-traceability", "/traceability", None),
    ("09-analytics", "/analytics", None),
    ("10-settings", "/settings", None),
    ("11-intelligence-report", "/intelligence-report", None),
    ("12-simulation", "/simulation", None),
]

VIEWPORTS = [
    (1440, 900, "1440"),
    (1280, 800, "1280"),
    (1024, 768, "1024"),
    (390, 844, "390"),
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8000")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[1] / "docs" / "screenshots"))
    ap.add_argument("--chrome", default="/usr/bin/chromium", help="Path to Chromium executable")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    problems = []
    a11y_summary = {}

    axe = Axe()

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=a.chrome) if a.chrome else p.chromium.launch()
        for width, height, _name in VIEWPORTS:
            ctx = browser.new_context(viewport={"width": width, "height": height})
            try:
                ctx.request.post(
                    a.base + "/api/v1/auth/switch-operator",
                    data={"persona": "operator"},
                )
            except Exception:
                pass
            page = ctx.new_page()
            errors: list[str] = []
            page.on("console", lambda m, e=errors: e.append(m.text) if m.type == "error" else None)

            for sname, path, action in SCREENS:
                page.goto(a.base + path)
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(600)
                if action == "row":
                    rows = page.locator("tbody tr")
                    if rows.count():
                        rows.nth(min(1, rows.count() - 1)).click()
                        page.wait_for_timeout(300)

                overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
                if overflow:
                    problems.append(f"{sname}@{width}: horizontal page overflow")
                page.screenshot(path=str(out / f"{sname}-{width}.png"))
                if width == 1440:
                    page.screenshot(path=str(out / f"{sname}.png"))

                # Run axe on 1440px laptop viewport
                if width == 1440:
                    try:
                        res = axe.run(page)
                        violations = res.get("violations", [])
                        crit = sum(1 for v in violations if v.get("impact") == "critical")
                        ser = sum(1 for v in violations if v.get("impact") == "serious")
                        mod = sum(1 for v in violations if v.get("impact") == "moderate")
                        min_v = sum(1 for v in violations if v.get("impact") == "minor")
                        a11y_summary[sname] = {
                            "total_violations": len(violations),
                            "critical": crit,
                            "serious": ser,
                            "moderate": mod,
                            "minor": min_v,
                            "violations": [{
                                "id": v.get("id"),
                                "impact": v.get("impact"),
                                "description": v.get("description"),
                                "help": v.get("help"),
                                "nodes_count": len(v.get("nodes", []))
                            } for v in violations]
                        }
                    except Exception as exc:
                        a11y_summary[sname] = {"error": str(exc)}

            if errors:
                problems.append(f"console errors at {width}px: {errors[:5]}")
            ctx.close()
        browser.close()

    a11y_file = Path(__file__).resolve().parents[1] / "docs" / "a11y-report.json"
    a11y_file.write_text(json.dumps(a11y_summary, indent=2), encoding="utf-8")

    total_captured = len(SCREENS) * len(VIEWPORTS)
    print(f"Captured {total_captured} screenshots across {len(VIEWPORTS)} viewports in {out}")
    print(f"Saved accessibility audit report in {a11y_file}")
    print("\n".join(problems) if problems else "Verification passed: No layout overflow or console errors detected across all viewports.")


if __name__ == "__main__":
    main()
