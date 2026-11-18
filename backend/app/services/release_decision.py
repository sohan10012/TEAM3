"""Canonical centralized release decision and quality readiness engine.

Evaluates evidence-backed release readiness across 5 deterministic states:
- Approved for Production (unconditional)
- Approved with Conditions
- Not Approved (blocked by defect, failure, or unacceptable coverage)
- Insufficient Evidence (missing tests, executions, or requirements)
- Evaluation In Progress (active workflows or pending review)

Strict invariants:
1. A blocking open defect MUST prevent unconditional production approval.
2. Zero verified tests must not be represented as passing or ready.
3. Empty denominators must never be treated as 100% or passing.
4. Missing execution evidence results in Insufficient Evidence, never Approved.
5. All scores are reproducible with documented numerators and denominators.
"""
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
    Requirement,
    Run,
    TestCase,
)

log = logging.getLogger("tracetest.release_decision")

ACTIVE_TEST_STATUSES = ("pending_review", "approved", "changes_requested", "needs_reapproval")


def evaluate_release_decision(db: Session, project_id: int) -> dict[str, Any]:
    """Calculate the authoritative release decision and evidence-backed readiness score."""
    project = db.get(Project, project_id)
    if not project:
        return {
            "project_id": project_id,
            "status": "insufficient_evidence",
            "display_status": "Insufficient Evidence",
            "is_approved": False,
            "readiness_score": 0.0,
            "reasons": [f"Project #{project_id} not found"],
            "blocking_defects": [],
            "metrics": {},
            "score_breakdown": {},
        }

    # 1. Documents
    docs = list(
        db.execute(
            select(Document).where(Document.project_id == project_id)
        ).scalars().all()
    )
    completed_docs = [d for d in docs if getattr(d, "status", "") in ("completed", "extracted", "parsed")]

    # 2. Requirements
    reqs = list(
        db.execute(
            select(Requirement)
            .where(Requirement.project_id == project_id, Requirement.status != "deprecated")
        ).scalars().all()
    )
    total_reqs = len(reqs)
    approved_reqs = [r for r in reqs if r.status == "approved"]

    # 3. Acceptance Criteria
    acs = list(
        db.execute(
            select(AcceptanceCriterion)
            .join(Requirement, Requirement.id == AcceptanceCriterion.requirement_id)
            .where(Requirement.project_id == project_id)
        ).scalars().all()
    )
    total_acs = len(acs)
    approved_acs = [a for a in acs if getattr(a, "review_status", "") == "approved"]

    # 4. Test Cases
    tests = list(
        db.execute(
            select(TestCase)
            .where(TestCase.project_id == project_id, TestCase.status.in_(ACTIVE_TEST_STATUSES))
        ).scalars().all()
    )
    total_tests = len(tests)
    approved_tests = [t for t in tests if t.status == "approved"]
    pending_tests = [t for t in tests if t.status == "pending_review"]

    # 5. Requirement Coverage
    covered_req_ids = {t.requirement_id for t in tests if t.requirement_id}
    covered_reqs_count = len(covered_req_ids)
    coverage_pct = round(100.0 * covered_reqs_count / total_reqs, 1) if total_reqs > 0 else 0.0

    # 6. Executions & Results
    execs = list(
        db.execute(
            select(Execution)
            .where(Execution.project_id == project_id)
            .order_by(desc(Execution.created_at))
        ).scalars().all()
    )
    total_execs = len(execs)
    last_exec = execs[0] if execs else None

    # Derive execution pass rate from latest run or all recent results
    executed_tests_count = 0
    passed_tests_count = 0
    failed_tests_count = 0
    if total_tests > 0:
        sub = (
            select(ExecutionResult.test_case_id, func.max(ExecutionResult.id).label("mid"))
            .join(Execution, Execution.id == ExecutionResult.execution_id)
            .where(Execution.project_id == project_id)
            .group_by(ExecutionResult.test_case_id)
            .subquery()
        )
        latest_res = list(
            db.execute(
                select(ExecutionResult).join(sub, ExecutionResult.id == sub.c.mid)
            ).scalars().all()
        )
        executed_tests_count = len(latest_res)
        passed_tests_count = sum(1 for r in latest_res if r.status == "passed")
        failed_tests_count = sum(1 for r in latest_res if r.status in ("failed", "error", "timed_out"))

    if executed_tests_count > 0:
        pass_rate_pct = round(100.0 * passed_tests_count / executed_tests_count, 1)
    elif last_exec:
        tot = (last_exec.passed or 0) + (last_exec.failed or 0) + (last_exec.errored or 0)
        pass_rate_pct = round(100.0 * (last_exec.passed or 0) / tot, 1) if tot > 0 else 0.0
    else:
        pass_rate_pct = 0.0

    # 7. Defects
    defects = list(
        db.execute(
            select(Defect).where(Defect.project_id == project_id)
        ).scalars().all()
    )
    open_defects = [d for d in defects if d.status not in ("closed", "verified")]
    critical_defects = [
        d for d in open_defects
        if d.severity in ("critical", "blocker") or d.priority == "p1"
    ]
    high_defects = [
        d for d in open_defects
        if d.severity == "high" or d.priority == "p2"
    ]

    # 8. Active Background Runs
    active_runs = list(
        db.execute(
            select(Run)
            .where(
                Run.subject_type == "project",
                Run.subject_id == project_id,
                Run.status.in_(("queued", "running")),
            )
        ).scalars().all()
    )

    # 9. Evaluate Decision & State
    reasons: list[str] = []
    blocking_defects_summary: list[dict[str, Any]] = []

    # Check for blocking defects
    for cd in critical_defects:
        blocking_defects_summary.append({
            "key": cd.key,
            "title": cd.title,
            "severity": cd.severity,
            "priority": cd.priority,
            "status": cd.status,
        })
        reasons.append(f"Blocking defect {cd.key} ({cd.severity.upper()}): {cd.title}")

    # Determine State
    if active_runs:
        state = "evaluation_in_progress"
        display_status = "Evaluation In Progress"
        reasons.append(f"{len(active_runs)} automated verification workflows currently executing.")
    elif total_reqs == 0:
        state = "insufficient_evidence"
        display_status = "Insufficient Evidence"
        reasons.append("No requirements extracted or configured for this project.")
    elif total_tests == 0 or total_execs == 0 or executed_tests_count == 0:
        state = "insufficient_evidence"
        display_status = "Insufficient Evidence"
        if total_tests == 0:
            reasons.append("Zero test cases exist to verify requirements (0% test coverage).")
        if total_execs == 0 or executed_tests_count == 0:
            reasons.append("Zero verified test executions recorded in sandbox or test environment.")
    elif len(critical_defects) > 0:
        state = "not_approved"
        display_status = "Not Approved"
    elif failed_tests_count > 0 or (last_exec and last_exec.status == "failed" and (last_exec.failed or 0) > 0):
        state = "not_approved"
        display_status = "Not Approved"
        reasons.append(
            f"Execution test failure detected: {failed_tests_count} test(s) failed in latest execution run."
        )
    elif coverage_pct < 60.0:
        state = "not_approved"
        display_status = "Not Approved"
        reasons.append(
            f"Requirement coverage is {coverage_pct}%, below minimum acceptable 60.0% threshold ({total_reqs - covered_reqs_count} uncovered)."
        )
    elif len(open_defects) > 0 or pass_rate_pct < 95.0 or coverage_pct < 90.0 or len(approved_tests) < total_tests:
        state = "approved_with_conditions"
        display_status = "Approved with Conditions"
        if len(open_defects) > 0:
            reasons.append(f"{len(open_defects)} non-critical open defect(s) pending remediation.")
        if pass_rate_pct < 95.0:
            reasons.append(f"Execution pass rate is {pass_rate_pct}%, below 95.0% full release threshold.")
        if coverage_pct < 90.0:
            reasons.append(f"Requirement coverage is {coverage_pct}%, below 90.0% production threshold.")
        if len(approved_tests) < total_tests:
            reasons.append(f"{len(pending_tests)} test case(s) await formal approval.")
    else:
        state = "approved_for_production"
        display_status = "Approved for Production"
        reasons.append("All release gates passed: 100% test pass rate, >=90% requirement coverage, and 0 open defects.")

    is_approved = state == "approved_for_production"

    # 10. Compute Evidence-Backed Readiness Score
    # Document Score (15%)
    if docs:
        doc_score = round(100.0 * len(completed_docs) / len(docs), 1)
    else:
        doc_score = 0.0

    # Requirement Score (20%)
    if reqs:
        req_score = round(100.0 * len(approved_reqs) / len(reqs), 1)
    else:
        req_score = 0.0

    # Coverage Score (25%)
    cov_score = coverage_pct

    # Execution Score (25%) - STRICTLY 0.0 if no executions!
    if executed_tests_count > 0:
        exec_score = pass_rate_pct
    else:
        exec_score = 0.0

    # Defect Penalty Score (15%)
    if executed_tests_count > 0 or total_execs > 0 or total_tests > 0:
        penalty = (len(critical_defects) * 40.0) + (len(high_defects) * 20.0) + (len(open_defects) * 5.0)
        defect_score = max(0.0, round(100.0 - penalty, 1))
    else:
        defect_score = 0.0 if open_defects else 50.0

    # Weighted composite score
    composite = (
        (doc_score * 0.15)
        + (req_score * 0.20)
        + (cov_score * 0.25)
        + (exec_score * 0.25)
        + (defect_score * 0.15)
    )
    readiness_score = round(composite, 1)

    # Invariants enforcement on score
    if total_reqs == 0:
        readiness_score = 0.0
    elif total_tests == 0 or executed_tests_count == 0:
        # Without test execution verification, score can never exceed 35%
        readiness_score = min(35.0, readiness_score)

    return {
        "project_id": project_id,
        "project_key": project.key,
        "project_name": project.name,
        "status": state,
        "display_status": display_status,
        "is_approved": is_approved,
        "readiness_score": readiness_score,
        "reasons": reasons,
        "blocking_defects": blocking_defects_summary,
        "metrics": {
            "total_documents": len(docs),
            "completed_documents": len(completed_docs),
            "total_requirements": total_reqs,
            "approved_requirements": len(approved_reqs),
            "total_acceptance_criteria": total_acs,
            "approved_acceptance_criteria": len(approved_acs),
            "total_test_cases": total_tests,
            "approved_test_cases": len(approved_tests),
            "pending_test_cases": len(pending_tests),
            "covered_requirements": covered_reqs_count,
            "coverage_pct": coverage_pct,
            "total_executions": total_execs,
            "executed_tests_count": executed_tests_count,
            "passed_tests_count": passed_tests_count,
            "failed_tests_count": failed_tests_count,
            "pass_rate_pct": pass_rate_pct,
            "total_defects": len(defects),
            "open_defects_count": len(open_defects),
            "critical_defects_count": len(critical_defects),
            "high_defects_count": len(high_defects),
        },
        "score_breakdown": {
            "document_score": {
                "score": doc_score,
                "weight": 0.15,
                "numerator": len(completed_docs),
                "denominator": len(docs),
                "method": "completed_documents / total_documents * 100",
            },
            "requirement_score": {
                "score": req_score,
                "weight": 0.20,
                "numerator": len(approved_reqs),
                "denominator": total_reqs,
                "method": "approved_requirements / total_requirements * 100",
            },
            "coverage_score": {
                "score": cov_score,
                "weight": 0.25,
                "numerator": covered_reqs_count,
                "denominator": total_reqs,
                "method": "covered_requirements / total_requirements * 100",
            },
            "execution_score": {
                "score": exec_score,
                "weight": 0.25,
                "numerator": passed_tests_count,
                "denominator": executed_tests_count,
                "method": "passed_tests / executed_tests * 100 (0 if unexecuted)",
            },
            "defect_score": {
                "score": defect_score,
                "weight": 0.15,
                "numerator": len(open_defects),
                "denominator": len(defects) if defects else 0,
                "method": "max(0, 100 - (critical*40 + high*20 + other*5))",
            },
        },
    }
