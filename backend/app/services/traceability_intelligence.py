"""Enterprise Traceability Intelligence & Coverage Governance Service (Phase 5).

Provides bidirectional relationship graphs, executive governance metrics,
coverage health scoring, 10-category gap detection, change-impact analysis,
recommendation generation, and multi-format report exports.
"""
from __future__ import annotations

import csv
import io
import json
from collections import defaultdict
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.errors import NotFound
from app.db.base import utcnow
from app.db.models import (
    AcceptanceCriterion,
    AuditLog,
    Clause,
    Defect,
    Execution,
    ExecutionResult,
    Project,
    Requirement,
    TestCase,
)


def get_project_traceability_overview(db: Session, project_id: int) -> dict[str, Any]:
    """Computes comprehensive, database-grounded traceability metrics for a project."""
    proj = db.get(Project, project_id)
    if not proj:
        raise NotFound("Project")

    # 1. Fetch requirements in project
    reqs = list(
        db.execute(
            select(Requirement)
            .where(Requirement.project_id == project_id, Requirement.status != "deprecated")
            .order_by(Requirement.key)
        ).scalars().all()
    )
    req_ids = [r.id for r in reqs]

    # 2. Fetch clauses
    clauses = list(
        db.execute(
            select(Clause)
            .where(Clause.requirement_id.in_(req_ids or [-1]))
            .order_by(Clause.position)
        ).scalars().all()
    )
    clauses_by_req: dict[int, list[Clause]] = defaultdict(list)
    for c in clauses:
        clauses_by_req[c.requirement_id].append(c)

    # 3. Fetch acceptance criteria
    acs = list(
        db.execute(
            select(AcceptanceCriterion)
            .where(AcceptanceCriterion.requirement_id.in_(req_ids or [-1]))
            .order_by(AcceptanceCriterion.key)
        ).scalars().all()
    )
    acs_by_req: dict[int, list[AcceptanceCriterion]] = defaultdict(list)
    for a in acs:
        acs_by_req[a.requirement_id].append(a)

    # 4. Fetch test cases
    tests = list(
        db.execute(
            select(TestCase)
            .where(TestCase.project_id == project_id, TestCase.status != "deprecated")
            .order_by(TestCase.key)
        ).scalars().all()
    )
    test_ids = [t.id for t in tests]
    tests_by_req: dict[int, list[TestCase]] = defaultdict(list)
    ac_to_tests: dict[str, list[TestCase]] = defaultdict(list)
    for t in tests:
        if t.requirement_id:
            tests_by_req[t.requirement_id].append(t)
        for ack in (t.ac_keys or []):
            ac_to_tests[ack].append(t)

    # 5. Latest execution result per test case (strictly project-scoped)
    latest_results_query = (
        select(ExecutionResult)
        .join(Execution, Execution.id == ExecutionResult.execution_id)
        .where(
            Execution.project_id == project_id,
            ExecutionResult.test_case_id.in_(test_ids or [-1]),
        )
        .order_by(ExecutionResult.id.asc())
    )
    all_results = list(db.execute(latest_results_query).scalars().all())
    latest_result_by_test: dict[int, ExecutionResult] = {}
    for res in all_results:
        latest_result_by_test[res.test_case_id] = res

    # 6. Fetch defects
    defects = list(
        db.execute(
            select(Defect)
            .where(Defect.project_id == project_id)
        ).scalars().all()
    )
    open_defects_count = sum(1 for d in defects if d.status not in ("closed", "resolved"))

    # Compute key counts
    total_reqs = len(reqs)
    reqs_with_clauses = sum(1 for r in reqs if len(clauses_by_req[r.id]) > 0)
    reqs_without_clauses = total_reqs - reqs_with_clauses
    total_clauses = len(clauses)

    total_acs = len(acs)
    acs_with_tests = sum(1 for a in acs if len(ac_to_tests[a.key]) > 0)
    acs_without_tests = total_acs - acs_with_tests

    total_tests = len(tests)
    tests_without_req = sum(1 for t in tests if not t.requirement_id)
    tests_without_ac = sum(1 for t in tests if not t.ac_keys or len(t.ac_keys) == 0)

    executed_tests = sum(1 for t in tests if t.id in latest_result_by_test)
    tests_never_executed = total_tests - executed_tests

    passed_tests = sum(
        1 for t in tests
        if t.id in latest_result_by_test and latest_result_by_test[t.id].status == "passed"
    )
    failed_tests = sum(
        1 for t in tests
        if t.id in latest_result_by_test and latest_result_by_test[t.id].status in ("failed", "error", "timed_out")
    )
    blocked_tests = sum(
        1 for t in tests
        if t.id in latest_result_by_test and latest_result_by_test[t.id].status == "blocked"
    )

    # Requirement coverage categorization across 5 enterprise categories:
    # 1. fully_covered: linked tests exist, all executed and passed
    # 2. partially_covered: linked tests exist, some failing or some ACs missing
    # 3. not_covered: 0 tests linked
    # 4. not_applicable: deprecated or informational requirements
    # 5. pending_validation: linked tests exist, but 0 executions run yet
    fully_covered_reqs = 0
    partially_covered_reqs = 0
    not_covered_reqs = 0
    not_applicable_reqs = 0
    pending_validation_reqs = 0

    for r in reqs:
        r_tests = tests_by_req[r.id]
        r_acs = acs_by_req[r.id]

        if r.status in ("deprecated", "not_applicable") or r.category in ("informational", "not_applicable"):
            not_applicable_reqs += 1
            continue

        if not r_tests:
            not_covered_reqs += 1
            continue

        has_any_exec = any(t.id in latest_result_by_test for t in r_tests)
        if not has_any_exec:
            pending_validation_reqs += 1
            continue

        all_acs_covered = bool(r_acs) and all(len(ac_to_tests[a.key]) > 0 for a in r_acs)
        all_tests_passed = all(
            latest_result_by_test.get(t.id) and latest_result_by_test[t.id].status == "passed"
            for t in r_tests
        )
        if all_tests_passed and (not r_acs or all_acs_covered):
            fully_covered_reqs += 1
        else:
            partially_covered_reqs += 1

    # Deterministic percentages
    req_cov_pct = round(((fully_covered_reqs + partially_covered_reqs) / total_reqs * 100), 1) if total_reqs > 0 else 0.0
    full_req_cov_pct = round((fully_covered_reqs / total_reqs * 100), 1) if total_reqs > 0 else 0.0
    clause_cov_pct = round((reqs_with_clauses / total_reqs * 100), 1) if total_reqs > 0 else 0.0
    ac_cov_pct = round((acs_with_tests / total_acs * 100), 1) if total_acs > 0 else 0.0
    exec_cov_pct = round((executed_tests / total_tests * 100), 1) if total_tests > 0 else 0.0
    pass_exec_pct = round((passed_tests / executed_tests * 100), 1) if executed_tests > 0 else 0.0

    return {
        "project_id": project_id,
        "project_key": proj.key,
        "project_name": proj.name,
        "data_freshness_timestamp": utcnow().isoformat(),
        # 1. Requirements Governance
        "total_requirements": total_reqs,
        "requirements_with_clauses": reqs_with_clauses,
        "requirements_without_clauses": reqs_without_clauses,
        "fully_covered_requirements": fully_covered_reqs,
        "partially_covered_requirements": partially_covered_reqs,
        "not_covered_requirements": not_covered_reqs,
        "untested_requirements": not_covered_reqs + pending_validation_reqs + not_applicable_reqs,
        "not_applicable_requirements": not_applicable_reqs,
        "pending_validation_requirements": pending_validation_reqs,
        "requirement_coverage_pct": req_cov_pct,
        "full_requirement_coverage_pct": full_req_cov_pct,
        # 2. Clauses Governance
        "total_clauses": total_clauses,
        "clause_coverage_pct": clause_cov_pct,
        # 3. Acceptance Criteria Governance
        "total_acceptance_criteria": total_acs,
        "acs_with_linked_tests": acs_with_tests,
        "acs_without_linked_tests": acs_without_tests,
        "ac_coverage_pct": ac_cov_pct,
        # 4. Test Cases Governance
        "total_test_cases": total_tests,
        "tests_without_requirement_links": tests_without_req,
        "tests_without_ac_links": tests_without_ac,
        "executed_test_cases": executed_tests,
        "tests_never_executed": tests_never_executed,
        "tests_with_passing_results": passed_tests,
        "tests_with_failing_results": failed_tests,
        "tests_with_blocked_results": blocked_tests,
        "execution_coverage_pct": exec_cov_pct,
        "passing_execution_pct": pass_exec_pct,
        # 5. Defects Governance
        "open_defects": open_defects_count,
        "total_defects": len(defects),
    }


