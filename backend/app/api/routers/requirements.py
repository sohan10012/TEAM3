from __future__ import annotations

import io
import json

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import serializers as S
from app.api.deps import (
    PageParams,
    Principal,
    check_entity_project,
    current_principal,
    get_project_checked,
    page_params,
    paginate,
    require,
    scoped_project_ids,
)
from app.core.config import get_settings
from app.core.errors import BadRequest, Conflict, NotFound
from app.core.security import sha256_text
from app.db.base import get_db, utcnow
from app.db.models import AcceptanceCriterion, Module, Requirement, RequirementVersion, Review, TestCase
from app.domain.enums import PRIORITIES
from app.graph import requirement_graph
from app.llm.router import provider_status
from app.services import audit, tasks
from app.services.requirements import (
    clauses_for,
    create_requirement,
    current_version,
    diff_versions,
    impact_analysis,
    update_requirement,
)

router = APIRouter(tags=["requirements"])
CATEGORIES = (
    "functional",
    "non_functional",
    "business_rule",
    "security",
    "validation_rule",
    "data_requirement",
    "integration_requirement",
    "performance_constraint",
    "operational_requirement",
    "permission_role",
    "compliance",
    "data",
    "reporting",
)
MAX_UPLOAD = 2 * 1024 * 1024


def _detail(db: Session, r: Requirement) -> dict:
    out = S.requirement(db, r)
    v = current_version(db, r)
    out["current"] = S.version(db, v)
    out["clauses"] = [S.clause(c) for c in clauses_for(db, v)]
    out["test_count"] = db.query(TestCase).filter(TestCase.requirement_id == r.id,
                                                  TestCase.status != "deprecated").count()
    return out


@router.get("/requirements")
def list_requirements(pp: PageParams = Depends(page_params), project_id: int | None = None,
                      status: str | None = None, priority: str | None = None, module_id: int | None = None,
                      category: str | None = None, p: Principal = Depends(current_principal),
                      db: Session = Depends(get_db)):
    stmt = select(Requirement).where(Requirement.project_id.in_(scoped_project_ids(db, p, project_id) or [-1]))
    for col, val in ((Requirement.status, status), (Requirement.priority, priority),
                     (Requirement.module_id, module_id), (Requirement.category, category)):
        if val is not None:
            stmt = stmt.where(col == val)
    if pp.q:
        stmt = stmt.where(Requirement.title.ilike(f"%{pp.q}%") | Requirement.key.ilike(f"%{pp.q}%"))
    return paginate(db, stmt, pp, {"key": Requirement.key, "title": Requirement.title,
                                   "priority": Requirement.priority, "status": Requirement.status,
                                   "updated_at": Requirement.updated_at}, Requirement.updated_at,
                    lambda r: S.requirement(db, r))


class RequirementIn(BaseModel):
    project_id: int
    title: str = Field(min_length=5, max_length=300)
    description: str = Field(min_length=10, max_length=20000)
    business_objective: str = Field("", max_length=4000)
    priority: str = "medium"
    category: str = "functional"
    module_id: int | None = None


def _validate_meta(db: Session, project_id: int, priority: str | None, category: str | None, module_id: int | None):
    if priority is not None and priority not in PRIORITIES:
        raise BadRequest(f"priority must be one of {PRIORITIES}")
    if category is not None and category not in CATEGORIES:
        raise BadRequest(f"category must be one of {CATEGORIES}")
    if module_id is not None:
        mod = db.get(Module, module_id)
        if mod is None or mod.project_id != project_id:
            raise BadRequest("Module does not belong to this project")


@router.post("/requirements", status_code=201)
def create(body: RequirementIn, p: Principal = Depends(require("requirement.write")), db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, body.project_id)
    if proj.status == "archived":
        raise Conflict("Archived projects are read-only")
    _validate_meta(db, proj.id, body.priority, body.category, body.module_id)
    r = create_requirement(db, proj, title=body.title, description=body.description,
                           business_objective=body.business_objective, priority=body.priority,
                           category=body.category, module_id=body.module_id, author_id=p.id)
    db.commit()
    return _detail(db, r)


