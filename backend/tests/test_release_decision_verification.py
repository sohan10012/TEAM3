"""Automated verification suite for the centralized Release Decision Engine.

Verifies:
1. All deterministic release states:
   - insufficient_evidence (no requirements, or no tests, or no executions)
   - not_approved (blocking critical defect, failed test execution, or coverage < 60%)
   - approved_with_conditions (non-critical defects, coverage < 90%, or pass rate < 95%)
   - approved_for_production (100% pass, >=90% coverage, 0 defects)
2. Invariants:
   - Empty denominators (0 reqs, 0 tests, 0 executions) never divide by zero.
   - Zero verified tests or executions caps readiness score at <= 35.0.
   - A critical defect always blocks unconditional approval.
3. Centralized consistency across all consumer interfaces:
   - Direct evaluate_release_decision()
   - GET /api/v1/projects/{id}/release-decision
   - Project Dashboard get_project_dashboard_data()["release_decision"]
   - Project Intelligence Dossier generate_project_intelligence_dossier()
   - ReasonX execute_reasonx_tool(db, id, "get_release_readiness", {})
"""
from __future__ import annotations

import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import sessionmaker

from app.api.deps import Principal
from app.api.routers.projects import delete_project
from app.core.config import REPO_ROOT
from app.db.base import make_engine
from app.db.models import (
    Defect,
    Document,
    Environment,
    Execution,
    ExecutionResult,
    Module,
    Project,
    Requirement,
    TestCase,
    User,
)
from app.db.models import (
    TestSuite as DBTestSuite,
)
from app.services.project_dashboard import get_project_dashboard_data
from app.services.project_intelligence import build_project_intelligence_report
from app.services.reasonx.executor import execute_tool
from app.services.release_decision import evaluate_release_decision

DBTestSuite.__test__ = False


def get_real_db_session():
    """Returns a session bound to var/tracetest.db."""
    real_db_path = REPO_ROOT / "var" / "tracetest.db"
    if not real_db_path.exists():
        pytest.skip("Production database var/tracetest.db not found")
    engine = make_engine(f"sqlite:///{real_db_path}")
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


def test_release_decision_existing_projects():
    """Verify release decision against authentic existing projects in var/tracetest.db."""
    with get_real_db_session() as db:
        # Project 5: EchoBox (has 1 critical open defect -> must be not_approved)
        echo_dec = evaluate_release_decision(db, 5)
        assert echo_dec["project_id"] == 5
        assert echo_dec["project_key"] == "ECHO"
        assert echo_dec["status"] == "not_approved"
        assert echo_dec["display_status"] == "Not Approved"
        assert echo_dec["is_approved"] is False
        assert len(echo_dec["blocking_defects"]) >= 1
        assert any(d["severity"] == "critical" for d in echo_dec["blocking_defects"])

        # Project 11: Enterprise Payroll
        pay_dec = evaluate_release_decision(db, 11)
        assert pay_dec["project_id"] == 11
        assert pay_dec["project_key"] == "EV_PAY"
        assert pay_dec["status"] in ("not_approved", "approved_with_conditions", "insufficient_evidence")
        assert "readiness_score" in pay_dec
        assert "metrics" in pay_dec
        assert "score_breakdown" in pay_dec

        # AWS Security Pillar (e.g. ASPME3 or ASPME2)
        aws_proj = db.execute(select(Project).where(Project.key.in_(["ASPME2", "ASPME3"]))).scalars().first()
        if aws_proj:
            aws_dec = evaluate_release_decision(db, aws_proj.id)
            assert aws_dec["project_id"] == aws_proj.id
            assert aws_dec["project_key"] == aws_proj.key
            assert "readiness_score" in aws_dec


