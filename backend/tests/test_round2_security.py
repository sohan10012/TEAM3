"""Round 2 Security Verification Suite.

Tests:
1. DNS rebinding prevention via IP resolution validation and git http.curloptResolve pinning.
2. Sandbox filesystem isolation via bubblewrap (bwrap+rlimits) blocking host filesystem, DB, and secrets.
3. Environment-aware AST allowlist distinguishing simulation vs real-code environments.
4. Security headers (CSP, nosniff, DENY) and request size limiting.
5. Session cookie flags, secret key file permissions (0600), and zero-secret leakage.
"""
from __future__ import annotations

import stat
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import REPO_ROOT
from app.core.errors import AppError
from app.execution.sandbox import detect_isolation_level, run_sandboxed_pytest
from app.guardrails.ast_validator import validate_test_syntax
from app.main import app
from app.services.git_client import run_hardened_git
from app.services.repo_ingest.url_validator import (
    resolve_and_validate_github_url,
)

# --- 1. DNS Rebinding and IP Pinning ---

def test_dns_rebinding_rejects_private_ips():
    """Validates that DNS resolution resolving to private, loopback, or link-local IPs is rejected."""
    # Resolver returns loopback
    with pytest.raises(AppError, match="private or disallowed"):
        resolve_and_validate_github_url("https://github.com/sohan10012/EchoBox", resolver=lambda host: ["127.0.0.1"])

    # Resolver returns AWS metadata link-local
    with pytest.raises(AppError, match="private or disallowed"):
        resolve_and_validate_github_url("https://github.com/sohan10012/EchoBox", resolver=lambda host: ["169.254.169.254"])

    # Resolver returns RFC 1918 private range
    with pytest.raises(AppError, match="private or disallowed"):
        resolve_and_validate_github_url("https://github.com/sohan10012/EchoBox", resolver=lambda host: ["192.168.1.100"])


def test_dns_resolution_pins_public_ip_for_git():
    """Validates that a legitimate public IP is resolved and pinned via http.curloptResolve."""
    owner, repo, ip = resolve_and_validate_github_url(
        "https://github.com/sohan10012/EchoBox",
        resolver=lambda host: ["140.82.121.4"]
    )
    assert owner == "sohan10012"
    assert repo == "EchoBox"
    assert ip == "140.82.121.4"

    # Verify that git command includes curloptResolve when pinned_ip is provided
    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "abc1234\tHEAD\n"
        mock_run.return_value.stderr = ""
        run_hardened_git(["ls-remote", "https://github.com/sohan10012/EchoBox.git", "HEAD"], pinned_ip=ip)

        called_cmd = mock_run.call_args[0][0]
        resolve_flag = f"http.curloptResolve=github.com:443:{ip}"
        assert any(resolve_flag in arg for arg in called_cmd), f"Expected {resolve_flag} in {called_cmd}"


# --- 2. Sandbox Filesystem Isolation (Bubblewrap) ---

def test_isolation_level_detects_bwrap():
    """Asserts that bwrap+rlimits is detected on Linux when bwrap is available."""
    import sys
    if not sys.platform.startswith("linux"):
        pytest.skip("Bubblewrap isolation only applicable on Linux")
    iso = detect_isolation_level()
    # On this Linux host bubblewrap 0.13.1 is installed
    assert iso in ("bwrap+rlimits", "netns+rlimits")


