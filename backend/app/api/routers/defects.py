from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
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
from app.core.errors import AppError, BadRequest, Conflict
from app.db.base import get_db, utcnow
from app.db.models import (
    Defect,
    DefectComment,
    DefectLink,
    Environment,
    Integration,
    IntegrationEvent,
    Project,
    Review,
    TestCase,
    User,
)
from app.domain.enums import normalize_defect_priority
from app.graph import execution_graph
from app.integrations import github
from app.services import audit
from app.services import defects as svc
from app.services.executions import create_execution

router = APIRouter(prefix="/defects", tags=["defects"])


@router.get("")
def list_defects(pp: PageParams = Depends(page_params), project_id: int | None = None, status: str | None = None,
                 severity: str | None = None, priority: str | None = None, approval_status: str | None = "approved",
                 owner_id: int | None = None, evidence_type: str | None = None, open_only: bool = False,
                 p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    normalized_pri = normalize_defect_priority(priority) if priority else None
    stmt = select(Defect).where(Defect.project_id.in_(scoped_project_ids(db, p, project_id) or [-1]))
    for col, val in ((Defect.status, status), (Defect.severity, severity), (Defect.priority, normalized_pri),
                     (Defect.owner_id, owner_id), (Defect.evidence_type, evidence_type),
                     (Defect.approval_status, approval_status if approval_status != "all" else None)):
        if val is not None:
            stmt = stmt.where(col == val)
    if open_only:
        stmt = stmt.where(Defect.status.notin_(["verified", "closed"]))
    if pp.q:
        stmt = stmt.where(Defect.title.ilike(f"%{pp.q}%") | Defect.key.ilike(f"%{pp.q}%"))
    return paginate(db, stmt, pp, {"key": Defect.key, "severity": Defect.severity, "status": Defect.status,
                                   "created_at": Defect.created_at, "updated_at": Defect.updated_at},
                    Defect.created_at, lambda d: S.defect(db, d))


def _detail(db: Session, d: Defect) -> dict:
    out = S.defect(db, d, full=True)
    out["comments"] = [{"id": c.id, "author": S.user_ref(db, c.author_id), "body": c.body, "at": S.iso(c.created_at)}
                       for c in db.execute(select(DefectComment).where(DefectComment.defect_id == d.id)
                                           .order_by(DefectComment.created_at)).scalars()]
    links = db.execute(select(DefectLink, Defect).join(Defect, Defect.id == DefectLink.related_defect_id)
                       .where(DefectLink.defect_id == d.id)).all()
    out["links"] = [{"type": lk.link_type, "key": o.key, "id": o.id, "title": o.title, "status": o.status}
                    for lk, o in links]
    out["duplicate_candidates"] = svc.duplicate_candidates(db, d.project_id, d.title, d.test_case_id, d.id)
    from app.domain.enums import DEFECT_TRANSITIONS
    out["allowed_transitions"] = sorted(DEFECT_TRANSITIONS.get(d.status, set())) if d.approval_status == "approved" else []
    return out


@router.get("/{defect_id}")
def get_defect(defect_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    return _detail(db, check_entity_project(db, p, db.get(Defect, defect_id), "Defect"))


class DefectIn(BaseModel):
    project_id: int
    title: str = Field(min_length=5, max_length=300)
    description: str = ""
    severity: str
    priority: str
    execution_result_id: int | None = None
    test_case_id: int | None = None
    requirement_id: int | None = None
    expected_result: str = ""
    actual_result: str = ""
    reproduction_steps: str = ""
    owner_id: int | None = None

    @field_validator("priority")
    @classmethod
    def _validate_priority(cls, v: str) -> str:
        try:
            return normalize_defect_priority(v)
        except ValueError as e:
            raise BadRequest(str(e))


@router.post("", status_code=201)
def create_defect(body: DefectIn, p: Principal = Depends(require("defect.write")), db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, body.project_id)
    d = svc.create_manual(db, proj.id, proj.key, body.model_dump(), p.id)
    db.commit()
    out = _detail(db, d)
    return out


class DefectPatch(BaseModel):
    title: str | None = Field(None, min_length=5, max_length=300)
    description: str | None = None
    severity: str | None = Field(None, pattern="^(critical|high|medium|low)$")
    priority: str | None = Field(None, pattern="^(p[1-4]|critical|high|medium|low)$")
    owner_id: int | None = None
    reproduction_steps: str | None = None

    @field_validator("priority")
    @classmethod
    def _validate_priority(cls, v: str | None) -> str | None:
        if v is None:
            return None
        try:
            return normalize_defect_priority(v)
        except ValueError as e:
            raise BadRequest(str(e))


@router.patch("/{defect_id}")
def patch_defect(defect_id: int, body: DefectPatch, p: Principal = Depends(require("defect.write")),
                 db: Session = Depends(get_db)):
    d = check_entity_project(db, p, db.get(Defect, defect_id), "Defect")
    changes = body.model_dump(exclude_none=True)
    if "owner_id" in changes and db.get(User, changes["owner_id"]) is None:
        raise BadRequest("Unknown owner")
    for k, v in changes.items():
        setattr(d, k, v)
    d.updated_at = utcnow()
    audit.record(db, p.id, "defect.updated", "defect", d.id, d.key, d.project_id, changes)
    db.commit()
    return _detail(db, d)


class TransitionIn(BaseModel):
    status: str
    comment: str = Field("", max_length=4000)


@router.post("/{defect_id}/transition")
def transition(defect_id: int, body: TransitionIn, p: Principal = Depends(require("defect.transition")),
               db: Session = Depends(get_db)):
    d = check_entity_project(db, p, db.get(Defect, defect_id), "Defect")
    svc.transition(db, d, body.status, p.id, body.comment)
    db.commit()
    return _detail(db, d)


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=8000)


@router.post("/{defect_id}/comments", status_code=201)
def comment(defect_id: int, body: CommentIn, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    d = check_entity_project(db, p, db.get(Defect, defect_id), "Defect")
    db.add(DefectComment(defect_id=d.id, author_id=p.id, body=body.body))
    audit.record(db, p.id, "defect.commented", "defect", d.id, d.key, d.project_id)
    db.commit()
    return _detail(db, d)


class LinkIn(BaseModel):
    related_key: str
    link_type: str = Field("related", pattern="^(related|duplicate|blocks)$")


@router.post("/{defect_id}/links", status_code=201)
def link(defect_id: int, body: LinkIn, p: Principal = Depends(require("defect.write")), db: Session = Depends(get_db)):
    d = check_entity_project(db, p, db.get(Defect, defect_id), "Defect")
    svc.add_link(db, d, body.related_key, body.link_type, p.id)
    db.commit()
    return _detail(db, d)


class DecisionIn(BaseModel):
    comment: str = ""
    severity: str | None = Field(None, pattern="^(critical|high|medium|low)$")
    priority: str | None = Field(None, pattern="^(p[1-4]|critical|high|medium|low)$")

    @field_validator("priority")
    @classmethod
    def _validate_priority(cls, v: str | None) -> str | None:
        if v is None:
            return None
        try:
            return normalize_defect_priority(v)
        except ValueError as e:
            raise BadRequest(str(e))


def _decide(db: Session, p: Principal, d: Defect, decision: str, body: DecisionIn) -> dict:
    if d.approval_status != "recommended":
        raise Conflict("Only recommended defects can be approved or dismissed")
    if decision == "approve":
        if body.severity:
            d.severity = body.severity
        if body.priority:
            d.priority = body.priority
    run = svc.find_workflow_run(db, d.id)
    db.add(Review(entity_type="defect_recommendation", entity_id=d.id, decision=decision, comment=body.comment,
                  reviewer_id=p.id))
    audit.record(db, p.id, f"defect.{decision}d", "defect", d.id, d.key, d.project_id,
                 {"comment": body.comment, "workflow_run": run.id if run else None})
    db.commit()
    if run is None or not execution_graph.resume_defect_decision(run.id, decision):
        d = db.get(Defect, d.id)
        if decision == "approve":
            d.approval_status = "approved"
            if d.ai_analysis:
                d.ai_analysis = {**d.ai_analysis, "confirmed": True}
        else:
            d.approval_status, d.status, d.resolved_at = "dismissed", "closed", utcnow()
        db.commit()
    db.expire_all()
    return _detail(db, db.get(Defect, d.id))


@router.post("/{defect_id}/approve")
def approve(defect_id: int, body: DecisionIn, p: Principal = Depends(require("defect.approve")),
            db: Session = Depends(get_db)):
    return _decide(db, p, check_entity_project(db, p, db.get(Defect, defect_id), "Defect"), "approve", body)


@router.post("/{defect_id}/dismiss")
def dismiss(defect_id: int, body: DecisionIn, p: Principal = Depends(require("defect.approve")),
            db: Session = Depends(get_db)):
    return _decide(db, p, check_entity_project(db, p, db.get(Defect, defect_id), "Defect"), "dismiss", body)


class RetestIn(BaseModel):
    environment_id: int


@router.post("/{defect_id}/retest", status_code=202)
def retest(defect_id: int, body: RetestIn, p: Principal = Depends(require("suite.execute")),
           db: Session = Depends(get_db)):
    from app.api.routers.execution import _launch
    d = check_entity_project(db, p, db.get(Defect, defect_id), "Defect")
    if d.approval_status != "approved":
        raise Conflict("Approve the defect before retesting")
    if not d.test_case_id:
        raise Conflict("Defect has no linked test case to retest")
    env = db.get(Environment, body.environment_id)
    proj = db.get(Project, d.project_id)
    if env is None or env.project_id != proj.id:
        raise BadRequest("Environment does not belong to this project")
    t = db.get(TestCase, d.test_case_id)
    ex, runnable = create_execution(db, proj, env, [t], source="platform_run", actor_id=p.id)
    audit.record(db, p.id, "defect.retest_started", "defect", d.id, d.key, d.project_id, {"execution": ex.key})
    return _launch(db, p, ex, runnable, defect_id=d.id)


def _issue_body(db: Session, d: Defect) -> str:
    info = S.defect(db, d, full=True)
    return (f"**TraceTest defect {d.key}** — severity {d.severity}, priority {d.priority}\n\n"
            f"{d.description}\n\n**Requirement:** {info.get('requirement_key')}  \n**Test:** {info.get('test_key')}  \n"
            f"**Execution:** {info.get('execution_key')}\n\n**Expected**\n\n{d.expected_result}\n\n**Actual**\n\n"
            f"```\n{d.actual_result[:3000]}\n```\n\n**Reproduction**\n\n{d.reproduction_steps}\n")


@router.post("/{defect_id}/github-issue")
def github_issue(defect_id: int, p: Principal = Depends(require("defect.write")), db: Session = Depends(get_db)):
    d = check_entity_project(db, p, db.get(Defect, defect_id), "Defect")
    if d.approval_status != "approved":
        raise Conflict("Only approved defects can be exported to GitHub")
    if d.github_issue_url:
        raise Conflict("A GitHub issue is already linked", {"url": d.github_issue_url})
    integ = db.execute(select(Integration).filter_by(project_id=d.project_id, kind="github")).scalar_one_or_none()
    repo = (integ.config or {}).get("repo") if integ else None
    if not github.configured() or not repo:
        raise AppError(409, "github_not_configured",
                       "GitHub is not configured for this project. Download the Markdown/JSON report instead.",
                       {"export_md": f"/api/v1/defects/{d.id}/report.md"})
    try:
        issue = github.create_issue(repo, f"[{d.key}] {d.title}", _issue_body(db, d),
                                    ["tracetest", f"severity:{d.severity}"])
    except github.GitHubError as exc:
        db.add(IntegrationEvent(integration_id=integ.id, kind="create_issue", status="error",
                                request_summary=d.key, response_summary=str(exc)[:1000]))
        db.commit()
        raise AppError(502, "github_error", str(exc)) from exc
    d.github_issue_url, d.github_issue_number, d.github_issue_state = issue["url"], issue["number"], issue["state"]
    db.add(IntegrationEvent(integration_id=integ.id, kind="create_issue", status="ok", request_summary=d.key,
                            response_summary=issue["url"]))
    audit.record(db, p.id, "defect.github_issue_created", "defect", d.id, d.key, d.project_id, issue)
    db.commit()
    return _detail(db, d)


@router.post("/{defect_id}/github-sync")
def github_sync(defect_id: int, p: Principal = Depends(require("defect.write")), db: Session = Depends(get_db)):
    d = check_entity_project(db, p, db.get(Defect, defect_id), "Defect")
    integ = db.execute(select(Integration).filter_by(project_id=d.project_id, kind="github")).scalar_one_or_none()
    if not d.github_issue_number or not integ:
        raise Conflict("Defect has no linked GitHub issue")
    try:
        issue = github.get_issue(integ.config["repo"], d.github_issue_number)
    except github.GitHubError as exc:
        raise AppError(502, "github_error", str(exc)) from exc
    d.github_issue_state = issue["state"]
    db.commit()
    return _detail(db, d)


@router.get("/{defect_id}/report.{fmt}")
def report(defect_id: int, fmt: str, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    d = check_entity_project(db, p, db.get(Defect, defect_id), "Defect")
    if fmt == "json":
        return Response(json.dumps(_detail(db, d), indent=2, default=str), media_type="application/json",
                        headers={"Content-Disposition": f'attachment; filename="{d.key}.json"'})
    if fmt == "md":
        body = f"# [{d.key}] {d.title}\n\nStatus: {d.status}\n\n" + _issue_body(db, d)
        return Response(body, media_type="text/markdown",
                        headers={"Content-Disposition": f'attachment; filename="{d.key}.md"'})
    raise BadRequest("Format must be md or json")
