from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import serializers as S
from app.api.deps import (
    PageParams,
    Principal,
    check_entity_project,
    current_principal,
    page_params,
    paginate,
    require,
    scoped_project_ids,
)
from app.core.errors import AppError, BadRequest
from app.db.base import get_db
from app.db.models import ExecutionResult, Requirement, Review, Run, TestCase, TestCaseVersion
from app.domain.enums import TEST_TYPES
from app.graph import requirement_graph
from app.services import audit
from app.services.tests import create_test, edit_test, review_test

router = APIRouter(prefix="/tests", tags=["test cases"])


@router.get("")
def list_tests(pp: PageParams = Depends(page_params), project_id: int | None = None,
               requirement_id: int | None = None, status: str | None = None, test_type: str | None = None,
               automation: str | None = None, validation_status: str | None = None, provider: str | None = None,
               test_category: str | None = None, execution_capability: str | None = None, approval_status: str | None = None,
               p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    stmt = select(TestCase).where(TestCase.project_id.in_(scoped_project_ids(db, p, project_id) or [-1]))
    for col, val in ((TestCase.requirement_id, requirement_id), (TestCase.status, status),
                     (TestCase.test_type, test_type), (TestCase.automation, automation),
                     (TestCase.validation_status, validation_status), (TestCase.provider, provider),
                     (TestCase.test_category, test_category), (TestCase.execution_capability, execution_capability),
                     (TestCase.approval_status, approval_status)):
        if val is not None:
            stmt = stmt.where(col == val)
    if pp.q:
        stmt = stmt.where(TestCase.title.ilike(f"%{pp.q}%") | TestCase.key.ilike(f"%{pp.q}%"))
    return paginate(db, stmt, pp, {"key": TestCase.key, "title": TestCase.title, "priority": TestCase.priority,
                                   "status": TestCase.status, "confidence": TestCase.confidence,
                                   "updated_at": TestCase.updated_at}, TestCase.key,
                    lambda t: S.test_case(db, t))


@router.get("/{test_id}")
def get_test(test_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    t = check_entity_project(db, p, db.get(TestCase, test_id), "Test case")
    out = S.test_case(db, t, full=True)
    out["reviews"] = [{"decision": r.decision, "comment": r.comment, "version": r.entity_version,
                       "reviewer": S.user_ref(db, r.reviewer_id), "at": S.iso(r.created_at)}
                      for r in db.execute(select(Review).where(Review.entity_type == "test_case",
                                                               Review.entity_id == t.id)
                                          .order_by(Review.created_at.desc())).scalars()]
    out["versions"] = [{"version": v.version, "script_hash": v.script_hash, "note": v.change_note,
                        "changed_by": S.user_ref(db, v.changed_by), "at": S.iso(v.created_at), "snapshot": v.snapshot}
                       for v in db.execute(select(TestCaseVersion).where(TestCaseVersion.test_case_id == t.id)
                                           .order_by(TestCaseVersion.version.desc())).scalars()]
    out["recent_results"] = [S.result(db, r) for r in db.execute(
        select(ExecutionResult).where(ExecutionResult.test_case_id == t.id)
        .order_by(ExecutionResult.id.desc()).limit(10)).scalars()]
    return out


class StepIn(BaseModel):
    action: str = Field(min_length=3)
    expected: str = ""


class TestIn(BaseModel):
    requirement_id: int
    title: str = Field(min_length=5, max_length=300)
    description: str = ""
    clause_keys: list[str] = Field(min_length=1)
    preconditions: str = ""
    test_data: dict = Field(default_factory=dict)
    steps: list[StepIn] = Field(min_length=1)
    expected_result: str = Field(min_length=3)
    priority: str = "medium"
    test_type: str = "functional"
    source_quote: str = Field(min_length=8)
    automation: str = Field("manual", pattern="^(pytest|playwright|manual)$")
    script: str | None = None


@router.post("", status_code=201)
def create_manual(body: TestIn, p: Principal = Depends(require("test.write")), db: Session = Depends(get_db)):
    req = check_entity_project(db, p, db.get(Requirement, body.requirement_id), "Requirement")
    if body.test_type not in TEST_TYPES:
        raise BadRequest(f"test_type must be one of {TEST_TYPES}")
    data = body.model_dump()
    data["steps"] = [s.model_dump() for s in body.steps]
    data["confidence"] = 1.0
    data["rationale"] = "Manually authored"
    t = create_test(db, req, data, actor_id=p.id, provider="manual")
    db.commit()
    return S.test_case(db, t, full=True)


class TestPatch(BaseModel):
    title: str | None = Field(None, min_length=5, max_length=300)
    description: str | None = None
    preconditions: str | None = None
    test_data: dict | None = None
    expected_result: str | None = None
    priority: str | None = None
    test_type: str | None = None
    clause_keys: list[str] | None = None
    source_quote: str | None = None
    automation: str | None = Field(None, pattern="^(pytest|playwright|manual)$")
    script: str | None = None
    steps: list[StepIn] | None = None
    note: str = ""


@router.patch("/{test_id}")
def patch_test(test_id: int, body: TestPatch, p: Principal = Depends(require("test.write")),
               db: Session = Depends(get_db)):
    t = check_entity_project(db, p, db.get(TestCase, test_id), "Test case")
    changes = body.model_dump(exclude={"note"}, exclude_none=True)
    if "steps" in changes:
        changes["steps"] = [s.model_dump() for s in body.steps or []]
    if not changes:
        raise BadRequest("No changes supplied")
    edit_test(db, t, changes, p.user, body.note)
    db.commit()
    return S.test_case(db, t, full=True)


class ReviewIn(BaseModel):
    decision: str = Field(pattern="^(approve|reject|request_changes)$")
    comment: str = Field("", max_length=4000)


def _maybe_resume(db: Session, requirement_id: int) -> None:
    runs = db.execute(select(Run.id).where(Run.kind == "requirement_generate", Run.status == "awaiting_review",
                                           Run.subject_id == requirement_id)).scalars().all()
    for rid in runs:
        requirement_graph.resume_after_review(rid)


@router.post("/{test_id}/review")
def review(test_id: int, body: ReviewIn, p: Principal = Depends(require("test.review")),
           db: Session = Depends(get_db)):
    t = check_entity_project(db, p, db.get(TestCase, test_id), "Test case")
    review_test(db, t, body.decision, body.comment, p.user, p.is_admin)
    db.commit()
    _maybe_resume(db, t.requirement_id)
    return S.test_case(db, t, full=True)


class BulkReviewIn(BaseModel):
    test_ids: list[int] = Field(min_length=1, max_length=200)
    decision: str = Field(pattern="^(approve|reject)$")
    comment: str = ""


@router.post("/bulk-review")
def bulk_review(body: BulkReviewIn, p: Principal = Depends(require("test.review")), db: Session = Depends(get_db)):
    done, skipped = [], []
    reqs = set()
    for tid in body.test_ids:
        t = db.get(TestCase, tid)
        try:
            check_entity_project(db, p, t, "Test case")
            with db.begin_nested():
                review_test(db, t, body.decision, body.comment, p.user, p.is_admin)
            done.append(t.key)
            reqs.add(t.requirement_id)
        except AppError as exc:
            skipped.append({"id": tid, "key": t.key if t else None, "reason": exc.message})
    audit.record(db, p.id, f"test.bulk_review.{body.decision}", "test_case", None, None, None,
                 {"done": done, "skipped": len(skipped)})
    db.commit()
    for rid in reqs:
        _maybe_resume(db, rid)
    return {"reviewed": done, "skipped": skipped}


@router.post("/{test_id}/deprecate")
def deprecate(test_id: int, p: Principal = Depends(require("test.write")), db: Session = Depends(get_db)):
    t = check_entity_project(db, p, db.get(TestCase, test_id), "Test case")
    t.status = "deprecated"
    audit.record(db, p.id, "test.deprecated", "test_case", t.id, t.key, t.project_id)
    db.commit()
    return S.test_case(db, t)


@router.post("/{test_id}/validate")
def validate_specification(
    test_id: int,
    p: Principal = Depends(require("test.write")),
    db: Session = Depends(get_db),
):
    from app.services.test_design import validate_test_specification
    t = check_entity_project(db, p, db.get(TestCase, test_id), "Test case")
    errors = validate_test_specification(db, t)
    db.commit()
    return {"id": t.id, "key": t.key, "validation_status": t.validation_status, "validation_errors": errors}


@router.post("/{test_id}/approve")
def approve_test_specification(
    test_id: int,
    p: Principal = Depends(require("test.review")),
    db: Session = Depends(get_db),
):
    t = check_entity_project(db, p, db.get(TestCase, test_id), "Test case")
    t.approval_status = "approved"
    t.status = "approved"
    t.reviewer_id = p.id
    db.add(Review(entity_type="test_case", entity_id=t.id, decision="approve", comment="Specification approved", reviewer_id=p.id))
    audit.record(db, p.id, "test.approved", "test_case", t.id, t.key, t.project_id)
    db.commit()
    return S.test_case(db, t, full=True)


@router.post("/{test_id}/reject")
def reject_test_specification(
    test_id: int,
    p: Principal = Depends(require("test.review")),
    db: Session = Depends(get_db),
):
    t = check_entity_project(db, p, db.get(TestCase, test_id), "Test case")
    t.approval_status = "rejected"
    t.status = "rejected"
    t.reviewer_id = p.id
    db.add(Review(entity_type="test_case", entity_id=t.id, decision="reject", comment="Specification rejected", reviewer_id=p.id))
    audit.record(db, p.id, "test.rejected", "test_case", t.id, t.key, t.project_id)
    db.commit()
    return S.test_case(db, t, full=True)