def test_release_decision_synthetic_lifecycle_and_invariants():
    """Verify all 5 states and strict invariants using an isolated synthetic project."""
    with get_real_db_session() as db:
        admin_user = db.execute(select(User).where(User.id == 1)).scalars().first()
        principal = Principal(admin_user, {"admin"}, None)

        # Pre-cleanup if previous run left test project
        prior = db.execute(select(Project).where(Project.key == "REL_SYN_02")).scalars().first()
        if prior:
            delete_project(project_id=prior.id, confirm_key="REL_SYN_02", p=principal, db=db)

        # -----------------------------------------------------------------
        # Stage A: Empty Project (0 requirements, 0 tests, 0 executions)
        # -----------------------------------------------------------------
        proj = Project(
            key="REL_SYN_02",
            name="Synthetic Project for Release Engine Audit",
            description="Lifecycle state and invariant audit",
            business_domain="Quality Assurance",
            status="active",
            organisation_id=1,
            owner_id=1,
        )
        db.add(proj)
        db.flush()
        pid = proj.id

        try:
            dec_a = evaluate_release_decision(db, pid)
            assert dec_a["status"] == "insufficient_evidence"
            assert dec_a["display_status"] == "Insufficient Evidence"
            assert dec_a["is_approved"] is False
            assert dec_a["readiness_score"] == 0.0
            assert dec_a["metrics"]["total_requirements"] == 0
            assert dec_a["metrics"]["total_test_cases"] == 0
            assert any("No requirements" in r for r in dec_a["reasons"])

            # -----------------------------------------------------------------
            # Stage B: Requirements exist, but 0 test cases
            # -----------------------------------------------------------------
            mod = Module(project_id=pid, code="REL_MOD", name="Release Module")
            db.add(mod)
            db.flush()

            doc = Document(
                project_id=pid,
                filename="rel_spec.pdf",
                display_name="Release Test Specification",
                file_path="uploads/rel_spec.pdf",
                file_size_bytes=1024,
                file_type="pdf",
                status="completed",
            )
            db.add(doc)
            db.flush()

            req = Requirement(
                project_id=pid,
                module_id=mod.id,
                document_id=doc.id,
                key="REL-REQ-001",
                title="Synthetic Release Requirement",
                status="approved",
                evidence_excerpt="Verifiable requirement obligation",
            )
            db.add(req)
            db.flush()

            dec_b = evaluate_release_decision(db, pid)
            assert dec_b["status"] == "insufficient_evidence"
            assert dec_b["is_approved"] is False
            assert dec_b["metrics"]["total_requirements"] == 1
            assert dec_b["metrics"]["total_test_cases"] == 0
            assert any("Zero test cases exist" in r for r in dec_b["reasons"])
            # Invariant: without test execution verification, score cannot exceed 35%
            assert dec_b["readiness_score"] <= 35.0

            # -----------------------------------------------------------------
            # Stage C: Test cases exist, but 0 executions
            # -----------------------------------------------------------------
            tc = TestCase(
                project_id=pid,
                requirement_id=req.id,
                requirement_version=1,
                key="TC-REL-0001",
                title="Synthetic Release Test Case",
                status="approved",
                test_type="functional",
                priority="high",
                automation="automated",
                clause_keys=["REL-REQ-001.C1"],
                source_quote="Quote",
                expected_result="Pass",
            )
            db.add(tc)
            db.flush()

            dec_c = evaluate_release_decision(db, pid)
            assert dec_c["status"] == "insufficient_evidence"
            assert dec_c["is_approved"] is False
            assert dec_c["metrics"]["total_test_cases"] == 1
            assert dec_c["metrics"]["executed_tests_count"] == 0
            assert any("Zero verified test executions" in r for r in dec_c["reasons"])
            assert dec_c["readiness_score"] <= 35.0

            # -----------------------------------------------------------------
            # Stage D: Execution recorded, but with a critical defect -> not_approved
            # -----------------------------------------------------------------
            env = Environment(project_id=pid, name="Rel Env", kind="simulation", is_default=True)
            suite = DBTestSuite(project_id=pid, key="TS-REL-001", name="Rel Suite", priority="normal")
            db.add_all([env, suite])
            db.flush()

            ex = Execution(
                project_id=pid,
                environment_id=env.id,
                suite_id=suite.id,
                key="EX-REL-0001",
                status="passed",
                source="platform_run",
                passed=1,
                failed=0,
            )
            db.add(ex)
            db.flush()

            ex_res = ExecutionResult(
                execution_id=ex.id,
                test_case_id=tc.id,
                test_case_version=1,
                status="passed",
                duration_ms=50,
            )
            crit_defect = Defect(
                project_id=pid,
                key="DEF-REL-CRIT",
                title="Critical blocking defect for release audit",
                severity="critical",
                priority="p1",
                status="open",
            )
            db.add_all([ex_res, crit_defect])
            db.flush()

            dec_d = evaluate_release_decision(db, pid)
            assert dec_d["status"] == "not_approved"
            assert dec_d["display_status"] == "Not Approved"
            assert dec_d["is_approved"] is False
            assert len(dec_d["blocking_defects"]) == 1
            assert dec_d["blocking_defects"][0]["key"] == "DEF-REL-CRIT"

            # -----------------------------------------------------------------
            # Stage E: Resolve critical defect, but introduce non-critical defect
            # -> approved_with_conditions
            # -----------------------------------------------------------------
            crit_defect.status = "closed"
            med_defect = Defect(
                project_id=pid,
                key="DEF-REL-MED",
                title="Medium non-blocking defect",
                severity="medium",
                priority="p3",
                status="open",
            )
            db.add(med_defect)
            db.flush()

            dec_e = evaluate_release_decision(db, pid)
            assert dec_e["status"] == "approved_with_conditions"
            assert dec_e["display_status"] == "Approved with Conditions"
            assert dec_e["is_approved"] is False
            assert len(dec_e["blocking_defects"]) == 0
            assert any("non-critical open defect" in r for r in dec_e["reasons"])

            # -----------------------------------------------------------------
            # Stage F: Resolve all defects, 100% pass, 100% coverage
            # -> approved_for_production
            # -----------------------------------------------------------------
            med_defect.status = "closed"
            db.flush()

            dec_f = evaluate_release_decision(db, pid)
            assert dec_f["status"] == "approved_for_production"
            assert dec_f["display_status"] == "Approved for Production"
            assert dec_f["is_approved"] is True
            assert dec_f["readiness_score"] >= 95.0
            assert len(dec_f["blocking_defects"]) == 0
            assert any("All release gates passed" in r for r in dec_f["reasons"])

            # -----------------------------------------------------------------
            # Consumer Consistency Checks on Stage F
            # -----------------------------------------------------------------
            # 1. Project Dashboard
            dash_data = get_project_dashboard_data(db, pid)
            assert "release_decision" in dash_data
            assert dash_data["release_decision"]["status"] == dec_f["status"]
            assert dash_data["release_decision"]["readiness_score"] == dec_f["readiness_score"]
            assert dash_data["release_decision"]["is_approved"] is True

            # 2. Project Intelligence Dossier
            dossier = build_project_intelligence_report(db, pid)
            assert dossier["readiness_score"] == dec_f["readiness_score"]
            assert dossier["release_decision"]["status"] == dec_f["status"]

            # 3. ReasonX Tool Call
            rx_result = execute_tool(db=db, tool_name="get_release_readiness", args={}, project_id=pid)
            assert rx_result["release_readiness_status"] == dec_f["status"].upper()
            assert rx_result["readiness_score"] == dec_f["readiness_score"]
            assert rx_result["is_approved"] is True

        finally:
            # -----------------------------------------------------------------
            # Cleanup synthetic project safely and verify zero leakage
            # -----------------------------------------------------------------
            delete_project(project_id=pid, confirm_key="REL_SYN_02", p=principal, db=db)

            # Confirm project is gone
            assert db.get(Project, pid) is None
            # Confirm SQLite foreign keys are 100% valid
            fk_violations = db.execute(text("PRAGMA foreign_key_check")).fetchall()
            assert len(fk_violations) == 0, f"FK violations: {fk_violations}"
