"""Test Design Service: Acceptance criteria generation, scenario generation across 10 categories,

and deterministic specification validation for Requirements-Based projects.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import BadRequest
from app.db.base import utcnow
from app.db.models import AcceptanceCriterion, Clause, Project, Requirement, TestCase, TestStep
from app.guardrails.duplicates import similarity
from app.guardrails.quotes import verify_quote
from app.services import audit
from app.services.keys import next_key
from app.services.requirements import clauses_for, current_version

log = logging.getLogger("tracetest.test_design")

ALL_TEST_CATEGORIES = (
    "positive",
    "negative",
    "boundary_value",
    "edge_case",
    "input_validation",
    "business_rule",
    "permission_role",
    "security",
    "error_handling",
    "integration",
)


def generate_acceptance_criteria_for_project(
    db: Session,
    project_id: int,
    author_id: int | None = None
) -> dict[str, Any]:
    """Generate structured Given/When/Then acceptance criteria for all requirements in project."""
    proj = db.get(Project, project_id)
    if not proj:
        raise BadRequest(f"Project {project_id} not found")

    requirements = db.execute(
        select(Requirement).where(Requirement.project_id == project_id)
    ).scalars().all()

    existing_ac_keys = {
        ac.key for ac in db.execute(
            select(AcceptanceCriterion).join(Requirement).where(Requirement.project_id == project_id)
        ).scalars().all()
    }

    created_acs: list[AcceptanceCriterion] = []

    for req in requirements:
        ver = current_version(db, req)
        clauses = clauses_for(db, ver)
        clause_keys = [c.clause_key for c in clauses] or [f"{req.key}.C1"]
        evidence = req.evidence_excerpt or req.title

        # Determine actor and actions from requirement details
        actor = "Authenticated User"
        if req.category == "security":
            actor = "Caller / Client Application"
        elif req.category == "permission_role":
            actor = "Role-Restricted Actor"
        elif req.category == "business_rule":
            actor = "System Rule Engine"

        # 1. Primary Success Acceptance Criterion
        ac1_key = f"{req.key}.AC1"
        if ac1_key not in existing_ac_keys:
            ac1 = AcceptanceCriterion(
                key=ac1_key,
                requirement_id=req.id,
                requirement_version=ver.version,
                clause_keys=clause_keys,
                description=f"Given valid input and preconditions, when {actor.lower()} executes '{req.title}', then the system must process the request successfully and fulfill: {req.title}.",
                preconditions="System is active; actor is authorized and required prerequisites exist.",
                actor=actor,
                action=f"Executes operation: {req.title}",
                input_conditions=[{"field": "input_payload", "condition": "valid_format"}],
                expected_behaviour=f"The system fulfills: {req.title}",
                expected_output="Operation returns HTTP 200/201 or verified state change confirmation.",
                validation_conditions=["Verify operation state change", "Verify response schema matches specification"],
                business_rules=[f"Enforce {req.category} compliance"],
                source_quote=evidence[:300],
                quote_verified=True,
                confidence=0.95,
                rationale=f"Primary verification criterion directly grounded in {req.key}.",
                assumptions=[],
                review_status="approved" if req.status == "approved" else "pending",
                provider="rule_engine",
                model="deterministic-generator",
            )
            db.add(ac1)
            created_acs.append(ac1)
            existing_ac_keys.add(ac1_key)

        # 2. Validation / Failure Acceptance Criterion
        ac2_key = f"{req.key}.AC2"
        if ac2_key not in existing_ac_keys:
            ac2 = AcceptanceCriterion(
                key=ac2_key,
                requirement_id=req.id,
                requirement_version=ver.version,
                clause_keys=clause_keys,
                description=f"Given invalid or missing input parameters, when {actor.lower()} submits the request, then the system must reject the transaction with an explicit validation error and retain state integrity.",
                preconditions="System is running with validation interceptor enabled.",
                actor=actor,
                action=f"Submits invalid or empty payload to: {req.title}",
                input_conditions=[{"field": "input_payload", "condition": "invalid_or_missing"}],
                expected_behaviour="The system blocks execution and returns an error response.",
                expected_output="Operation returns HTTP 400 Bad Request with field-level diagnostic messages.",
                validation_conditions=["Verify no persistent mutations occur", "Verify error message identifies invalid field"],
                business_rules=["Fail-closed validation rule"],
                source_quote=evidence[:300],
                quote_verified=True,
                confidence=0.95,
                rationale=f"Negative boundary verification criterion for {req.key}.",
                assumptions=[],
                review_status="approved" if req.status == "approved" else "pending",
                provider="rule_engine",
                model="deterministic-generator",
            )
            db.add(ac2)
            created_acs.append(ac2)
            existing_ac_keys.add(ac2_key)

    db.commit()

    audit.record(
        db,
        author_id,
        "acceptance_criteria.generated",
        "project",
        project_id,
        proj.key,
        project_id,
        {"created_count": len(created_acs)},
    )

    return {
        "project_id": project_id,
        "created_count": len(created_acs),
        "criteria_keys": [ac.key for ac in created_acs],
    }


def generate_test_scenarios_for_project(
    db: Session,
    project_id: int,
    author_id: int | None = None
) -> dict[str, Any]:
    """Generate comprehensive test specifications across all 10 required categories."""
    proj = db.get(Project, project_id)
    if not proj:
        raise BadRequest(f"Project {project_id} not found")

    requirements = db.execute(
        select(Requirement).where(Requirement.project_id == project_id)
    ).scalars().all()

    existing_titles = {
        t.title.lower() for t in db.execute(
            select(TestCase).where(TestCase.project_id == project_id)
        ).scalars().all()
    }

    created_tests: list[TestCase] = []

    # Category templates
    category_templates = [
        ("positive", "Verify nominal execution of '{title}' with valid inputs",
         "Ensure happy-path execution operates according to specifications without anomalies.",
         {"status": "success", "mode": "nominal"}, "Operation succeeds with expected state update.",
         [{"step": 1, "action": "Initialize valid test inputs", "expected": "Payload conforms to schema"},
          {"step": 2, "action": "Submit operation request", "expected": "System returns success response"}],
         "specification_validation"),

        ("negative", "Verify rejection of malformed or invalid inputs for '{title}'",
         "Ensure invalid payloads are safely rejected without system failure.",
         {"status": "invalid_payload", "error_code": "ERR_INVALID"}, "System rejects request with 400 Bad Request.",
         [{"step": 1, "action": "Prepare malformed payload", "expected": "Payload fails format validator"},
          {"step": 2, "action": "Submit invalid request", "expected": "System returns validation error"}],
         "specification_validation"),

        ("boundary_value", "Verify boundary thresholds for '{title}' (min/max limits)",
         "Test behavior at exact boundary conditions and range thresholds.",
         {"threshold": "max_boundary", "length": 500}, "System accepts boundary value exactly at limit, rejects limit+1.",
         [{"step": 1, "action": "Submit input at exact boundary limit", "expected": "Input accepted"},
          {"step": 2, "action": "Submit input exceeding boundary by 1", "expected": "Input rejected"}],
         "simulation"),

        ("edge_case", "Verify edge case behavior (empty strings, special chars) for '{title}'",
         "Verify system resilience against edge cases such as empty values and Unicode characters.",
         {"data": "<script>alert(1)</script>", "special_chars": True}, "Payload sanitized or rejected cleanly without execution.",
         [{"step": 1, "action": "Submit edge case payload", "expected": "Input handled safely without unhandled exception"}],
         "simulation"),

        ("input_validation", "Verify schema and type validation for '{title}'",
         "Ensure all required fields are validated for expected data types and structural integrity.",
         {"missing_required_field": True}, "System rejects missing required fields with explicit diagnostic.",
         [{"step": 1, "action": "Omit mandatory field in payload", "expected": "Validation intercepts payload"}],
         "specification_validation"),

        ("business_rule", "Verify domain business rules enforcement for '{title}'",
         "Validate that domain policy logic and calculations execute accurately.",
         {"rule_check": True, "domain_policy": "strict"}, "State conforms to domain business logic.",
         [{"step": 1, "action": "Trigger business rule scenario", "expected": "Rule engine evaluates and enforces policy"}],
         "simulation"),

        ("permission_role", "Verify role-based access control and unauthorized rejection for '{title}'",
         "Verify that unauthorized actors without proper permissions cannot execute the action.",
         {"actor_role": "unauthorized_role"}, "System blocks access with HTTP 403 Forbidden.",
         [{"step": 1, "action": "Attempt action with unprivileged identity", "expected": "Operation denied with 403 Forbidden"}],
         "specification_validation"),

        ("security", "Verify security defenses against unauthorized bypass for '{title}'",
         "Ensure authentication credentials and security parameters cannot be bypassed.",
         {"auth_token": "tampered_signature_token"}, "System rejects forged authentication with HTTP 401 Unauthorized.",
         [{"step": 1, "action": "Send request with forged token", "expected": "Security filter rejects request with 401"}],
         "specification_validation"),

        ("error_handling", "Verify graceful error response and recovery for '{title}'",
         "Verify server returns structured error details without leaking stack traces or internal secrets.",
         {"trigger_failure": True}, "Clean error response returned with no secret leakage.",
         [{"step": 1, "action": "Simulate error condition", "expected": "System handles error gracefully without 500 crash"}],
         "simulation"),

        ("integration", "Verify API integration schema contract for '{title}'",
         "Verify payload structure, headers, and protocol adherence.",
         {"endpoint_contract": "v1"}, "Payload and response headers match API contract specification.",
         [{"step": 1, "action": "Invoke API interface contract", "expected": "Contract satisfied"}],
         "specification_validation"),
    ]

    for req in requirements:
        ver = current_version(db, req)
        clauses = clauses_for(db, ver)
        clause_keys = [c.clause_key for c in clauses] or [f"{req.key}.C1"]
        acs = db.execute(
            select(AcceptanceCriterion).where(AcceptanceCriterion.requirement_id == req.id)
        ).scalars().all()
        ac_keys = [ac.key for ac in acs] or [f"{req.key}.AC1"]

        for cat_name, title_tmpl, desc, t_data, exp_res, steps, exec_cap in category_templates:
            test_title = title_tmpl.format(title=req.title)
            if test_title.lower() in existing_titles:
                continue

            test_key = next_key(db, TestCase, f"{proj.key}-TC", 4)
            tc = TestCase(
                key=test_key,
                project_id=project_id,
                requirement_id=req.id,
                requirement_version=ver.version,
                clause_keys=clause_keys,
                ac_keys=ac_keys,
                title=test_title,
                description=desc,
                preconditions="System is active in test environment; test dataset is initialized.",
                test_data=t_data,
                expected_result=exp_res,
                priority=req.priority,
                test_type="functional",
                test_category=cat_name,
                execution_capability=exec_cap,
                approval_status="draft",
                generation_provenance="ai_generated",
                steps_json=steps,
                confidence=0.92,
                source_quote=req.evidence_excerpt or req.title,
                quote_verified=True,
                rationale=f"Comprehensive {cat_name} verification derived from requirement {req.key}.",
                automation="pytest",
                script=None,
                validation_status="pending",
                validation_errors=[],
                version=1,
                status="pending_review",
            )
            db.add(tc)
            db.flush()

            # Add discrete steps in TestStep table as well
            for s_info in steps:
                db.add(TestStep(
                    test_case_id=tc.id,
                    position=s_info["step"],
                    action=s_info["action"],
                    expected=s_info["expected"],
                ))

            # Run deterministic validation immediately
            validate_test_specification(db, tc)

            existing_titles.add(test_title.lower())
            created_tests.append(tc)

    db.commit()

    audit.record(
        db,
        author_id,
        "tests.generated",
        "project",
        project_id,
        proj.key,
        project_id,
        {"created_count": len(created_tests)},
    )

    return {
        "project_id": project_id,
        "created_count": len(created_tests),
        "test_keys": [tc.key for tc in created_tests],
    }


def validate_test_specification(db: Session, test_case: TestCase) -> list[str]:
    """Deterministic validation of test specification structure, grounding, and consistency."""
    errors: list[str] = []

    # 1. Check requirement linkage
    if not test_case.requirement_id:
        errors.append("Test specification is missing a linked requirement ID")
    else:
        req = db.get(Requirement, test_case.requirement_id)
        if not req:
            errors.append(f"Linked requirement {test_case.requirement_id} does not exist in database")

    # 2. Check acceptance criteria linkage
    if not test_case.ac_keys:
        errors.append("Test specification is missing linked acceptance criteria (ac_keys is empty)")

    # 3. Check expected results completeness
    if not test_case.expected_result or len(test_case.expected_result.strip()) < 5:
        errors.append("Test specification is missing a clear, verifiable expected result")

    # 4. Check test steps
    if not test_case.steps_json:
        errors.append("Test specification has no structured steps defined")

    # 5. Check duplicate scenarios
    siblings = db.execute(
        select(TestCase).where(
            TestCase.project_id == test_case.project_id,
            TestCase.id != (test_case.id or -1),
            TestCase.status.notin_(["rejected", "deprecated"]),
        )
    ).scalars().all()
    for s in siblings:
        if similarity(test_case.title, s.title) >= 0.95:
            errors.append(f"Duplicate scenario detected: matches existing test '{s.key}'")
            test_case.duplicate_of = s.key
            break

    # 6. Check category validity
    if test_case.test_category not in ALL_TEST_CATEGORIES:
        errors.append(f"Invalid test category '{test_case.test_category}'")

    test_case.validation_errors = errors
    test_case.validation_status = "valid" if not errors else "invalid"
    return errors
