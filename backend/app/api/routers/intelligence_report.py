"""Project Intelligence Report API Router."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import Principal, current_principal, get_db, scoped_project_ids
from app.services.project_intelligence import (
    build_project_intelligence_report,
    generate_html_dossier,
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
    format: Literal["json", "markdown", "pdf", "html"] = Query("markdown"),
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Export the Project Intelligence Report in JSON, Markdown, or print-ready HTML/PDF format."""
    scoped_project_ids(db, p, project_id)
    try:
        rep = build_project_intelligence_report(db, project_id, force_regenerate=False)
        if format == "json":
            return Response(
                content=__import__("json").dumps(rep, indent=2),
                media_type="application/json",
                headers={"Content-Disposition": f'attachment; filename="{rep["project_key"]}_Intelligence_Report.json"'},
            )
        if format == "markdown":
            md = generate_markdown_report(rep)
            return Response(
                content=md,
                media_type="text/markdown",
                headers={"Content-Disposition": f'attachment; filename="{rep["project_key"]}_Intelligence_Report.md"'},
            )
        # HTML / PDF Print Dossier
        html_content = generate_html_dossier(rep)
        return Response(
            content=html_content,
            media_type="text/html",
            headers={"Content-Disposition": f'inline; filename="{rep["project_key"]}_Intelligence_Report.html"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export intelligence report: {e}")


@router.get("/projects/{project_id}/release-decision")
def get_project_release_decision(
    project_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Retrieve the authoritative release decision and evidence breakdown for a project."""
    scoped_project_ids(db, p, project_id)
    from app.services.release_decision import evaluate_release_decision
    return evaluate_release_decision(db, project_id)