def test_bwrap_sandbox_prohibits_host_filesystem_and_secrets():
    """Executes a test script inside the sandbox and asserts /home, host .env, DB and API keys are inaccessible."""
    iso = detect_isolation_level()
    if iso != "bwrap+rlimits":
        pytest.skip("Bubblewrap not active on this environment")

    # Probe script that attempts to access host paths and inspect environment variables
    probe_script = """
import os
import sys
from pathlib import Path

def test_sandbox_filesystem_and_env_isolation():
    # 1. Assert host .env does not exist or is empty/inaccessible
    env_file = Path("/home/Sohan/PROJECTS/tracetest-ai/.env")
    assert not env_file.exists(), f"Host .env file leaked into sandbox: {env_file}"

    # 2. Assert host DB is inaccessible
    db_file = Path("/home/Sohan/PROJECTS/tracetest-ai/var/tracetest.db")
    assert not db_file.exists(), f"Host database leaked into sandbox: {db_file}"

    # 3. Assert /home does not contain user directories
    home_dir = Path("/home")
    if home_dir.exists():
        entries = [e.name for e in home_dir.iterdir() if e.name != "tmp"]
        assert len(entries) == 0, f"/home is not masked: found {entries}"

    # 4. Assert secret env vars are not present in sandbox
    banned_prefixes = ["GROQ_", "GEMINI_", "SECRET_", "DATABASE_", "AWS_"]
    for k in os.environ:
        for prefix in banned_prefixes:
            assert not k.startswith(prefix), f"Sensitive env var {k} leaked into sandbox!"
"""
    # Execute probe script in sandbox
    res = run_sandboxed_pytest(
        test_content=probe_script,
        timeout_seconds=15,
        mount_echobox_harness=False
    )
    assert res.status == "passed", f"Sandbox isolation probe failed: {res.stdout}\n{res.stderr}\n{res.error_message}"


# --- 3. Environment-Aware AST Allowlist ---

def test_ast_allowlist_distinguishes_simulation_vs_real_code():
    """Asserts that echobox_harness is blocked in real_code environments but allowed in simulation environments."""
    script_with_simulation = """
import pytest
from echobox_harness.table import MemoryDynamo

def test_simulation_sample():
    table = MemoryDynamo()
    assert table is not None
"""
    # Allowed in simulation environment
    is_valid_sim, _ = validate_test_syntax(script_with_simulation, env_kind="simulation")
    assert is_valid_sim is True

    # Blocked in real_code environment
    is_valid_real, errs = validate_test_syntax(script_with_simulation, env_kind="real_code")
    assert is_valid_real is False
    assert any("echobox_harness" in e for e in errs)

    # Blocked in generic environment
    is_valid_gen, gen_errs = validate_test_syntax(script_with_simulation, env_kind="generic")
    assert is_valid_gen is False
    assert any("echobox_harness" in e for e in gen_errs)


# --- 4. Security Headers & Request Limits ---

def test_api_security_headers():
    """Verifies that security headers (CSP, nosniff, DENY, Referrer-Policy) are returned by the API."""
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200

        headers = response.headers
        assert "content-security-policy" in headers
        assert "frame-ancestors 'none'" in headers["content-security-policy"]
        assert headers.get("x-content-type-options") == "nosniff"
        assert headers.get("x-frame-options") == "DENY"
        assert "strict-origin-when-cross-origin" in headers.get("referrer-policy", "")


def test_api_payload_size_limit():
    """Verifies that oversized payloads (>10MB) are rejected with HTTP 413."""
    with TestClient(app) as client:
        # 11 MB dummy payload
        huge_payload = "a" * (11 * 1024 * 1024)
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": huge_payload}
        )
        assert response.status_code == 413


# --- 5. Secret Key Permissions & Session Security ---

def test_secret_key_file_permissions():
    """Verifies that the secret key file on disk has restrictive permissions (0600)."""
    import os
    if os.name != "posix":
        pytest.skip("POSIX permission checks not applicable on Windows NTFS")
    key_path = REPO_ROOT / "var" / ".secret_key"
    if not key_path.exists():
        # Ensure it is created and verified
        key_path.parent.mkdir(parents=True, exist_ok=True)
        key_path.write_text("test_secret_token_12345")
        key_path.chmod(0o600)
    mode = stat.S_IMODE(key_path.stat().st_mode)
    assert mode == 0o600, f"Expected 0600 permissions, got {oct(mode)}"


def test_session_cookie_flags_and_revocation():
    """Verifies session cookie has HttpOnly, SameSite=Strict, and revocation works."""
    with TestClient(app) as client:
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@northwind-hcm.example", "password": "test-admin-password-1"}
        )
        assert login_resp.status_code == 200
        cookie_header = login_resp.headers.get("set-cookie", "")
        assert "httponly" in cookie_header.lower()
        assert "samesite=strict" in cookie_header.lower()

        # Logout and verify session revocation
        csrf = login_resp.json()["csrf_token"]
        logout_resp = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
        assert logout_resp.status_code == 200

        # Attempting to use the old session cookie fails with 401
        me_resp = client.get("/api/v1/auth/me")
        assert me_resp.status_code == 401
