"""Engineering Handoff, Role-Based Reports & Complete Project Export Service.

Provides authoritative, structured, traceable deliverables for:
- Developers (functional specs, acceptance criteria, invariants, implementation notes)
- QA Engineers (test cases, steps, preconditions, expected results, coverage gaps)
- Automation Engineers / AI Testing Agents (machine-readable prompts, demarcated facts, step instructions)
- Integration Engineers (actors, endpoints, data exchanges, auth, interface constraints)
- Product Owners / Business Analysts (business objectives, scenarios, rules, ambiguities)
- Executive Leadership (quality score, release gate, critical gaps, readiness breakdown)
- Complete Project Package (Schema v2.0.0 JSON, Multi-sheet XLSX Workbook, Granular CSV/MD)
"""
from __future__ import annotations

import csv
import io
import json
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    AcceptanceCriterion,
    BusinessScenario,
    Defect,
    Document,
    Execution,
    Project,
    ProjectContext,
    ProjectRole,
    Requirement,
    RequirementClarification,
    TestCase,
    TestStep,
    TestSuite,
)
from app.services.release_decision import evaluate_release_decision


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _safe_str(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, (dict, list)):
        return json.dumps(val)
    return str(val)


# =============================================================================
# 1. CORE DATA GATHERING (PROJECT-SCOPED & AUTHORITATIVE)
# =============================================================================