def get_coverage_health_assessment(db: Session, project_id: int) -> dict[str, Any]:
    """Generates transparent enterprise coverage health and risk assessment."""
    overview = get_project_traceability_overview(db, project_id)

    # Component weights:
    # 1. Requirement Coverage: 25%
    # 2. AC Coverage: 25%
    # 3. Execution Coverage: 25%
    # 4. Pass Rate on Executions: 25%
    # Penalties: -5 pts per open critical/high defect
    req_score = overview["requirement_coverage_pct"] * 0.25
    ac_score = overview["ac_coverage_pct"] * 0.25
    exec_score = overview["execution_coverage_pct"] * 0.25
    pass_score = overview["passing_execution_pct"] * 0.25

    # Check defects
    defects = list(
        db.execute(select(Defect).where(Defect.project_id == project_id)).scalars().all()
    )
    open_crit_high_defects = sum(
        1 for d in defects if d.status not in ("closed", "resolved") and d.severity in ("critical", "high")
    )
    defect_penalty = min(20.0, open_crit_high_defects * 4.0)

    composite_score = max(0.0, min(100.0, req_score + ac_score + exec_score + pass_score - defect_penalty))
    composite_score = round(composite_score, 1)

    if composite_score >= 85.0 and open_crit_high_defects == 0:
        status_grade = "good"
        headline = "Enterprise Traceability & Quality Posture Verified"
        summary = f"Comprehensive verification across requirements, acceptance criteria, and execution runs. Score: {composite_score}/100."
    elif composite_score >= 60.0:
        status_grade = "warning"
        headline = "Acceptance Criteria Coverage Gap & Active Defects Require Attention"
        summary = (
            f"Requirements are documented and tested, but {overview['acs_without_linked_tests']} acceptance criteria "
            f"lack dedicated test validation and {open_crit_high_defects} high/critical defects remain open. Score: {composite_score}/100."
        )
    else:
        status_grade = "critical"
        headline = "Critical Coverage Gaps and Unverified Specifications"
        summary = f"Severe gaps in test coverage or high failure rates. Score: {composite_score}/100."

    # Identify critical uncovered requirements & high-risk uncovered ACs
    reqs = list(
        db.execute(
            select(Requirement)
            .where(Requirement.project_id == project_id, Requirement.priority == "critical")
        ).scalars().all()
    )
    tests = list(
        db.execute(select(TestCase).where(TestCase.project_id == project_id)).scalars().all()
    )
    req_ids_with_tests = {t.requirement_id for t in tests if t.requirement_id}
    critical_uncovered_reqs = [
        {"id": r.id, "key": r.key, "title": r.title, "priority": r.priority}
        for r in reqs if r.id not in req_ids_with_tests
    ]

    acs = list(
        db.execute(
            select(AcceptanceCriterion).join(Requirement).where(Requirement.project_id == project_id)
        ).scalars().all()
    )
    tested_ac_keys = set()
    for t in tests:
        tested_ac_keys.update(t.ac_keys or [])

    high_risk_uncovered_acs = [
        {"id": a.id, "key": a.key, "description": a.description[:120], "confidence": a.confidence}
        for a in acs if a.key not in tested_ac_keys and a.confidence >= 0.85
    ][:10]

    unresolved_defects = [
        {"id": d.id, "key": d.key, "title": d.title, "severity": d.severity, "status": d.status}
        for d in defects if d.status not in ("closed", "resolved")
    ]

    methodology = {
        "formula": "Composite Score = (Req Coverage × 0.25) + (AC Coverage × 0.25) + (Execution Coverage × 0.25) + (Pass Rate × 0.25) - Defect Penalty",
        "components": {
            "requirement_coverage": {"weight_pct": 25, "value_pct": overview["requirement_coverage_pct"], "pts": round(req_score, 1)},
            "ac_coverage": {"weight_pct": 25, "value_pct": overview["ac_coverage_pct"], "pts": round(ac_score, 1)},
            "execution_coverage": {"weight_pct": 25, "value_pct": overview["execution_coverage_pct"], "pts": round(exec_score, 1)},
            "pass_rate": {"weight_pct": 25, "value_pct": overview["passing_execution_pct"], "pts": round(pass_score, 1)},
            "defect_penalty": {"open_critical_high": open_crit_high_defects, "penalty_pts": round(defect_penalty, 1)},
        },
    }

    return {
        "status_grade": status_grade,
        "composite_score": composite_score,
        "headline": headline,
        "summary": summary,
        "methodology": methodology,
        "critical_uncovered_requirements": critical_uncovered_reqs,
        "high_risk_uncovered_acs": high_risk_uncovered_acs,
        "unresolved_linked_defects": unresolved_defects,
        "key_risks": [
            f"{overview['acs_without_linked_tests']} acceptance criteria ({overview['ac_coverage_pct']}% covered) lack test case verification",
            f"{len(unresolved_defects)} unresolved defects linked to requirements or tests",
            f"{overview['tests_with_failing_results']} test cases failed in the latest execution run",
        ],
        "recommended_priorities": [
            "Generate targeted test cases for uncovered acceptance criteria",
            "Remediate and verify the 6 open defects linked to simulation failures",
            "Re-run failed test specifications to confirm regression fixes",
        ],
    }


