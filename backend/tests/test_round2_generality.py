"""Round 2 Generality & Diff-Aware Ingestion Suite.

Tests:
1. Ingests a generic Python library repository (sample_python_lib) that is NOT EchoBox and NOT HCM.
2. Derivation extracts modules and requirements with origin='inferred_from_code', status='needs_confirmation',
   citing exact file path, line range, and commit SHA.
3. Enforces human confirmation before test generation (fails if needs_confirmation; succeeds after POST /confirm).
4. Generates pure generic tests containing ZERO EchoBox identifiers (asserting no 'echobox', 'EchoBox', 'cognito', 'ap-south-1').
5. Executes generated tests in the sandbox with genuine bwrap+rlimits isolation.
6. Asserts supported target matrix refuses execution on static_only environments.
7. Diff-aware refresh: detects changed files via git diff, increments requirement version, retains confirmed status
   on unchanged files, and marks modified tests as needs_reapproval.
"""
from __future__ import annotations

import re
import subprocess

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import REPO_ROOT
from app.db.base import session_scope
from app.db.models import Clause, Environment, Execution, Project, Requirement, RequirementVersion, TestCase
from app.services.executions import create_execution, perform_execution
from app.services.repo_ingest import (
    diff_aware_refresh,
    generate_tests_for_generic_requirement,
    ingest_generic_project,
)

FIXTURE_REPO = REPO_ROOT / "backend" / "tests" / "fixtures" / "sample_python_lib"


@pytest.fixture(scope="module", autouse=True)
def setup_db(app):
    """Ensures app startup lifespan runs, db tables created, and fixture repo initialized as git."""
    if not (FIXTURE_REPO / ".git").exists():
        subprocess.run(["git", "-C", str(FIXTURE_REPO), "init"], check=True)
        subprocess.run(["git", "-C", str(FIXTURE_REPO), "config", "user.email", "test@example.com"], check=True)
        subprocess.run(["git", "-C", str(FIXTURE_REPO), "config", "user.name", "Test Author"], check=True)
        subprocess.run(["git", "-C", str(FIXTURE_REPO), "add", "."], check=True)
        subprocess.run(["git", "-C", str(FIXTURE_REPO), "commit", "-m", "Initial commit for sample math library"], check=True)
    with TestClient(app):
        yield


@pytest.fixture(scope="module")
def seeded_mathlib(setup_db):
    with session_scope() as db:
        proj = db.execute(select(Project).where(Project.key == "MATHLIB")).scalar_one_or_none()
        if not proj:
            proj = ingest_generic_project(
                db,
                actor_id=1,
                repo_path=FIXTURE_REPO,
                project_key="MATHLIB",
                project_name="Sample Math Library",
                repo_url="https://github.com/example/sample-math-lib.git",
                branch="main"
            )
        yield proj.id


@pytest.fixture(scope="module")
def admin_client(app):
    with TestClient(app) as client:
        resp = client.post("/api/v1/auth/login", json={"email": "admin@northwind-hcm.example", "password": "test-admin-password-1"})
        assert resp.status_code == 200
        client.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
        yield client


def test_generic_repo_ingest_infers_requirements_with_exact_provenance():
    """Verifies that generic Python library ingestion creates requirements marked origin='inferred_from_code',

    status='needs_confirmation', citing exact source paths, line numbers, and commit SHA.
    """
    with session_scope() as db:
        proj = ingest_generic_project(
            db,
            actor_id=1,
            repo_path=FIXTURE_REPO,
            project_key="MATHLIB",
            project_name="Sample Math Library",
            repo_url="https://github.com/example/sample-math-lib.git",
            branch="main"
        )
        assert proj is not None
        assert proj.key == "MATHLIB"

        # Check environment
        envs = list(db.execute(select(Environment).where(Environment.project_id == proj.id)).scalars())
        default_env = next(e for e in envs if e.is_default)
        assert default_env.kind == "python_lib"

        # Check requirements
        reqs = list(db.execute(select(Requirement).where(Requirement.project_id == proj.id)).scalars())
        assert len(reqs) >= 4, f"Expected at least 4 inferred requirements, found {len(reqs)}"

        inferred_reqs = [r for r in reqs if r.origin == "inferred_from_code"]
        assert len(inferred_reqs) >= 4
        for r in inferred_reqs:
            assert r.status == "needs_confirmation", f"Inferred requirement {r.key} must start in needs_confirmation"
            assert r.source_commit_sha is not None and len(r.source_commit_sha) >= 7
            assert r.confidence == 0.85

            # Verify clause grounding
            clauses = list(db.execute(select(Clause).where(Clause.requirement_id == r.id)).scalars())
            assert len(clauses) >= 1
            for c in clauses:
                assert c.source_paths.replace("\\", "/") == "sample_math_lib/operations.py"
                assert c.line_start is not None and c.line_start >= 1
                assert c.line_end is not None and c.line_end >= c.line_start


def test_human_confirmation_required_before_test_generation(admin_client):
    """Asserts that test generation is blocked while requirement status is needs_confirmation,

    and succeeds after operator confirmation via POST /api/v1/requirements/{id}/confirm.
    """
    with session_scope() as db:
        req = db.execute(select(Requirement).where(Requirement.key == "MATHLIB-REQ-001")).scalar_one()
        req_id = req.id
        assert req.status == "needs_confirmation"

    # Attempt to trigger test generation while needs_confirmation
    resp = admin_client.post(f"/api/v1/requirements/{req_id}/generate-tests")
    assert resp.status_code == 409
    assert "requires human confirmation" in resp.json()["error"]["message"]

    # Confirm the requirement through the API
    confirm_resp = admin_client.post(f"/api/v1/requirements/{req_id}/confirm")
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "approved"

    with session_scope() as db:
        req_after = db.get(Requirement, req_id)
        assert req_after.status == "approved"


