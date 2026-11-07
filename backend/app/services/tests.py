"""Test case lifecycle: deterministic validation, review/approval, versioned edits."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BadRequest, Conflict, Forbidden
from app.core.security import sha256_text
from app.db.base import utcnow
from app.db.models import Clause, Requirement, Review, TestCase, TestCaseVersion, TestStep, User
from app.domain.enums import ALL_TEST_CATEGORIES
from app.guardrails.ast_validator import validate_script
from app.guardrails.duplicates import similarity
from app.guardrails.quotes import verify_quote
from app.services import audit
from app.services.keys import next_key
from app.services.requirements import clauses_for, current_version

LOW_CONFIDENCE = 0.6


def signature(t: TestCase) -> str:
    return " ".join([t.title, t.expected_result, " ".join(sorted(t.clause_keys)), str(t.test_data)])


def validate_test(db: Session, t: TestCase, clauses: list[Clause] | None = None) -> list[str]:
    """Deterministic grounding, quote, script and duplicate checks. Updates validation fields."""
    req = db.get(Requirement, t.requirement_id)
    if clauses is None:
        clauses = clauses_for(db, current_version(db, req))
    by_key = {c.clause_key: c for c in clauses}
    errors: list[str] = []
    unknown = [k for k in t.clause_keys if k not in by_key]
    if not t.clause_keys:
        errors.append("Test cites no requirement clauses")
    if unknown:
        errors.append(f"Unknown clause references: {', '.join(unknown)}")
    cited = [by_key[k].text for k in t.clause_keys if k in by_key]
    t.quote_verified = bool(t.source_quote) and verify_quote(t.source_quote, cited)
    if not t.quote_verified:
        errors.append("Source quotation does not match the cited clause text")
    if t.automation in ("pytest", "playwright"):
        report = validate_script(t.script or "", allow_playwright=t.automation == "playwright")
        errors.extend(report.errors)
        t.script_hash = sha256_text(t.script) if t.script else None
    else:
        t.script_hash = None
    t.duplicate_of = None
    siblings = db.execute(select(TestCase).where(TestCase.requirement_id == t.requirement_id,
                                                 TestCase.id != (t.id or -1),
                                                 TestCase.status.notin_(["rejected", "deprecated"]))).scalars()
    sig = signature(t)
    for s in siblings:
        if similarity(sig, signature(s)) >= 0.9:
            t.duplicate_of = s.key
            break
    t.validation_errors = errors
    t.validation_status = "valid" if not errors else "invalid"
    return errors


def snapshot(t: TestCase) -> dict:
    return {"title": t.title, "description": t.description, "preconditions": t.preconditions,
            "test_data": t.test_data, "expected_result": t.expected_result, "priority": t.priority,
            "test_type": t.test_type, "test_category": t.test_category, "clause_keys": t.clause_keys, "ac_keys": t.ac_keys,
            "source_quote": t.source_quote, "automation": t.automation, "script": t.script,
            "steps": [{"action": s.action, "expected": s.expected} for s in t.steps], "status": t.status}


def create_test(db: Session, req: Requirement, data: dict, *, actor_id: int | None, provider: str = "manual",
                model: str | None = None, status: str = "pending_review", key: str | None = None,
                created_at=None, audit_source: str = "platform", validate: bool = True,
                clauses: list[Clause] | None = None) -> TestCase:
    project_key = req.key.split("-")[0]
    key = key or next_key(db, TestCase, f"TC-{project_key}", 4)
    ts = created_at or utcnow()

    cat = data.get("test_category") or data.get("category")
    if not cat:
        tt = (data.get("test_type") or "").lower()
        if tt == "boundary":
            cat = "boundary_value"
        elif tt in ALL_TEST_CATEGORIES:
            cat = tt
        else:
            cat = "positive"
    elif cat == "boundary":
        cat = "boundary_value"
    elif cat not in ALL_TEST_CATEGORIES:
        raise BadRequest(f"Invalid test category '{cat}'. Must be one of {ALL_TEST_CATEGORIES}")

    t = TestCase(key=key, project_id=req.project_id, requirement_id=req.id, requirement_version=req.current_version,
                 clause_keys=data["clause_keys"], ac_keys=data.get("ac_keys", []), title=data["title"],
                 description=data.get("description", ""), preconditions=data.get("preconditions", ""),
                 test_data=data.get("test_data", {}), expected_result=data.get("expected_result", ""),
                 priority=data.get("priority", "medium"), test_type=data.get("test_type", "functional"),
                 test_category=cat,
                 confidence=float(data.get("confidence", 1.0)), source_quote=data.get("source_quote", ""),
                 rationale=data.get("rationale", ""), automation=data.get("automation", "manual"),
                 script=data.get("script"), status=status, provider=provider, model=model, created_by=actor_id,
                 created_at=ts, updated_at=ts)
    db.add(t)
    db.flush()
    for i, step in enumerate(data.get("steps", []), start=1):
        db.add(TestStep(test_case_id=t.id, position=i, action=step["action"], expected=step.get("expected", "")))
    db.flush()
    db.refresh(t)
    if validate:
        validate_test(db, t, clauses)
    db.add(TestCaseVersion(test_case_id=t.id, version=1, snapshot=snapshot(t), script_hash=t.script_hash,
                           changed_by=actor_id, change_note="Created", created_at=ts))
    audit.record(db, actor_id, "test.created", "test_case", t.id, t.key, t.project_id,
                 {"provider": provider, "validation": t.validation_status}, source=audit_source, created_at=ts)
    return t


EDITABLE = ("title", "description", "preconditions", "test_data", "expected_result", "priority", "test_type",
            "test_category", "clause_keys", "source_quote", "automation", "script")


def edit_test(db: Session, t: TestCase, changes: dict, actor: User, note: str = "") -> TestCase:
    if t.status == "deprecated":
        raise Conflict("Deprecated tests cannot be edited")
    if "test_category" in changes and changes["test_category"]:
        cat = changes["test_category"]
        if cat == "boundary":
            changes["test_category"] = "boundary_value"
        elif cat not in ALL_TEST_CATEGORIES:
            raise BadRequest(f"Invalid test category '{cat}'. Must be one of {ALL_TEST_CATEGORIES}")
    for f in EDITABLE:
        if f in changes and changes[f] is not None:
            setattr(t, f, changes[f])
    if changes.get("steps") is not None:
        for s in list(t.steps):
            db.delete(s)
        db.flush()
        for i, step in enumerate(changes["steps"], start=1):
            db.add(TestStep(test_case_id=t.id, position=i, action=step["action"], expected=step.get("expected", "")))
        db.flush()
        db.refresh(t)
    req = db.get(Requirement, t.requirement_id)
    t.requirement_version = req.current_version
    t.version += 1
    t.status = "pending_review"
    t.needs_reapproval_reason = None
    t.updated_at = utcnow()
    validate_test(db, t)
    db.add(TestCaseVersion(test_case_id=t.id, version=t.version, snapshot=snapshot(t), script_hash=t.script_hash,
                           changed_by=actor.id, change_note=note or "Edited"))
    audit.record(db, actor.id, "test.edited", "test_case", t.id, t.key, t.project_id,
                 {"version": t.version, "validation": t.validation_status})
    return t


def review_test(db: Session, t: TestCase, decision: str, comment: str, reviewer: User, is_admin: bool,
                created_at=None, audit_source: str = "platform") -> Review:
    if decision not in ("approve", "reject", "request_changes"):
        raise BadRequest("decision must be approve, reject or request_changes")
    if t.status in ("deprecated",):
        raise Conflict("Deprecated tests cannot be reviewed")
    if decision == "approve":
        if t.validation_status != "valid":
            raise Conflict("Test failed deterministic validation and cannot be approved",
                           {"validation_errors": t.validation_errors})
        if t.created_by == reviewer.id:
            raise Forbidden("Authors cannot approve their own tests")
        if t.confidence < LOW_CONFIDENCE and not (comment or "").strip():
            raise BadRequest("Low-confidence tests require a reviewer comment to approve")
        t.status = "approved"
        t.needs_reapproval_reason = None
    elif decision == "reject":
        t.status = "rejected"
    else:
        if not (comment or "").strip():
            raise BadRequest("A comment is required when requesting changes")
        t.status = "changes_requested"
    t.reviewer_id = reviewer.id
    t.updated_at = created_at or utcnow()
    r = Review(entity_type="test_case", entity_id=t.id, entity_version=t.version, decision=decision,
               comment=comment or "", reviewer_id=reviewer.id)
    if created_at:
        r.created_at = created_at
    db.add(r)
    audit.record(db, reviewer.id, f"test.review.{decision}", "test_case", t.id, t.key, t.project_id,
                 {"version": t.version, "comment": comment}, source=audit_source, created_at=created_at)
    return r