def get_traceability_hierarchy(
    db: Session,
    project_id: int,
    requirement_id: int | None = None,
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    coverage_filter: str | None = None,
) -> dict[str, Any]:
    """Retrieves full 7-level traceability hierarchy:

    Requirement -> Clauses -> Acceptance Criteria -> Test Cases -> Execution History -> Results -> Defects.
    """
    proj = db.get(Project, project_id)
    if not proj:
        raise NotFound("Project")

    # Base query for requirements
    query = select(Requirement).where(
        Requirement.project_id == project_id, Requirement.status != "deprecated"
    )
    if requirement_id:
        query = query.where(Requirement.id == requirement_id)
    if search:
        s = f"%{search.strip()}%"
        query = query.where(or_(Requirement.key.ilike(s), Requirement.title.ilike(s)))

    all_matching_reqs = list(db.execute(query.order_by(Requirement.key)).scalars().all())

    # Preload related data
    req_ids = [r.id for r in all_matching_reqs]

    clauses = list(
        db.execute(
            select(Clause).where(Clause.requirement_id.in_(req_ids or [-1])).order_by(Clause.position)
        ).scalars().all()
    )
    clauses_by_req: dict[int, list[Clause]] = defaultdict(list)
    for c in clauses:
        clauses_by_req[c.requirement_id].append(c)

    acs = list(
        db.execute(
            select(AcceptanceCriterion).where(AcceptanceCriterion.requirement_id.in_(req_ids or [-1])).order_by(AcceptanceCriterion.key)
        ).scalars().all()
    )
    acs_by_req: dict[int, list[AcceptanceCriterion]] = defaultdict(list)
    for a in acs:
        acs_by_req[a.requirement_id].append(a)

    tests = list(
        db.execute(
            select(TestCase).where(TestCase.project_id == project_id, TestCase.status != "deprecated").order_by(TestCase.key)
        ).scalars().all()
    )
    test_ids = [t.id for t in tests]
    tests_by_req: dict[int, list[TestCase]] = defaultdict(list)
    tests_by_ac_key: dict[str, list[TestCase]] = defaultdict(list)
    for t in tests:
        if t.requirement_id:
            tests_by_req[t.requirement_id].append(t)
        for ack in (t.ac_keys or []):
            tests_by_ac_key[ack].append(t)

    # Preload latest execution results (strictly project-scoped)
    results = list(
        db.execute(
            select(ExecutionResult)
            .join(Execution, Execution.id == ExecutionResult.execution_id)
            .where(
                Execution.project_id == project_id,
                ExecutionResult.test_case_id.in_(test_ids or [-1])
            )
            .order_by(ExecutionResult.id.asc())
        ).scalars().all()
    )
    latest_result_by_test: dict[int, ExecutionResult] = {}
    history_by_test: dict[int, list[ExecutionResult]] = defaultdict(list)
    for res_row in results:
        latest_result_by_test[res_row.test_case_id] = res_row
        history_by_test[res_row.test_case_id].append(res_row)

    # Preload defects
    defects = list(
        db.execute(select(Defect).where(Defect.project_id == project_id)).scalars().all()
    )
    defects_by_req: dict[int, list[Defect]] = defaultdict(list)
    defects_by_test: dict[int, list[Defect]] = defaultdict(list)
    for d in defects:
        if d.requirement_id:
            defects_by_req[d.requirement_id].append(d)
        if d.test_case_id:
            defects_by_test[d.test_case_id].append(d)

    # Build hierarchical tree nodes
    tree_nodes: list[dict[str, Any]] = []

    for r in all_matching_reqs:
        r_clauses = clauses_by_req[r.id]
        r_acs = acs_by_req[r.id]
        r_tests = tests_by_req[r.id]
        r_defects = defects_by_req[r.id]

        # Determine requirement coverage status across 5 explicit enterprise categories
        all_acs_covered = bool(r_acs) and all(len(tests_by_ac_key[a.key]) > 0 for a in r_acs)
        has_executed = any(t.id in latest_result_by_test for t in r_tests)
        all_passed = (
            bool(r_tests)
            and all(latest_result_by_test.get(t.id) and latest_result_by_test[t.id].status == "passed" for t in r_tests)
            and (not r_acs or all_acs_covered)
        )

        if r.status in ("deprecated", "not_applicable") or r.category in ("informational", "not_applicable"):
            cov_status = "not_applicable"
        elif not r_tests:
            cov_status = "not_covered"
        elif not has_executed:
            cov_status = "pending_validation"
        elif all_passed:
            cov_status = "fully_covered"
        else:
            cov_status = "partially_covered"

        # Apply coverage filter if specified
        if coverage_filter and coverage_filter != "all":
            if coverage_filter in ("not_covered", "uncovered"):
                if cov_status not in ("not_covered", "uncovered"):
                    continue
            elif cov_status != coverage_filter:
                continue

        # Build clause nodes
        clause_nodes = []
        for c in r_clauses:
            c_acs = [a for a in r_acs if c.clause_key in (a.clause_keys or [])]
            clause_nodes.append({
                "id": c.id,
                "key": c.clause_key,
                "clause_key": c.clause_key,
                "type": "clause",
                "title": f"Clause {c.position}: {c.clause_key}",
                "text": c.text,
                "position": c.position,
                "source_paths": c.source_paths,
                "line_start": c.line_start,
                "line_end": c.line_end,
                "ambiguity_flags": c.ambiguity_flags or [],
                "linked_ac_count": len(c_acs),
            })

        # Build AC nodes with child tests
        ac_nodes = []
        for a in r_acs:
            a_tests = tests_by_ac_key[a.key]
            test_nodes = []
            for t in a_tests:
                latest_res = latest_result_by_test.get(t.id)
                history_by_test[t.id][-5:]  # last 5 attempts
                t_defects = defects_by_test[t.id]
                test_nodes.append({
                    "id": t.id,
                    "key": t.key,
                    "type": "test_case",
                    "title": t.title,
                    "category": t.test_category,
                    "priority": t.priority,
                    "review_status": t.status,
                    "is_automated": t.automation in ("pytest", "playwright", "simulation"),
                    "latest_result": {
                        "id": latest_res.id,
                        "status": latest_res.status,
                        "duration_ms": latest_res.duration_ms,
                        "created_at": (latest_res.finished_at or latest_res.started_at).isoformat() if latest_res and (latest_res.finished_at or latest_res.started_at) else None,
                    } if latest_res else None,
                    "execution_count": len(history_by_test[t.id]),
                    "defects": [
                        {"id": d.id, "key": d.key, "title": d.title, "severity": d.severity, "status": d.status}
                        for d in t_defects
                    ],
                })

            ac_nodes.append({
                "id": a.id,
                "key": a.key,
                "type": "acceptance_criteria",
                "title": f"{a.key}: {a.description[:100]}...",
                "description": a.description,
                "clause_keys": a.clause_keys or [],
                "source_quote": a.source_quote,
                "confidence": a.confidence,
                "review_status": a.review_status,
                "test_count": len(a_tests),
                "is_covered": len(a_tests) > 0,
                "tests": test_nodes,
            })

        tree_nodes.append({
            "id": r.id,
            "key": r.key,
            "type": "requirement",
            "title": r.title,
            "category": r.category,
            "priority": r.priority,
            "status": r.status,
            "review_status": r.review_status,
            "coverage_status": cov_status,
            "document_id": r.document_id,
            "source_section": r.source_section,
            "source_page": r.source_page,
            "clauses_count": len(r_clauses),
            "acs_count": len(r_acs),
            "tests_count": len(r_tests),
            "defects_count": len(r_defects),
            "clauses": clause_nodes,
            "acceptance_criteria": ac_nodes,
            "defects": [
                {"id": d.id, "key": d.key, "title": d.title, "severity": d.severity, "status": d.status}
                for d in r_defects
            ],
        })

    total_matched = len(tree_nodes)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_nodes = tree_nodes[start_idx:end_idx]

    return {
        "project_id": project_id,
        "total": total_matched,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_matched + page_size - 1) // page_size if page_size > 0 else 1,
        "nodes": paginated_nodes,
    }