@router.post("/requirements/upload", status_code=201)
async def upload(project_id: int = Form(...), title: str = Form(..., min_length=5, max_length=300),
                 priority: str = Form("medium"), module_id: int | None = Form(None),
                 file: UploadFile = File(...), p: Principal = Depends(require("requirement.write")),
                 db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, project_id)
    _validate_meta(db, proj.id, priority, None, module_id)
    raw = await file.read(MAX_UPLOAD + 1)
    if len(raw) > MAX_UPLOAD:
        raise BadRequest("File exceeds 2 MB")
    name = (file.filename or "").lower()
    if name.endswith(".pdf"):
        if not raw.startswith(b"%PDF"):
            raise BadRequest("File is not a valid PDF")
        from pypdf import PdfReader
        try:
            text = "\n".join((pg.extract_text() or "") for pg in PdfReader(io.BytesIO(raw)).pages[:50])
        except Exception as exc:
            raise BadRequest(f"Could not read PDF: {exc}") from exc
        source = "pdf"
    elif name.endswith((".txt", ".md", ".markdown")):
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise BadRequest("Text files must be UTF-8") from exc
        source = "md" if name.endswith((".md", ".markdown")) else "txt"
    else:
        raise BadRequest("Supported formats: .pdf, .txt, .md")
    if len(text.strip()) < 10:
        raise BadRequest("No readable requirement text found in file")
    digest = sha256_text(raw.decode("latin-1"))
    dest = get_settings().uploads_dir / f"{digest}{name[name.rfind('.'):]}"
    dest.write_bytes(raw)
    r = create_requirement(db, proj, title=title, description=text, priority=priority, module_id=module_id,
                           author_id=p.id, source_type=source)
    audit.record(db, p.id, "requirement.uploaded", "requirement", r.id, r.key, proj.id,
                 {"file": file.filename, "sha256": digest, "stored_as": dest.name})
    db.commit()
    return _detail(db, r)


class ImportItem(BaseModel):
    title: str = Field(min_length=5, max_length=300)
    description: str = Field(min_length=10)
    business_objective: str = ""
    priority: str = "medium"
    category: str = "functional"


class ImportIn(BaseModel):
    project_id: int
    items: list[ImportItem] = Field(min_length=1, max_length=200)


@router.post("/requirements/import", status_code=201)
def structured_import(body: ImportIn, p: Principal = Depends(require("requirement.write")),
                      db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, body.project_id)
    keys = []
    for it in body.items:
        _validate_meta(db, proj.id, it.priority, it.category, None)
        r = create_requirement(db, proj, title=it.title, description=it.description,
                               business_objective=it.business_objective, priority=it.priority,
                               category=it.category, author_id=p.id, source_type="import")
        keys.append(r.key)
    db.commit()
    return {"created": keys}


