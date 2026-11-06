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
    recommended_priority: Literal["p1", "p2", "p3", "p4"] = "p3"
    defect_title: str = ""
    defect_summary: str = ""

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