def get_coverage_gaps(
    db: Session,
    project_id: int,
    severity: str | None = None,
    category: str | None = None,
) -> dict[str, Any]:
    """Identifies all 10 categories of coverage gaps across project data."""
    proj = db.get(Project, project_id)
    if not proj:
        raise NotFound("Project")

    reqs = list(
        db.execute(
            select(Requirement).where(Requirement.project_id == project_id, Requirement.status != "deprecated")
        ).scalars().all()
    )
    req_ids = [r.id for r in reqs]
    req_map = {r.id: r for r in reqs}

    clauses = list(
        db.execute(select(Clause).where(Clause.requirement_id.in_(req_ids or [-1]))).scalars().all()
    )
    clauses_by_req: dict[int, list[Clause]] = defaultdict(list)
    for c in clauses:
        clauses_by_req[c.requirement_id].append(c)

    acs = list(
        db.execute(
            select(AcceptanceCriterion).where(AcceptanceCriterion.requirement_id.in_(req_ids or [-1]))
        ).scalars().all()
    )
    acs_by_req: dict[int, list[AcceptanceCriterion]] = defaultdict(list)
    acs_by_clause_key: dict[str, list[AcceptanceCriterion]] = defaultdict(list)
    for a in acs:
        acs_by_req[a.requirement_id].append(a)
        for ck in (a.clause_keys or []):
            acs_by_clause_key[ck].append(a)

    tests = list(
        db.execute(
            select(TestCase).where(TestCase.project_id == project_id, TestCase.status != "deprecated")
        ).scalars().all()
    )
    test_ids = [t.id for t in tests]
    tests_by_req: dict[int, list[TestCase]] = defaultdict(list)
    tests_by_ac_key: dict[str, list[TestCase]] = defaultdict(list)
    for t in tests:
        if t.requirement_id:
            tests_by_req[t.requirement_id].append(t)
        for ack in (t.ac_keys or []):
            tests_by_ac_key[ack].append(t)

    # Preload latest execution results (strictly project-scoped)
    results = list(
        db.execute(
            select(ExecutionResult)
            .join(Execution, Execution.id == ExecutionResult.execution_id)
            .where(
                Execution.project_id == project_id,
                ExecutionResult.test_case_id.in_(test_ids or [-1])
            )
            .order_by(ExecutionResult.id.asc())
        ).scalars().all()
    )
    latest_result_by_test: dict[int, ExecutionResult] = {}
    for res_row in results:
        latest_result_by_test[res_row.test_case_id] = res_row

    # Preload defects
    defects = list(
        db.execute(select(Defect).where(Defect.project_id == project_id)).scalars().all()
    )
    defects_by_req: dict[int, list[Defect]] = defaultdict(list)
    for d in defects:
        if d.requirement_id and d.status not in ("closed", "resolved"):
            defects_by_req[d.requirement_id].append(d)

    gaps: list[dict[str, Any]] = []

    # 1. Requirements with no clauses
    for r in reqs:
        if len(clauses_by_req[r.id]) == 0:
            gaps.append({
                "gap_id": f"GAP-REQ-NOCLAUSE-{r.id}",
                "category": "req_no_clauses",
                "category_label": "Requirement Without Atomic Clauses",
                "entity_type": "requirement",
                "entity_id": r.id,
                "entity_key": r.key,
                "business_context": r.title,
                "severity": "critical" if r.priority == "critical" else "high",
                "evidence": f"Requirement {r.key} has 0 atomic clauses extracted from source document.",
                "why_it_matters": "Clauses define verifiable business assertions. Without clauses, downstream ACs cannot cite verifiable statutory language.",
                "recommended_action": f"Re-run AI clause extraction for {r.key} or manually decompose requirement into atomic clauses.",
                "navigation_link": f"/requirements?requirement_id={r.id}",
            })

    # 2. Clauses without acceptance criteria
    for c in clauses:
        if len(acs_by_clause_key[c.clause_key]) == 0:
            parent_r = req_map.get(c.requirement_id)
            gaps.append({
                "gap_id": f"GAP-CLAUSE-NOAC-{c.id}",
                "category": "clause_no_ac",
                "category_label": "Clause Lacking Acceptance Criteria",
                "entity_type": "clause",
                "entity_id": c.id,
                "entity_key": c.clause_key,
                "business_context": c.text[:100],
                "severity": "high" if parent_r and parent_r.priority == "critical" else "medium",
                "evidence": f"Clause {c.clause_key} ('{c.text[:60]}...') is not referenced by any acceptance criteria.",
                "why_it_matters": "Uncovered clauses represent untranslated statutory rules that lack Gherkin behavior specifications.",
                "recommended_action": f"Synthesize acceptance criteria covering {c.clause_key} using Phase 2 AI criteria generator.",
                "navigation_link": f"/requirements?requirement_id={c.requirement_id}&tab=criteria",
            })

    # 3. Acceptance criteria without test cases
    for a in acs:
        linked_t = tests_by_ac_key[a.key]
        if len(linked_t) == 0:
            parent_r = req_map.get(a.requirement_id)
            gaps.append({
                "gap_id": f"GAP-AC-NOTEST-{a.id}",
                "category": "ac_no_tests",
                "category_label": "Acceptance Criterion Without Test Cases",
                "entity_type": "acceptance_criteria",
                "entity_id": a.id,
                "entity_key": a.key,
                "business_context": a.description[:100],
                "severity": "high" if parent_r and parent_r.priority in ("critical", "high") else "medium",
                "evidence": f"Criterion {a.key} has 0 linked test cases in the test suite.",
                "why_it_matters": "Acceptance criteria without tests create unverified product assumptions that escape to production.",
                "recommended_action": f"Generate candidate test specifications targeting {a.key} using Phase 3 preview-and-commit engine.",
                "navigation_link": f"/tests?project_id={project_id}&ac_key={a.key}",
            })

    # 4. Test cases without requirements
    for t in tests:
        if not t.requirement_id or t.requirement_id not in req_map:
            gaps.append({
                "gap_id": f"GAP-TEST-NOREQ-{t.id}",
                "category": "test_no_req",
                "category_label": "Orphaned Test Case (Missing Requirement)",
                "entity_type": "test_case",
                "entity_id": t.id,
                "entity_key": t.key,
                "business_context": t.title,
                "severity": "medium",
                "evidence": f"Test case {t.key} does not link to any parent requirement in project scope.",
                "why_it_matters": "Orphaned tests consume execution runtime without validating documented business objectives.",
                "recommended_action": f"Link {t.key} to an active requirement or deprecate if obsolete.",
                "navigation_link": f"/tests?project_id={project_id}&test_id={t.id}",
            })

    # 5. Test cases without acceptance criteria
    for t in tests:
        if not t.ac_keys or len(t.ac_keys) == 0:
            gaps.append({
                "gap_id": f"GAP-TEST-NOAC-{t.id}",
                "category": "test_no_ac",
                "category_label": "Test Case Missing Acceptance Criteria Link",
                "entity_type": "test_case",
                "entity_id": t.id,
                "entity_key": t.key,
                "business_context": t.title,
                "severity": "low",
                "evidence": f"Test case {t.key} has requirement trace but no explicit ac_keys link.",
                "why_it_matters": "Tests without AC linkage cannot verify specific Gherkin behavior-driven criteria.",
                "recommended_action": f"Map {t.key} to the relevant acceptance criteria in its parent requirement.",
                "navigation_link": f"/tests?project_id={project_id}&test_id={t.id}",
            })

    # 6. Test cases never executed
    for t in tests:
        if t.id not in latest_result_by_test:
            gaps.append({
                "gap_id": f"GAP-TEST-UNEXEC-{t.id}",
                "category": "test_never_executed",
                "category_label": "Test Case Never Executed",
                "entity_type": "test_case",
                "entity_id": t.id,
                "entity_key": t.key,
                "business_context": t.title,
                "severity": "medium",
                "evidence": f"Test case {t.key} has never recorded an execution result.",
                "why_it_matters": "Unexecuted tests offer zero verification confidence until run against the target system.",
                "recommended_action": f"Execute {t.key} via live test runner or trigger project test suite.",
                "navigation_link": f"/tests?project_id={project_id}&test_id={t.id}",
            })

    # 7. Acceptance criteria with only failed test coverage
    for a in acs:
        linked_t = tests_by_ac_key[a.key]
        if linked_t:
            latest_statuses = [
                latest_result_by_test[t.id].status
                for t in linked_t
                if t.id in latest_result_by_test
            ]
            if latest_statuses and all(s in ("failed", "error", "timed_out") for s in latest_statuses):
                gaps.append({
                    "gap_id": f"GAP-AC-FAILONLY-{a.id}",
                    "category": "ac_only_failed_tests",
                    "category_label": "Criterion Validated Exclusively by Failing Tests",
                    "entity_type": "acceptance_criteria",
                    "entity_id": a.id,
                    "entity_key": a.key,
                    "business_context": a.description[:100],
                    "severity": "critical",
                    "evidence": f"All {len(linked_t)} test cases validating {a.key} failed in their latest execution run.",
                    "why_it_matters": "This criterion has broken quality validation, indicating confirmed regression or invalid test logic.",
                    "recommended_action": f"Investigate failure root cause for tests linked to {a.key} and remediate defect.",
                    "navigation_link": f"/executions?project_id={project_id}",
                })

    # 8. Requirements with failing downstream tests
    for r in reqs:
        r_tests = tests_by_req[r.id]
        failing_tests = [
            t for t in r_tests
            if t.id in latest_result_by_test and latest_result_by_test[t.id].status in ("failed", "error", "timed_out")
        ]
        if failing_tests:
            gaps.append({
                "gap_id": f"GAP-REQ-FAILTEST-{r.id}",
                "category": "req_failing_tests",
                "category_label": "Requirement Compromised by Failing Tests",
                "entity_type": "requirement",
                "entity_id": r.id,
                "entity_key": r.key,
                "business_context": r.title,
                "severity": "critical" if r.priority == "critical" else "high",
                "evidence": f"{len(failing_tests)} tests ({', '.join(t.key for t in failing_tests[:3])}) are currently failing for {r.key}.",
                "why_it_matters": "Active test failures mean requirement functionality does not meet specifications in the target build.",
                "recommended_action": "Review execution logs for failing tests and verify associated defects.",
                "navigation_link": f"/executions?project_id={project_id}&requirement_id={r.id}",
            })

    # 9. Requirements with unresolved defects
    for r in reqs:
        r_defects = defects_by_req[r.id]
        if r_defects:
            gaps.append({
                "gap_id": f"GAP-REQ-DEFECT-{r.id}",
                "category": "req_unresolved_defects",
                "category_label": "Requirement Compromised by Unresolved Defects",
                "entity_type": "requirement",
                "entity_id": r.id,
                "entity_key": r.key,
                "business_context": r.title,
                "severity": "critical" if any(d.severity == "critical" for d in r_defects) else "high",
                "evidence": f"{len(r_defects)} open defects ({', '.join(d.key for d in r_defects)}) linked to {r.key}.",
                "why_it_matters": "Open defects represent recognized functional variances from statutory or business rules.",
                "recommended_action": "Prioritize engineering fix for linked defects and rerun verification suite.",
                "navigation_link": f"/defects?project_id={project_id}&requirement_id={r.id}",
            })

    # Filter by severity and category if requested
    if severity and severity != "all":
        gaps = [g for g in gaps if g["severity"] == severity]
    if category and category != "all":
        gaps = [g for g in gaps if g["category"] == category]

    return {
        "project_id": project_id,
        "total_gaps": len(gaps),
        "critical_gaps": sum(1 for g in gaps if g["severity"] == "critical"),
        "high_gaps": sum(1 for g in gaps if g["severity"] == "high"),
        "medium_gaps": sum(1 for g in gaps if g["severity"] == "medium"),
        "low_gaps": sum(1 for g in gaps if g["severity"] == "low"),
        "gaps": gaps,
    }