@router.get("/requirements/{req_id}")
def get_requirement(req_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    return _detail(db, r)


class RequirementPatch(BaseModel):
    title: str | None = Field(None, min_length=5, max_length=300)
    description: str | None = Field(None, min_length=10, max_length=20000)
    business_objective: str | None = None
    priority: str | None = None
    category: str | None = None
    module_id: int | None = None
    status: str | None = Field(None, pattern="^(draft|analysed|approved|changed|deprecated)$")
    change_summary: str = Field("", max_length=500)


@router.patch("/requirements/{req_id}")
def patch_requirement(req_id: int, body: RequirementPatch, p: Principal = Depends(require("requirement.write")),
                      db: Session = Depends(get_db)):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    _validate_meta(db, r.project_id, body.priority, body.category, body.module_id)
    result = update_requirement(db, r, actor_id=p.id, **body.model_dump(exclude={"change_summary"}),
                                change_summary=body.change_summary)
    db.commit()
    return {"requirement": _detail(db, r), **result}


@router.get("/requirements/{req_id}/versions")
def versions(req_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    vs = db.execute(select(RequirementVersion).where(RequirementVersion.requirement_id == r.id)
                    .order_by(RequirementVersion.version.desc())).scalars()
    return [{**S.version(db, v), "clauses": [S.clause(c) for c in clauses_for(db, v)]} for v in vs]


@router.get("/requirements/{req_id}/diff")
def diff(req_id: int, from_version: int, to_version: int, p: Principal = Depends(current_principal),
         db: Session = Depends(get_db)):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    return diff_versions(db, r, from_version, to_version)


@router.get("/requirements/{req_id}/impact-analysis")
def impact(req_id: int, from_version: int | None = None, to_version: int | None = None,
           p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    to_v = to_version or r.current_version
    from_v = from_version or max(1, to_v - 1)
    if from_v == to_v:
        return {"requirement": r.key, "from_version": from_v, "to_version": to_v, "message": "Only one version exists",
                "added": [], "removed": [], "modified": [], "impacted_tests": [], "impacted_suites": [],
                "changed_clause_keys": [], "uncovered_new_clauses": []}
    return impact_analysis(db, r, from_v, to_v, apply=False)


@router.get("/requirements/{req_id}/clauses")
def clauses(req_id: int, version: int | None = None, p: Principal = Depends(current_principal),
            db: Session = Depends(get_db)):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    v = db.execute(select(RequirementVersion).filter_by(requirement_id=r.id,
                                                        version=version or r.current_version)).scalar_one_or_none()
    if v is None:
        raise NotFound("Version")
    return [S.clause(c) for c in clauses_for(db, v)]


def _start_workflow(db: Session, p: Principal, r: Requirement, mode: str) -> dict:
    st = provider_status()
    if not st["any_configured"]:
        raise Conflict("No AI provider is configured. Configure Groq or Gemini under Settings to run analysis.",
                       {"settings_path": "/settings"})
    run_id = tasks.create_run("requirement_" + mode, "requirement", r.id, p.id)
    audit.record(db, p.id, f"workflow.{mode}_started", "requirement", r.id, r.key, r.project_id, {"run_id": run_id})
    db.commit()
    tasks.submit(run_id, lambda rid: requirement_graph.run_requirement_workflow(rid, r.id, p.id, mode))
    return {"run_id": run_id, "status": "queued"}


@router.post("/requirements/{req_id}/analyse", status_code=202)
def analyse(req_id: int, p: Principal = Depends(require("requirement.analyse")), db: Session = Depends(get_db)):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    return _start_workflow(db, p, r, "analyse")


@router.post("/requirements/{req_id}/confirm", status_code=200)
def confirm_requirement(req_id: int, p: Principal = Depends(require("requirement.write")), db: Session = Depends(get_db)):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    r.status = "approved"
    r.updated_at = utcnow()
    audit.record(db, p.id, "requirement.confirmed", "requirement", r.id, r.key, r.project_id)
    db.commit()
    return S.requirement(db, r)


@router.post("/requirements/{req_id}/generate-tests", status_code=202)
def generate_tests(req_id: int, p: Principal = Depends(require("requirement.analyse")), db: Session = Depends(get_db)):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    if r.status == "needs_confirmation":
        raise Conflict(
            f"Requirement {r.key} requires human confirmation before test generation.",
            {"requirement_id": r.id, "key": r.key, "status": r.status}
        )
    return _start_workflow(db, p, r, "generate")


@router.get("/requirements/{req_id}/acceptance-criteria")
def list_criteria(req_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    rows = db.execute(select(AcceptanceCriterion).where(AcceptanceCriterion.requirement_id == r.id)
                      .order_by(AcceptanceCriterion.id)).scalars()
    return [S.criterion(a) for a in rows]


class CriterionReview(BaseModel):
    decision: str = Field(pattern="^(approve|reject|request_changes)$")
    comment: str = ""


@router.post("/acceptance-criteria/{ac_id}/review")
def review_criterion(ac_id: int, body: CriterionReview, p: Principal = Depends(require("test.review")),
                     db: Session = Depends(get_db)):
    a = db.get(AcceptanceCriterion, ac_id)
    if a is None:
        raise NotFound("Acceptance criterion")
    r = check_entity_project(db, p, db.get(Requirement, a.requirement_id), "Acceptance criterion")
    if body.decision == "request_changes" and not body.comment.strip():
        raise BadRequest("A comment is required when requesting changes")
    a.review_status = {"approve": "approved", "reject": "rejected", "request_changes": "changes_requested"}[body.decision]
    db.add(Review(entity_type="acceptance_criterion", entity_id=a.id, decision=body.decision, comment=body.comment,
                  reviewer_id=p.id))
    audit.record(db, p.id, f"criterion.review.{body.decision}", "acceptance_criterion", a.id, a.key, r.project_id,
                 {"comment": body.comment})
    db.commit()
    return S.criterion(a)


@router.get("/requirements/{req_id}/export")
def export_requirement(req_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    return json.loads(json.dumps(_detail(db, r), default=str))


@router.post("/projects/{project_id}/analyze-requirements", status_code=200)
def trigger_requirements_analysis(
    project_id: int,
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    get_project_checked(db, p, project_id)
    from app.services.requirement_intelligence import analyze_and_extract_project_requirements
    result = analyze_and_extract_project_requirements(db, project_id, author_id=p.id)
    return result


@router.get("/projects/{project_id}/clarifications")
def list_project_clarifications(
    project_id: int,
    status: str | None = None,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    get_project_checked(db, p, project_id)
    from app.db.models import RequirementClarification
    stmt = select(RequirementClarification).where(RequirementClarification.project_id == project_id)
    if status:
        stmt = stmt.where(RequirementClarification.status == status)
    rows = db.execute(stmt.order_by(RequirementClarification.created_at.desc())).scalars().all()
    return [S.requirement_clarification(c) for c in rows]


class ClarificationResolveIn(BaseModel):
    user_response: str = Field(min_length=2)


@router.post("/clarifications/{clarification_id}/resolve")
def resolve_clarification(
    clarification_id: int,
    body: ClarificationResolveIn,
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    from app.db.models import RequirementClarification
    clar = db.get(RequirementClarification, clarification_id)
    if not clar:
        raise NotFound("Clarification not found")
    get_project_checked(db, p, clar.project_id)

    clar.status = "resolved"
    clar.user_response = body.user_response.strip()
    clar.resolved_at = utcnow()
    audit.record(db, p.id, "clarification.resolved", "clarification", clar.id, clar.type, clar.project_id)
    db.commit()
    return S.requirement_clarification(clar)


@router.post("/clarifications/{clarification_id}/dismiss")
def dismiss_clarification(
    clarification_id: int,
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    from app.db.models import RequirementClarification
    clar = db.get(RequirementClarification, clarification_id)
    if not clar:
        raise NotFound("Clarification not found")
    get_project_checked(db, p, clar.project_id)

    clar.status = "dismissed"
    audit.record(db, p.id, "clarification.dismissed", "clarification", clar.id, clar.type, clar.project_id)
    db.commit()
    return S.requirement_clarification(clar)


@router.post("/requirements/{req_id}/approve")
def approve_requirement(
    req_id: int,
    p: Principal = Depends(require("test.review")),
    db: Session = Depends(get_db),
):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    r.review_status = "approved"
    r.status = "approved"
    r.updated_at = utcnow()
    db.add(Review(entity_type="requirement", entity_id=r.id, decision="approve", comment="Requirement approved", reviewer_id=p.id))
    audit.record(db, p.id, "requirement.approved", "requirement", r.id, r.key, r.project_id)
    db.commit()
    return S.requirement(db, r)


@router.post("/requirements/{req_id}/confirm")
def confirm_inferred_requirement(
    req_id: int,
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    r.review_status = "confirmed"
    r.status = "draft"
    r.updated_at = utcnow()
    audit.record(db, p.id, "requirement.confirmed", "requirement", r.id, r.key, r.project_id)
    db.commit()
    return S.requirement(db, r)


@router.post("/requirements/{req_id}/reject")
def reject_requirement(
    req_id: int,
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    r.review_status = "rejected"
    r.status = "deprecated"
    r.updated_at = utcnow()
    db.add(Review(entity_type="requirement", entity_id=r.id, decision="reject", comment="Requirement rejected", reviewer_id=p.id))
    audit.record(db, p.id, "requirement.rejected", "requirement", r.id, r.key, r.project_id)
    db.commit()
    return S.requirement(db, r)


@router.post("/requirements/{req_id}/request-clarification")
def mark_requirement_needs_clarification(
    req_id: int,
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    r.review_status = "needs_clarification"
    r.updated_at = utcnow()
    audit.record(db, p.id, "requirement.needs_clarification", "requirement", r.id, r.key, r.project_id)
    db.commit()
    return S.requirement(db, r)


@router.get("/requirements/{req_id}/history")
def get_requirement_history(
    req_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    r = check_entity_project(db, p, db.get(Requirement, req_id), "Requirement")
    versions = db.execute(
        select(RequirementVersion).where(RequirementVersion.requirement_id == r.id).order_by(RequirementVersion.version.asc())
    ).scalars().all()
    from app.db.models import AuditLog
    audits = db.execute(
        select(AuditLog).where(AuditLog.entity_type == "requirement", AuditLog.entity_id == r.id).order_by(AuditLog.created_at.desc())
    ).scalars().all()

    return {
        "requirement_id": r.id,
        "key": r.key,
        "current_version": r.current_version,
        "versions": [S.version(db, v) for v in versions],
        "audit_logs": [
            {
                "id": a.id,
                "action": a.action,
                "user_id": a.user_id,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "details": a.details,
            }
            for a in audits
        ],
    }
