"""Pydantic v2 contracts for every structured AI output."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.domain.enums import FAILURE_CATEGORIES, TEST_TYPES


class ClauseInsight(BaseModel):
    clause_key: str
    business_rules: list[str] = Field(default_factory=list, max_length=10)
    ambiguities: list[str] = Field(default_factory=list, max_length=10)
    missing_information: list[str] = Field(default_factory=list, max_length=10)
    conflicts_with: list[str] = Field(default_factory=list, max_length=10)
    clarifying_questions: list[str] = Field(default_factory=list, max_length=10)
    interpretation: str = ""


class RequirementAnalysis(BaseModel):
    clauses: list[ClauseInsight]
    assumptions: list[str] = Field(default_factory=list)
    summary: str = ""


class AcceptanceCriterionOut(BaseModel):
    clause_keys: list[str] = Field(min_length=1)
    description: str = Field(min_length=10)
    preconditions: str = ""
    expected_behaviour: str = Field(min_length=5)
    validation_conditions: list[str] = Field(default_factory=list)
    source_quote: str = Field(min_length=8)
    confidence: float = Field(ge=0, le=1)
    rationale: str = ""
    assumptions: list[str] = Field(default_factory=list)


class AcceptanceCriteriaBatch(BaseModel):
    criteria: list[AcceptanceCriterionOut] = Field(min_length=1, max_length=20)


class TestStepOut(BaseModel):
    action: str = Field(min_length=3)
    expected: str = ""


class TestCaseOut(BaseModel):
    __test__ = False
    title: str = Field(min_length=5, max_length=300)
    description: str = ""
    clause_keys: list[str] = Field(min_length=1)
    ac_refs: list[int] = Field(default_factory=list, description="1-based indexes of acceptance criteria")
    preconditions: str = ""
    test_data: dict = Field(default_factory=dict)
    steps: list[TestStepOut] = Field(min_length=1, max_length=15)
    expected_result: str = Field(min_length=3)
    priority: Literal["critical", "high", "medium", "low"] = "medium"
    test_type: str
    test_category: str | None = None
    confidence: float = Field(ge=0, le=1)
    source_quote: str = Field(min_length=8)
    rationale: str = ""
    automation: Literal["pytest", "playwright", "manual"] = "pytest"
    script: str | None = None

    @field_validator("test_type")
    @classmethod
    def _tt(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in TEST_TYPES:
            raise ValueError(f"test_type must be one of {TEST_TYPES}")
        return v


class TestCaseBatch(BaseModel):
    __test__ = False
    tests: list[TestCaseOut] = Field(min_length=1, max_length=20)


class FailureAnalysisOut(BaseModel):
    category: str
    observed_facts: list[str] = Field(min_length=1)
    hypotheses: list[str] = Field(default_factory=list)
    probable_cause: str
    suggested_actions: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)
    recommended_severity: Literal["critical", "high", "medium", "low"] = "medium"
    recommended_priority: str = "p3"
    defect_title: str = ""
    defect_summary: str = ""

    @field_validator("recommended_priority")
    @classmethod
    def _pri(cls, v: str) -> str:
        from app.domain.enums import normalize_defect_priority
        try:
            return normalize_defect_priority(v)
        except ValueError:
            return "p3"

    @field_validator("category")
    @classmethod
    def _cat(cls, v: str) -> str:
        v = v.lower().strip().replace(" ", "_")
        if v not in FAILURE_CATEGORIES:
            raise ValueError(f"category must be one of {FAILURE_CATEGORIES}")
        return v


class JudgeIssue(BaseModel):
    category: Literal[
        "ungrounded_assertion",
        "missing_boundary",
        "syntax_error",
        "logic_inconsistency",
        "policy_violation",
        "weak_assertion",
    ]
    severity: Literal["critical", "high", "medium", "low"] = "medium"
    item_type: str = "test_case"
    item_title: str
    description: str
    suggested_correction: str


class JudgeEvaluation(BaseModel):
    requirement_key: str
    has_issues: bool
    issues: list[JudgeIssue] = Field(default_factory=list)
    grounding_score: float = Field(ge=0.0, le=1.0)
    completeness_score: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    summary_verdict: str


class ReasonXEvidence(BaseModel):
    source_document: str = ""
    page: int | None = None
    section: str = ""
    requirement_id: str = ""
    quote: str = ""


class ReasonXResponse(BaseModel):
    direct_answer: str
    explanation: str
    supporting_evidence: list[ReasonXEvidence] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    confidence_level: Literal["HIGH", "MEDIUM", "QUALIFIED"] = "HIGH"
    simplified_summary: str = ""


class OnboardingBusinessRuleOut(BaseModel):
    rule_id: str = Field(min_length=3)
    title: str = Field(min_length=3)
    description: str = Field(min_length=10)
    rule_type: str = Field(default="business_rule")
    source_document: str = Field(default="")
    page_number: int = Field(default=1, ge=1)
    clause_ref: str = Field(default="")
    supporting_quote: str = Field(default="")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)
    is_inferred: bool = Field(default=False)
    approval_status: str = Field(default="suggested")


class OnboardingRoleOut(BaseModel):
    role_id: str = Field(min_length=3)
    name: str = Field(min_length=2)
    description: str = Field(default="")
    responsibilities: list[str] = Field(default_factory=list)
    restrictions: list[str] = Field(default_factory=list)
    source_document: str = Field(default="")
    citation: str = Field(default="")


class OnboardingScenarioOut(BaseModel):
    scenario_id: str = Field(min_length=3)
    title: str = Field(min_length=3)
    description: str = Field(default="")
    regulatory_ref: str = Field(default="")
    preconditions: list[str] = Field(default_factory=list)
    steps: list[str] = Field(default_factory=list)
    expected_outcome: str = Field(default="")


class OnboardingCrossDocInsightOut(BaseModel):
    insight_id: str = Field(min_length=3)
    title: str = Field(min_length=3)
    regime_a: str = Field(default="")
    regime_b: str = Field(default="")
    reconciliation: str = Field(default="")
    source_citations: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)


class OnboardingAnalysisOut(BaseModel):
    detected_domain: str = Field(min_length=2)
    product_overview: str = Field(min_length=10)
    problem_statement: str = Field(min_length=10)
    business_goals: list[str] = Field(default_factory=list)
    target_users: list[str] = Field(default_factory=list)
    product_modules: list[str] = Field(default_factory=list)
    external_integrations: list[str] = Field(default_factory=list)
    security_expectations: str = Field(default="")
    privacy_requirements: str = Field(default="")
    performance_expectations: str = Field(default="")
    availability_expectations: str = Field(default="")
    business_rules: list[OnboardingBusinessRuleOut] = Field(default_factory=list)
    roles: list[OnboardingRoleOut] = Field(default_factory=list)
    scenarios: list[OnboardingScenarioOut] = Field(default_factory=list)
    cross_document_insights: list[OnboardingCrossDocInsightOut] = Field(default_factory=list)