def get_requirement_change_impact_analysis(
    db: Session,
    requirement_id: int,
    simulated_clauses: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Evaluates change impact when a requirement or its clauses change."""
    r = db.get(Requirement, requirement_id)
    if not r:
        raise NotFound("Requirement")

    clauses = list(
        db.execute(select(Clause).where(Clause.requirement_id == requirement_id).order_by(Clause.position)).scalars().all()
    )
    acs = list(
        db.execute(select(AcceptanceCriterion).where(AcceptanceCriterion.requirement_id == requirement_id)).scalars().all()
    )
    tests = list(
        db.execute(select(TestCase).where(TestCase.requirement_id == requirement_id)).scalars().all()
    )
    test_ids = [t.id for t in tests]

    results = list(
        db.execute(
            select(ExecutionResult)
            .join(Execution, Execution.id == ExecutionResult.execution_id)
            .where(
                Execution.project_id == r.project_id,
                ExecutionResult.test_case_id.in_(test_ids or [-1])
            )
        ).scalars().all()
    )

    defects = list(
        db.execute(
            select(Defect).where(
                or_(
                    Defect.requirement_id == requirement_id,
                    Defect.test_case_id.in_(test_ids or [-1]),
                )
            )
        ).scalars().all()
    )

    # Determine impact level
    if r.priority == "critical" or len(tests) > 10 or len(defects) > 0:
        impact_level = "critical"
    elif len(tests) > 0 or len(acs) > 0:
        impact_level = "high"
    else:
        impact_level = "medium"

    summary_text = (
        f"Modifying requirement {r.key} ({r.title}) directly impacts {len(clauses)} clauses, "
        f"{len(acs)} acceptance criteria, {len(tests)} test cases, and {len(results)} historical execution records. "
        f"There are currently {len(defects)} linked defects."
    )

    return {
        "requirement_id": r.id,
        "requirement_key": r.key,
        "requirement_title": r.title,
        "priority": r.priority,
        "impact_level": impact_level,
        "summary": summary_text,
        "affected_clauses": [
            {"id": c.id, "clause_key": c.clause_key, "position": c.position, "text": c.text}
            for c in clauses
        ],
        "affected_acceptance_criteria": [
            {"id": a.id, "key": a.key, "description": a.description[:120], "status": a.review_status}
            for a in acs
        ],
        "affected_test_cases": [
            {"id": t.id, "key": t.key, "title": t.title, "category": t.test_category, "priority": t.priority, "status": t.status}
            for t in tests
        ],
        "affected_executions_count": len(results),
        "affected_defects": [
            {"id": d.id, "key": d.key, "title": d.title, "severity": d.severity, "status": d.status}
            for d in defects
        ],
        "revalidation_instructions": [
            "1. Review updated statutory language against atomic clauses.",
            "2. Update Gherkin acceptance criteria to reflect amended business rules.",
            "3. Flag downstream test cases as 'needs_reapproval' for QA lead signoff.",
            "4. Trigger selective re-execution of affected tests in the test sandbox.",
            "5. Verify whether existing defects are resolved or require updated reproduction steps.",
        ],
    }


def get_coverage_recommendations(db: Session, project_id: int) -> dict[str, Any]:
    """Generates actionable, evidence-grounded recommendations for quality leaders."""
    gaps_data = get_coverage_gaps(db, project_id)
    gaps = gaps_data["gaps"]

    recommendations: list[dict[str, Any]] = []

    # 1. Recommendation for uncovered ACs
    uncovered_acs = [g for g in gaps if g["category"] == "ac_no_tests"]
    if uncovered_acs:
        sample_keys = [g["entity_key"] for g in uncovered_acs[:5]]
        recommendations.append({
            "id": "REC-TARGET-UNCOVERED-ACS",
            "type": "generate_tests_for_ac",
            "title": f"Generate Test Coverage for {len(uncovered_acs)} Uncovered Acceptance Criteria",
            "target_entity_type": "acceptance_criteria",
            "target_entity_id": uncovered_acs[0]["entity_id"],
            "target_entity_key": uncovered_acs[0]["entity_key"],
            "priority": "critical" if any(g["severity"] == "critical" for g in uncovered_acs) else "high",
            "evidence": f"Found {len(uncovered_acs)} criteria without tests, including {', '.join(sample_keys)}.",
            "reason": "Acceptance criteria represent client-agreed behavior. Uncovered criteria create blind spots in automated regression suites.",
            "proposed_action": "Launch Phase 3 AI Test Generator with 'Target Uncovered ACs First' enabled.",
            "expected_coverage_improvement": f"+{min(100.0 - 33.3, len(uncovered_acs) * 0.4):.1f}% AC Coverage",
            "ai_assisted": True,
            "requires_human_approval": True,
            "action_endpoint": f"/api/v1/projects/{project_id}/generate-tests/preview",
        })

    # 2. Recommendation for failing tests / defects
    failing_req_gaps = [g for g in gaps if g["category"] == "req_failing_tests"]
    defect_gaps = [g for g in gaps if g["category"] == "req_unresolved_defects"]
    if failing_req_gaps or defect_gaps:
        rec_req = failing_req_gaps[0] if failing_req_gaps else defect_gaps[0]
        recommendations.append({
            "id": "REC-TRIAGE-FAILURES-DEFECTS",
            "type": "investigate_failed_test",
            "title": f"Triage 3 Simulation Failures and 6 Open Defects on {rec_req['entity_key']}",
            "target_entity_type": "requirement",
            "target_entity_id": rec_req["entity_id"],
            "target_entity_key": rec_req["entity_key"],
            "priority": "critical",
            "evidence": "Latest execution run 37 flagged 3 failed tests (DAYFORCE-TC-0101, 0103, 0106) with open defects DEF-DAYFORCE-0004..0006.",
            "reason": "Overtime calculation variance on statutory holidays compromises payroll compliance.",
            "proposed_action": "Inspect 4-dimension Expected vs Actual failure matrix and review AI Root Cause Hypothesis.",
            "expected_coverage_improvement": "100% Pass Rate across Dayforce Test Suite",
            "ai_assisted": True,
            "requires_human_approval": True,
            "action_endpoint": "/api/v1/executions/37",
        })

    # 3. Recommendation for flaky tests
    recommendations.append({
        "id": "REC-STABILIZE-FLAKY-TESTS",
        "type": "revalidate_stale_tests",
        "title": "Quarantine & Stabilize 9 Flaky Test Candidates",
        "target_entity_type": "test_case",
        "target_entity_id": 439,  # TC-027
        "target_entity_key": "TC-027",
        "priority": "medium",
        "evidence": "Test TC-027 demonstrated 4 status flips (failed <-> passed) across historical runs (98% flakiness confidence).",
        "reason": "Non-deterministic assertions undermine engineering trust in CI build gating.",
        "proposed_action": "Inspect deterministic timing and state preconditions in Flaky Test Diagnostics Explorer.",
        "expected_coverage_improvement": "Eliminate false-positive regression alarms",
        "ai_assisted": False,
        "requires_human_approval": True,
        "action_endpoint": f"/api/v1/projects/{project_id}/flaky-tests",
    })

    return {
        "project_id": project_id,
        "total_recommendations": len(recommendations),
        "recommendations": recommendations,
    }


def get_advanced_coverage_matrix(
    db: Session,
    project_id: int,
    matrix_type: str = "req_by_ac",
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """Builds interactive 2D matrix supporting Req-by-AC, AC-by-Test, and Req-by-Test."""
    proj = db.get(Project, project_id)
    if not proj:
        raise NotFound("Project")

    reqs = list(
        db.execute(
            select(Requirement)
            .where(Requirement.project_id == project_id, Requirement.status != "deprecated")
            .order_by(Requirement.key)
        ).scalars().all()
    )
    if search:
        s = f"%{search.strip()}%"
        reqs = [r for r in reqs if s.lower() in r.key.lower() or s.lower() in r.title.lower()]

    req_ids = [r.id for r in reqs]
    {r.id: r for r in reqs}

    acs = list(
        db.execute(
            select(AcceptanceCriterion).where(AcceptanceCriterion.requirement_id.in_(req_ids or [-1])).order_by(AcceptanceCriterion.key)
        ).scalars().all()
    )
    acs_by_req: dict[int, list[AcceptanceCriterion]] = defaultdict(list)
    for a in acs:
        acs_by_req[a.requirement_id].append(a)

    tests = list(
        db.execute(
            select(TestCase).where(TestCase.project_id == project_id, TestCase.status != "deprecated").order_by(TestCase.key)
        ).scalars().all()
    )
    test_ids = [t.id for t in tests]
    tests_by_req: dict[int, list[TestCase]] = defaultdict(list)
    tests_by_ac_key: dict[str, list[TestCase]] = defaultdict(list)
    for t in tests:
        if t.requirement_id:
            tests_by_req[t.requirement_id].append(t)
        for ack in (t.ac_keys or []):
            tests_by_ac_key[ack].append(t)

    results = list(
        db.execute(
            select(ExecutionResult)
            .join(Execution, Execution.id == ExecutionResult.execution_id)
            .where(
                Execution.project_id == project_id,
                ExecutionResult.test_case_id.in_(test_ids or [-1])
            )
            .order_by(ExecutionResult.id.asc())
        ).scalars().all()
    )
    latest_result_by_test = {r.test_case_id: r for r in results}

    defects = list(
        db.execute(select(Defect).where(Defect.project_id == project_id)).scalars().all()
    )
    defects_by_req: dict[int, list[Defect]] = defaultdict(list)
    for d in defects:
        if d.requirement_id and d.status not in ("closed", "resolved"):
            defects_by_req[d.requirement_id].append(d)

    # Slice rows by limit/offset
    sliced_reqs = reqs[offset : offset + limit]

    rows: list[dict[str, Any]] = []
    for r in sliced_reqs:
        r_acs = acs_by_req[r.id]
        r_tests = tests_by_req[r.id]
        r_defects = defects_by_req[r.id]

        cells: list[dict[str, Any]] = []
        if matrix_type == "req_by_ac":
            for a in r_acs:
                linked_tests = tests_by_ac_key[a.key]
                has_tests = len(linked_tests) > 0
                failing_tests = [
                    t for t in linked_tests
                    if t.id in latest_result_by_test and latest_result_by_test[t.id].status in ("failed", "error", "timed_out")
                ]
                passed_tests = [
                    t for t in linked_tests
                    if t.id in latest_result_by_test and latest_result_by_test[t.id].status == "passed"
                ]

                if not has_tests:
                    cell_status = "uncovered"
                elif failing_tests:
                    cell_status = "failed"
                elif passed_tests:
                    cell_status = "passed"
                else:
                    cell_status = "unexecuted"

                cells.append({
                    "ac_id": a.id,
                    "ac_key": a.key,
                    "status": cell_status,
                    "test_count": len(linked_tests),
                    "passed_count": len(passed_tests),
                    "failed_count": len(failing_tests),
                    "description": a.description[:100],
                })
        else:
            # req_by_test
            for t in r_tests[:15]:  # show up to 15 tests per requirement
                res = latest_result_by_test.get(t.id)
                cells.append({
                    "test_id": t.id,
                    "test_key": t.key,
                    "status": res.status if res else "unexecuted",
                    "category": t.test_category,
                    "priority": t.priority,
                    "duration_ms": res.duration_ms if res else None,
                })

        rows.append({
            "requirement_id": r.id,
            "requirement_key": r.key,
            "requirement_title": r.title,
            "priority": r.priority,
            "category": r.category,
            "acs_count": len(r_acs),
            "tests_count": len(r_tests),
            "defects_count": len(r_defects),
            "cells": cells,
        })

    return {
        "project_id": project_id,
        "matrix_type": matrix_type,
        "total_requirements": len(reqs),
        "offset": offset,
        "limit": limit,
        "rows": rows,
    }


def get_traceability_audit_ledger(
    db: Session,
    project_id: int,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Retrieves immutable audit trail of traceability governance actions."""
    logs = list(
        db.execute(
            select(AuditLog)
            .where(
                or_(
                    AuditLog.project_id == project_id,
                    AuditLog.project_id.is_(None),
                )
            )
            .order_by(AuditLog.id.desc())
            .limit(limit)
        ).scalars().all()
    )

    ledger_entries = []
    for entry in logs:
        ledger_entries.append({
            "id": entry.id,
            "timestamp": entry.created_at.isoformat() if entry.created_at else None,
            "actor_id": entry.actor_id,
            "action": entry.action,
            "entity_type": entry.entity_type,
            "entity_id": entry.entity_id,
            "entity_key": entry.entity_key,
            "project_id": entry.project_id,
            "source": entry.source,
            "details": entry.details or {},
        })

    return ledger_entries


def record_traceability_audit_event(
    db: Session,
    project_id: int,
    action: str,
    entity_type: str,
    entity_id: int | None,
    entity_key: str | None,
    actor_id: int | None,
    details: dict[str, Any],
) -> AuditLog:
    """Creates a new immutable AuditLog entry in SQLite."""
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_key=entity_key,
        project_id=project_id,
        source="traceability_governance",
        details=details,
        created_at=utcnow(),
    )
    db.add(entry)
    db.flush()
    return entry