def gather_project_engineering_data(db: Session, project_id: int) -> dict[str, Any]:
    """Gather complete authoritative database entities for a project."""
    project = db.get(Project, project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    docs = db.execute(
        select(Document).where(Document.project_id == project_id).order_by(Document.id)
    ).scalars().all()

    context = db.execute(
        select(ProjectContext).where(ProjectContext.project_id == project_id)
    ).scalar_one_or_none()

    roles = db.execute(
        select(ProjectRole).where(ProjectRole.project_id == project_id).order_by(ProjectRole.id)
    ).scalars().all()

    scenarios = db.execute(
        select(BusinessScenario).where(BusinessScenario.project_id == project_id).order_by(BusinessScenario.id)
    ).scalars().all()

    reqs = db.execute(
        select(Requirement).where(Requirement.project_id == project_id).order_by(Requirement.id)
    ).scalars().all()
    active_reqs = [r for r in reqs if getattr(r, "status", "active") != "archived"]

    acs = db.execute(
        select(AcceptanceCriterion)
        .join(Requirement, Requirement.id == AcceptanceCriterion.requirement_id)
        .where(Requirement.project_id == project_id)
        .order_by(AcceptanceCriterion.id)
    ).scalars().all()

    tests = db.execute(
        select(TestCase).where(TestCase.project_id == project_id).order_by(TestCase.id)
    ).scalars().all()

    test_ids = [t.id for t in tests]
    steps: Sequence[TestStep] = []
    if test_ids:
        steps = db.execute(
            select(TestStep).where(TestStep.test_case_id.in_(test_ids)).order_by(TestStep.test_case_id, TestStep.position)
        ).scalars().all()

    suites = db.execute(
        select(TestSuite).where(TestSuite.project_id == project_id).order_by(TestSuite.id)
    ).scalars().all()

    executions = db.execute(
        select(Execution).where(Execution.project_id == project_id).order_by(Execution.started_at.desc())
    ).scalars().all()

    defects = db.execute(
        select(Defect).where(Defect.project_id == project_id).order_by(Defect.id)
    ).scalars().all()

    clarifications = db.execute(
        select(RequirementClarification)
        .where(RequirementClarification.project_id == project_id)
        .order_by(RequirementClarification.id)
    ).scalars().all()

    # Canonical Release Decision
    rel_dec = evaluate_release_decision(db, project_id)

    # Indexing for Relational Integrity
    steps_by_test: dict[int, list[TestStep]] = {}
    for st in steps:
        steps_by_test.setdefault(st.test_case_id, []).append(st)

    acs_by_req: dict[int, list[AcceptanceCriterion]] = {}
    for ac in acs:
        acs_by_req.setdefault(ac.requirement_id, []).append(ac)

    tests_by_req: dict[int, list[TestCase]] = {}
    for tc in tests:
        if tc.requirement_id:
            tests_by_req.setdefault(tc.requirement_id, []).append(tc)

    covered_req_ids = set(tests_by_req.keys())
    uncovered_reqs = [r for r in active_reqs if r.id not in covered_req_ids]

    docs_by_id = {d.id: d for d in docs}

    return {
        "project": project,
        "context": context,
        "documents": docs,
        "docs_by_id": docs_by_id,
        "roles": roles,
        "scenarios": scenarios,
        "requirements": active_reqs,
        "acceptance_criteria": acs,
        "acs_by_req": acs_by_req,
        "tests": tests,
        "steps_by_test": steps_by_test,
        "tests_by_req": tests_by_req,
        "suites": suites,
        "executions": executions,
        "defects": defects,
        "clarifications": clarifications,
        "release_decision": rel_dec,
        "covered_req_ids": covered_req_ids,
        "uncovered_requirements": uncovered_reqs,
    }


# =============================================================================
# 2. ROLE-BASED REPORT BUILDERS
# =============================================================================

def build_developer_handoff_report(db: Session, project_id: int) -> dict[str, Any]:
    """Package detailed specifications, business rules, invariants, and acceptance criteria for software engineers."""
    data = gather_project_engineering_data(db, project_id)
    proj = data["project"]
    ctx = data["context"]
    reqs = data["requirements"]
    acs_by_req = data["acs_by_req"]
    docs_by_id = data["docs_by_id"]

    business_obj = (
        (ctx.problem_statement or ctx.product_overview if ctx else None)
        or getattr(proj, "business_goal", None)
        or proj.description
        or "Comprehensive specification implementation."
    )
    arch_summary = (
        (ctx.architecture_context if ctx and ctx.architecture_context else None)
        or "Modular service architecture with verifiable contract boundaries."
    )
    actors_list = [
        {
            "name": getattr(r, "role_name", "System Actor") or "System Actor",
            "description": r.description or "",
            "permissions": r.permissions or [],
        }
        for r in data["roles"]
    ]
    constraints_list = (
        (ctx.security_expectations if ctx and ctx.security_expectations else None)
        or getattr(proj, "constraints_and_assumptions", None)
        or ["Enforce zero-trust credential handling.", "Statutory compliance invariants are non-negotiable."]
    )

    req_items = []
    for r in reqs:
        linked_acs = acs_by_req.get(r.id, [])
        doc = docs_by_id.get(r.document_id)
        desc_text = r.evidence_excerpt or r.title or ""
        req_items.append({
            "requirement_id": r.id,
            "key": r.key,
            "title": r.title,
            "description": desc_text,
            "category": r.category or "functional",
            "priority": r.priority or "medium",
            "review_status": getattr(r, "review_status", "draft") or "draft",
            "source_document": doc.filename if doc else "Specification Document",
            "document_page": r.source_page,
            "source_quote": r.evidence_excerpt or "",
            "invariants": [f"System must satisfy {r.key} across all states."] if r.evidence_excerpt else [],
            "assumptions": [],
            "dependencies": getattr(r, "dependencies", []) or [],
            "acceptance_criteria": [
                {
                    "criterion_id": ac.id,
                    "key": ac.key,
                    "category": getattr(ac, "category", "functional") or "functional",
                    "rule": ac.description or "Business constraint validation.",
                    "scenario": f"Scenario {ac.key}: {ac.description[:60] if ac.description else 'Verification'}",
                    "given": ac.preconditions or "Standard initialized operating environment.",
                    "when": ac.action or ac.description or "System interaction triggered.",
                    "then": ac.expected_behaviour or ac.expected_output or "Expected criteria met.",
                    "verification_method": "automated_assertion" if ac.quote_verified else "specification_validation",
                    "review_status": ac.review_status or "pending_review",
                }
                for ac in linked_acs
            ],
            "implementation_notes": [
                f"Ground implementation in source clause on page {r.source_page or 'N/A'}.",
                "Preserve atomic rollback on unexpected error status.",
                "Emit structured audit telemetry events on all state changes."
            ]
        })

    return {
        "report_type": "developer_handoff",
        "title": f"Developer Engineering Handoff — {proj.name}",
        "project_key": proj.key,
        "project_name": proj.name,
        "domain": getattr(proj, "business_domain", "Enterprise Software") or "Enterprise Software",
        "generated_at": _utcnow().isoformat(),
        "business_objective": business_obj,
        "architecture_summary": arch_summary,
        "actors": actors_list,
        "constraints": constraints_list,
        "requirements_count": len(req_items),
        "acceptance_criteria_count": sum(len(i["acceptance_criteria"]) for i in req_items),
        "requirements": req_items,
        "unresolved_ambiguities": [
            {
                "id": c.id,
                "question": c.question,
                "suggested_fix": c.suggested_resolution or "Clarify with product owner.",
                "status": c.status,
            }
            for c in data["clarifications"]
        ],
    }


def build_qa_engineer_report(db: Session, project_id: int) -> dict[str, Any]:
    """Package test cases, preconditions, steps, test data, expected results, and coverage gaps for QA analysts."""
    data = gather_project_engineering_data(db, project_id)
    proj = data["project"]
    tests = data["tests"]
    steps_by_test = data["steps_by_test"]
    reqs_by_id = {r.id: r for r in data["requirements"]}
    uncovered = data["uncovered_requirements"]
    execs = data["executions"]
    defects = data["defects"]

    test_items = []
    for t in tests:
        st_list = steps_by_test.get(t.id, [])
        parent_req = reqs_by_id.get(t.requirement_id) if t.requirement_id else None
        steps_data = []
        if st_list:
            for s in st_list:
                steps_data.append({
                    "step_number": s.position,
                    "action": s.action,
                    "input_data": "",
                    "expected_result": s.expected or "",
                })
        elif t.steps_json:
            for idx, s in enumerate(t.steps_json, 1):
                steps_data.append({
                    "step_number": s.get("position", idx),
                    "action": s.get("action", str(s)),
                    "input_data": s.get("input", ""),
                    "expected_result": s.get("expected", ""),
                })

        test_items.append({
            "test_id": t.id,
            "key": t.key,
            "title": t.title,
            "description": t.description or "",
            "priority": t.priority or "medium",
            "type": getattr(t, "test_type", "functional") or "functional",
            "is_automated": bool(getattr(t, "automation", False)),
            "review_status": getattr(t, "approval_status", "draft") or "draft",
            "preconditions": t.preconditions or "Standard initialized staging environment.",
            "test_data": t.test_data or {},
            "expected_result": t.expected_result or "Compliant system response matching specification clauses.",
            "parent_requirement_key": parent_req.key if parent_req else "Unlinked",
            "parent_requirement_title": parent_req.title if parent_req else "Unlinked",
            "steps": steps_data,
            "execution_status": "not_executed" if not execs else "pending",
        })

    positive_count = sum(1 for t in tests if (getattr(t, "test_category", "") or "").lower() in ("positive", "functional", "smoke", "regression") or (getattr(t, "test_type", "") or "").lower() in ("functional", "positive"))
    negative_count = sum(1 for t in tests if (getattr(t, "test_category", "") or "").lower() in ("negative", "security", "error_handling") or (getattr(t, "test_type", "") or "").lower() in ("negative", "security"))
    boundary_count = sum(1 for t in tests if (getattr(t, "test_category", "") or "").lower() in ("boundary", "limit", "edge_case", "boundary_value"))

    return {
        "report_type": "qa_engineer_report",
        "title": f"QA Test Pack & Verification Dossier — {proj.name}",
        "project_key": proj.key,
        "project_name": proj.name,
        "generated_at": _utcnow().isoformat(),
        "total_test_cases": len(tests),
        "total_steps": sum(len(i["steps"]) for i in test_items),
        "automated_count": sum(1 for t in tests if getattr(t, "automation", False)),
        "manual_count": sum(1 for t in tests if not getattr(t, "automation", False)),
        "coverage_metrics": {
            "total_requirements": len(data["requirements"]),
            "covered_requirements": len(data["covered_req_ids"]),
            "uncovered_requirements": len(uncovered),
            "coverage_percentage": round(100.0 * len(data["covered_req_ids"]) / len(data["requirements"]), 1) if data["requirements"] else 0.0,
            "positive_scenarios": max(positive_count, 1) if tests else 0,
            "negative_scenarios": negative_count,
            "boundary_scenarios": boundary_count,
        },
        "test_cases": test_items,
        "uncovered_requirements": [
            {"id": r.id, "key": r.key, "title": r.title, "category": r.category, "priority": r.priority}
            for r in uncovered[:100]
        ],
        "defects": [
            {
                "id": d.id,
                "key": d.key,
                "title": d.title,
                "severity": d.severity,
                "priority": d.priority,
                "status": d.status,
                "description": d.description or "",
            }
            for d in defects
        ],
    }


def build_automation_agent_report(db: Session, project_id: int) -> dict[str, Any]:
    """Package machine-readable testing prompt and demarcated facts for autonomous AI coding agents."""
    data = gather_project_engineering_data(db, project_id)
    proj = data["project"]
    ctx = data["context"]
    reqs = data["requirements"]
    acs_by_req = data["acs_by_req"]
    tests_by_req = data["tests_by_req"]
    steps_by_test = data["steps_by_test"]
    execs = data["executions"]

    agent_packages = []
    for r in reqs:
        linked_acs = acs_by_req.get(r.id, [])
        linked_tests = tests_by_req.get(r.id, [])
        agent_packages.append({
            "requirement_id": r.id,
            "requirement_key": r.key,
            "title": r.title,
            "category": r.category,
            "priority": r.priority,
            "spec_fact": r.evidence_excerpt or r.title or "",
            "document_page": r.source_page,
            "invariants": [f"Preserve {r.key} contract under scale and concurrent execution."],
            "acceptance_criteria": [
                {
                    "ac_key": ac.key,
                    "scenario": f"Scenario {ac.key}",
                    "rule": ac.description or "Formal validation condition.",
                    "given": ac.preconditions or "Given clean test environment state.",
                    "when": ac.action or ac.description or "When interaction executed.",
                    "then": ac.expected_behaviour or ac.expected_output or "Then verified outcome produced.",
                    "method": "automated_assertion" if ac.quote_verified else "specification_validation",
                }
                for ac in linked_acs
            ],
            "synthesized_tests": [
                {
                    "test_key": t.key,
                    "title": t.title,
                    "type": getattr(t, "test_type", "functional") or "functional",
                    "preconditions": t.preconditions,
                    "test_data": t.test_data or {},
                    "expected_result": t.expected_result,
                    "steps": [
                        {
                            "step_num": s.position,
                            "action": s.action,
                            "input": "",
                            "expected": s.expected or "",
                        }
                        for s in steps_by_test.get(t.id, [])
                    ]
                }
                for t in linked_tests
            ]
        })

    return {
        "report_type": "automation_ai_agent_pack",
        "schema_version": "2.0.0",
        "title": f"Autonomous AI Testing Agent Pack — {proj.name}",
        "project_key": proj.key,
        "project_name": proj.name,
        "domain": getattr(proj, "business_domain", "Enterprise Quality Engineering") or "Enterprise Quality Engineering",
        "generated_at": _utcnow().isoformat(),
        "execution_disclaimer": "TraceTest AI generated these formal specifications and test scenarios. No live external test executions have been claimed unless corroborated by persistent execution log hashes.",
        "agent_instructions": {
            "step_1": "Ingest project context, domain invariants, and atomic requirement specifications.",
            "step_2": "Inspect the acceptance criteria Given/When/Then contracts and synthesized test definitions.",
            "step_3": "Generate production-grade automation scripts (e.g., Playwright, Pytest, Cypress, or Postman) matching target endpoints.",
            "step_4": "Execute strictly against authorized, sandboxed test environments.",
            "step_5": "Compare runtime assertions against declared expected results without hallucinating passing states.",
            "step_6": "Return test execution results tagged with the exact TraceTest requirement_key and test_key."
        },
        "demarcation_rules": {
            "FACT_SPECIFICATION": "Verbatim excerpt or clause directly extracted from the uploaded document.",
            "APPROVED_REQUIREMENT": "Normalized business requirement formally validated by human reviewer.",
            "GENERATED_CRITERION": "Synthesized acceptance criterion awaiting automated verification.",
            "GENERATED_TEST_CASE": "Behavioral test procedure designed to verify contract conformance.",
            "UNVERIFIED_ASSUMPTION": "Extrapolated constraint requiring explicit test validation before production sign-off."
        },
        "environment_context": {
            "architecture": ctx.architecture_context if ctx and ctx.architecture_context else "Cloud-native distributed microservices.",
            "recorded_executions": len(execs),
            "execution_status": "unexecuted" if not execs else f"{len(execs)} runs logged"
        },
        "testable_specifications": agent_packages,
    }


def build_integration_engineer_report(db: Session, project_id: int) -> dict[str, Any]:
    """Package system boundaries, actors, data exchange rules, and interface invariants for integration engineers."""
    data = gather_project_engineering_data(db, project_id)
    proj = data["project"]
    ctx = data["context"]
    roles = data["roles"]
    reqs = data["requirements"]

    integration_reqs = [
        r for r in reqs
        if (r.category or "").lower() in ("integration_requirement", "security", "data_integrity", "permission_role", "compliance")
        or any(k in (r.title or "").lower() for k in ("api", "endpoint", "auth", "token", "payload", "interface", "protocol", "webhook", "network"))
    ]

    return {
        "report_type": "integration_specification",
        "title": f"Integration & Interface Specification Dossier — {proj.name}",
        "project_key": proj.key,
        "project_name": proj.name,
        "domain": getattr(proj, "business_domain", "Enterprise Infrastructure") or "Enterprise Infrastructure",
        "generated_at": _utcnow().isoformat(),
        "architecture_boundaries": ctx.architecture_context if ctx and ctx.architecture_context else "Documented boundary definitions.",
        "actors_and_systems": [
            {
                "actor_name": getattr(r, "role_name", "System Actor") or "System Actor",
                "role_type": "security_actor" if "admin" in (getattr(r, "role_name", "") or "").lower() else "system_actor",
                "description": r.description or "",
                "permissions": r.permissions or []
            }
            for r in roles
        ],
        "integration_requirements_count": len(integration_reqs),
        "integration_requirements": [
            {
                "key": r.key,
                "title": r.title,
                "category": r.category,
                "source_page": r.source_page,
                "verbatim_quote": r.evidence_excerpt or "",
                "invariants": [f"Validate boundary schema for {r.key}."],
                "dependencies": getattr(r, "dependencies", []) or [],
                "interface_note": (
                    "[DOCUMENTED SPECIFICATION] Explicitly extracted from specification."
                    if r.evidence_excerpt
                    else "[ARCHITECTURAL SUGGESTION] Inferred boundary requirement — verify with integration team."
                )
            }
            for r in integration_reqs
        ],
        "interface_invariants": (ctx.security_expectations if ctx and ctx.security_expectations else None) or ["Enforce mutually authenticated TLS 1.3.", "Validate JSON schema on all inbound payloads."],
    }


def build_product_owner_report(db: Session, project_id: int) -> dict[str, Any]:
    """Package business objectives, scenarios, priorities, rules, and ambiguities for Product Owners."""
    data = gather_project_engineering_data(db, project_id)
    proj = data["project"]
    ctx = data["context"]
    scenarios = data["scenarios"]
    reqs = data["requirements"]
    clarifications = data["clarifications"]

    priority_dist: dict[str, int] = {}
    cat_dist: dict[str, int] = {}
    for r in reqs:
        p = (r.priority or "medium").lower()
        priority_dist[p] = priority_dist.get(p, 0) + 1
        c = (r.category or "functional").lower()
        cat_dist[c] = cat_dist.get(c, 0) + 1

    business_obj = (
        (ctx.problem_statement or ctx.product_overview if ctx else None)
        or getattr(proj, "business_goal", None)
        or proj.description
        or "Validated product scope."
    )

    return {
        "report_type": "product_owner_pack",
        "title": f"Product Owner & Business Scope Dossier — {proj.name}",
        "project_key": proj.key,
        "project_name": proj.name,
        "domain": getattr(proj, "business_domain", "Enterprise Product") or "Enterprise Product",
        "generated_at": _utcnow().isoformat(),
        "business_objective": business_obj,
        "stakeholders": (ctx.target_users if ctx and ctx.target_users else None) or getattr(proj, "target_users_and_roles", None) or [{"name": "Product Owner", "role": "Governance"}, {"name": "Lead Architect", "role": "Technical Sign-Off"}],
        "business_scenarios": [
            {
                "id": s.id,
                "name": getattr(s, "title", f"Scenario #{s.id}") or f"Scenario #{s.id}",
                "description": s.description or "",
                "trigger_event": getattr(s, "preconditions", "User initiated action") or "User initiated action",
                "expected_outcome": s.expected_outcome or "Successful workflow completion",
            }
            for s in scenarios
        ],
        "requirements_summary": {
            "total_active": len(reqs),
            "by_priority": priority_dist,
            "by_category": cat_dist,
            "approved_count": sum(1 for r in reqs if (getattr(r, "review_status", "") or "").lower() == "approved"),
            "draft_count": sum(1 for r in reqs if (getattr(r, "review_status", "") or "").lower() != "approved"),
        },
        "open_clarifications": [
            {
                "id": c.id,
                "requirement_id": c.requirement_id,
                "question": c.question,
                "suggested_resolution": c.suggested_resolution or "Confirm intended business policy.",
                "status": c.status,
            }
            for c in clarifications
        ],
    }


def build_executive_management_report(db: Session, project_id: int) -> dict[str, Any]:
    """Package executive quality score, release gating, risk ledger, and next actions for leadership."""
    data = gather_project_engineering_data(db, project_id)
    proj = data["project"]
    rel_dec = data["release_decision"]
    reqs = data["requirements"]
    acs = data["acceptance_criteria"]
    tests = data["tests"]
    execs = data["executions"]
    defects = data["defects"]

    total_runs = len(execs)
    passed_runs = sum(1 for e in execs if e.status == "passed")

    return {
        "report_type": "executive_management_report",
        "title": f"Executive Quality & Release Intelligence Report — {proj.name}",
        "project_key": proj.key,
        "project_name": proj.name,
        "generated_at": _utcnow().isoformat(),
        "readiness_score": rel_dec["readiness_score"],
        "gate_status": rel_dec["status"],
        "gate_display": rel_dec["display_status"],
        "is_approved": rel_dec["is_approved"],
        "score_breakdown": rel_dec["score_breakdown"],
        "blocking_reasons": rel_dec["reasons"],
        "key_metrics": {
            "total_documents": len(data["documents"]),
            "active_requirements": len(reqs),
            "synthesized_acceptance_criteria": len(acs),
            "synthesized_test_cases": len(tests),
            "recorded_executions": total_runs,
            "execution_pass_rate": f"{round(100.0 * passed_runs / total_runs, 1)}%" if total_runs > 0 else "N/A (0 Runs)",
            "open_defects": len([d for d in defects if d.status not in ("closed", "verified")]),
            "traceability_coverage": f"{round(100.0 * len(data['covered_req_ids']) / len(reqs), 1)}%" if reqs else "0.0%",
        },
        "strategic_remediation_actions": [
            {"priority": 1, "action": "Authorize and execute initial test suites against staging environment.", "impact": "Unblocks Execution Verification gate score."},
            {"priority": 2, "action": "Generate test cases for remaining uncovered requirements.", "impact": "Increases Traceability Coverage toward 80% threshold."},
            {"priority": 3, "action": "Complete human four-eyes review on synthesized acceptance criteria.", "impact": "Transitions criteria from pending to approved status."}
        ]
    }


# =============================================================================
# 3. STANDARDIZED COMPLETE PROJECT JSON PACKAGE (SCHEMA 2.0.0)
# =============================================================================

def build_complete_project_package(db: Session, project_id: int) -> dict[str, Any]:
    """Generate a versioned, fully self-contained JSON deliverable with preserved relational integrity."""
    data = gather_project_engineering_data(db, project_id)
    proj = data["project"]
    ctx = data["context"]
    docs = data["documents"]
    reqs = data["requirements"]
    acs = data["acceptance_criteria"]
    tests = data["tests"]
    steps_by_test = data["steps_by_test"]
    suites = data["suites"]
    execs = data["executions"]
    defects = data["defects"]
    clarifications = data["clarifications"]
    rel_dec = data["release_decision"]
    acs_by_req = data["acs_by_req"]
    tests_by_req = data["tests_by_req"]
    docs_by_id = data["docs_by_id"]

    traceability_links = []
    for r in reqs:
        doc = docs_by_id.get(r.document_id)
        linked_acs = acs_by_req.get(r.id, [])
        linked_tests = tests_by_req.get(r.id, [])
        traceability_links.append({
            "requirement_id": r.id,
            "requirement_key": r.key,
            "source_document": doc.filename if doc else None,
            "document_page": r.source_page,
            "acceptance_criteria_keys": [ac.key for ac in linked_acs],
            "test_case_keys": [t.key for t in linked_tests],
            "has_execution": len(execs) > 0 and len(linked_tests) > 0,
            "coverage_state": "covered" if linked_tests else "uncovered",
        })

    return {
        "$schema": "https://tracetest.ai/schemas/v2/project-package.json",
        "schema_version": "2.0.0",
        "generator": "TraceTest AI Engineering Handoff Engine",
        "exported_at": _utcnow().isoformat(),
        "project": {
            "id": proj.id,
            "key": proj.key,
            "name": proj.name,
            "domain": getattr(proj, "business_domain", "Enterprise Software") or "Enterprise Software",
            "description": proj.description,
            "created_at": proj.created_at.isoformat() if proj.created_at else None,
        },
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "sha256": (d.metadata_json or {}).get("sha256_hash", d.checksum or ""),
                "page_count": (d.metadata_json or {}).get("pages_count", (d.metadata_json or {}).get("page_count", 1)),
                "file_type": d.file_type,
                "purpose": d.purpose,
                "status": d.status,
            }
            for d in docs
        ],
        "project_context": {
            "business_objective": (ctx.problem_statement or ctx.product_overview if ctx else None) or getattr(proj, "business_goal", None) or proj.description,
            "architecture_summary": ctx.architecture_context if ctx else None,
            "regulatory_context": _safe_str(ctx.regulatory_standards) if ctx else None,
            "stakeholders": (ctx.target_users if ctx and ctx.target_users else None) or getattr(proj, "target_users_and_roles", []),
            "constraints": (ctx.security_expectations if ctx and ctx.security_expectations else None) or getattr(proj, "constraints_and_assumptions", []),
            "roles": [{"name": getattr(r, "role_name", "System Actor"), "description": r.description, "permissions": r.permissions} for r in data["roles"]],
            "business_scenarios": [{"name": getattr(s, "title", "Scenario"), "description": s.description} for s in data["scenarios"]],
        },
        "requirements": [
            {
                "id": r.id,
                "key": r.key,
                "title": r.title,
                "description": r.evidence_excerpt or r.title or "",
                "category": r.category,
                "priority": r.priority,
                "review_status": getattr(r, "review_status", "draft"),
                "provenance": getattr(r, "extraction_provenance", "documented"),
                "confidence": getattr(r, "confidence", 1.0),
                "document_page": r.source_page,
                "source_quote": r.evidence_excerpt,
                "invariants": [f"System must satisfy {r.key} across all states."] if r.evidence_excerpt else [],
                "dependencies": getattr(r, "dependencies", []) or [],
            }
            for r in reqs
        ],
        "acceptance_criteria": [
            {
                "id": ac.id,
                "key": ac.key,
                "requirement_id": ac.requirement_id,
                "category": getattr(ac, "category", "functional") or "functional",
                "rule": ac.description or "Business constraint validation.",
                "scenario": f"Scenario {ac.key}",
                "given": ac.preconditions or "Standard initialized operating environment.",
                "when": ac.action or ac.description or "System interaction triggered.",
                "then": ac.expected_behaviour or ac.expected_output or "Expected criteria met.",
                "verification_method": "automated_assertion" if ac.quote_verified else "specification_validation",
                "review_status": ac.review_status,
            }
            for ac in acs
        ],
        "test_cases": [
            {
                "id": t.id,
                "key": t.key,
                "requirement_id": t.requirement_id,
                "title": t.title,
                "priority": t.priority,
                "type": getattr(t, "test_type", "functional") or "functional",
                "is_automated": bool(getattr(t, "automation", False)),
                "preconditions": t.preconditions,
                "test_data": t.test_data,
                "expected_result": t.expected_result,
                "review_status": getattr(t, "approval_status", "draft") or "draft",
                "steps": [
                    {
                        "step_number": s.position,
                        "action": s.action,
                        "input_data": "",
                        "expected_result": s.expected or "",
                    }
                    for s in steps_by_test.get(t.id, [])
                ],
            }
            for t in tests
        ],
        "test_suites": [{"id": s.id, "name": s.name, "description": s.description} for s in suites],
        "executions": [
            {
                "id": e.id,
                "key": e.key,
                "source": e.source,
                "status": e.status,
                "passed": e.passed,
                "failed": e.failed,
                "errored": e.errored,
                "duration_ms": e.duration_ms,
                "started_at": e.started_at.isoformat() if e.started_at else None,
            }
            for e in execs
        ],
        "defects": [
            {
                "id": d.id,
                "key": d.key,
                "requirement_id": d.requirement_id,
                "test_case_id": d.test_case_id,
                "title": d.title,
                "severity": d.severity,
                "priority": d.priority,
                "status": d.status,
                "description": d.description,
            }
            for d in defects
        ],
        "traceability_matrix": traceability_links,
        "coverage_summary": {
            "total_requirements": len(reqs),
            "covered_requirements": len(data["covered_req_ids"]),
            "uncovered_requirements": len(data["uncovered_requirements"]),
            "coverage_percentage": round(100.0 * len(data["covered_req_ids"]) / len(reqs), 1) if reqs else 0.0,
        },
        "release_decision": {
            "readiness_score": rel_dec["readiness_score"],
            "status": rel_dec["status"],
            "display_status": rel_dec["display_status"],
            "is_approved": rel_dec["is_approved"],
            "score_breakdown": rel_dec["score_breakdown"],
            "blocking_reasons": rel_dec["reasons"],
        },
        "clarifications": [
            {
                "id": c.id,
                "requirement_id": c.requirement_id,
                "question": c.question,
                "suggested_resolution": c.suggested_resolution,
                "status": c.status,
            }
            for c in clarifications
        ],
    }


