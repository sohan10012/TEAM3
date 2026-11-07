from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api import serializers as S
from app.api.deps import (
    PageParams,
    Principal,
    current_principal,
    get_project_checked,
    page_params,
    paginate,
    require,
    scoped_project_ids,
)
from app.core.config import get_settings
from app.core.errors import AppError, BadRequest, Conflict, NotFound
from app.db.base import get_db, utcnow
from app.db.models import (
    AuditLog,
    Defect,
    Environment,
    EvalResult,
    EvalRun,
    Execution,
    ExecutionResult,
    Integration,
    IntegrationEvent,
    Notification,
    Project,
    Requirement,
    TestCase,
)
from app.execution.sandbox import _parse_junit
from app.integrations import github
from app.llm.router import provider_status
from app.services import analytics, audit, evals, exports, tasks
from app.services.keys import next_key

router = APIRouter()


# ---------- traceability / analytics ----------
@router.get("/traceability/matrix", tags=["traceability"])
def matrix(project_id: int | None = None, requirement_id: int | None = None,
           p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    try:
        ids = scoped_project_ids(db, p, project_id)
    except AppError:
        ids = scoped_project_ids(db, p, None)
    if project_id is None and requirement_id is None:
        ids = ids[:1]  # the full org matrix is too wide; default to first accessible project
    if requirement_id:
        r = db.get(Requirement, requirement_id)
        if r is None or r.project_id not in ids:
            raise NotFound("Requirement")
        ids = [r.project_id]
    out = analytics.traceability(db, ids, requirement_id)
    out["project_ids"] = ids
    return out


def _dt(v: str | None) -> datetime | None:
    if not v:
        return None
    try:
        return datetime.fromisoformat(v.replace("Z", ""))
    except ValueError as exc:
        raise BadRequest("Dates must be ISO-8601") from exc


@router.get("/analytics/dashboard", tags=["analytics"])
def dashboard(project_id: int | None = None, date_from: str | None = None, date_to: str | None = None,
              p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    try:
        pids = scoped_project_ids(db, p, project_id)
    except AppError:
        pids = scoped_project_ids(db, p, None)
    return analytics.dashboard(db, pids, _dt(date_from), _dt(date_to))


@router.get("/analytics/quality", tags=["analytics"])
def quality(project_id: int | None = None, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    try:
        pids = scoped_project_ids(db, p, project_id)
    except AppError:
        pids = scoped_project_ids(db, p, None)
    return analytics.quality_report(db, pids)


@router.get("/executions-compare", tags=["analytics"])
def compare(a: int, b: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    ids = scoped_project_ids(db, p, None)
    ea, eb = db.get(Execution, a), db.get(Execution, b)
    if not ea or not eb or ea.project_id not in ids or eb.project_id not in ids:
        raise NotFound("Execution")
    ra = {r.test_case_id: r.status for r in db.execute(select(ExecutionResult).filter_by(execution_id=a)).scalars()}
    rb = {r.test_case_id: r.status for r in db.execute(select(ExecutionResult).filter_by(execution_id=b)).scalars()}
    keys = dict(db.execute(select(TestCase.id, TestCase.key).where(TestCase.id.in_(set(ra) | set(rb) or {-1}))).tuples().all())
    rows = [{"test": keys.get(t), "before": ra.get(t), "after": rb.get(t)} for t in sorted(set(ra) | set(rb))]
    return {"a": ea.key, "b": eb.key,
            "regressions": [r for r in rows if r["before"] == "passed" and r["after"] in ("failed", "error")],
            "fixed": [r for r in rows if r["before"] in ("failed", "error") and r["after"] == "passed"],
            "unchanged": sum(1 for r in rows if r["before"] == r["after"]), "rows": rows}


# ---------- exports ----------
@router.get("/exports/{report}.{fmt}", tags=["exports"])
def export(report: str, fmt: str, project_id: int | None = None, p: Principal = Depends(require("export.read")),
           db: Session = Depends(get_db)):
    ids = scoped_project_ids(db, p, project_id)
    payload: object
    if report == "quality":
        payload = analytics.quality_report(db, ids)
        rows = [{k: v for k, v in r.items() if k not in ("defect_ageing", "last_execution")} |
                {"defect_ageing": r["defect_ageing"]} for r in payload["projects"]]
        title = "Release Quality Summary"
    elif report == "defects":
        ds = db.execute(select(Defect).where(Defect.project_id.in_(ids or [-1]), Defect.approval_status == "approved")
                        .order_by(Defect.key)).scalars()
        rows = [{"key": d.key, "title": d.title, "severity": d.severity, "priority": d.priority, "status": d.status,
                 "created": S.iso(d.created_at), "resolved": S.iso(d.resolved_at)} for d in ds]
        payload = rows
        title = "Defect Register"
    elif report == "traceability":
        tr = analytics.traceability(db, ids[:1] if project_id is None else ids)
        tests = tr["tests"]
        by_clause: dict[int, list[str]] = {}
        for ci, ti, state in tr["cells"]:
            by_clause.setdefault(ci, []).append(f"{tests[ti]['key']}({state})")
        rows = [{"requirement": c["requirement_key"], "clause": c["clause_key"], "covered": c["covered"],
                 "tests": ", ".join(by_clause.get(c["index"], []))} for c in tr["clauses"]]
        payload = tr
        title = "Requirement Traceability Matrix"
    elif report == "executions":
        es = db.execute(select(Execution).where(Execution.project_id.in_(ids or [-1])).order_by(Execution.id)).scalars()
        rows = [{"key": e.key, "source": e.source, "status": e.status, "hcm_version": e.hcm_version,
                 "passed": e.passed, "failed": e.failed, "errored": e.errored, "started": S.iso(e.started_at)}
                for e in es]
        payload = rows
        title = "Execution History"
    else:
        raise NotFound("Report")
    try:
        data, media = exports.render(fmt, title, rows, payload, f"Generated {utcnow().isoformat()}Z from live records.")
    except ValueError as exc:
        raise BadRequest(str(exc)) from exc
    audit.record(db, p.id, "export.generated", "report", None, f"{report}.{fmt}", project_id)
    db.commit()
    return Response(data, media_type=media, headers={"Content-Disposition": f'attachment; filename="{report}.{fmt}"'})


# ---------- evaluations ----------
@router.get("/evaluations", tags=["evaluations"])
def list_evals(p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    runs = db.execute(select(EvalRun).order_by(EvalRun.id.desc()).limit(50)).scalars()
    return {"runs": [S.eval_run(e) for e in runs], "scenarios": [
        {"key": s["key"], "title": s["title"], "expected_clause_count": s["expected_clause_count"],
         "expected_ambiguity_terms": s["expected_ambiguity_terms"]} for s in evals.load_golden()]}


@router.get("/evaluations/{eval_id}", tags=["evaluations"])
def get_eval(eval_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    e = db.get(EvalRun, eval_id)
    if e is None:
        raise NotFound("Evaluation")
    out = S.eval_run(e)
    out["results"] = [{"scenario": r.scenario_key, "passed": r.passed, "metrics": r.metrics}
                      for r in db.execute(select(EvalResult).filter_by(eval_run_id=e.id)).scalars()]
    return out


class EvalIn(BaseModel):
    provider: str = Field(pattern="^(groq|gemini|ollama|mock)$")


@router.post("/evaluations/run", status_code=202, tags=["evaluations"])
def run_eval(body: EvalIn, p: Principal = Depends(require("eval.run")), db: Session = Depends(get_db)):
    s = get_settings()
    model = {"groq": s.groq_model, "gemini": s.gemini_model, "ollama": s.ollama_model, "mock": "fixture-v1"}[body.provider]
    if body.provider != "mock":
        st = next(x for x in provider_status()["providers"] if x["name"] == body.provider)
        if not st["configured"]:
            raise Conflict(f"{body.provider} is not configured. Add its API key in the environment.")
    er = EvalRun(provider=body.provider, model=model, is_fixture=body.provider == "mock", triggered_by=p.id)
    db.add(er)
    db.flush()
    audit.record(db, p.id, "evaluation.started", "eval_run", er.id, None, None, {"provider": body.provider})
    db.commit()
    run_id = tasks.create_run("evaluation", "eval_run", er.id, p.id)
    tasks.submit(run_id, lambda rid: evals.run_evaluation(rid, er.id, body.provider))
    return {"eval_run_id": er.id, "run_id": run_id}


# ---------- audit ----------
@router.get("/audit", tags=["audit"])
def audit_log(pp: PageParams = Depends(page_params), project_id: int | None = None, action: str | None = None,
              entity_type: str | None = None, actor_id: int | None = None, source: str | None = None,
              p: Principal = Depends(require("audit.read")), db: Session = Depends(get_db)):
    ids = scoped_project_ids(db, p, project_id)
    stmt = select(AuditLog)
    stmt = stmt.where(AuditLog.project_id.in_(ids or [-1])) if project_id or not p.is_admin else stmt
    for col, val in ((AuditLog.action, action), (AuditLog.entity_type, entity_type), (AuditLog.actor_id, actor_id),
                     (AuditLog.source, source)):
        if val is not None:
            stmt = stmt.where(col == val)
    if pp.q:
        stmt = stmt.where(AuditLog.action.ilike(f"%{pp.q}%") | AuditLog.entity_key.ilike(f"%{pp.q}%"))
    return paginate(db, stmt, pp, {"created_at": AuditLog.created_at, "action": AuditLog.action}, AuditLog.id,
                    lambda a: S.audit_entry(db, a))


# ---------- integrations ----------
@router.get("/integrations", tags=["integrations"])
def integrations(project_id: int | None = None, p: Principal = Depends(require("integration.read")),
                 db: Session = Depends(get_db)):
    ids = scoped_project_ids(db, p, project_id)
    rows = {i.project_id: i for i in db.execute(select(Integration).where(
        Integration.project_id.in_(ids or [-1]), Integration.kind == "github")).scalars()}
    projects = db.execute(select(Project).where(Project.id.in_(ids or [-1]))).scalars()
    events = db.execute(select(IntegrationEvent).order_by(IntegrationEvent.id.desc()).limit(20)).scalars()
    ci = db.execute(select(Execution).where(Execution.source == "ci", Execution.project_id.in_(ids or [-1]))
                    .order_by(Execution.id.desc()).limit(10)).scalars()
    return {"github_token_configured": github.configured(),
            "ci_ingest_configured": bool(_ci_token()),
            "projects": [{"project": S.project(pr), "github": {"config": rows[pr.id].config, "status": rows[pr.id].status,
                                                                "last_checked_at": S.iso(rows[pr.id].last_checked_at)}
                          if pr.id in rows else None} for pr in projects],
            "events": [{"kind": e.kind, "status": e.status, "request": e.request_summary,
                        "response": e.response_summary, "at": S.iso(e.created_at)} for e in events],
            "ci_executions": [S.execution(db, e) for e in ci]}


class GitHubConfigIn(BaseModel):
    repo: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    branch: str = Field("main", max_length=200)


@router.put("/integrations/github/{project_id}", tags=["integrations"])
def configure_github(project_id: int, body: GitHubConfigIn, p: Principal = Depends(require("project.admin")),
                     db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, project_id)
    integ = db.execute(select(Integration).filter_by(project_id=proj.id, kind="github")).scalar_one_or_none()
    if integ is None:
        integ = Integration(project_id=proj.id, kind="github")
        db.add(integ)
        db.flush()
    integ.config = {"repo": body.repo, "branch": body.branch}
    status, detail = "configured_unverified", "GITHUB_TOKEN not set; configuration saved but not verified"
    if github.configured():
        try:
            info = github.get_repo(body.repo)
            status, detail = "connected", f"Verified repository {info.get('full_name')}"
        except github.GitHubError as exc:
            status, detail = "error", str(exc)
    integ.status, integ.last_checked_at = status, utcnow()
    db.add(IntegrationEvent(integration_id=integ.id, kind="verify_repo", status=status,
                            request_summary=body.repo, response_summary=detail[:1000]))
    audit.record(db, p.id, "integration.github_configured", "integration", integ.id, body.repo, proj.id,
                 {"status": status})
    db.commit()
    return {"status": status, "detail": detail}


@router.get("/integrations/github/{project_id}/branches", tags=["integrations"])
def branches(project_id: int, p: Principal = Depends(require("integration.read")), db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, project_id)
    integ = db.execute(select(Integration).filter_by(project_id=proj.id, kind="github")).scalar_one_or_none()
    if not integ or not github.configured():
        raise AppError(409, "github_not_configured", "GitHub is not configured")
    try:
        return {"branches": github.list_branches(integ.config["repo"])}
    except github.GitHubError as exc:
        raise AppError(502, "github_error", str(exc)) from exc


@router.post("/integrations/github/{project_id}/export-tests", tags=["integrations"])
def export_tests(project_id: int, p: Principal = Depends(require("project.admin")), db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, project_id)
    integ = db.execute(select(Integration).filter_by(project_id=proj.id, kind="github")).scalar_one_or_none()
    if not integ or not github.configured():
        raise AppError(409, "github_not_configured", "GitHub is not configured")
    tests = db.execute(select(TestCase).where(TestCase.project_id == proj.id, TestCase.status == "approved",
                                              TestCase.automation == "pytest")).scalars().all()
    pushed = []
    try:
        for t in tests[:200]:
            name = "test_" + t.key.replace("-", "_").lower() + ".py"
            header = f"# TraceTest {t.key} v{t.version} sha256={t.script_hash}\n"
            r = github.put_file(integ.config["repo"], integ.config.get("branch", "main"), f"tracetest/{name}",
                                header + (t.script or ""), f"TraceTest: export {t.key} v{t.version}")
            pushed.append(r["path"])
    except github.GitHubError as exc:
        raise AppError(502, "github_error", f"Exported {len(pushed)} files before failure: {exc}") from exc
    audit.record(db, p.id, "integration.tests_exported", "integration", integ.id, None, proj.id, {"files": len(pushed)})
    db.commit()
    return {"exported": pushed}


def _ci_token() -> str | None:
    import os
    return os.environ.get("TRACETEST_CI_TOKEN")


class CIResultIn(BaseModel):
    project_key: str
    environment: str = Field(pattern=r"^1\.[01]$")
    commit_sha: str = Field(max_length=64)
    branch: str = Field(max_length=200)
    junit_xml: str = Field(max_length=5_000_000)


@router.post("/ci/results", status_code=201, tags=["integrations"])
def ingest_ci(body: CIResultIn, authorization: str = Header(""), db: Session = Depends(get_db)):
    """CI pushes junit results here with `Authorization: Bearer $TRACETEST_CI_TOKEN`."""
    from app.core.security import constant_eq
    token = _ci_token()
    if not token or not constant_eq(authorization.removeprefix("Bearer ").strip(), token):
        raise AppError(401, "unauthenticated", "Invalid CI token")
    proj = db.execute(select(Project).where(Project.key == body.project_key)).scalar_one_or_none()
    if proj is None:
        raise NotFound("Project")
    env = db.execute(select(Environment).where(Environment.project_id == proj.id,
                                               Environment.hcm_version == body.environment)).scalars().first()
    if env is None:
        raise NotFound("Environment")
    tests = {("test_" + t.key.replace("-", "_").lower() + ".py"): t for t in
             db.execute(select(TestCase).where(TestCase.project_id == proj.id)).scalars()}
    outcomes = _parse_junit(body.junit_xml, {f: t.key for f, t in tests.items()})
    if not outcomes:
        raise BadRequest("No TraceTest results recognised in junit XML")
    by_key = {t.key: t for t in tests.values()}
    ex = Execution(key=next_key(db, Execution, "EX", 6), project_id=proj.id, environment_id=env.id, source="ci",
                   runner="pytest", status="running", hcm_version=env.hcm_version, total=len(outcomes),
                   commit_sha=body.commit_sha, branch=body.branch, started_at=utcnow())
    db.add(ex)
    db.flush()
    from app.execution.sandbox import SandboxResult
    from app.services.executions import persist_results
    persist_results(db, ex, [by_key[k] for k in outcomes], SandboxResult("completed", outcomes,
                    sum(o.duration_ms for o in outcomes.values()), "CI junit import"), ex.started_at, utcnow())
    audit.record(db, None, "execution.ci_ingested", "execution", ex.id, ex.key, proj.id,
                 {"commit": body.commit_sha, "branch": body.branch}, source="ci")
    db.commit()
    return {"execution": ex.key, "status": ex.status}


# ---------- notifications / search ----------
@router.get("/notifications", tags=["notifications"])
def notifications(p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    rows = db.execute(select(Notification).where(Notification.user_id == p.id)
                      .order_by(Notification.id.desc()).limit(30)).scalars()
    return [{"id": n.id, "title": n.title, "body": n.body, "link": n.link, "read": n.read, "at": S.iso(n.created_at)}
            for n in rows]


@router.post("/notifications/{nid}/read", tags=["notifications"])
def mark_read(nid: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    n = db.get(Notification, nid)
    if n is None or n.user_id != p.id:
        raise NotFound("Notification")
    n.read = True
    db.commit()
    return {"ok": True}


@router.get("/search", tags=["search"])
def search(q: str, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    if len(q.strip()) < 2:
        return {"results": []}
    ids = scoped_project_ids(db, p, None) or [-1]
    like = f"%{q.strip()}%"
    out = []
    for r in db.execute(select(Requirement).where(Requirement.project_id.in_(ids),
                        Requirement.key.ilike(like) | Requirement.title.ilike(like)).limit(6)).scalars():
        out.append({"type": "requirement", "id": r.id, "key": r.key, "title": r.title})
    for t in db.execute(select(TestCase).where(TestCase.project_id.in_(ids),
                        TestCase.key.ilike(like) | TestCase.title.ilike(like)).limit(6)).scalars():
        out.append({"type": "test", "id": t.id, "key": t.key, "title": t.title})
    for d in db.execute(select(Defect).where(Defect.project_id.in_(ids),
                        Defect.key.ilike(like) | Defect.title.ilike(like)).limit(6)).scalars():
        out.append({"type": "defect", "id": d.id, "key": d.key, "title": d.title})
    for e in db.execute(select(Execution).where(Execution.project_id.in_(ids), Execution.key.ilike(like)).limit(4)).scalars():
        out.append({"type": "execution", "id": e.id, "key": e.key, "title": f"{e.status} · {e.hcm_version}"})
    return {"results": out}


# ---------- health / config ----------
@router.get("/health", tags=["health"])
def health(db: Session = Depends(get_db)):
    ok = db.execute(text("PRAGMA quick_check")).scalar() == "ok"
    fk = db.execute(text("PRAGMA foreign_key_check")).fetchall()
    return {"status": "ok" if ok and not fk else "degraded", "database": {"integrity": "ok" if ok else "failed",
            "foreign_key_violations": len(fk), "journal_mode": db.execute(text("PRAGMA journal_mode")).scalar()},
            "time": utcnow().isoformat() + "Z"}


@router.get("/config", tags=["health"])
def config(p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    s = get_settings()
    from app.execution.sandbox import detect_isolation_level
    counts = {name: db.scalar(select(func.count()).select_from(model)) for name, model in
              (("requirements", Requirement), ("test_cases", TestCase), ("executions", Execution), ("defects", Defect))}
    iso = detect_isolation_level()
    return {"environment": s.app_env, "isolation_level": iso, "llm": provider_status(), "github_configured": github.configured(),
            "playwright_target_url": s.playwright_target_url, "data_dir": str(s.data_dir) if p.is_admin else None,
            "sandbox": {"timeout_seconds": s.exec_timeout_seconds, "memory_mb": s.exec_memory_mb,
                        "max_output_bytes": s.exec_max_output_bytes, "isolation_level": iso}, "counts": counts}


@router.get("/system/provider-status", tags=["health"])
def get_provider_status(p: Principal = Depends(current_principal)):
    return provider_status()


class TestConnectionIn(BaseModel):
    provider: str = Field(pattern="^(groq|gemini|ollama)$")


@router.post("/llm/test-connection", tags=["health"])
def test_connection(body: TestConnectionIn, p: Principal = Depends(current_principal)):
    import time
    s = get_settings()
    if s.llm_mode == "mock" or s.app_env == "test":
        return {
            "provider": body.provider,
            "ok": True,
            "latency_ms": 12,
            "model": "fixture-v1",
            "slots": [{"slot": 1, "masked": "test-key-mock", "state": "healthy", "requests": 1, "errors": 0}],
            "error": None,
        }

    provider_obj: Any = None
    if body.provider == "groq":
        from app.llm.providers import GroqProvider
        provider_obj = GroqProvider(s)
    elif body.provider == "gemini":
        from app.llm.providers import GeminiProvider
        provider_obj = GeminiProvider(s)
    elif body.provider == "ollama":
        from app.llm.providers import OllamaProvider
        provider_obj = OllamaProvider(s)

    if not provider_obj or not provider_obj.configured():
        return {
            "provider": body.provider,
            "ok": False,
            "latency_ms": 0,
            "model": getattr(provider_obj, "model", "unknown") if provider_obj else "unknown",
            "slots": provider_obj.slot_status() if hasattr(provider_obj, "slot_status") else [],
            "error": f"Provider '{body.provider}' is not configured with any API keys.",
        }

    t0 = time.monotonic()
    try:
        provider_obj.complete_json(
            system="You are an automated health check probe.",
            user='Return JSON: {"status": "ok", "probe": "ping"}',
            timeout=15.0,
        )
        latency = int((time.monotonic() - t0) * 1000)
        return {
            "provider": body.provider,
            "ok": True,
            "latency_ms": latency,
            "model": provider_obj.model,
            "slots": provider_obj.slot_status() if hasattr(provider_obj, "slot_status") else [],
            "error": None,
        }
    except Exception as exc:
        latency = int((time.monotonic() - t0) * 1000)
        return {
            "provider": body.provider,
            "ok": False,
            "latency_ms": latency,
            "model": provider_obj.model,
            "slots": provider_obj.slot_status() if hasattr(provider_obj, "slot_status") else [],
            "error": str(exc),
        }


@router.post("/admin/backup", tags=["admin"])
def backup(p: Principal = Depends(require("system.admin")), db: Session = Depends(get_db)):
    from app.db.maintenance import backup_database
    path = backup_database()
    audit.record(db, p.id, "system.backup", "database", None, path.name)
    db.commit()
    return {"backup": path.name}
