"""Defect lifecycle management."""
from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import BadRequest, Conflict, NotFound
from app.db.base import session_scope, utcnow
from app.db.models import Defect, DefectComment, DefectLink, Execution, ExecutionResult, Run, TestCase
from app.domain.enums import (
    SEVERITIES,
    can_transition_defect,
    normalize_defect_priority,
)
from app.guardrails.duplicates import similarity
from app.services import audit
from app.services.keys import next_key


def duplicate_candidates(db: Session, project_id: int, title: str, test_case_id: int | None,
                         exclude_id: int | None = None) -> list[dict]:
    rows = db.execute(select(Defect).where(Defect.project_id == project_id, Defect.approval_status != "dismissed",
                                           Defect.status != "closed", Defect.id != (exclude_id or -1))).scalars()
    out: list[dict[str, Any]] = []
    for d in rows:
        score = similarity(title, d.title)
        if (test_case_id and d.test_case_id == test_case_id) or score >= 0.6:
            out.append({"key": d.key, "id": d.id, "title": d.title, "status": d.status,
                        "score": 1.0 if d.test_case_id == test_case_id and test_case_id else round(score, 2)})
    return sorted(out, key=lambda x: -x["score"])[:5]


def create_manual(db: Session, project_id: int, project_key: str, data: dict, actor_id: int) -> Defect:
    if data.get("severity") not in SEVERITIES:
        raise BadRequest(f"Invalid severity '{data.get('severity')}'. Must be one of {SEVERITIES}")
    try:
        data["priority"] = normalize_defect_priority(data.get("priority", "p3"))
    except ValueError as e:
        raise BadRequest(str(e))
    res = None
    if data.get("execution_result_id"):
        res = db.get(ExecutionResult, data["execution_result_id"])
        if res is None or res.status not in ("failed", "error", "timed_out"):
            raise BadRequest("Defects can only be linked to a recorded failure")
        ex = db.get(Execution, res.execution_id)
        if ex.project_id != project_id:
            raise BadRequest("Execution result belongs to another project")
    t = db.get(TestCase, res.test_case_id) if res else (
        db.get(TestCase, data["test_case_id"]) if data.get("test_case_id") else None)
    d = Defect(key=next_key(db, Defect, f"DEF-{project_key}", 4), project_id=project_id, title=data["title"],
               description=data.get("description", ""), severity=data["severity"], priority=data["priority"],
               evidence_type=data.get("evidence_type", "execution_failure" if res else "manual"),
               source_commit_sha=data.get("source_commit_sha"),
               status="open", approval_status="approved", requirement_id=t.requirement_id if t else data.get("requirement_id"),
               test_case_id=t.id if t else None, execution_id=res.execution_id if res else None,
               execution_result_id=res.id if res else None, expected_result=data.get("expected_result", ""),
               actual_result=data.get("actual_result") or (res.message if res else ""),
               reproduction_steps=data.get("reproduction_steps", ""), error_log=res.stdout if res else "",
               stack_trace=res.stack_trace if res else "", ai_analysis=res.failure_analysis if res else None,
               owner_id=data.get("owner_id"), reporter_id=actor_id)
    db.add(d)
    db.flush()
    audit.record(db, actor_id, "defect.created", "defect", d.id, d.key, project_id, {"manual": True})
    return d


def transition(db: Session, d: Defect, target: str, actor_id: int, comment: str = "", created_at=None,
               audit_source: str = "platform") -> Defect:
    if d.approval_status != "approved":
        raise Conflict("Defect recommendation must be approved before its lifecycle can progress")
    if not can_transition_defect(d.status, target):
        raise Conflict(f"Invalid transition {d.status} → {target}")
    if target == "assigned" and not d.owner_id:
        raise BadRequest("Assign an owner before moving to Assigned")
    if target == "verified" and not d.verified_execution_id:
        raise Conflict("A passing retest execution is required before a defect can be verified")
    prev = d.status
    d.status = target
    d.updated_at = created_at or utcnow()
    if target in ("verified", "closed"):
        d.resolved_at = d.resolved_at or d.updated_at
    if target == "reopened":
        d.resolved_at = None
        d.verified_execution_id = None
    audit.record(db, actor_id, "defect.transition", "defect", d.id, d.key, d.project_id,
                 {"from": prev, "to": target, "comment": comment}, source=audit_source, created_at=created_at)
    if comment:
        db.add(DefectComment(defect_id=d.id, author_id=actor_id, body=comment,
                             **({"created_at": created_at} if created_at else {})))
    return d


def add_link(db: Session, d: Defect, related_key: str, link_type: str, actor_id: int) -> DefectLink:
    other = db.execute(select(Defect).where(Defect.key == related_key)).scalar_one_or_none()
    if other is None or other.id == d.id:
        raise NotFound("Related defect")
    link = DefectLink(defect_id=d.id, related_defect_id=other.id, link_type=link_type)
    db.add(link)
    audit.record(db, actor_id, "defect.linked", "defect", d.id, d.key, d.project_id,
                 {"related": other.key, "type": link_type})
    return link


def find_workflow_run(db: Session, defect_id: int) -> Run | None:
    return db.execute(select(Run).where(Run.kind == "failure_analysis", Run.status == "awaiting_review",
                                        func.json_extract(Run.result, "$.defect_id") == defect_id)).scalars().first()


def apply_retest_outcome(execution_id: int, defect_id: int, actor_id: int | None) -> str:
    """After a retest execution completes, update the defect from the genuine result."""
    with session_scope() as db:
        d = db.get(Defect, defect_id)
        res = db.execute(select(ExecutionResult).where(ExecutionResult.execution_id == execution_id,
                                                       ExecutionResult.test_case_id == d.test_case_id)).scalar_one_or_none()
        if res is None:
            return "no_result"
        if res.status == "passed":
            d.verified_execution_id = execution_id
            if d.status == "fixed":
                transition(db, d, "ready_for_retest", actor_id or d.reporter_id or 1, "Retest scheduled")
            if d.status == "ready_for_retest":
                transition(db, d, "verified", actor_id or d.reporter_id or 1,
                           f"Retest passed in execution {db.get(Execution, execution_id).key}")
            return "passed"
        if d.status in ("fixed", "ready_for_retest", "verified", "closed"):
            transition(db, d, "reopened", actor_id or d.reporter_id or 1,
                       f"Retest failed in execution {db.get(Execution, execution_id).key}: {res.message[:200]}")
        return res.status