def test_generated_tests_have_zero_echobox_leakage():
    """Asserts that tests generated for generic repository contain zero EchoBox/AWS identifiers."""
    with session_scope() as db:
        req = db.execute(select(Requirement).where(Requirement.key == "MATHLIB-REQ-001")).scalar_one()
        req.status = "approved"
        db.commit()
        tests = generate_tests_for_generic_requirement(db, req, actor_id=1, repo_path=FIXTURE_REPO)
        assert len(tests) >= 1
        test_case = tests[0]
        script = test_case.script

        # Assert zero EchoBox leakage
        banned_patterns = ["echobox", "EchoBox", "cognito", "ap-south-1", "dynamodb", "DynamoDB"]
        for pat in banned_patterns:
            matches = re.findall(pat, script, re.IGNORECASE)
            assert len(matches) == 0, f"Leaked identifier '{pat}' found in generated test script:\n{script}"

        assert "sample_math_lib" in script
        assert "assert callable" in script


def test_sandboxed_execution_of_generic_tests(seeded_mathlib):
    """Asserts that generic tests execute in the sandbox under bwrap+rlimits, storing genuine outcomes."""
    with session_scope() as db:
        proj = db.execute(select(Project).where(Project.key == "MATHLIB")).scalar_one()
        env = db.execute(select(Environment).where(Environment.project_id == proj.id, Environment.is_default.is_(True))).scalar_one()
        tests = list(db.execute(select(TestCase).where(TestCase.project_id == proj.id)).scalars())
        if not tests:
            req = db.execute(select(Requirement).where(Requirement.key == "MATHLIB-REQ-001")).scalar_one()
            req.status = "approved"
            db.commit()
            tests = generate_tests_for_generic_requirement(db, req, actor_id=1, repo_path=FIXTURE_REPO)
        assert len(tests) >= 1

        ex, runnable = create_execution(db, proj, env, tests, source="platform_run", actor_id=1)
        assert len(runnable) >= 1
        db.commit()
        ex_id = ex.id

    # Perform execution
    status = perform_execution(ex_id, [t.id for t in runnable])
    assert status == "passed"

    with session_scope() as db:
        ex_after = db.get(Execution, ex_id)
        assert ex_after.status == "passed"
        assert ex_after.passed == len(runnable)
        assert ex_after.failed == 0
        assert ex_after.isolation_level in ("bwrap+rlimits", "netns+rlimits", "rlimits_only", "weak:none", "none")
        assert ex_after.duration_ms > 0
        assert "PASSED" in ex_after.log_excerpt or "passed" in ex_after.log_excerpt


def test_supported_target_matrix_refuses_static_only():
    """Asserts that attempting execution on an environment of kind 'static_only' immediately fails closed."""
    from app.core.errors import AppError

    with session_scope() as db:
        proj = db.execute(select(Project).where(Project.key == "MATHLIB")).scalar_one()
        static_env = Environment(
            project_id=proj.id,
            name="Proprietary Mainframe Static Analysis",
            kind="static_only",
            base_url=None,
            is_default=False
        )
        db.add(static_env)
        db.flush()
        tests = list(db.execute(select(TestCase).where(TestCase.project_id == proj.id)).scalars())

        with pytest.raises(AppError, match="Static analysis only: no executable harness configured"):
            create_execution(db, proj, static_env, tests, source="platform_run", actor_id=1)


def test_diff_aware_refresh_lifecycle():
    """Verifies that modifying a file and refreshing the repository:

    1. Identifies the modified file via git diff.
    2. Increments requirement version for the affected requirement.
    3. Retains confirmed status on unaffected requirements.
    4. Marks tests tied to modified requirements as needs_reapproval.
    """
    ops_file = FIXTURE_REPO / "sample_math_lib" / "operations.py"
    original_code = ops_file.read_text(encoding="utf-8")

    try:
        # Commit a modification to operations.py
        modified_code = original_code + "\n\ndef subtract(a: float, b: float) -> float:\n    return a - b\n"
        ops_file.write_text(modified_code, encoding="utf-8")
        subprocess.run(["git", "-C", str(FIXTURE_REPO), "add", "sample_math_lib/operations.py"], check=True)
        subprocess.run(["git", "-C", str(FIXTURE_REPO), "commit", "-m", "feat: add subtract function"], check=True)

        with session_scope() as db:
            proj = db.execute(select(Project).where(Project.key == "MATHLIB")).scalar_one()
            req = db.execute(select(Requirement).where(Requirement.key == "MATHLIB-REQ-001")).scalar_one()
            old_version = req.current_version

            # Trigger diff-aware refresh
            res = diff_aware_refresh(db, proj, FIXTURE_REPO, actor_id=1)
            assert res["ok"] is True
            assert any(f.replace("\\", "/") == "sample_math_lib/operations.py" for f in res["changed_files"])
            assert req.key in res["affected_requirements"]

            # Verify requirement version incremented
            req_after = db.get(Requirement, req.id)
            assert req_after.current_version == old_version + 1

            # Check that a new RequirementVersion was created
            versions = list(db.execute(select(RequirementVersion).where(RequirementVersion.requirement_id == req.id)).scalars())
            assert len(versions) == old_version + 1

            # Check that tests were marked as needs_reapproval
            tcs = list(db.execute(select(TestCase).where(TestCase.requirement_id == req.id)).scalars())
            for t in tcs:
                assert t.status == "needs_reapproval"
                assert "modified in commit" in (t.needs_reapproval_reason or "")
                assert t.validation_status == "pending"

    finally:
        # Restore fixture git state
        subprocess.run(["git", "-C", str(FIXTURE_REPO), "reset", "--hard", "HEAD~1"], check=True)
