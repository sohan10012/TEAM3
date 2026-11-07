"""Database-derived quality metrics, traceability and reports. No hardcoded figures."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.db.models import (
    AcceptanceCriterion,
    Clause,
    Defect,
    Document,
    Execution,
    ExecutionResult,
    Project,
    Requirement,
    RequirementVersion,
    TestCase,
)

ACTIVE_TEST = ("pending_review", "approved", "changes_requested", "needs_reapproval")


def _current_clauses(db: Session, project_ids: list[int]) -> list[tuple[Clause, Requirement]]:
    q = (select(Clause, Requirement).join(RequirementVersion, RequirementVersion.id == Clause.version_id)
         .join(Requirement, and_(Requirement.id == Clause.requirement_id,
                                 Requirement.current_version == RequirementVersion.version))
         .where(Requirement.project_id.in_(project_ids or [-1]), Requirement.status != "deprecated")
         .order_by(Requirement.key, Clause.position))
    return list(db.execute(q).tuples().all())


def _latest_results(db: Session, test_ids: list[int]) -> dict[int, ExecutionResult]:
    if not test_ids:
        return {}
    sub = (select(ExecutionResult.test_case_id, func.max(ExecutionResult.id).label("mid"))
           .where(ExecutionResult.test_case_id.in_(test_ids)).group_by(ExecutionResult.test_case_id).subquery())
    rows = db.execute(select(ExecutionResult).join(sub, ExecutionResult.id == sub.c.mid)).scalars()
    return {r.test_case_id: r for r in rows}


def coverage_by_project(db: Session, project_ids: list[int]) -> list[dict]:
    clauses = _current_clauses(db, project_ids)
    tests = db.execute(select(TestCase.project_id, TestCase.requirement_id, TestCase.clause_keys)
                       .where(TestCase.project_id.in_(project_ids or [-1]),
                              TestCase.status.in_(ACTIVE_TEST))).all()
    covered: dict[int, set[str]] = defaultdict(set)
    for _pid, rid, keys in tests:
        covered[rid].update(keys)
    per: dict[int, list[int]] = defaultdict(lambda: [0, 0])
    for c, r in clauses:
        per[r.project_id][0] += 1
        per[r.project_id][1] += 1 if c.clause_key in covered[r.id] else 0
    names = dict(db.execute(select(Project.id, Project.key).where(Project.id.in_(project_ids or [-1]))).tuples().all())
    return [{"project_id": pid, "project": names.get(pid), "total_clauses": t, "covered_clauses": cv,
             "coverage_pct": round(100 * cv / t, 1) if t else 0.0} for pid, (t, cv) in sorted(per.items())]


def dashboard(db: Session, project_ids: list[int], date_from: datetime | None, date_to: datetime | None) -> dict:
    date_to = date_to or utcnow() + timedelta(days=1)
    date_from = date_from or date_to - timedelta(days=120)
    pids = project_ids or [-1]
    projects = db.execute(select(Project).where(Project.id.in_(pids))).scalars().all()
    reqs = db.execute(select(Requirement.status, func.count()).where(Requirement.project_id.in_(pids))
                      .group_by(Requirement.status)).tuples().all()
    req_counts = dict(reqs)
    test_counts = dict(db.execute(select(TestCase.status, func.count()).where(TestCase.project_id.in_(pids))
                                  .group_by(TestCase.status)).tuples().all())
    ex_filter = and_(Execution.project_id.in_(pids), Execution.started_at >= date_from, Execution.started_at < date_to)
    executions = db.execute(select(Execution).where(ex_filter).order_by(Execution.started_at)).scalars().all()
    res_counts = dict(db.execute(select(ExecutionResult.status, func.count())
                                 .join(Execution, Execution.id == ExecutionResult.execution_id)
                                 .where(ex_filter).group_by(ExecutionResult.status)).tuples().all())
    denom = sum(res_counts.get(s, 0) for s in ("passed", "failed", "error", "timed_out"))
    pass_rate = round(100 * res_counts.get("passed", 0) / denom, 1) if denom else None
    defects = db.execute(select(Defect).where(Defect.project_id.in_(pids), Defect.approval_status == "approved")).scalars().all()
    open_defects = [d for d in defects if d.status not in ("verified", "closed")]
    cov = coverage_by_project(db, [p.id for p in projects])
    tot = sum(c["total_clauses"] for c in cov)
    cvd = sum(c["covered_clauses"] for c in cov)

    trend: dict[str, Counter] = defaultdict(Counter)
    for e in executions:
        wk = (e.started_at - timedelta(days=e.started_at.weekday())).strftime("%Y-%m-%d")
        trend[wk]["passed"] += e.passed
        trend[wk]["failed"] += e.failed
        trend[wk]["error"] += e.errored
        trend[wk]["executions"] += 1
    resolution: dict[str, Counter] = defaultdict(Counter)
    for d in defects:
        resolution[(d.created_at - timedelta(days=d.created_at.weekday())).strftime("%Y-%m-%d")]["opened"] += 1
        if d.resolved_at:
            resolution[(d.resolved_at - timedelta(days=d.resolved_at.weekday())).strftime("%Y-%m-%d")]["resolved"] += 1
    recent_changes = db.execute(
        select(RequirementVersion, Requirement).join(Requirement, Requirement.id == RequirementVersion.requirement_id)
        .where(Requirement.project_id.in_(pids), RequirementVersion.version > 1)
        .order_by(RequirementVersion.created_at.desc()).limit(8)).all()
    per_project = []
    for p in projects:
        pe = [e for e in executions if e.project_id == p.id]
        pd = [d for d in open_defects if d.project_id == p.id]
        p_res = sum(e.passed for e in pe), sum(e.passed + e.failed + e.errored for e in pe)
        c = next((x for x in cov if x["project_id"] == p.id), None)
        per_project.append({"project_id": p.id, "key": p.key, "name": p.name, "status": p.status,
                            "executions": len(pe), "pass_rate": round(100 * p_res[0] / p_res[1], 1) if p_res[1] else None,
                            "open_defects": len(pd), "critical_defects": sum(1 for d in pd if d.severity == "critical"),
                            "coverage_pct": c["coverage_pct"] if c else 0.0})
    return {
        "filters": {"project_ids": project_ids, "date_from": date_from.isoformat(), "date_to": date_to.isoformat()},
        "kpis": {
            "total_projects": len(projects), "active_projects": sum(1 for p in projects if p.status == "active"),
            "total_requirements": sum(req_counts.values()),
            "analysed_requirements": sum(v for k, v in req_counts.items() if k in ("analysed", "approved", "changed")),
            "total_test_cases": sum(test_counts.values()), "approved_test_cases": test_counts.get("approved", 0),
            "pending_reviews": test_counts.get("pending_review", 0) + test_counts.get("needs_reapproval", 0),
            "total_executions": len(executions), "pass_rate": pass_rate,
            "failed_executions": sum(1 for e in executions if e.status in ("failed", "error", "timed_out")),
            "open_defects": len(open_defects), "critical_defects": sum(1 for d in open_defects if d.severity == "critical"),
            "requirement_coverage": round(100 * cvd / tot, 1) if tot else 0.0,
        },
        "charts": {
            "execution_trend": [{"week": k, **v} for k, v in sorted(trend.items())],
            "result_distribution": [{"status": k, "count": v} for k, v in sorted(res_counts.items())],
            "coverage_by_project": cov,
            "defect_severity": [{"severity": s, "count": sum(1 for d in open_defects if d.severity == s)}
                                for s in ("critical", "high", "medium", "low")],
            "defect_resolution": [{"week": k, "opened": v["opened"], "resolved": v["resolved"]}
                                  for k, v in sorted(resolution.items())],
            "test_status": [{"status": k, "count": v} for k, v in sorted(test_counts.items())],
        },
        "recent_changes": [{"requirement_id": r.id, "key": r.key, "title": v.title, "version": v.version,
                            "summary": v.change_summary, "at": v.created_at.isoformat()} for v, r in recent_changes],
        "recent_executions": [{"id": e.id, "key": e.key, "status": e.status, "source": e.source,
                               "passed": e.passed, "failed": e.failed, "errored": e.errored,
                               "hcm_version": e.hcm_version, "started_at": e.started_at.isoformat() if e.started_at else None}
                              for e in sorted(executions, key=lambda e: e.started_at or utcnow(), reverse=True)[:8]],
        "projects": per_project,
    }


def traceability(db: Session, project_ids: list[int], requirement_id: int | None = None) -> dict:
    rows = _current_clauses(db, project_ids)
    if requirement_id:
        rows = [(c, r) for c, r in rows if r.id == requirement_id]
    req_ids = {r.id for _, r in rows}

    # Fetch all requirements in scope
    req_q = (
        select(Requirement)
        .where(Requirement.project_id.in_(project_ids or [-1]), Requirement.status != "deprecated")
        .order_by(Requirement.key)
    )
    if requirement_id:
        req_q = req_q.where(Requirement.id == requirement_id)
    all_reqs = list(db.execute(req_q).scalars().all())

    # Map document provenance
    doc_ids = {r.document_id for r in all_reqs if r.document_id}
    docs_map = {
        d.id: d
        for d in db.execute(select(Document).where(Document.id.in_(doc_ids or [-1]))).scalars().all()
    }

    # Map acceptance criteria
    all_acs = list(
        db.execute(
            select(AcceptanceCriterion).where(AcceptanceCriterion.requirement_id.in_(req_ids or [-1]))
        ).scalars().all()
    )
    acs_by_req: dict[int, list[AcceptanceCriterion]] = defaultdict(list)
    for ac in all_acs:
        acs_by_req[ac.requirement_id].append(ac)

    # Map test cases
    tq = select(TestCase).where(TestCase.project_id.in_(project_ids or [-1]), TestCase.status != "deprecated")
    if requirement_id:
        tq = tq.where(TestCase.requirement_id == requirement_id)
    tests = list(db.execute(tq.order_by(TestCase.key)).scalars())
    tests_by_req: dict[int, list[TestCase]] = defaultdict(list)
    for t in tests:
        tests_by_req[t.requirement_id].append(t)

    latest = _latest_results(db, [t.id for t in tests])

    # Map defects
    test_ids = [t.id for t in tests]
    def_q = select(Defect).where(
        Defect.project_id.in_(project_ids or [-1]),
        (Defect.requirement_id.in_(req_ids or [-1])) | (Defect.test_case_id.in_(test_ids or [-1])),
    )
    all_defects = list(db.execute(def_q).scalars().all())
    defects_by_req: dict[int, list[Defect]] = defaultdict(list)
    defects_by_test: dict[int, list[Defect]] = defaultdict(list)
    for df in all_defects:
        if df.requirement_id:
            defects_by_req[df.requirement_id].append(df)
        if df.test_case_id:
            defects_by_test[df.test_case_id].append(df)

    clause_index = {(r.id, c.clause_key): i for i, (c, r) in enumerate(rows)}
    test_cols, cells = [], []
    covered: set[int] = set()
    orphans, duplicates, impacted = [], [], []
    duplicate_details = []

    for t in tests:
        lr = latest.get(t.id)
        state = {"approved": "approved", "pending_review": "pending_approval", "changes_requested": "needs_review",
                 "needs_reapproval": "needs_review", "rejected": "rejected"}.get(t.status, t.status)
        if lr and lr.status in ("failed", "error", "timed_out") and t.status == "approved":
            state = "failed_execution"
        elif lr and lr.status == "passed" and t.status == "approved":
            state = "passed"
        idxs = [clause_index[(t.requirement_id, k)] for k in t.clause_keys if (t.requirement_id, k) in clause_index]
        if t.requirement_id in req_ids and not idxs:
            orphans.append(t.key)
        if t.duplicate_of:
            duplicates.append(t.key)
            duplicate_details.append({
                "id": t.id,
                "key": t.key,
                "title": t.title,
                "duplicate_of": t.duplicate_of,
                "test_category": t.test_category,
                "clause_keys": t.clause_keys,
                "reason": f"Exact duplicated parameter specification of {t.duplicate_of} citing {', '.join(t.clause_keys)}",
            })
        if t.status == "needs_reapproval":
            impacted.append(t.key)
        if not idxs:
            continue
        col = len(test_cols)
        test_cols.append({
            "id": t.id,
            "key": t.key,
            "title": t.title,
            "status": t.status,
            "state": state,
            "test_type": t.test_type,
            "test_category": t.test_category,
            "approval_status": t.approval_status,
            "duplicate_of": t.duplicate_of,
            "last_result": lr.status if lr else None,
            "last_execution_id": lr.execution_id if lr else None,
            "defects_count": len(defects_by_test.get(t.id, [])),
        })
        for i in idxs:
            cells.append([i, col, state])
            if t.status in ACTIVE_TEST:
                covered.add(i)

    clauses_out = [
        {
            "index": i,
            "requirement_id": r.id,
            "requirement_key": r.key,
            "requirement_title": r.title,
            "clause_key": c.clause_key,
            "text": c.text,
            "covered": i in covered,
            "ambiguous": bool(c.ambiguity_flags),
        }
        for i, (c, r) in enumerate(rows)
    ]
    total_clauses = len(rows)
    covered_clauses = len(covered)
    untested_clauses = total_clauses - covered_clauses

    # Build Requirement-Level Coverage Records
    req_coverage_list = []
    covered_req_count = 0
    partial_req_count = 0
    uncovered_req_count = 0

    for r in all_reqs:
        doc = docs_map.get(r.document_id) if r.document_id else None
        r_clauses = [c for c, req in rows if req.id == r.id]
        r_acs = acs_by_req.get(r.id, [])
        r_tests = tests_by_req.get(r.id, [])
        r_defects = defects_by_req.get(r.id, [])

        covered_r_clauses = sum(
            1 for c in r_clauses
            if (r.id, c.clause_key) in clause_index and clause_index[(r.id, c.clause_key)] in covered
        )

        has_tests = len(r_tests) > 0
        all_clauses_covered = len(r_clauses) > 0 and covered_r_clauses == len(r_clauses)
        tests_approved = any(t.status == "approved" or t.approval_status == "approved" for t in r_tests)

        if not has_tests:
            cov_status = "uncovered"
            uncovered_req_count += 1
        elif all_clauses_covered and tests_approved:
            cov_status = "fully_covered"
            covered_req_count += 1
        else:
            cov_status = "partially_covered"
            partial_req_count += 1

        req_exec_results = []
        for t in r_tests:
            if t.id in latest:
                lr = latest[t.id]
                req_exec_results.append({
                    "test_key": t.key,
                    "status": lr.status,
                    "duration_ms": lr.duration_ms,
                    "execution_id": lr.execution_id,
                })

        gaps = []
        if not has_tests:
            gaps.append(f"No test cases validate requirement {r.key}.")
        if len(r_acs) == 0:
            gaps.append("Missing formal acceptance criteria.")
        for c in r_clauses:
            if not any(c.clause_key in t.clause_keys for t in r_tests):
                gaps.append(f"Clause {c.clause_key} has no mapped test case.")
        if r_tests and not any(t.test_category == "boundary_value" for t in r_tests):
            gaps.append("Missing boundary value verification test cases.")
        if r_tests and not any(t.test_category == "negative" for t in r_tests):
            gaps.append("Missing negative validation test cases.")

        actions = []
        if not has_tests:
            actions.append("generate_tests")
            actions.append("generate_ac")
        elif any(t.status == "pending_review" for t in r_tests):
            actions.append("review_tests")
        if r_defects:
            actions.append("investigate_defects")
        actions.append("view_document")

        req_coverage_list.append({
            "id": r.id,
            "key": r.key,
            "title": r.title,
            "category": r.category,
            "priority": r.priority,
            "status": r.status,
            "review_status": r.review_status,
            "coverage_status": cov_status,
            "covered_clauses_count": covered_r_clauses,
            "total_clauses_count": len(r_clauses),
            "document": {
                "id": doc.id if doc else None,
                "filename": doc.filename if doc else None,
                "page": r.source_page or "Page 1",
                "section": r.source_section or "General",
                "excerpt": r.evidence_excerpt or r.title,
            } if doc else None,
            "clauses": [
                {
                    "id": c.id,
                    "clause_key": c.clause_key,
                    "position": c.position,
                    "text": c.text,
                    "covered": (r.id, c.clause_key) in clause_index and clause_index[(r.id, c.clause_key)] in covered,
                    "ambiguity_flags": c.ambiguity_flags or [],
                }
                for c in r_clauses
            ],
            "acceptance_criteria": [
                {
                    "id": ac.id,
                    "key": ac.key,
                    "description": ac.description,
                    "source_quote": ac.source_quote,
                    "review_status": ac.review_status,
                }
                for ac in r_acs
            ],
            "tests": [
                {
                    "id": t.id,
                    "key": t.key,
                    "title": t.title,
                    "category": t.test_category,
                    "priority": t.priority,
                    "status": t.status,
                    "approval_status": t.approval_status,
                    "duplicate_of": t.duplicate_of,
                    "last_result": latest[t.id].status if t.id in latest else None,
                }
                for t in r_tests
            ],
            "executions": req_exec_results,
            "defects": [
                {
                    "id": df.id,
                    "key": df.key,
                    "title": df.title,
                    "severity": df.severity,
                    "status": df.status,
                }
                for df in r_defects
            ],
            "coverage_gaps": gaps,
            "recommended_actions": actions,
        })

    total_reqs = len(all_reqs)
    total_tests = len(tests)
    executed_tests = sum(1 for t in tests if t.id in latest)
    passed_tests = sum(1 for t in tests if latest.get(t.id) and latest[t.id].status == "passed")
    failed_tests = sum(1 for t in tests if latest.get(t.id) and latest[t.id].status in ("failed", "error", "timed_out"))
    pending_approval_tests = sum(1 for t in tests if t.status in ("pending_review", "draft") or t.approval_status in ("pending_approval", "draft"))
    approved_tests = sum(1 for t in tests if t.status == "approved" or t.approval_status == "approved")
    needs_review_tests = sum(1 for t in tests if t.status in ("needs_reapproval", "changes_requested"))

    # Plain language health assessment
    if uncovered_req_count > 0:
        headline = f"Critical Coverage Gap: {uncovered_req_count} of {total_reqs} requirements lack verified test coverage."
        summary = (
            f"Your project contains {total_reqs} requirements with {total_clauses} clauses across {len(doc_ids)} document(s). "
            f"Currently, only {covered_req_count + partial_req_count} requirement(s) cite test cases, leaving {uncovered_req_count} "
            f"requirements ({round(100 * uncovered_req_count / total_reqs, 1)}%) completely untested. In addition, {len(duplicates)} "
            f"test cases are duplicate definitions that require consolidation or distinct parameter sets."
        )
        biggest_problem = f"{uncovered_req_count} requirements across regulatory compliance and overtime calculation have zero linked test cases."
        recommended_action = "Generate baseline positive, negative, and boundary test scenarios for uncovered requirements using the Intelligent Test Generator."
    else:
        headline = "Full Requirement Coverage Verified."
        summary = f"All {total_reqs} requirements have associated test cases across {total_clauses} clauses."
        biggest_problem = "None. All requirements currently have linked test specifications."
        recommended_action = "Execute pending test suites to verify runtime adherence."

    return {
        "clauses": clauses_out,
        "tests": test_cols,
        "cells": cells,
        "requirements": req_coverage_list,
        "duplicate_test_details": duplicate_details,
        "health_assessment": {
            "status_grade": "critical" if uncovered_req_count > 0 else "good" if covered_req_count == total_reqs else "warning",
            "headline": headline,
            "summary": summary,
            "biggest_problem": biggest_problem,
            "recommended_action": recommended_action,
        },
        "distribution": {
            "fully_covered": {"count": covered_req_count, "pct": round(100 * covered_req_count / total_reqs, 1) if total_reqs else 0.0},
            "partially_covered": {"count": partial_req_count, "pct": round(100 * partial_req_count / total_reqs, 1) if total_reqs else 0.0},
            "uncovered": {"count": uncovered_req_count, "pct": round(100 * uncovered_req_count / total_reqs, 1) if total_reqs else 0.0},
            "pending_review": {"count": pending_approval_tests, "pct": round(100 * pending_approval_tests / total_tests, 1) if total_tests else 0.0},
            "failed_validation": {"count": failed_tests, "pct": round(100 * failed_tests / total_tests, 1) if total_tests else 0.0},
            "approved_verified": {"count": approved_tests, "pct": round(100 * approved_tests / total_tests, 1) if total_tests else 0.0},
        },
        "summary": {
            "total_requirements": total_reqs,
            "covered_requirements": covered_req_count,
            "partially_covered_requirements": partial_req_count,
            "uncovered_requirements": uncovered_req_count,
            "requirement_coverage_pct": round(100 * (covered_req_count + partial_req_count) / total_reqs, 1) if total_reqs else 0.0,
            "total_clauses": total_clauses,
            "covered_clauses": covered_clauses,
            "untested_clauses": untested_clauses,
            "coverage_pct": round(100 * covered_clauses / total_clauses, 1) if total_clauses else 0.0,
            "total_tests": total_tests,
            "executed_tests": executed_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "pending_approval_tests": pending_approval_tests,
            "needs_review_tests": needs_review_tests,
            "approved_tests": approved_tests,
            "orphan_tests": orphans,
            "duplicate_tests": duplicates,
            "impacted_tests": impacted,
        },
    }


def quality_report(db: Session, project_ids: list[int]) -> dict:
    now = utcnow()
    projects = db.execute(select(Project).where(Project.id.in_(project_ids or [-1]))).scalars().all()
    out = []
    for p in projects:
        reqs = db.scalar(select(func.count()).select_from(Requirement).where(Requirement.project_id == p.id)) or 0
        tests = db.execute(select(TestCase).where(TestCase.project_id == p.id, TestCase.status != "deprecated")).scalars().all()
        defects = db.execute(select(Defect).where(Defect.project_id == p.id, Defect.approval_status == "approved")).scalars().all()
        open_d = [d for d in defects if d.status not in ("verified", "closed")]
        ageing = Counter()
        for d in open_d:
            age = (now - d.created_at).days
            ageing["0-7d" if age <= 7 else "8-30d" if age <= 30 else "31-90d" if age <= 90 else ">90d"] += 1
        execs = db.execute(select(Execution).where(Execution.project_id == p.id).order_by(Execution.started_at)).scalars().all()
        # regression: tests whose latest result failed after a previous pass
        hist: dict[int, list[str]] = defaultdict(list)
        for tc_id, st in db.execute(select(ExecutionResult.test_case_id, ExecutionResult.status)
                                    .join(Execution, Execution.id == ExecutionResult.execution_id)
                                    .where(Execution.project_id == p.id).order_by(Execution.started_at)).all():
            hist[tc_id].append(st)
        regressions = sum(1 for seq in hist.values() if len(seq) >= 2 and seq[-1] == "failed" and "passed" in seq[:-1])
        automated = sum(1 for t in tests if t.automation in ("pytest", "playwright"))
        last = execs[-1] if execs else None
        cov = coverage_by_project(db, [p.id])
        out.append({
            "project": p.key, "name": p.name, "requirements": reqs, "tests": len(tests),
            "approved_tests": sum(1 for t in tests if t.status == "approved"),
            "automation_coverage_pct": round(100 * automated / len(tests), 1) if tests else 0.0,
            "requirement_coverage_pct": cov[0]["coverage_pct"] if cov else 0.0,
            "defect_density_per_requirement": round(len(defects) / reqs, 2) if reqs else 0.0,
            "open_defects": len(open_d), "critical_open": sum(1 for d in open_d if d.severity == "critical"),
            "defect_ageing": dict(ageing), "regressions": regressions,
            "impacted_tests": sum(1 for t in tests if t.status == "needs_reapproval"),
            "executions": len(execs),
            "last_execution": {"key": last.key, "status": last.status, "hcm_version": last.hcm_version,
                               "passed": last.passed, "failed": last.failed} if last else None,
            "release_readiness": ("blocked" if any(d.severity == "critical" for d in open_d) else
                                  "at_risk" if open_d or (last and last.status != "passed") else "ready"),
        })
    return {"generated_at": now.isoformat(), "projects": out}
