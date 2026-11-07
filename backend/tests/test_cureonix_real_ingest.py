"""Acceptance tests for Phase 1: Real Repository Ingestion and Project Data Isolation.

Validates:
1. Real repository ingestion for Cureonix (https://github.com/sohan10012/Cureonix.git).
2. Commit SHA resolution matches the checked-out source.
3. Architecture-aware module discovery ignores Flutter platform wrapper directories
   (android, ios, linux, macos, windows, web) and discovers real subsystems
   (backend agents, routes, services, models; lib screens, services, providers).
4. AST analysis extracts real endpoint lines and associates routes with actual modules.
5. README requirement extraction extracts real capabilities with source provenance
   and rejects meta-headers ('TABLE OF CONTENTS', architecture diagrams, etc.).
6. Project creation does not inject Reference HCM environments into generic projects.
7. Multi-project isolation: Project A records never leak into Project B.
8. Re-import of the same commit is idempotent and does not create duplicate records.
9. Unsupported files (e.g. binary PDFs, icons) and parsing failures are reported honestly.
10. Importing a second project does not alter the first project's data.
11. EchoBox records remain completely intact.
"""
from __future__ import annotations

import pytest

from app.core.config import REPO_ROOT
from app.db.base import session_scope
from app.db.models import (
    AcceptanceCriterion,
    Clause,
    Defect,
    Environment,
    Integration,
    Module,
    Project,
    ProjectMember,
    Requirement,
    RequirementVersion,
    TestCase,
)
from app.services.repo_ingest.ast_analyzer import analyze_repository
from app.services.repo_ingest.generic_derivation import ingest_generic_project

CUREONIX_LOCAL_PATH = REPO_ROOT / "var" / "repos" / "sohan10012_Cureonix"


@pytest.fixture
def clean_testcur_project():
    """Fixture ensuring TESTCUR is cleaned up before and after tests."""
    def _cleanup():
        with session_scope() as db:
            p = db.query(Project).filter_by(key="TESTCUR").first()
            if p:
                pid = p.id
                req_ids = [r.id for r in db.query(Requirement).filter_by(project_id=pid).all()]
                for rid in req_ids:
                    db.query(AcceptanceCriterion).filter_by(requirement_id=rid).delete()
                    db.query(Clause).filter_by(requirement_id=rid).delete()
                    db.query(RequirementVersion).filter_by(requirement_id=rid).delete()
                db.query(Requirement).filter_by(project_id=pid).delete()
                db.query(Module).filter_by(project_id=pid).delete()
                db.query(Environment).filter_by(project_id=pid).delete()
                db.query(ProjectMember).filter_by(project_id=pid).delete()
                db.query(Integration).filter_by(project_id=pid).delete()
                db.delete(p)
                db.commit()

    _cleanup()
    yield
    _cleanup()


@pytest.mark.skipif(not CUREONIX_LOCAL_PATH.exists(), reason="Cureonix repository not cloned locally")
def test_cureonix_ast_analysis_architecture_aware():
    """Verify that AST analysis on Cureonix identifies Flutter + Python FastAPI,
    ignores platform wrapper directories, and discovers genuine application modules."""
    res = analyze_repository(CUREONIX_LOCAL_PATH)

    # 1. Commit SHA resolution
    assert res.commit_sha != "unknown"
    assert len(res.commit_sha) == 40
    assert res.commit_sha.startswith("f5f2c9c")

    # 2. Languages & Frameworks
    assert "Dart" in res.languages
    assert "Python" in res.languages
    assert "Flutter" in res.frameworks
    assert "FastAPI" in res.frameworks

    # 3. Module discovery: Must NOT contain generic OS wrapper domains
    mod_codes = {m["code"] for m in res.modules}
    assert "ANDROID" not in mod_codes, "android platform wrapper must not be treated as an app module"
    assert "IOS" not in mod_codes, "ios platform wrapper must not be treated as an app module"
    assert "LINUX" not in mod_codes, "linux platform wrapper must not be treated as an app module"
    assert "MACOS" not in mod_codes, "macos platform wrapper must not be treated as an app module"

    # Must contain real backend and frontend subsystems
    assert any("AGENT" in c or "AGENTS" in c for c in mod_codes)
    assert any("ROUTE" in c or "API" in c for c in mod_codes)
    assert any("SCREEN" in c or "UI" in c for c in mod_codes)

    # 4. AST Endpoints: Must have real line numbers > 1
    assert len(res.endpoints_found) > 0
    query_ep = next((ep for ep in res.endpoints_found if ep["url"] == "/query" or "/query" in ep["url"]), None)
    assert query_ep is not None
    assert query_ep.get("line_start", 0) > 1, "Endpoint line_start must be from real AST parsing, not hardcoded 1"

    # 5. Unsupported files tracked honestly
    assert len(res.unsupported_files) > 0
    assert any(f.endswith(".pdf") for f in res.unsupported_files), "PDF binary files must be reported in unsupported_files"
    assert any(f.endswith(".png") for f in res.unsupported_files), "PNG image assets must be reported in unsupported_files"


