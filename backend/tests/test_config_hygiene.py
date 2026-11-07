"""Tests for configuration hygiene, environment variable validation, secrets shape checks,
and dual-control reviewer persona switching.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.db.base import session_scope
from app.db.models import TestCase

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_config_loads_from_temp_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Verifies Settings loads custom configuration from an isolated temp .env file."""
    temp_env = tmp_path / ".env"
    temp_env.write_text(
        "TRACETEST_ENV=test\n"
        "TRACETEST_PORT=9000\n"
        "TRACETEST_LLM_MODE=mock\n"
        "GROQ_MODEL=openai/gpt-oss-120b\n"
        "GROQ_FALLBACK_MODEL=openai/gpt-oss-20b\n"
        "GEMINI_MODEL=gemini-2.5-flash\n"
        "GEMINI_FALLBACK_MODEL=gemini-2.5-flash-lite\n"
    )
    # Clear interfering keys from environment so .env is read
    for k in ("TRACETEST_PORT", "GROQ_MODEL", "GROQ_FALLBACK_MODEL", "GEMINI_MODEL", "GEMINI_FALLBACK_MODEL"):
        monkeypatch.delenv(k, raising=False)

    s = Settings(_env_file=str(temp_env))
    assert s.app_env == "test"
    assert s.bind_port == 9000
    assert s.llm_mode == "mock"
    assert s.groq_model == "openai/gpt-oss-120b"
    assert s.groq_fallback_model == "openai/gpt-oss-20b"
    assert s.gemini_model == "gemini-2.5-flash"
    assert s.gemini_fallback_model == "gemini-2.5-flash-lite"


def test_config_rejects_invalid_key_shape_without_logging(monkeypatch: pytest.MonkeyPatch) -> None:
    """Validates that keys with whitespace fail validation cleanly without echoing values."""
    monkeypatch.setenv("GROQ_API_KEY", "corrupted key with spaces")
    with pytest.raises(ValidationError) as exc:
        Settings()
    err_str = str(exc.value)
    assert "credential cannot contain internal whitespace" in err_str
    # Ensure raw secret is not dumped in error message
    assert "corrupted key with spaces" not in err_str


def test_config_production_mode_invariants(monkeypatch: pytest.MonkeyPatch) -> None:
    """Production mode must refuse default secret key and refuse single-operator mode."""
    # 1. Default secret key refused in prod
    monkeypatch.setenv("TRACETEST_ENV", "production")
    monkeypatch.setenv("TRACETEST_SECRET_KEY", "change-me-in-env")
    monkeypatch.setenv("TRACETEST_SINGLE_OPERATOR", "false")
    s1 = Settings()
    with pytest.raises(ValueError, match="Production mode requires an explicit TRACETEST_SECRET_KEY"):
        s1.validate_security_invariants()

    # 2. Single-operator refused in prod
    monkeypatch.setenv("TRACETEST_SECRET_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
    monkeypatch.setenv("TRACETEST_SINGLE_OPERATOR", "true")
    s2 = Settings()
    with pytest.raises(ValueError, match="Production mode refuses TRACETEST_SINGLE_OPERATOR=true"):
        s2.validate_security_invariants()


def test_config_single_operator_loopback_binding(monkeypatch: pytest.MonkeyPatch) -> None:
    """Single operator mode must fail closed if bound to non-loopback interfaces."""
    monkeypatch.setenv("TRACETEST_ENV", "development")
    monkeypatch.setenv("TRACETEST_SINGLE_OPERATOR", "true")
    monkeypatch.setenv("TRACETEST_HOST", "0.0.0.0")
    s = Settings()
    with pytest.raises(ValueError, match="Single-operator mode allows loopback binding only"):
        s.validate_security_invariants()


def test_config_warns_on_unknown_tracetest_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Detects and reports unknown TRACETEST_* variables."""
    monkeypatch.setenv("TRACETEST_UNKNOWN_SPECIAL_FLAG", "1")
    unknown = Settings.check_unknown_env()
    assert "TRACETEST_UNKNOWN_SPECIAL_FLAG" in unknown


def test_all_code_env_vars_in_example_and_docs() -> None:
    """Ensures that every environment variable defined in Settings or read in code

    is documented in .env.example and docs/ENGINEERING_OPERATIONS.md to prevent documentation drift.
    """
    example_text = (REPO_ROOT / ".env.example").read_text()
    docs_text = (REPO_ROOT / "docs" / "ENGINEERING_OPERATIONS.md").read_text()

    # Extract all aliases and field names from Settings
    for field in Settings.model_fields.values():
        var_name = field.alias or field.name
        if var_name.startswith("TRACETEST_") or var_name in (
            "GROQ_API_KEY", "GROQ_API_KEY2", "GROQ_API_KEY3", "GROQ_MODEL", "GROQ_FALLBACK_MODEL", "GROQ_BASE_URL",
            "GEMINI_API_KEY", "GEMINI_API_KEY2", "GEMINI_API_KEY3", "GEMINI_MODEL", "GEMINI_FALLBACK_MODEL",
            "OLLAMA_BASE_URL", "OLLAMA_MODEL", "GITHUB_TOKEN", "GITHUB_API_URL",
        ):
            assert var_name in example_text, f"{var_name} missing from .env.example"
            assert var_name in docs_text, f"{var_name} missing from docs/ENGINEERING_OPERATIONS.md"

    # Specific additional code variables
    for extra in ("TRACETEST_CI_TOKEN", "TRACETEST_URL"):
        assert extra in example_text, f"{extra} missing from .env.example"
        assert extra in docs_text, f"{extra} missing from docs/ENGINEERING_OPERATIONS.md"


def test_dual_control_reviewer_switch(anon) -> None:
    """Verifies that the /switch-operator endpoint toggles identity and enforces four-eyes approval."""
    # 1. Switch to operator persona
    res_op = anon.post("/auth/switch-operator", json={"persona": "operator"})
    assert res_op.status_code == 200
    me_op = res_op.json()
    assert me_op["persona"] == "operator"
    op_user_id = me_op["user"]["id"]
    anon.csrf = me_op["csrf_token"]

    # 2. Find or create a test case created by the operator
    tc_id = None
    with session_scope() as db:
        tc = db.query(TestCase).filter_by(status="pending_review").first()
        if not tc:
            tc = db.query(TestCase).first()
            if tc:
                tc.status = "pending_review"
        if tc:
            tc_id = tc.id
            tc.created_by = op_user_id
            tc.validation_status = "valid"

    assert tc_id is not None
    # Attempting to approve own test as operator must be rejected with 403
    res_reject = anon.post(f"/tests/{tc_id}/review", json={"decision": "approve", "comment": "self review"})
    assert res_reject.status_code == 403
    assert "Authors cannot approve their own tests" in res_reject.json()["error"]["message"]

    # 3. Switch to reviewer persona
    res_rev = anon.post("/auth/switch-operator", json={"persona": "reviewer"})
    assert res_rev.status_code == 200
    me_rev = res_rev.json()
    assert me_rev["persona"] == "reviewer"
    assert me_rev["user"]["id"] != op_user_id
    anon.csrf = me_rev["csrf_token"]

    # 4. Reviewer approves successfully
    res_approve = anon.post(f"/tests/{tc_id}/review", json={"decision": "approve", "comment": "Compliant four-eyes approval"})
    assert res_approve.status_code == 200
    assert res_approve.json()["status"] == "approved"