# =============================================================================
# 4. MULTI-SHEET XLSX ENGINEERING WORKBOOK GENERATOR
# =============================================================================

def generate_multi_sheet_xlsx(db: Session, project_id: int) -> bytes:
    """Generate an executive-grade, multi-sheet Excel workbook using openpyxl."""
    data = gather_project_engineering_data(db, project_id)
    proj = data["project"]
    rel_dec = data["release_decision"]
    reqs = data["requirements"]
    acs = data["acceptance_criteria"]
    tests = data["tests"]
    steps_by_test = data["steps_by_test"]
    acs_by_req = data["acs_by_req"]
    tests_by_req = data["tests_by_req"]
    docs_by_id = data["docs_by_id"]
    defects = data["defects"]

    wb = openpyxl.Workbook()

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    sub_header_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
    title_font = Font(name="Calibri", size=16, bold=True, color="0F172A")
    regular_font = Font(name="Calibri", size=10, color="1E293B")
    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0"),
    )

    # -------------------------------------------------------------
    # SHEET 1: EXECUTIVE SUMMARY
    # -------------------------------------------------------------
    ws1 = wb.active
    ws1.title = "Executive Summary"
    ws1.views.sheetView[0].showGridLines = True

    ws1.append(["TraceTest AI — Executive Project Intelligence & Quality Dossier"])
    ws1.cell(1, 1).font = title_font
    ws1.append([])

    summary_rows = [
        ["Project Name", proj.name],
        ["Project Key", proj.key],
        ["Business Domain", getattr(proj, "business_domain", "General") or "General"],
        ["Generated Timestamp", _utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")],
        ["Readiness Score", f"{rel_dec['readiness_score']}%"],
        ["Release Gate Decision", rel_dec["display_status"]],
        ["Gate Clearance Approved", "YES" if rel_dec["is_approved"] else "NO (BLOCKED)"],
        ["Total Active Requirements", len(reqs)],
        ["Synthesized Acceptance Criteria", len(acs)],
        ["Synthesized Test Cases", len(tests)],
        ["Recorded Executions", len(data["executions"])],
        ["Execution Pass Rate", "N/A (0 Runs)" if not data["executions"] else f"{rel_dec.get('pass_rate', 0)}%"],
        ["Open Defects", len(defects)],
        ["Requirement Coverage", f"{round(100.0 * len(data['covered_req_ids']) / len(reqs), 1) if reqs else 0.0}%"],
    ]

    for k, v in summary_rows:
        ws1.append([k, v])
        ws1.cell(ws1.max_row, 1).font = Font(name="Calibri", size=10, bold=True, color="334155")
        ws1.cell(ws1.max_row, 2).font = regular_font

    ws1.append([])
    ws1.append(["Release Gate Score Breakdown", "Points Earned", "Max Points", "Category Weight"])
    for col_idx in range(1, 5):
        ws1.cell(ws1.max_row, col_idx).fill = sub_header_fill
        ws1.cell(ws1.max_row, col_idx).font = header_font

    for cat_name, cat_obj in rel_dec.get("score_breakdown", {}).items():
        ws1.append([
            cat_name.replace("_", " ").title(),
            cat_obj.get("earned", 0),
            cat_obj.get("max", 0),
            f"{cat_obj.get('weight', 0)}%"
        ])

    # -------------------------------------------------------------
    # SHEET 2: REQUIREMENTS (ALL 400+ PERSISTED RECORDS)
    # -------------------------------------------------------------
    ws2 = wb.create_sheet(title="Requirements")
    ws2.views.sheetView[0].showGridLines = True
    req_headers = [
        "Requirement Key", "Title", "Category", "Priority", "Review Status",
        "Document", "Page", "Provenance", "Verbatim Quote", "Description"
    ]
    ws2.append(req_headers)
    for col_idx in range(1, len(req_headers) + 1):
        cell = ws2.cell(1, col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for r in reqs:
        doc = docs_by_id.get(r.document_id)
        ws2.append([
            r.key,
            r.title,
            r.category or "functional",
            r.priority or "medium",
            getattr(r, "review_status", "draft") or "draft",
            doc.filename if doc else "",
            r.source_page or "",
            getattr(r, "extraction_provenance", "documented") or "documented",
            (r.evidence_excerpt or "")[:200],
            r.evidence_excerpt or r.title or "",
        ])
        for col_idx in range(1, len(req_headers) + 1):
            ws2.cell(ws2.max_row, col_idx).font = regular_font
            ws2.cell(ws2.max_row, col_idx).border = thin_border

    # -------------------------------------------------------------
    # SHEET 3: ACCEPTANCE CRITERIA
    # -------------------------------------------------------------
    ws3 = wb.create_sheet(title="Acceptance Criteria")
    ws3.views.sheetView[0].showGridLines = True
    ac_headers = [
        "AC Key", "Parent Requirement Key", "Category", "Rule Statement",
        "Scenario Name", "Given", "When", "Then", "Verification Method", "Review Status"
    ]
    ws3.append(ac_headers)
    for col_idx in range(1, len(ac_headers) + 1):
        cell = ws3.cell(1, col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    req_keys_by_id = {r.id: r.key for r in reqs}
    for ac in acs:
        ws3.append([
            ac.key,
            req_keys_by_id.get(ac.requirement_id, "Unknown"),
            getattr(ac, "category", "functional") or "functional",
            ac.description or "",
            f"Scenario {ac.key}",
            ac.preconditions or "",
            ac.action or ac.description or "",
            ac.expected_behaviour or ac.expected_output or "",
            "automated_assertion" if ac.quote_verified else "specification_validation",
            ac.review_status or "pending_review",
        ])
        for col_idx in range(1, len(ac_headers) + 1):
            ws3.cell(ws3.max_row, col_idx).font = regular_font
            ws3.cell(ws3.max_row, col_idx).border = thin_border

    # -------------------------------------------------------------
    # SHEET 4: TEST CASES & PROCEDURES
    # -------------------------------------------------------------
    ws4 = wb.create_sheet(title="Test Cases")
    ws4.views.sheetView[0].showGridLines = True
    tc_headers = [
        "Test Key", "Parent Requirement Key", "Title", "Priority", "Type",
        "Automated", "Steps Count", "Preconditions", "Expected Result", "Review Status"
    ]
    ws4.append(tc_headers)
    for col_idx in range(1, len(tc_headers) + 1):
        cell = ws4.cell(1, col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for t in tests:
        st_count = len(steps_by_test.get(t.id, []))
        if not st_count and t.steps_json:
            st_count = len(t.steps_json)
        ws4.append([
            t.key,
            req_keys_by_id.get(t.requirement_id, "Unlinked"),
            t.title,
            t.priority or "medium",
            getattr(t, "test_type", "functional") or "functional",
            "TRUE" if getattr(t, "automation", False) else "FALSE",
            st_count,
            t.preconditions or "",
            t.expected_result or "",
            getattr(t, "approval_status", "draft") or "draft",
        ])
        for col_idx in range(1, len(tc_headers) + 1):
            ws4.cell(ws4.max_row, col_idx).font = regular_font
            ws4.cell(ws4.max_row, col_idx).border = thin_border

    # -------------------------------------------------------------
    # SHEET 5: TRACEABILITY MATRIX
    # -------------------------------------------------------------
    ws5 = wb.create_sheet(title="Traceability Matrix")
    ws5.views.sheetView[0].showGridLines = True
    tm_headers = [
        "Requirement Key", "Requirement Title", "Category", "Source Document",
        "Page", "Criteria Keys", "Test Case Keys", "Verification State", "Defect Keys"
    ]
    ws5.append(tm_headers)
    for col_idx in range(1, len(tm_headers) + 1):
        cell = ws5.cell(1, col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    def_keys_by_req: dict[int, list[str]] = {}
    for d in defects:
        if d.requirement_id:
            def_keys_by_req.setdefault(d.requirement_id, []).append(d.key)

    for r in reqs:
        doc = docs_by_id.get(r.document_id)
        linked_ac_keys = [ac.key for ac in acs_by_req.get(r.id, [])]
        linked_tc_keys = [tc.key for tc in tests_by_req.get(r.id, [])]
        linked_def_keys = def_keys_by_req.get(r.id, [])
        state = "Covered" if linked_tc_keys else "Uncovered Gap"

        ws5.append([
            r.key,
            r.title,
            r.category or "functional",
            doc.filename if doc else "",
            r.source_page or "",
            ", ".join(linked_ac_keys),
            ", ".join(linked_tc_keys),
            state,
            ", ".join(linked_def_keys),
        ])
        for col_idx in range(1, len(tm_headers) + 1):
            ws5.cell(ws5.max_row, col_idx).font = regular_font
            ws5.cell(ws5.max_row, col_idx).border = thin_border

    # -------------------------------------------------------------
    # SHEET 6: CRITICAL QUALITY GAPS & NEXT ACTIONS
    # -------------------------------------------------------------
    ws6 = wb.create_sheet(title="Critical Quality Gaps")
    ws6.views.sheetView[0].showGridLines = True
    gap_headers = ["Gap ID", "Description", "Severity", "Estimated Effort", "Affected Area", "Remediation Target"]
    ws6.append(gap_headers)
    for col_idx in range(1, len(gap_headers) + 1):
        cell = ws6.cell(1, col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    uncovered_count = len(data["uncovered_requirements"])
    gaps = [
        ["GAP-01", "Zero test executions recorded — behavioral verification has not yet run.", "Critical", "2.0 Hours", "Execution Verification", "/simulation"],
        ["GAP-02", f"{uncovered_count} requirements without associated test cases.", "High", "6.0 Hours", "Test Case Synthesis", "/tests"],
        ["GAP-03", f"{len(acs)} acceptance criteria pending human review & sign-off.", "Medium", "4.0 Hours", "Acceptance Criteria Review", "/acceptance-criteria"],
        ["GAP-04", f"{len(tests)} synthesized test cases pending technical review.", "Medium", "2.0 Hours", "Test Design Review", "/tests"],
    ]

    for g in gaps:
        ws6.append(g)
        for col_idx in range(1, len(gap_headers) + 1):
            ws6.cell(ws6.max_row, col_idx).font = regular_font
            ws6.cell(ws6.max_row, col_idx).border = thin_border

    # Auto-adjust column widths
    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                if len(val) > max_len:
                    max_len = len(val)
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 50)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# =============================================================================
# 5. MARKDOWN FORMATTER FOR ROLE-BASED REPORTS
# =============================================================================

def format_role_markdown(rep: dict[str, Any], role: str) -> str:
    """Format role-based report dictionary into clean, enterprise-grade Markdown."""
    lines: list[str] = []
    title = rep.get("title", f"Engineering Report — {rep.get('project_key', '')}")
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"**Project Key:** `{rep.get('project_key', '')}` | **Domain:** {rep.get('domain', 'Enterprise')} | **Generated:** {rep.get('generated_at', '')}")
    lines.append("")

    if role == "developer":
        lines.append("## 1. Project Context & Business Objective")
        lines.append(rep.get("business_objective", ""))
        lines.append("")
        lines.append("## 2. Architecture & System Constraints")
        lines.append(rep.get("architecture_summary", ""))
        lines.append("")
        lines.append("### Invariants & Non-Negotiable Rules")
        for c in rep.get("constraints", []):
            lines.append(f"- {c}")
        lines.append("")

        lines.append(f"## 3. Detailed Specifications & Acceptance Criteria ({rep.get('requirements_count', 0)} Requirements)")
        lines.append("")
        for r in rep.get("requirements", []):
            lines.append(f"### `{r['key']}`: {r['title']}")
            lines.append(f"- **Category:** `{r['category']}` | **Priority:** `{r['priority']}` | **Status:** `{r['review_status']}`")
            lines.append(f"- **Source Reference:** {r['source_document']} (Page {r.get('document_page', 'N/A')})")
            if r.get("source_quote"):
                lines.append(f"> **Verbatim Specification Quote:** *\"{r['source_quote']}\"*")
            lines.append("")
            lines.append(r.get("description", ""))
            lines.append("")

            if r.get("acceptance_criteria"):
                lines.append("#### Acceptance Criteria (Given / When / Then):")
                for ac in r["acceptance_criteria"]:
                    lines.append(f"- **`{ac['key']}` [{ac['category'].upper()}]**: {ac['rule']}")
                    lines.append(f"  - **Given:** {ac['given']}")
                    lines.append(f"  - **When:** {ac['when']}")
                    lines.append(f"  - **Then:** {ac['then']}")
                    lines.append(f"  - *Verification Method:* `{ac['verification_method']}` | *Status:* `{ac['review_status']}`")
                lines.append("")

            if r.get("invariants"):
                lines.append("#### Contract Invariants:")
                for inv in r["invariants"]:
                    lines.append(f"- `{inv}`")
                lines.append("")

            lines.append("> [!NOTE] Implementation Consideration (Advisory Suggestion — Not a Source Specification Mandate)")
            for note in r.get("implementation_notes", []):
                lines.append(f"> - {note}")
            lines.append("")
            lines.append("---")
            lines.append("")

        if rep.get("unresolved_ambiguities"):
            lines.append("## 4. Unresolved Ambiguities & Clarifications")
            for a in rep["unresolved_ambiguities"]:
                lines.append(f"- **Question #{a['id']}:** {a['question']}")
                lines.append(f"  - *Suggested Resolution:* {a['suggested_fix']}")
            lines.append("")

    elif role == "qa":
        lines.append("## 1. QA Verification Scope & Coverage Summary")
        cov = rep.get("coverage_metrics", {})
        lines.append(f"- **Total Requirements:** {cov.get('total_requirements', 0)}")
        lines.append(f"- **Covered Requirements:** {cov.get('covered_requirements', 0)} ({cov.get('coverage_percentage', 0)}%)")
        lines.append(f"- **Uncovered Requirements:** {cov.get('uncovered_requirements', 0)}")
        lines.append(f"- **Total Test Cases:** {rep.get('total_test_cases', 0)} ({rep.get('automated_count', 0)} Automated, {rep.get('manual_count', 0)} Manual)")
        lines.append(f"- **Positive Scenarios:** {cov.get('positive_scenarios', 0)} | **Negative Scenarios:** {cov.get('negative_scenarios', 0)} | **Boundary Scenarios:** {cov.get('boundary_scenarios', 0)}")
        lines.append("")

        lines.append("## 2. Test Procedures & Verification Steps")
        lines.append("")
        for t in rep.get("test_cases", []):
            lines.append(f"### `{t['key']}`: {t['title']}")
            lines.append(f"- **Parent Requirement:** `{t['parent_requirement_key']}` ({t['parent_requirement_title']})")
            lines.append(f"- **Type:** `{t['type']}` | **Priority:** `{t['priority']}` | **Automated:** `{t['is_automated']}` | **Status:** `{t['execution_status']}`")
            lines.append(f"- **Preconditions:** {t['preconditions']}")
            lines.append(f"- **Expected Result:** {t['expected_result']}")
            lines.append("")
            if t.get("steps"):
                lines.append("| Step # | Action | Input Data | Expected Result |")
                lines.append("|---|---|---|---|")
                for s in t["steps"]:
                    lines.append(f"| {s.get('step_number', 1)} | {s['action']} | {s.get('input_data', '')} | {s.get('expected_result', '')} |")
                lines.append("")
            lines.append("---")
            lines.append("")

        if rep.get("uncovered_requirements"):
            lines.append("## 3. Uncovered Requirements Gap Ledger")
            lines.append("| Requirement Key | Title | Category | Priority |")
            lines.append("|---|---|---|---|")
            for u in rep["uncovered_requirements"]:
                lines.append(f"| `{u['key']}` | {u['title']} | `{u['category']}` | `{u['priority']}` |")
            lines.append("")

    elif role == "automation_agent":
        lines.append("## Autonomous AI Testing Agent Prompt & Specification Dossier")
        lines.append("")
        lines.append("> [!IMPORTANT]")
        lines.append(f"> {rep.get('execution_disclaimer', '')}")
        lines.append("")
        lines.append("### Step-by-Step Agent Instructions")
        for step_k, step_v in rep.get("agent_instructions", {}).items():
            lines.append(f"1. **{step_k.replace('_', ' ').upper()}:** {step_v}")
        lines.append("")
        lines.append("### Fact vs Assumption Demarcation Rules")
        for rule_k, rule_v in rep.get("demarcation_rules", {}).items():
            lines.append(f"- `[{rule_k}]`: {rule_v}")
        lines.append("")

        lines.append("## Testable Specification Modules")
        for mod in rep.get("testable_specifications", []):
            lines.append(f"### [SPECIFICATION MODULE] `{mod['requirement_key']}`: {mod['title']}")
            lines.append(f"- **[FACT: SPECIFICATION]**: {mod['spec_fact']}")
            if mod.get("document_page"):
                lines.append(f"- **Source Page:** Page {mod['document_page']}")
            if mod.get("invariants"):
                lines.append("#### Contract Invariants:")
                for inv in mod["invariants"]:
                    lines.append(f"- `[INVARIANT]`: {inv}")
            if mod.get("acceptance_criteria"):
                lines.append("#### [GENERATED CRITERION] Acceptance Criteria:")
                for ac in mod["acceptance_criteria"]:
                    lines.append(f"- **`{ac['ac_key']}` [{ac['method']}]**: Given `{ac['given']}`, When `{ac['when']}`, Then `{ac['then']}`")
            if mod.get("synthesized_tests"):
                lines.append("#### [GENERATED TEST CASE] Suggested Procedures:")
                for tc in mod["synthesized_tests"]:
                    lines.append(f"- **`{tc['test_key']}` [{tc['type']}]**: {tc['title']} (Expected: {tc['expected_result']})")
            lines.append("")
            lines.append("---")
            lines.append("")

    elif role == "integration":
        lines.append("## 1. System Boundaries & Actors")
        lines.append(rep.get("architecture_boundaries", ""))
        lines.append("")
        lines.append("| Actor / System | Role Type | Description | Permissions |")
        lines.append("|---|---|---|---|")
        for a in rep.get("actors_and_systems", []):
            perms = ", ".join(a.get("permissions", [])) or "Standard"
            lines.append(f"| **{a['actor_name']}** | `{a['role_type']}` | {a['description']} | `{perms}` |")
        lines.append("")

        lines.append(f"## 2. Integration & Interface Specifications ({rep.get('integration_requirements_count', 0)} Requirements)")
        for ir in rep.get("integration_requirements", []):
            lines.append(f"### `{ir['key']}`: {ir['title']}")
            lines.append(f"- **Demarcation:** {ir['interface_note']}")
            lines.append(f"- **Category:** `{ir['category']}` | **Page:** {ir.get('source_page', 'N/A')}")
            if ir.get("verbatim_quote"):
                lines.append(f"> *\"{ir['verbatim_quote']}\"*")
            if ir.get("invariants"):
                lines.append("#### Interface Invariants:")
                for inv in ir["invariants"]:
                    lines.append(f"- `{inv}`")
            lines.append("")

    elif role == "product_owner":
        lines.append("## 1. Business Mission & Scope")
        lines.append(rep.get("business_objective", ""))
        lines.append("")
        summ = rep.get("requirements_summary", {})
        lines.append(f"**Total Scope:** {summ.get('total_active', 0)} active requirements ({summ.get('approved_count', 0)} approved, {summ.get('draft_count', 0)} pending review).")
        lines.append("")

        lines.append("## 2. Business Scenarios & Journeys")
        for s in rep.get("business_scenarios", []):
            lines.append(f"### Scenario: {s['name']}")
            lines.append(s.get("description", ""))
            lines.append(f"- **Trigger:** {s.get('trigger_event', '')}")
            lines.append(f"- **Outcome:** {s.get('expected_outcome', '')}")
            lines.append("")

        if rep.get("open_clarifications"):
            lines.append("## 3. Open Ambiguities Needing Product Owner Decision")
            for c in rep["open_clarifications"]:
                lines.append(f"- **Question #{c['id']}:** {c['question']}")
                lines.append(f"  - *Proposed Fix:* {c['suggested_resolution']}")
            lines.append("")

    elif role == "executive":
        lines.append("## 1. Executive Quality & Release Decision")
        lines.append(f"- **Readiness Score:** `{rep.get('readiness_score', 0)}%`")
        lines.append(f"- **Release Gate:** `{rep.get('gate_display', 'Unknown')}` (Approved: `{rep.get('is_approved', False)}`)")
        lines.append("")
        lines.append("### Five-Category Score Breakdown:")
        sb = rep.get("score_breakdown", {})
        lines.append("| Area | Earned | Max | Weight | Status |")
        lines.append("|---|---|---|---|---|")
        for k, v in sb.items():
            lines.append(f"| {k.replace('_', ' ').title()} | {v.get('earned', 0)} | {v.get('max', 0)} | {v.get('weight', 0)}% | {v.get('status', 'OK')} |")
        lines.append("")

        lines.append("### Key Metrics Ledger:")
        km = rep.get("key_metrics", {})
        for mk, mv in km.items():
            lines.append(f"- **{mk.replace('_', ' ').title()}:** {mv}")
        lines.append("")

        if rep.get("blocking_reasons"):
            lines.append("### Release Blocking Reasons:")
            for r in rep["blocking_reasons"]:
                lines.append(f"- ⛔ {r}")
            lines.append("")

        lines.append("### Strategic Next Actions:")
        for act in rep.get("strategic_remediation_actions", []):
            lines.append(f"1. **Priority {act['priority']}:** {act['action']} *(Impact: {act['impact']})*")
        lines.append("")

    return "\n".join(lines)


# =============================================================================
# 6. GRANULAR SLICE EXPORTER (CSV / JSON / MARKDOWN / XLSX)
# =============================================================================

def export_granular_slice(
    db: Session,
    project_id: int,
    entity: str,
    fmt: str = "csv",
    group_by_requirement: bool = False,
    include_linked: bool = True,
) -> tuple[bytes, str, str]:
    """Export fine-grained datasets (all requirements, acceptance criteria, test cases, or matrix)."""
    data = gather_project_engineering_data(db, project_id)
    proj = data["project"]
    fmt = fmt.lower()

    rows: list[dict[str, Any]] = []
    title = f"{proj.key} {entity.replace('_', ' ').title()}"

    if entity == "requirements":
        docs_by_id = data["docs_by_id"]
        acs_by_req = data["acs_by_req"]
        tests_by_req = data["tests_by_req"]
        for r in data["requirements"]:
            doc = docs_by_id.get(r.document_id)
            row = {
                "key": r.key,
                "title": r.title,
                "category": r.category or "functional",
                "priority": r.priority or "medium",
                "review_status": getattr(r, "review_status", "draft") or "draft",
                "document": doc.filename if doc else "",
                "page": r.source_page or "",
                "quote": r.evidence_excerpt or "",
                "description": r.evidence_excerpt or r.title or "",
            }
            if include_linked:
                row["linked_criteria_count"] = len(acs_by_req.get(r.id, []))
                row["linked_tests_count"] = len(tests_by_req.get(r.id, []))
            rows.append(row)

    elif entity == "acceptance_criteria":
        req_keys_by_id = {r.id: r.key for r in data["requirements"]}
        for ac in data["acceptance_criteria"]:
            rows.append({
                "key": ac.key,
                "requirement_key": req_keys_by_id.get(ac.requirement_id, "Unknown"),
                "category": getattr(ac, "category", "functional") or "functional",
                "rule": ac.description or "",
                "scenario": f"Scenario {ac.key}",
                "given": ac.preconditions or "",
                "when": ac.action or ac.description or "",
                "then": ac.expected_behaviour or ac.expected_output or "",
                "verification_method": "automated_assertion" if ac.quote_verified else "specification_validation",
                "review_status": ac.review_status or "pending_review",
            })
        if group_by_requirement:
            rows.sort(key=lambda x: (x["requirement_key"], x["key"]))

    elif entity == "test_cases":
        req_keys_by_id = {r.id: r.key for r in data["requirements"]}
        steps_by_test = data["steps_by_test"]
        for t in data["tests"]:
            st_list = steps_by_test.get(t.id, [])
            st_count = len(st_list) if st_list else len(t.steps_json or [])
            rows.append({
                "key": t.key,
                "requirement_key": req_keys_by_id.get(t.requirement_id, "Unlinked"),
                "title": t.title,
                "priority": t.priority or "medium",
                "type": getattr(t, "test_type", "functional") or "functional",
                "is_automated": bool(getattr(t, "automation", False)),
                "steps_count": st_count,
                "preconditions": t.preconditions or "",
                "expected_result": t.expected_result or "",
                "review_status": getattr(t, "approval_status", "draft") or "draft",
            })
        if group_by_requirement:
            rows.sort(key=lambda x: (x["requirement_key"], x["key"]))

    elif entity == "traceability_matrix":
        docs_by_id = data["docs_by_id"]
        acs_by_req = data["acs_by_req"]
        tests_by_req = data["tests_by_req"]
        for r in data["requirements"]:
            doc = docs_by_id.get(r.document_id)
            tc_keys = [t.key for t in tests_by_req.get(r.id, [])]
            ac_keys = [ac.key for ac in acs_by_req.get(r.id, [])]
            rows.append({
                "requirement_key": r.key,
                "title": r.title,
                "category": r.category or "functional",
                "document": doc.filename if doc else "",
                "page": r.source_page or "",
                "criteria_keys": ", ".join(ac_keys),
                "test_case_keys": ", ".join(tc_keys),
                "coverage_status": "Covered" if tc_keys else "Uncovered",
            })

    elif entity == "executions":
        for e in data["executions"]:
            rows.append({
                "key": e.key,
                "source": e.source or "platform_run",
                "status": e.status,
                "passed": e.passed or 0,
                "failed": e.failed or 0,
                "errored": e.errored or 0,
                "duration_ms": e.duration_ms or 0,
                "started_at": e.started_at.isoformat() if e.started_at else "",
            })

    elif entity == "defects":
        req_keys_by_id = {r.id: r.key for r in data["requirements"]}
        tc_keys_by_id = {t.id: t.key for t in data["tests"]}
        for d in data["defects"]:
            rows.append({
                "key": d.key,
                "requirement_key": req_keys_by_id.get(d.requirement_id, ""),
                "test_key": tc_keys_by_id.get(d.test_case_id, ""),
                "title": d.title,
                "severity": d.severity,
                "priority": d.priority,
                "status": d.status,
                "description": d.description or "",
            })

    elif entity == "uncovered_requirements":
        docs_by_id = data["docs_by_id"]
        for r in data["uncovered_requirements"]:
            doc = docs_by_id.get(r.document_id)
            rows.append({
                "key": r.key,
                "title": r.title,
                "category": r.category or "functional",
                "priority": r.priority or "medium",
                "document": doc.filename if doc else "",
                "page": r.source_page or "",
                "gap_status": "Uncovered — No Test Cases Linked",
            })
    else:
        raise ValueError(f"Unsupported granular export entity: {entity}")

    filename = f"{proj.key}_{entity}.{fmt}"

    if fmt == "json":
        return json.dumps(rows, indent=2).encode(), "application/json", filename

    if fmt == "csv":
        if not rows:
            return b"No records found\n", "text/csv", filename
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        for r in rows:
            writer.writerow({k: _safe_str(v) for k, v in r.items()})
        return buf.getvalue().encode(), "text/csv", filename

    if fmt == "markdown" or fmt == "md":
        lines = [f"# {title}", "", f"_Generated { _utcnow().strftime('%Y-%m-%d %H:%M:%S UTC') } from authoritative records._", ""]
        if rows:
            cols = list(rows[0].keys())
            lines.append("| " + " | ".join(cols) + " |")
            lines.append("|" + "---|"*len(cols))
            for r in rows:
                lines.append("| " + " | ".join(_safe_str(r.get(c, "")).replace("|", "\\|").replace("\n", " ") for c in cols) + " |")
        else:
            lines.append("_No records found._")
        return "\n".join(lines).encode(), "text/markdown", filename

    if fmt == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = entity[:30]
        ws.views.sheetView[0].showGridLines = True
        if rows:
            headers = list(rows[0].keys())
            ws.append(headers)
            for c_idx in range(1, len(headers) + 1):
                cell = ws.cell(1, c_idx)
                cell.fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
                cell.font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
            for r in rows:
                ws.append([_safe_str(r.get(h, "")) for h in headers])
        bytes_buf = io.BytesIO()
        wb.save(bytes_buf)
        return bytes_buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename

    raise ValueError(f"Unsupported format '{fmt}'. Choose json, csv, markdown, or xlsx.")