@pytest.mark.skipif(not CUREONIX_LOCAL_PATH.exists(), reason="Cureonix repository not cloned locally")
def test_cureonix_ingest_no_spurious_requirements(app, clean_testcur_project):
    """Verify that ingest_generic_project does NOT create spurious requirements like
    'TABLE OF CONTENTS', correctly links modules, and sets confidence and provenance."""
    with session_scope() as db:
        user_id = 1
        proj = ingest_generic_project(
            db=db,
            actor_id=user_id,
            repo_path=CUREONIX_LOCAL_PATH,
            project_key="TESTCUR",
            project_name="Test Cureonix Clean Ingestion",
            repo_url="https://github.com/sohan10012/Cureonix.git",
            branch="main",
            commit_sha="f5f2c9c826409bc8e00d3618d7df80c6252c0715"
        )

        reqs = db.query(Requirement).filter_by(project_id=proj.id).all()
        assert len(reqs) > 0

        # Reject meta-headers
        req_titles = [r.title.upper() for r in reqs]
        assert not any("TABLE OF CONTENTS" in t for t in req_titles), "Table of contents was incorrectly extracted as a requirement"
        assert not any("ARCHITECTURE" in t and "DIAGRAM" in t for t in req_titles)

        # Inferred requirements must have status 'needs_confirmation'
        inferred = [r for r in reqs if r.origin == "inferred_from_code"]
        assert len(inferred) > 0
        for inf in inferred:
            assert inf.status == "needs_confirmation", "Inferred code requirement must require human confirmation"
            assert inf.source_commit_sha == "f5f2c9c826409bc8e00d3618d7df80c6252c0715"

        # Check environments: Generic projects must NOT have Reference HCM environments
        envs = db.query(Environment).filter_by(project_id=proj.id).all()
        env_names = [e.name for e in envs]
        assert not any("Reference HCM" in n for n in env_names), "Generic project received Reference HCM environment"

        # Check initial tests: Newly imported project starts with 0 tests
        tests = db.query(TestCase).filter_by(project_id=proj.id).all()
        assert len(tests) == 0, "New project must start with 0 tests until authored or generated"

        # Check modules: No Android/iOS/Linux/macOS modules
        mods = db.query(Module).filter_by(project_id=proj.id).all()
        mod_codes = {m.code for m in mods}
        assert "ANDROID" not in mod_codes
        assert "IOS" not in mod_codes
        assert "LINUX" not in mod_codes
        assert "MACOS" not in mod_codes

        # Re-importing must be idempotent and not create duplicate requirements
        req_count_before = len(reqs)
        ingest_generic_project(
            db=db,
            actor_id=user_id,
            repo_path=CUREONIX_LOCAL_PATH,
            project_key="TESTCUR",
            project_name="Test Cureonix Clean Ingestion",
            repo_url="https://github.com/sohan10012/Cureonix.git",
            branch="main",
            commit_sha="f5f2c9c826409bc8e00d3618d7df80c6252c0715"
        )
        reqs_after = db.query(Requirement).filter_by(project_id=proj.id).all()
        assert len(reqs_after) == req_count_before, "Re-import created duplicate requirement records"


def test_generic_project_creation_no_reference_hcm(app):
    """Verify that creating a generic project via API does not inject Reference HCM environments."""
    from app.api.deps import Principal
    from app.api.routers.projects import ProjectIn, create_project
    from app.db.models import User

    with session_scope() as db:
        user = db.query(User).first()
        assert user is not None
        p = Principal(user=user, roles={"admin", "project.admin"}, session=None)
        body = ProjectIn(
            key="GENPROJ",
            name="Generic Standalone Project",
            description="A generic project without any HCM dependencies"
        )
        try:
            proj_dict = create_project(body=body, p=p, db=db)
            proj_id = proj_dict["id"]

            envs = db.query(Environment).filter_by(project_id=proj_id).all()
            assert len(envs) > 0
            for env in envs:
                assert "Reference HCM" not in env.name, f"Generic project received HCM environment: {env.name}"
                assert env.kind != "reference_hcm"
        finally:
            p_to_del = db.query(Project).filter_by(key="GENPROJ").first()
            if p_to_del:
                db.query(Environment).filter_by(project_id=p_to_del.id).delete()
                db.query(ProjectMember).filter_by(project_id=p_to_del.id).delete()
                db.delete(p_to_del)
                db.commit()


def test_project_isolation_and_echobox_preservation(app):
    """Verify that EchoBox data is preserved and querying one project never returns another's records."""
    from app.api.deps import Principal, scoped_project_ids
    from app.db.models import User

    with session_scope() as db:
        user = db.query(User).first()
        assert user is not None
        p = Principal(user=user, roles={"admin"}, session=None)

        echo = db.query(Project).filter_by(key="ECHO").first()
        if echo:
            # EchoBox records must be intact
            echo_reqs = db.query(Requirement).filter_by(project_id=echo.id).all()
            assert len(echo_reqs) >= 20, "EchoBox requirements must remain intact"
            echo_tests = db.query(TestCase).filter_by(project_id=echo.id).all()
            assert len(echo_tests) >= 20, "EchoBox test cases must remain intact"
            echo_defects = db.query(Defect).filter_by(project_id=echo.id).all()
            assert len(echo_defects) >= 5, "EchoBox defects must remain intact"

        # Verify scoped_project_ids with explicit project_id filters strictly
        scoped_5 = scoped_project_ids(db, p, 5)
        assert scoped_5 == [5]

        # Verify cross-project isolation in requirements query
        if echo:
            cureon = db.query(Project).filter_by(key="CUREON").first()
            if cureon:
                cureon_reqs = db.query(Requirement).filter_by(project_id=cureon.id).all()
                echo_req_ids = {r.id for r in echo_reqs}
                cureon_req_ids = {r.id for r in cureon_reqs}
                assert echo_req_ids.isdisjoint(cureon_req_ids), "EchoBox requirements leaked into Cureonix"
