"""SQLAlchemy 2.x ORM models. SQLite is the only datastore."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utcnow


def _ts() -> Mapped[datetime]:
    return mapped_column(DateTime, default=utcnow, nullable=False)


class Organisation(Base):
    __tablename__ = "organisations"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    created_at: Mapped[datetime] = _ts()


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    title: Mapped[str | None] = mapped_column(String(120))
    password_hash: Mapped[str | None] = mapped_column(String(255))  # None = cannot sign in
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    can_login: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _ts()
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime)
    roles: Mapped[list[UserRole]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)  # admin | qa_engineer | reviewer
    description: Mapped[str] = mapped_column(String(255))


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"))
    user: Mapped[User] = relationship(back_populates="roles")
    role: Mapped[Role] = relationship()


class UserSession(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_token: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = _ts()
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    ip: Mapped[str | None] = mapped_column(String(64))


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    ip: Mapped[str | None] = mapped_column(String(64))
    success: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = _ts()


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(10), unique=True)  # PAY, TNA, LVE, WFS, BEN
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | archived
    project_type: Mapped[str] = mapped_column(String(30), default="requirements_based")  # requirements_based | code_based
    business_domain: Mapped[str] = mapped_column(String(100), default="")
    product_type: Mapped[str] = mapped_column(String(100), default="")
    target_users_and_roles: Mapped[list[Any]] = mapped_column(JSON, default=list)
    objectives: Mapped[list[Any]] = mapped_column(JSON, default=list)
    business_scenarios: Mapped[list[Any]] = mapped_column(JSON, default=list)
    functional_expectations: Mapped[list[Any]] = mapped_column(JSON, default=list)
    non_functional_expectations: Mapped[list[Any]] = mapped_column(JSON, default=list)
    constraints_and_assumptions: Mapped[list[Any]] = mapped_column(JSON, default=list)
    explicit_exclusions: Mapped[list[Any]] = mapped_column(JSON, default=list)
    organisation_id: Mapped[int] = mapped_column(ForeignKey("organisations.id"))
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()
    __table_args__ = (CheckConstraint("status in ('active','archived')", name="ck_project_status"),)


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_role: Mapped[str] = mapped_column(String(40), default="member")
    added_at: Mapped[datetime] = _ts()


class Module(Base):
    __tablename__ = "modules"
    __table_args__ = (UniqueConstraint("project_id", "code"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")


class Environment(Base):
    __tablename__ = "environments"
    __table_args__ = (UniqueConstraint("project_id", "name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(20), default="reference_hcm")  # reference_hcm | web
    hcm_version: Mapped[str | None] = mapped_column(String(10))  # 1.0 | 1.1
    base_url: Mapped[str | None] = mapped_column(String(500))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _ts()


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    file_type: Mapped[str] = mapped_column(String(20))  # pdf | docx | xlsx | txt | md | csv
    file_size_bytes: Mapped[int] = mapped_column(Integer)
    purpose: Mapped[str] = mapped_column(String(40))  # prd | srs | brd | functional_spec | technical_spec | api_doc | business_rules | user_stories | acceptance_criteria | other
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="uploaded", index=True)  # uploaded | processing | completed | failed
    error_message: Mapped[str | None] = mapped_column(Text)
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


class Requirement(Base):
    __tablename__ = "requirements"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(40), unique=True, index=True)  # PAY-REQ-001
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    module_id: Mapped[int | None] = mapped_column(ForeignKey("modules.id", ondelete="SET NULL"))
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    category: Mapped[str] = mapped_column(String(40), default="functional")
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)  # draft|analysed|approved|deprecated
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    source_type: Mapped[str] = mapped_column(String(20), default="manual")  # manual|pdf|txt|md|import
    origin: Mapped[str] = mapped_column(String(30), default="manual")  # documented|inferred_from_code|manual
    source_commit_sha: Mapped[str | None] = mapped_column(String(64))
    source_section: Mapped[str | None] = mapped_column(String(200))
    source_page: Mapped[str | None] = mapped_column(String(50))
    evidence_excerpt: Mapped[str | None] = mapped_column(Text)
    related_scenario: Mapped[str | None] = mapped_column(String(200))
    dependencies: Mapped[list[Any]] = mapped_column(JSON, default=list)
    extraction_provenance: Mapped[str] = mapped_column(String(30), default="explicit_documented")  # explicit_documented | user_provided | ai_inferred
    review_status: Mapped[str] = mapped_column(String(30), default="pending_review", index=True)  # pending_review | confirmed | rejected | needs_clarification | approved
    confidence: Mapped[float | None] = mapped_column(Float)
    analysed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()
    versions: Mapped[list[RequirementVersion]] = relationship(
        back_populates="requirement", order_by="RequirementVersion.version", cascade="all, delete-orphan")


class RequirementVersion(Base):
    """Immutable snapshot. Never updated after insert."""
    __tablename__ = "requirement_versions"
    __table_args__ = (UniqueConstraint("requirement_id", "version"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    business_objective: Mapped[str] = mapped_column(Text, default="")
    content_hash: Mapped[str] = mapped_column(String(64))
    change_summary: Mapped[str] = mapped_column(String(500), default="")
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = _ts()
    requirement: Mapped[Requirement] = relationship(back_populates="versions")
    clauses: Mapped[list[Clause]] = relationship(back_populates="version", order_by="Clause.position")


class Clause(Base):
    __tablename__ = "clauses"
    __table_args__ = (UniqueConstraint("version_id", "clause_key"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("requirement_versions.id", ondelete="CASCADE"), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    clause_key: Mapped[str] = mapped_column(String(60), index=True)  # PAY-REQ-001.C1
    position: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    normalized_hash: Mapped[str] = mapped_column(String(64))
    source_paths: Mapped[str | None] = mapped_column(String(500))
    line_start: Mapped[int | None] = mapped_column(Integer)
    line_end: Mapped[int | None] = mapped_column(Integer)
    ambiguity_flags: Mapped[list[Any]] = mapped_column(JSON, default=list)
    analysis: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)  # rules, missing info, conflicts, questions
    version: Mapped[RequirementVersion] = relationship(back_populates="clauses")


class RequirementClarification(Base):
    __tablename__ = "requirement_clarifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    requirement_id: Mapped[int | None] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(40))  # ambiguity | conflict | missing_acceptance | incomplete_rule | unspecified_boundary | missing_error_handling | unclear_permission | missing_dependency
    question: Mapped[str] = mapped_column(Text)
    context: Mapped[str] = mapped_column(Text, default="")
    impact: Mapped[str] = mapped_column(Text, default="")
    suggested_resolution: Mapped[str | None] = mapped_column(Text)
    user_response: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open | resolved | dismissed
    created_at: Mapped[datetime] = _ts()
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)


class AcceptanceCriterion(Base):
    __tablename__ = "acceptance_criteria"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(60), unique=True)  # PAY-REQ-001.AC1
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    requirement_version: Mapped[int] = mapped_column(Integer)
    clause_keys: Mapped[list[str]] = mapped_column(JSON)
    description: Mapped[str] = mapped_column(Text)
    preconditions: Mapped[str] = mapped_column(Text, default="")
    expected_behaviour: Mapped[str] = mapped_column(Text, default="")
    validation_conditions: Mapped[list[str]] = mapped_column(JSON, default=list)
    source_quote: Mapped[str] = mapped_column(Text)
    quote_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    rationale: Mapped[str] = mapped_column(Text, default="")
    assumptions: Mapped[list[str]] = mapped_column(JSON, default=list)
    review_status: Mapped[str] = mapped_column(String(20), default="pending")
    provider: Mapped[str] = mapped_column(String(40), default="manual")
    model: Mapped[str | None] = mapped_column(String(100))
    actor: Mapped[str | None] = mapped_column(String(100))
    action: Mapped[str | None] = mapped_column(Text)
    input_conditions: Mapped[list[Any]] = mapped_column(JSON, default=list)
    expected_output: Mapped[str | None] = mapped_column(Text)
    business_rules: Mapped[list[Any]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = _ts()


class TestSuite(Base):
    __tablename__ = "test_suites"
    __table_args__ = (UniqueConstraint("project_id", "name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(40), unique=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    module_id: Mapped[int | None] = mapped_column(ForeignKey("modules.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


class SuiteTestCase(Base):
    __tablename__ = "suite_test_cases"
    __table_args__ = (UniqueConstraint("suite_id", "test_case_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    suite_id: Mapped[int] = mapped_column(ForeignKey("test_suites.id", ondelete="CASCADE"), index=True)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)


class TestCase(Base):
    __tablename__ = "test_cases"
    __test__ = False
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(40), unique=True, index=True)  # TC-PAY-0001
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    requirement_version: Mapped[int] = mapped_column(Integer)
    clause_keys: Mapped[list[str]] = mapped_column(JSON)
    ac_keys: Mapped[list[str]] = mapped_column(JSON, default=list)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    preconditions: Mapped[str] = mapped_column(Text, default="")
    test_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    expected_result: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    test_type: Mapped[str] = mapped_column(String(20), default="functional", index=True)
    test_category: Mapped[str] = mapped_column(String(40), default="positive")  # positive | negative | boundary_value | edge_case | input_validation | business_rule | permission_role | security | error_handling | integration
    execution_capability: Mapped[str] = mapped_column(String(40), default="specification_validation")  # specification_validation | simulation | external
    approval_status: Mapped[str] = mapped_column(String(30), default="draft", index=True)  # draft | pending_approval | approved | rejected
    steps_json: Mapped[list[Any]] = mapped_column(JSON, default=list)
    generation_provenance: Mapped[str] = mapped_column(String(50), default="ai_generated")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    source_quote: Mapped[str] = mapped_column(Text, default="")
    quote_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    rationale: Mapped[str] = mapped_column(Text, default="")
    automation: Mapped[str] = mapped_column(String(20), default="pytest")  # pytest|playwright|manual
    script: Mapped[str | None] = mapped_column(Text)
    script_hash: Mapped[str | None] = mapped_column(String(64))
    validation_status: Mapped[str] = mapped_column(String(20), default="pending")  # valid|invalid|pending
    validation_errors: Mapped[list[Any]] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(30), default="pending_review", index=True)
    # pending_review | approved | rejected | changes_requested | needs_reapproval | deprecated
    needs_reapproval_reason: Mapped[str | None] = mapped_column(String(500))
    reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(String(40), default="manual")  # manual|seed_import|groq|gemini|ollama|mock
    model: Mapped[str | None] = mapped_column(String(100))
    duplicate_of: Mapped[str | None] = mapped_column(String(40))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()
    steps: Mapped[list[TestStep]] = relationship(order_by="TestStep.position", cascade="all, delete-orphan")


class TestCaseVersion(Base):
    __tablename__ = "test_case_versions"
    __table_args__ = (UniqueConstraint("test_case_id", "version"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    script_hash: Mapped[str | None] = mapped_column(String(64))
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    change_note: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = _ts()


class TestStep(Base):
    __tablename__ = "test_steps"
    __table_args__ = (UniqueConstraint("test_case_id", "position"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(Text)
    expected: Mapped[str] = mapped_column(Text, default="")


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(30))  # test_case | acceptance_criterion | defect_recommendation
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    entity_version: Mapped[int] = mapped_column(Integer, default=1)
    decision: Mapped[str] = mapped_column(String(30))  # approve|reject|request_changes|edit|assign
    comment: Mapped[str] = mapped_column(Text, default="")
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = _ts()
    __table_args__ = (Index("ix_reviews_entity", "entity_type", "entity_id"),)


class Run(Base):
    """A background workflow run (analysis, generation, execution, evaluation)."""
    __tablename__ = "runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    # queued|running|awaiting_review|completed|failed|degraded|cancelled
    subject_type: Mapped[str | None] = mapped_column(String(30))
    subject_id: Mapped[int | None] = mapped_column(Integer)
    thread_id: Mapped[str | None] = mapped_column(String(80))  # LangGraph thread
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    message: Mapped[str] = mapped_column(String(500), default="")
    result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = _ts()
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)


class RunStep(Base):
    __tablename__ = "run_steps"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20))
    detail: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime] = _ts()
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)


class SimulationModel(Base):
    __tablename__ = "simulation_models"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    version: Mapped[str] = mapped_column(String(20), default="1.0")
    domain: Mapped[str] = mapped_column(String(100), default="")
    definition_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)  # draft | active | deprecated
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


class Execution(Base):
    __tablename__ = "executions"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(40), unique=True)  # EX-000123
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    suite_id: Mapped[int | None] = mapped_column(ForeignKey("test_suites.id", ondelete="SET NULL"), index=True)
    environment_id: Mapped[int] = mapped_column(ForeignKey("environments.id"))
    model_id: Mapped[int | None] = mapped_column(ForeignKey("simulation_models.id", ondelete="SET NULL"))
    execution_type: Mapped[str] = mapped_column(String(30), default="simulation")  # specification_validation | simulation | external | real_code
    run_id: Mapped[int | None] = mapped_column(ForeignKey("runs.id", ondelete="SET NULL"))
    retry_of_id: Mapped[int | None] = mapped_column(ForeignKey("executions.id", ondelete="SET NULL"))
    source: Mapped[str] = mapped_column(String(30), index=True)  # historical_import | platform_run | ci
    runner: Mapped[str] = mapped_column(String(20), default="pytest")
    isolation_level: Mapped[str] = mapped_column(String(30), default="none")  # netns+rlimits|rlimits_only|none
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    # queued|running|passed|failed|error|cancelled|timed_out
    hcm_version: Mapped[str | None] = mapped_column(String(10))
    total: Mapped[int] = mapped_column(Integer, default=0)
    passed: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    errored: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    commit_sha: Mapped[str | None] = mapped_column(String(64))
    branch: Mapped[str | None] = mapped_column(String(200))
    triggered_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    log_excerpt: Mapped[str] = mapped_column(Text, default="")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = _ts()
    __table_args__ = (CheckConstraint(
        "status in ('queued','running','passed','failed','error','cancelled','timed_out')", name="ck_exec_status"),)


class ExecutionResult(Base):
    __tablename__ = "execution_results"
    __table_args__ = (UniqueConstraint("execution_id", "test_case_id"),
                      CheckConstraint("status in ('passed','failed','skipped','error','cancelled','timed_out')",
                                      name="ck_result_status"))
    id: Mapped[int] = mapped_column(primary_key=True)
    execution_id: Mapped[int] = mapped_column(ForeignKey("executions.id", ondelete="CASCADE"), index=True)
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id", ondelete="CASCADE"), index=True)
    test_case_version: Mapped[int] = mapped_column(Integer)
    script_hash: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), index=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(Text, default="")
    stack_trace: Mapped[str] = mapped_column(Text, default="")
    stdout: Mapped[str] = mapped_column(Text, default="")
    failure_analysis: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)


class ExecutionArtifact(Base):
    __tablename__ = "execution_artifacts"
    id: Mapped[int] = mapped_column(primary_key=True)
    execution_id: Mapped[int] = mapped_column(ForeignKey("executions.id", ondelete="CASCADE"), index=True)
    result_id: Mapped[int | None] = mapped_column(ForeignKey("execution_results.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(30))  # log | junit | screenshot | browser_log | script
    path: Mapped[str] = mapped_column(String(500))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    sha256: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = _ts()


class Defect(Base):
    __tablename__ = "defects"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(40), unique=True, index=True)  # DEF-PAY-0001
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(10), index=True)  # critical|high|medium|low
    priority: Mapped[str] = mapped_column(String(10))  # p1..p4
    status: Mapped[str] = mapped_column(String(20), index=True)
    evidence_type: Mapped[str] = mapped_column(String(30), default="manual")  # execution_failure|static_analysis|manual
    source_commit_sha: Mapped[str | None] = mapped_column(String(64))
    approval_status: Mapped[str] = mapped_column(String(20), default="approved")  # recommended|approved|dismissed
    requirement_id: Mapped[int | None] = mapped_column(ForeignKey("requirements.id", ondelete="SET NULL"))
    test_case_id: Mapped[int | None] = mapped_column(ForeignKey("test_cases.id", ondelete="SET NULL"))
    execution_id: Mapped[int | None] = mapped_column(ForeignKey("executions.id", ondelete="SET NULL"))
    execution_result_id: Mapped[int | None] = mapped_column(ForeignKey("execution_results.id", ondelete="SET NULL"))
    expected_result: Mapped[str] = mapped_column(Text, default="")
    actual_result: Mapped[str] = mapped_column(Text, default="")
    reproduction_steps: Mapped[str] = mapped_column(Text, default="")
    error_log: Mapped[str] = mapped_column(Text, default="")
    stack_trace: Mapped[str] = mapped_column(Text, default="")
    ai_analysis: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reporter_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    verified_execution_id: Mapped[int | None] = mapped_column(ForeignKey("executions.id", ondelete="SET NULL"))
    github_issue_url: Mapped[str | None] = mapped_column(String(500))
    github_issue_number: Mapped[int | None] = mapped_column(Integer)
    github_issue_state: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
    __table_args__ = (CheckConstraint(
        "status in ('open','triaged','assigned','in_progress','fixed','ready_for_retest','verified','closed','reopened')",
        name="ck_defect_status"),)


class DefectComment(Base):
    __tablename__ = "defect_comments"
    id: Mapped[int] = mapped_column(primary_key=True)
    defect_id: Mapped[int] = mapped_column(ForeignKey("defects.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = _ts()


class DefectLink(Base):
    __tablename__ = "defect_links"
    __table_args__ = (UniqueConstraint("defect_id", "related_defect_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    defect_id: Mapped[int] = mapped_column(ForeignKey("defects.id", ondelete="CASCADE"), index=True)
    related_defect_id: Mapped[int] = mapped_column(ForeignKey("defects.id", ondelete="CASCADE"))
    link_type: Mapped[str] = mapped_column(String(20), default="related")  # related | duplicate | blocks


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[int | None] = mapped_column(Integer)
    entity_key: Mapped[str | None] = mapped_column(String(60))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    source: Mapped[str] = mapped_column(String(30), default="platform")  # platform | seed_import | ci
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    trace_id: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class ProviderTrace(Base):
    __tablename__ = "provider_traces"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int | None] = mapped_column(ForeignKey("runs.id", ondelete="SET NULL"), index=True)
    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(100))
    slot_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    task: Mapped[str] = mapped_column(String(60))
    prompt_hash: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(20))  # ok | error | invalid_output | cached
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(Text)
    response_text: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _ts()


class EvalRun(Base):
    __tablename__ = "eval_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(100))
    is_fixture: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="running")
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    scenario_count: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    triggered_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    started_at: Mapped[datetime] = _ts()
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)


class EvalResult(Base):
    __tablename__ = "eval_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    eval_run_id: Mapped[int] = mapped_column(ForeignKey("eval_runs.id", ondelete="CASCADE"), index=True)
    scenario_key: Mapped[str] = mapped_column(String(60))
    passed: Mapped[bool] = mapped_column(Boolean)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    notes: Mapped[str] = mapped_column(Text, default="")


class Integration(Base):
    __tablename__ = "integrations"
    __table_args__ = (UniqueConstraint("project_id", "kind"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(30))  # github
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)  # repo, branch (never secrets)
    status: Mapped[str] = mapped_column(String(20), default="not_configured")
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = _ts()


class IntegrationEvent(Base):
    __tablename__ = "integration_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    integration_id: Mapped[int | None] = mapped_column(ForeignKey("integrations.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20))
    request_summary: Mapped[str] = mapped_column(Text, default="")
    response_summary: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = _ts()


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str | None] = mapped_column(String(300))
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _ts()


class AICache(Base):
    __tablename__ = "ai_cache"
    __table_args__ = (UniqueConstraint("prompt_hash", "task"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    prompt_hash: Mapped[str] = mapped_column(String(64))
    task: Mapped[str] = mapped_column(String(60))
    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(100))
    response: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = _ts()
