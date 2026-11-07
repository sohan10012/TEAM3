"""Application configuration loaded from environment variables."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        env_prefix="",
        extra="ignore",
        hide_input_in_errors=True,
        populate_by_name=True,
    )

    app_env: str = Field("development", alias="TRACETEST_ENV")
    data_dir: Path = Field(REPO_ROOT / "var", alias="TRACETEST_DATA_DIR")
    secret_key: str = Field("change-me-in-env", alias="TRACETEST_SECRET_KEY")
    session_hours: int = Field(12, alias="TRACETEST_SESSION_HOURS")
    cookie_secure: bool = Field(False, alias="TRACETEST_COOKIE_SECURE")
    cors_origins: str = Field("http://localhost:5173", alias="TRACETEST_CORS_ORIGINS")
    bind_host: str = Field("127.0.0.1", alias="TRACETEST_HOST")
    bind_port: int = Field(8000, alias="TRACETEST_PORT")
    allowed_hosts: str = Field("localhost,127.0.0.1,[::1],testserver", alias="TRACETEST_ALLOWED_HOSTS")
    require_network_isolation: bool = Field(True, alias="TRACETEST_REQUIRE_NETWORK_ISOLATION")
    allow_weak_sandbox: bool = Field(False, alias="TRACETEST_ALLOW_WEAK_SANDBOX")
    seed_on_startup: bool = Field(False, alias="TRACETEST_SEED_ON_STARTUP")
    rate_limit_per_minute: int = Field(600, alias="TRACETEST_RATE_LIMIT_PER_MINUTE")
    single_operator: bool = Field(True, alias="TRACETEST_SINGLE_OPERATOR")

    admin_email: str = Field("admin@dayforce-qa.local", alias="TRACETEST_ADMIN_EMAIL")
    qa_email: str = Field("qa.engineer@dayforce-qa.local", alias="TRACETEST_QA_EMAIL")
    reviewer_email: str = Field("reviewer@dayforce-qa.local", alias="TRACETEST_REVIEWER_EMAIL")
    dev_email: str = Field("dev@dayforce-qa.local", alias="TRACETEST_DEV_EMAIL")

    # LLM providers
    llm_mode: str = Field("live", alias="TRACETEST_LLM_MODE")  # live | mock
    primary_provider: str = Field("groq", alias="TRACETEST_PRIMARY_PROVIDER")
    judge_provider: str = Field("gemini", alias="TRACETEST_JUDGE_PROVIDER")
    judge_model: str = Field("gemini-3.1-flash-lite", alias="TRACETEST_JUDGE_MODEL")
    groq_api_key: str | None = Field(None, alias="GROQ_API_KEY")
    groq_api_key2: str | None = Field(None, alias="GROQ_API_KEY2")
    groq_api_key3: str | None = Field(None, alias="GROQ_API_KEY3")
    groq_key: str | None = Field(None, alias="GROQ_KEY")
    groq_key2: str | None = Field(None, alias="GROQ_KEY2")
    groq_key3: str | None = Field(None, alias="GROQ_KEY3")
    groq_model: str = Field("qwen/qwen3.8-27b", alias="GROQ_MODEL")
    groq_fallback_model: str = Field("openai/gpt-oss-120b", alias="GROQ_FALLBACK_MODEL")
    groq_base_url: str = Field("https://api.groq.com/openai/v1", alias="GROQ_BASE_URL")
    groq_concurrency_per_slot: int = Field(2, alias="GROQ_CONCURRENCY_PER_SLOT")

    gemini_api_key: str | None = Field(None, alias="GEMINI_API_KEY")
    gemini_api_key2: str | None = Field(None, alias="GEMINI_API_KEY2")
    gemini_api_key3: str | None = Field(None, alias="GEMINI_API_KEY3")
    gemini_key: str | None = Field(None, alias="GEMINI_KEY")
    gemini_key2: str | None = Field(None, alias="GEMINI_KEY2")
    gemini_key3: str | None = Field(None, alias="GEMINI_KEY3")
    gemini_model: str = Field("gemini-3.1-flash-lite", alias="GEMINI_MODEL")
    gemini_fallback_model: str = Field("gemini-flash-lite-latest", alias="GEMINI_FALLBACK_MODEL")

    ollama_base_url: str | None = Field(None, alias="OLLAMA_BASE_URL")
    ollama_model: str = Field("llama3.1", alias="OLLAMA_MODEL")
    llm_timeout_seconds: float = Field(60, alias="TRACETEST_LLM_TIMEOUT")
    llm_max_retries: int = Field(2, alias="TRACETEST_LLM_MAX_RETRIES")

    @property
    def groq_keys(self) -> list[str]:
        res: list[str] = []
        for val in (self.groq_api_key, self.groq_key, self.groq_api_key2, self.groq_key2, self.groq_api_key3, self.groq_key3):
            if val and val.strip() and val.strip() not in res:
                res.append(val.strip())
        return res

    @property
    def gemini_keys(self) -> list[str]:
        res: list[str] = []
        for val in (self.gemini_api_key, self.gemini_key, self.gemini_api_key2, self.gemini_key2, self.gemini_api_key3, self.gemini_key3):
            if val and val.strip() and val.strip() not in res:
                res.append(val.strip())
        return res

    # Execution sandbox
    exec_timeout_seconds: int = Field(60, alias="TRACETEST_EXEC_TIMEOUT")
    exec_max_output_bytes: int = Field(256_000, alias="TRACETEST_EXEC_MAX_OUTPUT")
    exec_memory_mb: int = Field(512, alias="TRACETEST_EXEC_MEMORY_MB")
    playwright_target_url: str | None = Field(None, alias="TRACETEST_PLAYWRIGHT_TARGET_URL")
    chromium_executable: str | None = Field("/usr/bin/chromium", alias="TRACETEST_CHROMIUM_EXECUTABLE")

    # GitHub
    github_token: str | None = Field(None, alias="GITHUB_TOKEN")
    github_api_url: str = Field("https://api.github.com", alias="GITHUB_API_URL")

    @field_validator(
        "groq_api_key", "groq_api_key2", "groq_api_key3",
        "gemini_api_key", "gemini_api_key2", "gemini_api_key3",
        "github_token",
        mode="after"
    )
    @classmethod
    def _validate_key_shape(cls, v: str | None, info) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            return None
        if any(c.isspace() for c in stripped):
            name = info.field_name or "credential"
            raise ValueError(f"Invalid shape for {name}: credential cannot contain internal whitespace")
        return stripped

    @classmethod
    def check_unknown_env(cls) -> list[str]:
        known_aliases = {
            field.alias for field in cls.model_fields.values() if field.alias
        }
        known_names = set(cls.model_fields.keys()) | known_aliases | {"TRACETEST_CI_TOKEN", "TRACETEST_URL"}
        unknown = []
        for k in os.environ:
            if k.startswith("TRACETEST_") and k not in known_names:
                unknown.append(k)
        if unknown:
            import sys
            for u in unknown:
                print(f"[TraceTest AI Config Warning] Unknown environment variable: {u}", file=sys.stderr)
        return unknown

    @field_validator("data_dir", mode="after")
    @classmethod
    def _absolute(cls, v: Path) -> Path:
        return v if v.is_absolute() else (REPO_ROOT / v).resolve()

    @property
    def db_path(self) -> Path:
        return self.data_dir / "tracetest.db"

    @property
    def checkpoint_db_path(self) -> Path:
        return self.data_dir / "workflow_checkpoints.db"

    @property
    def artifacts_dir(self) -> Path:
        return self.data_dir / "artifacts"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def backups_dir(self) -> Path:
        return self.data_dir / "backups"

    @property
    def is_dev(self) -> bool:
        return self.app_env in ("development", "test")

    def validate_security_invariants(self) -> None:
        """Enforce strict environment and security boundaries."""
        if self.app_env == "production":
            if self.secret_key in ("change-me-in-env", "test-secret", ""):
                raise ValueError(
                    "Production mode requires an explicit TRACETEST_SECRET_KEY. Cannot run with default or empty key."
                )
            if self.single_operator:
                raise ValueError(
                    "Production mode refuses TRACETEST_SINGLE_OPERATOR=true. Operator authentication is mandatory in production."
                )
        if self.single_operator:
            loopback = {"127.0.0.1", "::1", "localhost", "testserver"}
            host = self.bind_host.strip().lower()
            if host not in loopback:
                raise ValueError(
                    f"TRACETEST_SINGLE_OPERATOR is enabled but TRACETEST_HOST is '{self.bind_host}'. "
                    f"Single-operator mode allows loopback binding only (127.0.0.1, ::1, localhost) "
                    f"to prevent exposing an unauthenticated administrative API to the local network or internet."
                )


@lru_cache
def get_settings() -> Settings:
    Settings.check_unknown_env()
    s = Settings()
    for d in (s.data_dir, s.artifacts_dir, s.uploads_dir, s.backups_dir):
        d.mkdir(parents=True, exist_ok=True)
    if s.app_env != "production" and s.secret_key == "change-me-in-env":
        secret_file = s.data_dir / ".secret_key"
        if secret_file.exists():
            try:
                secret_file.chmod(0o600)
            except OSError:
                pass
            content = secret_file.read_text().strip()
            if content:
                s.secret_key = content
        if s.secret_key == "change-me-in-env":
            import secrets
            token = secrets.token_hex(32)
            flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
            fd = os.open(str(secret_file), flags, 0o600)
            with os.fdopen(fd, "w") as f:
                f.write(token)
            s.secret_key = token
    if s.app_env != "test":
        s.validate_security_invariants()
    return s
