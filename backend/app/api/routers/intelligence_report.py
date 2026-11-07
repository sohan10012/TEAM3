"""Project Intelligence Report API Router."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import Principal, current_principal, get_db, scoped_project_ids
from app.services.project_intelligence import (
    build_project_intelligence_report,
    generate_markdown_report,
)

router = APIRouter(tags=["intelligence_report"])


@router.get("/projects/{project_id}/intelligence-report")
def get_project_intelligence_report(
    project_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Retrieve the consolidated executive Project Intelligence Report."""
    scoped_project_ids(db, p, project_id)
    try:
        rep = build_project_intelligence_report(db, project_id, force_regenerate=False)
        return rep
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate intelligence report: {e}")


@router.post("/projects/{project_id}/intelligence-report/regenerate")
def regenerate_project_intelligence_report(
    project_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Force fresh recalculation of the Project Intelligence Report."""
    scoped_project_ids(db, p, project_id)
    try:
        rep = build_project_intelligence_report(db, project_id, force_regenerate=True)
        return rep
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to regenerate intelligence report: {e}")


@router.get("/projects/{project_id}/intelligence-report/export")
def export_project_intelligence_report(
    project_id: int,
    format: Literal["json", "markdown", "pdf"] = Query("markdown"),
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Export the Project Intelligence Report in JSON, Markdown, or print-ready format."""
    scoped_project_ids(db, p, project_id)
    try:
        rep = build_project_intelligence_report(db, project_id, force_regenerate=False)
        if format == "json":
            return rep
        if format == "markdown":
            md = generate_markdown_report(rep)
            return Response(
                content=md,
                media_type="text/markdown",
                headers={"Content-Disposition": f'attachment; filename="{rep["project_key"]}_Intelligence_Report.md"'},
            )
        # PDF / Print HTML representation
        md = generate_markdown_report(rep)
        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{rep['project_name']} — Intelligence Report</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 960px; margin: 40px auto; padding: 0 20px; }}
    h1 {{ color: #0f172a; border-bottom: 2px solid #3067db; padding-bottom: 8px; }}
    h2 {{ color: #1e293b; margin-top: 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }}
    table {{ border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 13px; }}
    th, td {{ border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }}
    th {{ background: #f8fafc; font-weight: 600; }}
    blockquote {{ border-left: 4px solid #3067db; margin: 16px 0; padding: 8px 16px; background: #eff6ff; }}
    @media print {{ body {{ margin: 0; padding: 0; }} }}
  </style>
</head>
<body>
  <pre style="white-space: pre-wrap; font-family: inherit;">{md}</pre>
</body>
</html>"""
        return Response(
            content=html_content,
            media_type="text/html",
            headers={"Content-Disposition": f'inline; filename="{rep["project_key"]}_Intelligence_Report.html"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
