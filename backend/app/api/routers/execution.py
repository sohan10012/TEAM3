from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
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
from app.db.base import SessionLocal, get_db, utcnow
from app.db.models import (
    Environment,
    Execution,
    ExecutionArtifact,
    ExecutionResult,
    Module,
    Run,
    RunStep,
    SuiteTestCase,
    TestCase,
    TestSuite,
)
from app.graph import execution_graph
from app.services import audit, tasks
from app.services.executions import create_execution, is_executable, perform_execution, suite_tests
from app.services.keys import next_key

router = APIRouter(tags=["test suites & executions"])


# ---------------- suites ----------------
def _suite_count(db: Session, s: TestSuite) -> int:
    return db.scalar(select(func.count()).select_from(SuiteTestCase).where(SuiteTestCase.suite_id == s.id)) or 0


@router.get("/suites")
def list_suites(pp: PageParams = Depends(page_params), project_id: int | None = None, module_id: int | None = None,
                p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    stmt = select(TestSuite).where(TestSuite.project_id.in_(scoped_project_ids(db, p, project_id) or [-1]))
    if module_id:
        stmt = stmt.where(TestSuite.module_id == module_id)
    if pp.q:
        stmt = stmt.where(TestSuite.name.ilike(f"%{pp.q}%") | TestSuite.key.ilike(f"%{pp.q}%"))
    return paginate(db, stmt, pp, {"name": TestSuite.name, "key": TestSuite.key, "updated_at": TestSuite.updated_at},
                    TestSuite.key, lambda s: S.suite(db, s, _suite_count(db, s)))


class SuiteIn(BaseModel):
    project_id: int
    name: str = Field(min_length=3, max_length=200)
    description: str = ""
    priority: str = "medium"
    module_id: int | None = None
    test_ids: list[int] = Field(default_factory=list)


def _set_tests(db: Session, s: TestSuite, ids: list[int], replace: bool) -> list[str]:
    if replace:
        db.query(SuiteTestCase).filter_by(suite_id=s.id).delete()
    existing = set(db.execute(select(SuiteTestCase.test_case_id).where(SuiteTestCase.suite_id == s.id)).scalars())
    pos = len(existing)
    rejected = []
    for tid in ids:
        t = db.get(TestCase, tid)
        if t is None or t.project_id != s.project_id:
            rejected.append(str(tid))
            continue
        if tid in existing:
            continue
        pos += 1
        db.add(SuiteTestCase(suite_id=s.id, test_case_id=tid, position=pos))
        existing.add(tid)
    return rejected


@router.post("/suites", status_code=201)
def create_suite(body: SuiteIn, p: Principal = Depends(require("suite.write")), db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, body.project_id)
    if body.module_id and (m := db.get(Module, body.module_id)) and m.project_id != proj.id:
        raise BadRequest("Module does not belong to this project")
    if db.execute(select(TestSuite).filter_by(project_id=proj.id, name=body.name)).scalar_one_or_none():
        raise Conflict("A suite with this name already exists in the project")
    s = TestSuite(key=next_key(db, TestSuite, f"TS-{proj.key}", 3), project_id=proj.id, module_id=body.module_id,
                  name=body.name, description=body.description, priority=body.priority, created_by=p.id)
    db.add(s)
    db.flush()
    rejected = _set_tests(db, s, body.test_ids, False)
    audit.record(db, p.id, "suite.created", "test_suite", s.id, s.key, proj.id, {"tests": len(body.test_ids)})
    db.commit()
    return {**S.suite(db, s, _suite_count(db, s)), "rejected_test_ids": rejected}


@router.get("/suites/{suite_id}")
def get_suite(suite_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    s = check_entity_project(db, p, db.get(TestSuite, suite_id), "Suite")
    tests = suite_tests(db, s)
    out = S.suite(db, s, len(tests))
    out["tests"] = [{**S.test_case(db, t), "executable": is_executable(t)[0], "blocked_reason": is_executable(t)[1]}
                    for t in tests]
    req_ids = {t.requirement_id for t in tests}
    covered = {(t.requirement_id, k) for t in tests for k in t.clause_keys}
    from app.services.analytics import _current_clauses
    clauses = [(c, r) for c, r in _current_clauses(db, [s.project_id]) if r.id in req_ids]
    out["coverage"] = {"requirements": len(req_ids), "clauses": len(clauses),
                       "covered": sum(1 for c, r in clauses if (r.id, c.clause_key) in covered)}
    out["executions"] = [S.execution(db, e) for e in db.execute(
        select(Execution).where(Execution.suite_id == s.id).order_by(Execution.id.desc()).limit(20)).scalars()]
    return out


class SuitePatch(BaseModel):
    name: str | None = Field(None, min_length=3, max_length=200)
    description: str | None = None
    priority: str | None = None
    add_test_ids: list[int] = Field(default_factory=list)
    remove_test_ids: list[int] = Field(default_factory=list)


@router.patch("/suites/{suite_id}")
def patch_suite(suite_id: int, body: SuitePatch, p: Principal = Depends(require("suite.write")),
                db: Session = Depends(get_db)):
    s = check_entity_project(db, p, db.get(TestSuite, suite_id), "Suite")
    for k in ("name", "description", "priority"):
        if getattr(body, k) is not None:
            setattr(s, k, getattr(body, k))
    rejected = _set_tests(db, s, body.add_test_ids, False)
    if body.remove_test_ids:
        db.query(SuiteTestCase).filter(SuiteTestCase.suite_id == s.id,
                                       SuiteTestCase.test_case_id.in_(body.remove_test_ids)).delete()
    s.updated_at = utcnow()
    audit.record(db, p.id, "suite.updated", "test_suite", s.id, s.key, s.project_id,
                 {"added": body.add_test_ids, "removed": body.remove_test_ids})
    db.commit()
    return {**S.suite(db, s, _suite_count(db, s)), "rejected_test_ids": rejected}


class ExecuteIn(BaseModel):
    environment_id: int
    test_ids: list[int] | None = None
    commit_sha: str | None = Field(None, max_length=64)
    branch: str | None = Field(None, max_length=200)


def _launch(db: Session, p: Principal, ex: Execution, runnable: list[TestCase], defect_id: int | None = None) -> dict:
    db.commit()  # release the write lock before the run record is written by another session
    run_id = tasks.create_run("execution", "execution", ex.id, p.id)
    ex.run_id = run_id
    db.commit()
    ids = [t.id for t in runnable]

    def job(rid: int) -> dict:
        tasks.step(rid, "execution_precheck", detail={"tests": len(ids)}, progress=0.1)
        status = perform_execution(ex.id, ids)
        tasks.step(rid, "sandbox_execution", status, progress=0.9)
        out = {"execution_id": ex.id, "status": status}
        if defect_id:
            from app.services.defects import apply_retest_outcome
            out["retest_outcome"] = apply_retest_outcome(ex.id, defect_id, p.id)
        return out
    tasks.submit(run_id, job)
    return {"execution": S.execution(db, ex), "run_id": run_id}


@router.post("/suites/{suite_id}/execute", status_code=202)
def execute_suite(suite_id: int, body: ExecuteIn, p: Principal = Depends(require("suite.execute")),
                  db: Session = Depends(get_db)):
    s = check_entity_project(db, p, db.get(TestSuite, suite_id), "Suite")
    env = db.get(Environment, body.environment_id)
    if env is None or env.project_id != s.project_id:
        raise BadRequest("Environment does not belong to this project")
    tests = suite_tests(db, s)
    if body.test_ids:
        tests = [t for t in tests if t.id in set(body.test_ids)]
    proj = get_project_checked(db, p, s.project_id)
    ex, runnable = create_execution(db, proj, env, tests, source="platform_run", actor_id=p.id, suite=s,
                                    commit_sha=body.commit_sha, branch=body.branch)
    return _launch(db, p, ex, runnable)


# ---------------- executions ----------------
@router.get("/executions")
def list_executions(pp: PageParams = Depends(page_params), project_id: int | None = None,
                    status: str | None = None, source: str | None = None, suite_id: int | None = None,
                    p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    stmt = select(Execution).where(Execution.project_id.in_(scoped_project_ids(db, p, project_id) or [-1]))
    for col, val in ((Execution.status, status), (Execution.source, source), (Execution.suite_id, suite_id)):
        if val is not None:
            stmt = stmt.where(col == val)
    if pp.q:
        stmt = stmt.where(Execution.key.ilike(f"%{pp.q}%"))
    return paginate(db, stmt, pp, {"key": Execution.key, "started_at": Execution.started_at,
                                   "status": Execution.status, "duration_ms": Execution.duration_ms},
                    Execution.id, lambda e: S.execution(db, e))


@router.get("/executions/{ex_id}")
def get_execution(ex_id: int, result_status: str | None = None, p: Principal = Depends(current_principal),
                  db: Session = Depends(get_db)):
    ex = check_entity_project(db, p, db.get(Execution, ex_id), "Execution")
    out = S.execution(db, ex)
    q = select(ExecutionResult).where(ExecutionResult.execution_id == ex.id)
    if result_status:
        q = q.where(ExecutionResult.status == result_status)
    out["results"] = [S.result(db, r) for r in db.execute(q.order_by(ExecutionResult.id)).scalars()]
    out["artifacts"] = [{"id": a.id, "kind": a.kind, "name": a.path.rsplit("/", 1)[-1], "size_bytes": a.size_bytes,
                         "sha256": a.sha256} for a in db.execute(
        select(ExecutionArtifact).where(ExecutionArtifact.execution_id == ex.id)).scalars()]
    return out


@router.get("/executions/{ex_id}/logs")
def execution_logs(ex_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    ex = check_entity_project(db, p, db.get(Execution, ex_id), "Execution")
    art = db.execute(select(ExecutionArtifact).where(ExecutionArtifact.execution_id == ex.id,
                                                     ExecutionArtifact.kind == "log")).scalars().first()
    text = ex.log_excerpt
    if art:
        path = get_settings().data_dir / art.path
        if path.exists():
            text = path.read_text(errors="replace")
    return {"execution": ex.key, "log": text, "status": ex.status}


@router.get("/executions/{ex_id}/artifacts/{artifact_id}")
def download_artifact(ex_id: int, artifact_id: int, p: Principal = Depends(current_principal),
                      db: Session = Depends(get_db)):
    ex = check_entity_project(db, p, db.get(Execution, ex_id), "Execution")
    art = db.get(ExecutionArtifact, artifact_id)
    if art is None or art.execution_id != ex.id:
        raise NotFound("Artifact")
    base = get_settings().data_dir.resolve()
    path = (base / art.path).resolve()
    if base not in path.parents or not path.exists():
        raise NotFound("Artifact file")
    return FileResponse(path, filename=path.name)


@router.get("/executions/{ex_id}/report.junit")
def download_junit_report(ex_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    ex = check_entity_project(db, p, db.get(Execution, ex_id), "Execution")
    from app.services.project_dashboard import generate_junit_xml_for_execution
    xml = generate_junit_xml_for_execution(db, ex)
    return Response(content=xml, media_type="application/xml", headers={
        "Content-Disposition": f'attachment; filename="execution_{ex.key}_junit.xml"'
    })


@router.get("/executions/{ex_id}/report.html")
def view_html_report(ex_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    ex = check_entity_project(db, p, db.get(Execution, ex_id), "Execution")
    from app.services.project_dashboard import generate_html_report_for_execution
    html_content = generate_html_report_for_execution(db, ex)
    return Response(content=html_content, media_type="text/html", headers={
        "Content-Disposition": f'inline; filename="execution_{ex.key}_report.html"'
    })


class RetryIn(BaseModel):
    failed_only: bool = True
    environment_id: int | None = None


@router.post("/executions/{ex_id}/retry", status_code=202)
def retry(ex_id: int, body: RetryIn, p: Principal = Depends(require("suite.execute")), db: Session = Depends(get_db)):
    ex = check_entity_project(db, p, db.get(Execution, ex_id), "Execution")
    q = select(TestCase).join(ExecutionResult, ExecutionResult.test_case_id == TestCase.id).where(
        ExecutionResult.execution_id == ex.id)
    if body.failed_only:
        q = q.where(ExecutionResult.status.in_(["failed", "error", "timed_out"]))
    tests = list(db.execute(q).scalars())
    if not tests:
        raise Conflict("No tests to rerun")
    env = db.get(Environment, body.environment_id or ex.environment_id)
    proj = get_project_checked(db, p, ex.project_id)
    suite = db.get(TestSuite, ex.suite_id) if ex.suite_id else None
    new, runnable = create_execution(db, proj, env, tests, source="platform_run", actor_id=p.id, suite=suite,
                                     retry_of=ex)
    return _launch(db, p, new, runnable)


@router.post("/executions/{ex_id}/cancel")
def cancel(ex_id: int, p: Principal = Depends(require("suite.execute")), db: Session = Depends(get_db)):
    ex = check_entity_project(db, p, db.get(Execution, ex_id), "Execution")
    if ex.status not in ("queued", "running"):
        raise Conflict("Only queued or running executions can be cancelled")
    ex.status, ex.finished_at = "cancelled", utcnow()
    audit.record(db, p.id, "execution.cancelled", "execution", ex.id, ex.key, ex.project_id)
    db.commit()
    return S.execution(db, ex)


class AnalyseIn(BaseModel):
    result_id: int | None = None


@router.post("/executions/{ex_id}/analyse-failure", status_code=202)
def analyse_failure(ex_id: int, body: AnalyseIn, p: Principal = Depends(require("execution.read")),
                    db: Session = Depends(get_db)):
    ex = check_entity_project(db, p, db.get(Execution, ex_id), "Execution")
    q = select(ExecutionResult).where(ExecutionResult.execution_id == ex.id,
                                      ExecutionResult.status.in_(["failed", "error", "timed_out"]))
    if body.result_id:
        q = q.where(ExecutionResult.id == body.result_id)
    results = list(db.execute(q).scalars())
    if not results:
        raise Conflict("No failed results to analyse")
    run_ids = []
    for r in results[:25]:
        rid = tasks.create_run("failure_analysis", "execution_result", r.id, p.id)
        run_ids.append(rid)
        def job(run_id: int, res_id: int = r.id) -> dict:
            return execution_graph.run_failure_analysis(run_id, res_id, p.id)
        tasks.submit(rid, job)
    audit.record(db, p.id, "execution.failure_analysis_started", "execution", ex.id, ex.key, ex.project_id,
                 {"results": [r.id for r in results[:25]]})
    db.commit()
    return {"run_ids": run_ids}


# ---------------- runs (progress) ----------------
@router.get("/runs/{run_id}")
def get_run(run_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    r = db.get(Run, run_id)
    if r is None or (r.created_by != p.id and not p.is_admin and r.created_by is not None):
        raise NotFound("Run")
    steps = list(db.execute(select(RunStep).where(RunStep.run_id == r.id).order_by(RunStep.id)).scalars())
    return S.run(r, steps)


@router.get("/runs/{run_id}/events")
async def run_events(run_id: int, request: Request, p: Principal = Depends(current_principal)):
    """Server-Sent Events stream of run progress (clients fall back to polling GET /runs/{id})."""
    async def gen():
        last = None
        for _ in range(1800):
            if await request.is_disconnected():
                break
            db = SessionLocal()
            try:
                r = db.get(Run, run_id)
                if r is None:
                    yield "event: error\ndata: {\"message\": \"not found\"}\n\n"
                    break
                steps = list(db.execute(select(RunStep).where(RunStep.run_id == r.id).order_by(RunStep.id)).scalars())
                payload = json.dumps(S.run(r, steps), default=str)
            finally:
                db.close()
            if payload != last:
                yield f"data: {payload}\n\n"
                last = payload
            if r.status in ("completed", "failed", "degraded", "cancelled", "awaiting_review"):
                yield "event: done\ndata: {}\n\n"
                break
            await asyncio.sleep(1)
    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