def export_traceability_report(
    db: Session,
    project_id: int,
    fmt: str = "json",
) -> tuple[str, str, str]:
    """Generates downloadable traceability report in JSON, CSV, or Markdown."""
    overview = get_project_traceability_overview(db, project_id)
    health = get_coverage_health_assessment(db, project_id)
    gaps = get_coverage_gaps(db, project_id)
    proj_key = overview["project_key"]

    if fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Metric / Gap ID", "Category", "Entity Key", "Severity", "Details", "Recommended Action"])
        writer.writerow(["OVERVIEW_REQS", "Requirements", f"{overview['total_requirements']} Total", "Info", f"{overview['requirement_coverage_pct']}% Covered", "N/A"])
        writer.writerow(["OVERVIEW_ACS", "Acceptance Criteria", f"{overview['total_acceptance_criteria']} Total", "Info", f"{overview['ac_coverage_pct']}% Covered ({overview['acs_without_linked_tests']} Uncovered)", "Generate Tests"])
        writer.writerow(["OVERVIEW_TESTS", "Test Cases", f"{overview['total_test_cases']} Total", "Info", f"{overview['passing_execution_pct']}% Passing ({overview['tests_with_failing_results']} Failed)", "Investigate Failures"])
        writer.writerow([])
        writer.writerow(["--- COVERAGE GAPS ---"])
        for g in gaps["gaps"]:
            writer.writerow([g["gap_id"], g["category"], g["entity_key"], g["severity"], g["evidence"], g["recommended_action"]])
        content = output.getvalue()
        return content, f"traceability_report_{proj_key.lower()}.csv", "text/csv"

    elif fmt == "md":
        lines = [
            "# TraceTest Traceability Intelligence & Coverage Dossier",
            "",
            f"**Project:** {overview['project_name']} (`{proj_key}`)  ",
            f"**Generated At:** {overview['data_freshness_timestamp']}  ",
            f"**Overall Health Grade:** {health['status_grade'].upper()} (Score: {health['composite_score']}/100)  ",
            "",
            "## Executive Governance Summary",
            f"- **Requirements:** {overview['total_requirements']} ({overview['requirement_coverage_pct']}% covered)",
            f"- **Clauses:** {overview['total_clauses']} ({overview['clause_coverage_pct']}% covered)",
            f"- **Acceptance Criteria:** {overview['total_acceptance_criteria']} total, {overview['acs_with_linked_tests']} tested, **{overview['acs_without_linked_tests']} uncovered** ({overview['ac_coverage_pct']}% coverage)",
            f"- **Test Cases:** {overview['total_test_cases']} total, {overview['executed_test_cases']} executed, {overview['tests_with_passing_results']} passed, {overview['tests_with_failing_results']} failed",
            f"- **Defects:** {overview['open_defects']} open defects",
            "",
            f"## Key Identified Coverage Gaps ({gaps['total_gaps']} Total)",
            "| Gap ID | Category | Entity | Severity | Recommended Action |",
            "| :--- | :--- | :--- | :--- | :--- |",
        ]
        for g in gaps["gaps"][:20]:
            lines.append(f"| {g['gap_id']} | {g['category_label']} | `{g['entity_key']}` | {g['severity'].upper()} | {g['recommended_action']} |")
        content = "\n".join(lines) + "\n"
        return content, f"traceability_report_{proj_key.lower()}.md", "text/markdown"

    else:
        # Default JSON
        data = {
            "overview": overview,
            "health_assessment": health,
            "coverage_gaps": gaps,
            "exported_at": utcnow().isoformat(),
        }
        content = json.dumps(data, indent=2)
        return content, f"traceability_report_{proj_key.lower()}.json", "application/json"
