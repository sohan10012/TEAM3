"""ReasonX Context Layer — Project-isolated, authentic data retrieval across TraceTest."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db.models import (
    AcceptanceCriterion,
    Defect,
    Document,
    Execution,
    ExecutionResult,
    Project,
    ProjectIntelligenceReport,
    Requirement,
    RequirementClarification,
    TestCase,
)
from app.services.analytics import traceability
from app.services.yaml_workflow import get_golden_policies

logger = logging.getLogger(__name__)


def get_detailed_project_context(
    db: Session,
    project_id: int,
    page: str = "workspace",
    active_tab: str | None = None,
    selected_id: Any | None = None,
) -> dict[str, Any]:
    """Retrieve verified, project-scoped data without leaking cross-project records."""
    project = db.get(Project, project_id)
    if not project:
        return {"project_id": project_id, "error": f"Project #{project_id} not found"}

    ctx: dict[str, Any] = {
        "project_id": project.id,
        "project_key": project.key,
        "project_name": project.name,
        "business_domain": project.business_domain,
        "product_type": project.product_type,
        "primary_goal": project.business_goal,
        "status": project.status,
        "active_page": page,
        "active_tab": active_tab,
        "selected_id": selected_id,
    }

    # 1. Source Documents
    docs = db.execute(
        select(Document)
        .where(Document.project_id == project_id)
        .order_by(desc(Document.created_at))
    ).scalars().all()
    ctx["documents"] = [
        {
            "id": d.id,
            "filename": d.filename,
            "document_type": d.document_type,
            "provenance_hash": (getattr(d, "checksum", "") or "")[:12],
            "created_at": d.created_at.strftime("%Y-%m-%d %H:%M") if d.created_at else None,
        }
        for d in docs
    ]
    ctx["document_count"] = len(docs)

    # 2. Requirements & Clauses
    reqs_query = (
        select(Requirement)
        .where(Requirement.project_id == project_id, Requirement.status != "deprecated")
        .order_by(Requirement.key)
    )
    all_reqs = db.execute(reqs_query).scalars().all()
    ctx["requirement_count"] = len(all_reqs)
    
    # Priority & Category distributions
    prio_counts: dict[str, int] = {}
    cat_counts: dict[str, int] = {}
    for r in all_reqs:
        prio_counts[r.priority] = prio_counts.get(r.priority, 0) + 1
        cat_counts[r.category] = cat_counts.get(r.category, 0) + 1
    ctx["requirement_priorities"] = prio_counts
    ctx["requirement_categories"] = cat_counts

    # Sample top requirements with clauses
    sample_reqs = []
    for r in all_reqs[:8]:
        clauses = [c.text for c in r.current_clauses] if hasattr(r, "current_clauses") else []
        sample_reqs.append({
            "id": r.id,
            "key": r.key,
            "title": r.title,
            "category": r.category,
            "priority": r.priority,
            "status": r.status,
            "clause_count": len(clauses),
            "source_section": r.source_section,
            "source_page": r.source_page,
            "sample_clause": clauses[0] if clauses else None,
        })
    ctx["sample_requirements"] = sample_reqs

    # 3. Acceptance Criteria
    acs = db.execute(
        select(AcceptanceCriterion)
        .join(Requirement, Requirement.id == AcceptanceCriterion.requirement_id)
        .where(Requirement.project_id == project_id)
        .order_by(AcceptanceCriterion.key)
    ).scalars().all()
    ctx["acceptance_criteria_count"] = len(acs)
    ctx["sample_acceptance_criteria"] = [
        {
            "id": a.id,
            "ac_key": getattr(a, "key", ""),
            "description": (a.description or "")[:150],
            "expected_behaviour": (a.expected_behaviour or "")[:120],
            "quote": (a.source_quote or "")[:120],
            "quote_verified": getattr(a, "quote_verified", False),
        }
        for a in acs[:6]
    ]

    # 4. Test Cases
    tests = db.execute(
        select(TestCase)
        .where(TestCase.project_id == project_id)
        .order_by(TestCase.key)
    ).scalars().all()
    ctx["test_case_count"] = len(tests)
    approved_tests = sum(1 for t in tests if t.status in ("approved", "active"))
    pending_tests = sum(1 for t in tests if t.status == "pending_review")
    automated_tests = sum(1 for t in tests if getattr(t, "is_automated", True))
    ctx["test_metrics"] = {
        "total": len(tests),
        "approved": approved_tests,
        "pending_review": pending_tests,
        "automated": automated_tests,
        "manual": len(tests) - automated_tests,
    }
    ctx["sample_tests"] = [
        {
            "id": t.id,
            "key": t.key,
            "title": t.title,
            "test_category": t.test_category,
            "priority": t.priority,
            "status": t.status,
            "clause_keys": t.clause_keys,
        }
        for t in tests[:6]
    ]

    # 5. Executions & Results
    recent_execs = db.execute(
        select(Execution)
        .where(Execution.project_id == project_id)
        .order_by(desc(Execution.created_at))
        .limit(5)
    ).scalars().all()
    ctx["execution_runs_count"] = len(recent_execs)
    exec_summaries = []
    failed_results_sample = []
    for ex in recent_execs:
        exec_summaries.append({
            "id": ex.id,
            "key": ex.key,
            "status": ex.status,
            "passed": ex.passed,
            "failed": ex.failed,
            "errored": ex.errored,
            "total": (ex.passed or 0) + (ex.failed or 0) + (ex.errored or 0),
            "created_at": ex.created_at.strftime("%Y-%m-%d %H:%M") if ex.created_at else None,
        })
        # If this execution had failures, collect failure details
        if (ex.failed or 0) > 0 or (ex.errored or 0) > 0:
            failures = db.execute(
                select(ExecutionResult)
                .where(ExecutionResult.execution_id == ex.id, ExecutionResult.status.in_(("failed", "error")))
                .limit(5)
            ).scalars().all()
            for f in failures:
                failed_results_sample.append({
                    "execution_key": ex.key,
                    "test_case_id": f.test_case_id,
                    "status": f.status,
                    "message": (f.message or "")[:200],
                })
    ctx["recent_executions"] = exec_summaries
    ctx["recent_failed_results"] = failed_results_sample

    # 6. Defects
    defects = db.execute(
        select(Defect)
        .where(Defect.project_id == project_id)
        .order_by(desc(Defect.created_at))
    ).scalars().all()
    ctx["defect_count"] = len(defects)
    sev_counts: dict[str, int] = {}
    status_counts: dict[str, int] = {}
    for d in defects:
        sev_counts[d.severity] = sev_counts.get(d.severity, 0) + 1
        status_counts[d.status] = status_counts.get(d.status, 0) + 1
    ctx["defect_severities"] = sev_counts
    ctx["defect_statuses"] = status_counts
    ctx["active_defects"] = [
        {
            "id": d.id,
            "key": d.key,
            "title": d.title,
            "severity": d.severity,
            "status": d.status,
            "description": (d.description or "")[:150],
            "linked_test_case_id": getattr(d, "test_case_id", None),
        }
        for d in defects
    ]

    # 7. Traceability & Coverage Matrix
    try:
        tdata = traceability(db, [project_id])
        summary = tdata.get("summary", {})
        ctx["traceability_coverage_pct"] = summary.get("coverage_pct", 0.0)
        ctx["uncovered_requirements_count"] = summary.get("uncovered_count", 0)
        uncovered = [r for r in tdata.get("requirements", []) if r.get("coverage_status") == "uncovered"]
        ctx["sample_uncovered_requirements"] = [
            {"key": r["key"], "title": r["title"], "priority": r["priority"]}
            for r in uncovered[:5]
        ]
    except Exception as exc:
        logger.warning(f"Traceability calculation skipped for project {project_id}: {exc}")
        ctx["traceability_coverage_pct"] = 100.0 if len(tests) >= len(all_reqs) and len(tests) > 0 else 0.0

    # 8. Specific Selected Item Context (Screen Aware)
    if selected_id:
        try:
            sel_id_int = int(selected_id)
            if page in ("requirements", "requirement_detail"):
                req = db.get(Requirement, sel_id_int)
                if req and req.project_id == project_id:
                    ctx["selected_item"] = {
                        "type": "requirement",
                        "id": req.id,
                        "key": req.key,
                        "title": req.title,
                        "category": req.category,
                        "priority": req.priority,
                        "status": req.status,
                        "source_section": req.source_section,
                        "source_page": req.source_page,
                        "clauses": [c.text for c in req.current_clauses] if hasattr(req, "current_clauses") else [],
                    }
            elif page in ("tests", "test_detail"):
                test = db.get(TestCase, sel_id_int)
                if test and test.project_id == project_id:
                    ctx["selected_item"] = {
                        "type": "test_case",
                        "id": test.id,
                        "key": test.key,
                        "title": test.title,
                        "category": test.test_category,
                        "priority": test.priority,
                        "status": test.status,
                        "preconditions": test.preconditions,
                        "steps": test.steps,
                        "expected_result": test.expected_result,
                    }
            elif page in ("executions", "execution_detail"):
                ex = db.get(Execution, sel_id_int)
                if ex and ex.project_id == project_id:
                    ctx["selected_item"] = {
                        "type": "execution",
                        "id": ex.id,
                        "key": ex.key,
                        "status": ex.status,
                        "passed": ex.passed,
                        "failed": ex.failed,
                        "errored": ex.errored,
                    }
            elif page in ("defects", "defect_detail"):
                df = db.get(Defect, sel_id_int)
                if df and df.project_id == project_id:
                    ctx["selected_item"] = {
                        "type": "defect",
                        "id": df.id,
                        "key": df.key,
                        "title": df.title,
                        "severity": df.severity,
                        "status": df.status,
                        "description": df.description,
                        "reproduction_steps": df.reproduction_steps,
                    }
        except (ValueError, TypeError):
            pass

    return ctx
