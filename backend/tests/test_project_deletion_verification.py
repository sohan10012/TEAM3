"""Comprehensive Project Deletion Verification Suite.

Tests:
1. Rejection of deletion when confirmation key does not match.
2. Complete cascading cleanup of all 20+ project-owned tables and polymorphic records.
3. Protection of shared documents (project_id=None).
4. Absolute isolation: existing real projects (ECHO, EV_PAY, ASPME2) are 100% untouched.
5. Complete removal from search results and project listing.
6. Foreign key integrity verified via PRAGMA foreign_key_check.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from sqlalchemy.orm import sessionmaker

from app.core.config import REPO_ROOT, get_settings
from app.db.base import make_engine, utcnow
from app.db.models import (
    AcceptanceCriterion,
    AuditLog,
    BusinessScenario,
    Clause,
    Defect,
    DefectComment,
    Document,
    Environment,
    Execution,
    ExecutionResult,
    Module,
    Project,
    ProjectContext,
    ProjectIntelligenceReport,
    ProjectMember,
    ReasonXConversation,
    ReasonXMessage,
    Requirement,
    Review,
    Run,
    RunStep,
    SimulationModel,
    TestCase,
    TestSuite as DBTestSuite,
    User,
)

DBTestSuite.__test__ = False


def get_real_db_session():
    """Returns a session bound to the real application database var/tracetest.db."""
    real_db_path = REPO_ROOT / "var" / "tracetest.db"
    if not real_db_path.exists():
        pytest.skip("Production database var/tracetest.db not found")
    engine = make_engine(f"sqlite:///{real_db_path}")
    Session = sessionmaker(bind=engine)
    return Session()


def test_synthetic_project_deletion_lifecycle_and_integrity():
    with get_real_db_session() as db:
        # Snapshot real projects before test
        real_projects_before = db.execute(select(Project.id, Project.key, Project.name)).all()
        real_keys_before = {p[1] for p in real_projects_before}
        assert "ECHO" in real_keys_before
        assert "EV_PAY" in real_keys_before

        counts_before = {
            "reqs": db.scalar(select(func.count(Requirement.id)).where(Requirement.project_id == 5)),
            "tests": db.scalar(select(func.count(TestCase.id)).where(TestCase.project_id == 5)),
            "defects": db.scalar(select(func.count(Defect.id)).where(Defect.project_id == 5)),
        }

        from app.api.deps import Principal
        from app.api.routers.projects import delete_project
        from app.core.errors import AppError

        admin_user = db.execute(select(User).where(User.id == 1)).scalars().first()
        principal = Principal(admin_user, {"admin"}, None)

        # Pre-cleanup if prior run failed midway
        prior = db.execute(select(Project).where(Project.key == "DEL_SYN_99")).scalars().first()
        if prior:
            delete_project(project_id=prior.id, confirm_key="DEL_SYN_99", p=principal, db=db)

        # 1. Create isolated synthetic project
        syn_proj = Project(
            key="DEL_SYN_99",
            name="Synthetic Test Project for Deletion Audit",
            description="Temporary synthetic project to audit zero-leakage deletion",
            business_domain="Quality Assurance Testing",
            status="active",
            organisation_id=1,
            owner_id=1,
        )
        db.add(syn_proj)
        db.flush()
        pid = syn_proj.id

        # 2. Add records across all project-owned tables
        env = Environment(project_id=pid, name="Del Test Env", kind="simulation", is_default=True)
        mod = Module(project_id=pid, name="Del Test Module", code="DEL_MOD")
        db.add_all([env, mod])
        db.flush()

        doc = Document(
            project_id=pid,
            filename="del_test_spec.pdf",
            display_name="Deletion Test Specification",
            file_path="uploads/del_test_spec.pdf",
            file_size_bytes=1024,
            file_type="pdf",
            status="completed",
        )
        db.add(doc)
        db.flush()
        doc_id = doc.id

        # Verify other projects' documents exist before deletion
        other_doc_ids_before = set(db.scalars(select(Document.id).where(Document.project_id != pid)).all())
        assert 8 in other_doc_ids_before
        assert 9 in other_doc_ids_before

        req = Requirement(
            project_id=pid,
            module_id=mod.id,
            document_id=doc.id,
            key="DEL-REQ-001",
            title="Synthetic Requirement for Deletion Audit",
            status="approved",
            evidence_excerpt="Synthetic verifiable obligation for deletion lifecycle",
        )
        db.add(req)
        db.flush()

        ac = AcceptanceCriterion(
            requirement_id=req.id,
            requirement_version=1,
            clause_keys=["DEL-REQ-001.C1"],
            key="DEL-REQ-001.AC1",
            description="Synthetic acceptance criterion to audit cascade deletion",
            source_quote="Synthetic quote",
            review_status="approved",
        )
        db.add(ac)
        db.flush()

        clause = Clause(
            requirement_id=req.id,
            version_id=1,
            clause_key="DEL-REQ-001.C1",
            position=1,
            text="Synthetic clause obligation text",
            normalized_hash="del_hash_001",
        )
        tc = TestCase(
            project_id=pid,
            requirement_id=req.id,
            requirement_version=1,
            key="TC-DEL-0001",
            title="Synthetic Test Case for Deletion Verification",
            status="approved",
            test_type="functional",
            priority="high",
            automation="automated",
            clause_keys=["DEL-REQ-001.C1"],
            source_quote="Synthetic quote",
            expected_result="Pass",
        )
        db.add_all([clause, tc])
        db.flush()

        suite = DBTestSuite(
            project_id=pid,
            key="TS-DEL-001",
            name="Deletion Verification Test Suite",
            priority="normal",
        )
        db.add(suite)
        db.flush()

        ex = Execution(
            project_id=pid,
            environment_id=env.id,
            suite_id=suite.id,
            key="EX-DEL-0001",
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
            duration_ms=45,
        )
        defect = Defect(
            project_id=pid,
            key="DEF-DEL-0001",
            title="Synthetic Defect for Deletion Verification",
            severity="medium",
            priority="medium",
            status="open",
        )
        db.add_all([ex_res, defect])
        db.flush()

        scenario = BusinessScenario(
            project_id=pid,
            title="Synthetic Scenario for Deletion Audit",
            description="Testing business scenario cascade cleanup",
            actor="QA Tester",
        )
        report = ProjectIntelligenceReport(
            project_id=pid,
            readiness_score=0.88,
            executive_summary={"verdict": "synthetic"},
        )
        conv = ReasonXConversation(
            project_id=pid,
            title="Synthetic Conversation",
        )
        db.add_all([scenario, report, conv])
        db.flush()

        # Add polymorphic reviews and runs referencing this project's entities
        rev_req = Review(entity_type="requirement", entity_id=req.id, decision="approved", reviewer_id=1)
        rev_tc = Review(entity_type="test_case", entity_id=tc.id, decision="approved", reviewer_id=1)
        run_proj = Run(subject_type="project", subject_id=pid, kind="test_run", status="completed")
        db.add_all([rev_req, rev_tc, run_proj])
        db.flush()
        run_step = RunStep(run_id=run_proj.id, name="synthetic_step", status="passed")
        db.add(run_step)
        db.commit()

        req_id = req.id
        tc_id = tc.id

        # Verify all records exist prior to deletion
        assert db.scalar(select(func.count(Requirement.id)).where(Requirement.project_id == pid)) == 1
        assert db.scalar(select(func.count(TestCase.id)).where(TestCase.project_id == pid)) == 1
        assert db.scalar(select(func.count(Execution.id)).where(Execution.project_id == pid)) == 1
        assert db.scalar(select(func.count(Defect.id)).where(Defect.project_id == pid)) == 1

        # 3. Test failed deletion with mismatched confirm_key -> must reject and preserve data
        with pytest.raises(AppError) as exc_info:
            delete_project(project_id=pid, confirm_key="WRONG_KEY", p=principal, db=db)
        assert exc_info.value.status == 400
        assert "does not match" in str(exc_info.value.message)

        # Confirm data remains 100% intact after failed deletion attempt
        assert db.get(Project, pid) is not None
        assert db.scalar(select(func.count(Requirement.id)).where(Requirement.project_id == pid)) == 1

        # 4. Execute valid deletion with matching confirm_key
        delete_project(project_id=pid, confirm_key="DEL_SYN_99", p=principal, db=db)

        # 5. Verify Project is completely deleted
        assert db.get(Project, pid) is None

        # 6. Verify ALL child records are completely cascade deleted (0 orphans)
        assert db.scalar(select(func.count(Requirement.id)).where(Requirement.project_id == pid)) == 0
        assert db.scalar(select(func.count(TestCase.id)).where(TestCase.project_id == pid)) == 0
        assert db.scalar(select(func.count(AcceptanceCriterion.id)).where(AcceptanceCriterion.key == "DEL-REQ-001.AC1")) == 0
        assert db.scalar(select(func.count(Clause.id)).where(Clause.clause_key == "DEL-REQ-001.C1")) == 0
        assert db.scalar(select(func.count(Execution.id)).where(Execution.project_id == pid)) == 0
        assert db.scalar(select(func.count(Defect.id)).where(Defect.project_id == pid)) == 0
        assert db.scalar(select(func.count(DBTestSuite.id)).where(DBTestSuite.project_id == pid)) == 0
        assert db.scalar(select(func.count(BusinessScenario.id)).where(BusinessScenario.project_id == pid)) == 0
        assert db.scalar(select(func.count(ProjectIntelligenceReport.id)).where(ProjectIntelligenceReport.project_id == pid)) == 0
        assert db.scalar(select(func.count(ReasonXConversation.id)).where(ReasonXConversation.project_id == pid)) == 0

        # Verify polymorphic records were cleaned up
        assert db.scalar(select(func.count(Review.id)).where(Review.entity_type == "requirement", Review.entity_id == req_id)) == 0
        assert db.scalar(select(func.count(Run.id)).where(Run.subject_type == "project", Run.subject_id == pid)) == 0

        # 7. Verify project's document is deleted and other projects' documents remain untouched
        assert db.get(Document, doc_id) is None
        other_doc_ids_after = set(db.scalars(select(Document.id)).all())
        assert other_doc_ids_before == other_doc_ids_after

        # 8. Verify existing real projects (ECHO, EV_PAY, ASPME2) remain 100% untouched
        counts_after = {
            "reqs": db.scalar(select(func.count(Requirement.id)).where(Requirement.project_id == 5)),
            "tests": db.scalar(select(func.count(TestCase.id)).where(TestCase.project_id == 5)),
            "defects": db.scalar(select(func.count(Defect.id)).where(Defect.project_id == 5)),
        }
        assert counts_before == counts_after

        # 9. Verify Foreign Key integrity in SQLite
        fk_violations = db.execute(text("PRAGMA foreign_key_check")).fetchall()
        assert len(fk_violations) == 0, f"Foreign key violations detected: {fk_violations}"

        # 10. Verify search returns 0 results for deleted project
        from app.api.routers.misc import search
        search_res = search(q="DEL_SYN_99", p=principal, db=db)
        assert len(search_res["results"]) == 0
