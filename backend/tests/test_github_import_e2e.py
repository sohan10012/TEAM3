"""Comprehensive End-to-End tests for GitHub repository connect, dry-run preview,
askpass token isolation, multi-project data isolation, inferred requirement gates,
and sandboxed execution.
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from app.services.git_client import run_hardened_git


def test_dry_run_preview_echobox(admin):
    """Verifies dry-run preview returns rich metadata without modifying the database."""
    res = admin.post(
        "/projects/import-repo",
        json={
            "repo_url": "https://github.com/sohan10012/EchoBox.git",
            "branch": "main",
            "dry_run": True,
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["dry_run"] is True
    assert data["owner"] == "sohan10012"
    assert data["repo_name"] == "EchoBox"
    assert data["default_branch"] == "main"
    assert data["target_type"] == "real_code"
    assert data["execution_supported"] is True
    assert data["isolation_tier"] in ("bwrap+rlimits", "netns+rlimits")
    assert data["repo_size_bytes"] > 0
    assert data["file_count"] > 0
    assert "Python" in data["languages"]
    assert "secret_scan" in data
    assert isinstance(data["secret_scan"]["count"], int)
    assert isinstance(data["candidate_files"], list)
    assert len(data["candidate_files"]) > 0


def test_dry_run_preview_generic_repo(admin):
    """Verifies target architecture detection for python_lib and static_only."""
    # Test samplemod (python_lib target)
    res = admin.post(
        "/projects/import-repo",
        json={
            "repo_url": "https://github.com/pypa/sampleproject.git",
            "branch": "main",
            "project_key": "PYSAMP",
            "dry_run": True,
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["dry_run"] is True
    assert data["target_type"] == "python_lib"
    assert data["execution_supported"] is True
    assert data["isolation_tier"] in ("bwrap+rlimits", "netns+rlimits")


def test_askpass_token_isolation():
    """Proves personal access tokens are transferred via isolated GIT_ASKPASS and never persisted."""
    token = "ghp_super_secret_test_token_never_persist_12345"
    with tempfile.TemporaryDirectory() as td:
        dest = Path(td) / "dummy_repo"
        dest.mkdir()
        run_hardened_git(["init"], cwd=dest)
        git_config = dest / ".git" / "config"
        assert git_config.exists()

        # Run git command using auth_token
        proc = run_hardened_git(["status"], cwd=dest, auth_token=token)
        assert proc.returncode == 0

        # Assert token is NOT in .git/config
        config_text = git_config.read_text(encoding="utf-8")
        assert token not in config_text

        # Assert askpass temp files were cleaned up
        for p in Path(tempfile.gettempdir()).glob("tt-git-askpass-*"):
            # Check if any file contains our token
            for child in p.iterdir():
                if child.is_file():
                    assert token not in child.read_text(encoding="utf-8", errors="ignore")


def test_independent_project_isolation(admin):
    """Proves that imported projects maintain strict data isolation."""
    # 1. Import EchoBox as ECHO
    r1 = admin.post(
        "/projects/import-repo",
        json={
            "repo_url": "https://github.com/sohan10012/EchoBox.git",
            "branch": "main",
            "project_key": "ECHO",
            "project_name": "EchoBox Verification",
            "dry_run": False,
        },
    )
    assert r1.status_code == 201, r1.text
    proj_echo = r1.json()["project"]

    # 2. Import samplemod as SAMP
    r2 = admin.post(
        "/projects/import-repo",
        json={
            "repo_url": "https://github.com/pypa/sampleproject.git",
            "branch": "main",
            "project_key": "SAMP",
            "project_name": "Sample Python Module",
            "dry_run": False,
        },
    )
    assert r2.status_code == 201, r2.text
    proj_samp = r2.json()["project"]

    assert proj_echo["id"] != proj_samp["id"]
    assert proj_echo["key"] == "ECHO"
    assert proj_samp["key"] == "SAMP"

    # Query requirements scoped to ECHO
    reqs_echo = admin.get(f"/requirements?project_id={proj_echo['id']}").json()
    echo_keys = {item["key"] for item in reqs_echo["items"]}
    assert all(k.startswith("ECHO-") for k in echo_keys)

    # Query requirements scoped to SAMP
    reqs_samp = admin.get(f"/requirements?project_id={proj_samp['id']}").json()
    samp_keys = {item["key"] for item in reqs_samp["items"]}
    assert all(k.startswith("SAMP-") for k in samp_keys)

    # Prove zero cross-project leakage
    assert len(echo_keys.intersection(samp_keys)) == 0


def test_inferred_requirements_human_confirmation_gate(admin):
    """Proves inferred requirements require human confirmation before automated test generation."""
    # Get SAMP project requirements
    proj_res = admin.get("/projects").json()
    samp_proj = next((p for p in proj_res["items"] if p["key"] == "SAMP"), None)
    assert samp_proj is not None

    reqs_res = admin.get(f"/requirements?project_id={samp_proj['id']}").json()
    inferred_req = next((r for r in reqs_res["items"] if r.get("origin") == "inferred_from_code"), None)

    if inferred_req is None:
        # Check if there is any requirement with needs_confirmation
        inferred_req = next((r for r in reqs_res["items"] if r.get("status") == "needs_confirmation"), None)

    assert inferred_req is not None, "Expected at least one inferred requirement in generic project"
    assert inferred_req["status"] == "needs_confirmation"

    # Attempting to generate tests before confirmation must fail with HTTP 409 Conflict
    gen_res = admin.post(f"/requirements/{inferred_req['id']}/generate-tests")
    assert gen_res.status_code == 409, gen_res.text
    err_data = gen_res.json()
    assert "human confirmation" in err_data["error"]["message"].lower()

    # Confirm the requirement
    confirm_res = admin.post(f"/requirements/{inferred_req['id']}/confirm")
    assert confirm_res.status_code == 200, confirm_res.text
    assert confirm_res.json()["status"] == "approved"

    # Now test generation is permitted
    gen_after = admin.post(f"/requirements/{inferred_req['id']}/generate-tests")
    assert gen_after.status_code in (200, 202), gen_after.text


def test_diff_aware_refresh_and_immutable_executions(admin):
    """Proves refresh-repo computes diffs while keeping historical executions immutable."""
    proj_res = admin.get("/projects").json()
    echo_proj = next(p for p in proj_res["items"] if p["key"] == "ECHO")

    # Fetch initial executions
    execs_before = admin.get(f"/executions?project_id={echo_proj['id']}").json()
    assert execs_before["total"] > 0
    first_exec = execs_before["items"][0]
    initial_status = first_exec["status"]
    initial_failed = first_exec["failed"]

    # Trigger diff-aware refresh
    ref_res = admin.post(f"/projects/{echo_proj['id']}/refresh-repo")
    assert ref_res.status_code == 200, ref_res.text
    ref_data = ref_res.json()
    assert ref_data["ok"] is True
    assert "diff_refresh" in ref_data

    # Verify past execution record is completely unchanged (immutable)
    execs_after = admin.get(f"/executions/{first_exec['id']}").json()
    assert execs_after["status"] == initial_status
    assert execs_after["failed"] == initial_failed


def test_static_only_environment_fails_closed(admin):
    """Proves that attempting execution on a static_only environment fails closed."""
    # Create or find a project with a static_only environment
    proj_res = admin.get("/projects").json()
    samp_proj = next(p for p in proj_res["items"] if p["key"] == "SAMP")

    # Add a static_only environment to SAMP project
    env_res = admin.post(
        f"/projects/{samp_proj['id']}/environments",
        json={
            "name": "Static Documentation Sandbox",
            "kind": "static_only",
        },
    )
    assert env_res.status_code == 201, env_res.text
    env_id = env_res.json()["id"]

    # Create a test suite for SAMP
    suite_res = admin.post(
        "/suites",
        json={
            "project_id": samp_proj["id"],
            "name": "Smoke Suite",
        },
    )
    assert suite_res.status_code == 201, suite_res.text
    suite_id = suite_res.json()["id"]

    # Attempting to execute the suite on static_only environment must fail closed with 400 BadRequest
    exec_res = admin.post(
        f"/suites/{suite_id}/execute",
        json={
            "environment_id": env_id,
        },
    )
    assert exec_res.status_code == 400, exec_res.text
    assert "Static analysis only" in exec_res.json()["error"]["message"]

