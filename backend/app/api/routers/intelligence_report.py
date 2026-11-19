"""Project Intelligence & Engineering Handoff API Router."""
from __future__ import annotations

import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import Principal, current_principal, get_db, scoped_project_ids
from app.services.engineering_handoff import (
    build_automation_agent_report,
    build_complete_project_package,
    build_developer_handoff_report,
    build_executive_management_report,
    build_integration_engineer_report,
    build_product_owner_report,
    build_qa_engineer_report,
    export_granular_slice,
    format_role_markdown,
    generate_multi_sheet_xlsx,
)
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
    format: Literal["json", "markdown", "pdf", "html", "xlsx"] = Query("markdown"),
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Export the Project Intelligence Report in JSON, Markdown, XLSX or print-ready HTML/PDF format."""
    scoped_project_ids(db, p, project_id)
    try:
        rep = build_project_intelligence_report(db, project_id, force_regenerate=False)
        project_key = rep.get("project_key", f"PROJ_{project_id}")

        if format == "json":
            return Response(
                content=json.dumps(rep, indent=2),
                media_type="application/json",
                headers={"Content-Disposition": f'attachment; filename="{project_key}_Intelligence_Report.json"'},
            )
        if format == "markdown":
            md = generate_markdown_report(rep)
            return Response(
                content=md,
                media_type="text/markdown",
                headers={"Content-Disposition": f'attachment; filename="{project_key}_Intelligence_Report.md"'},
            )
        if format == "xlsx":
            xlsx_content = generate_multi_sheet_xlsx(db, project_id)
            return Response(
                content=xlsx_content,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f'attachment; filename="{project_key}_Engineering_Workbook.xlsx"'},
            )
        # HTML / PDF Print Dossier
        html_content = generate_html_dossier(rep)
        return Response(
            content=html_content,
            media_type="text/html",
            headers={"Content-Disposition": f'inline; filename="{project_key}_Intelligence_Report.html"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export intelligence report: {e}")


# =============================================================================
# ROLE-BASED ENGINEERING HANDOFF ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/intelligence-report/handoff/{role}")
def get_role_handoff_report(
    project_id: int,
    role: Literal["developer", "qa", "automation_agent", "integration", "product_owner", "executive"],
    format: Literal["json", "markdown", "html"] = Query("json"),
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Retrieve or export role-specific engineering deliverables."""
    scoped_project_ids(db, p, project_id)
    try:
        if role == "developer":
            rep = build_developer_handoff_report(db, project_id)
        elif role == "qa":
            rep = build_qa_engineer_report(db, project_id)
        elif role == "automation_agent":
            rep = build_automation_agent_report(db, project_id)
        elif role == "integration":
            rep = build_integration_engineer_report(db, project_id)
        elif role == "product_owner":
            rep = build_product_owner_report(db, project_id)
        elif role == "executive":
            rep = build_executive_management_report(db, project_id)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid handoff role: {role}")

        project_key = rep.get("project_key", f"PROJ_{project_id}")

        if format == "json":
            return rep

        if format == "markdown":
            md_content = format_role_markdown(rep, role)
            return Response(
                content=md_content,
                media_type="text/markdown",
                headers={"Content-Disposition": f'attachment; filename="{project_key}_{role}_handoff.md"'},
            )

        # Standalone clean HTML preview/print
        md_content = format_role_markdown(rep, role)
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{rep.get('title', 'TraceTest Engineering Handoff')}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 960px; margin: 40px auto; padding: 0 20px; color: #1e293b; }}
    pre {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; overflow-x: auto; white-space: pre-wrap; }}
    table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
    th, td {{ border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }}
    th {{ background: #f1f5f9; }}
    h1, h2, h3 {{ color: #0f172a; }}
    @media print {{ body {{ margin: 0; padding: 20px; }} }}
  </style>
</head>
<body>
  <pre>{md_content}</pre>
</body>
</html>"""
        return Response(content=html_content, media_type="text/html")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate {role} report: {e}")


@router.get("/projects/{project_id}/intelligence-report/complete-package")
def get_complete_project_package_endpoint(
    project_id: int,
    format: Literal["json", "xlsx"] = Query("json"),
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Export the standardized complete project package (Schema v2.0.0 JSON or multi-sheet XLSX workbook)."""
    scoped_project_ids(db, p, project_id)
    try:
        pkg = build_complete_project_package(db, project_id)
        project_key = pkg["project"]["key"]

        if format == "json":
            return Response(
                content=json.dumps(pkg, indent=2),
                media_type="application/json",
                headers={"Content-Disposition": f'attachment; filename="{project_key}_Complete_Package_v2.json"'},
            )

        xlsx_bytes = generate_multi_sheet_xlsx(db, project_id)
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{project_key}_Engineering_Workbook.xlsx"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate complete package: {e}")


@router.get("/projects/{project_id}/intelligence-report/granular-export")
def get_granular_export_endpoint(
    project_id: int,
    entity: Literal["requirements", "acceptance_criteria", "test_cases", "traceability_matrix", "executions", "defects", "uncovered_requirements"] = Query("requirements"),
    format: Literal["csv", "json", "markdown", "xlsx"] = Query("csv"),
    group_by_requirement: bool = Query(False),
    include_linked: bool = Query(True),
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Export fine-grained data slices with full dataset coverage."""
    scoped_project_ids(db, p, project_id)
    try:
        content_bytes, media_type, filename = export_granular_slice(
            db, project_id, entity, format, group_by_requirement, include_linked
        )
        return Response(
            content=content_bytes,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export {entity}: {e}")


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
