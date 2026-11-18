"""Pydantic v2 contracts for every structured AI output."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

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
    page: int | str | None = None
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
    rule_id: str = Field(default="BR-001")
    title: str = Field(default="Business Rule")
    description: str = Field(default="")
    rule_type: str = Field(default="business_rule")
    source_document: str = Field(default="")
    source_document_id: int | None = None
    document_checksum: str = ""
    physical_page_number: int = Field(default=1, ge=1)
    printed_page_number: int | str = Field(default=1)
    page_number: int = Field(default=1, ge=1)
    section_title: str = Field(default="")
    subsection_title: str = Field(default="")
    source_char_offset: int | None = None
    clause_ref: str = Field(default="")
    supporting_quote: str = Field(default="")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)
    confidence_breakdown: dict[str, Any] = Field(default_factory=dict)
    confidence_rationale: str = Field(default="")
    evidence_type: Literal["verbatim", "inferred", "user_defined", "unsupported"] = "verbatim"
    inference_rationale: str = Field(default="")
    is_inferred: bool = Field(default=False)
    approval_status: str = Field(default="suggested")

    @model_validator(mode="before")
    @classmethod
    def _normalize_rule(cls, data: Any) -> Any:
        if isinstance(data, dict):
            r_id = str(data.get("rule_id") or data.get("id") or "").strip()
            data["rule_id"] = r_id or "BR-001"
            title = str(data.get("title") or data.get("name") or data.get("rule_name") or "Business Rule").strip()
            data["title"] = title or "Business Rule"
            desc = str(data.get("description") or data.get("summary") or title).strip()
            data["description"] = desc or "Extracted business rule specification."
            data["supporting_quote"] = str(data.get("supporting_quote") or data.get("quote") or data.get("excerpt") or "").strip()
            if "physical_page_number" not in data and "page_number" in data:
                try:
                    data["physical_page_number"] = int(data["page_number"])
                except Exception:
                    data["physical_page_number"] = 1
            if "printed_page_number" not in data and "page_number" in data:
                data["printed_page_number"] = data["page_number"]
            if data.get("is_inferred"):
                data["evidence_type"] = "inferred"
            elif not data.get("evidence_type"):
                data["evidence_type"] = "verbatim"
        return data


class OnboardingRoleOut(BaseModel):
    role_id: str = Field(default="ROLE-001")
    name: str = Field(default="Actor")
    description: str = Field(default="")
    responsibilities: list[str] = Field(default_factory=list)
    restrictions: list[str] = Field(default_factory=list)
    source_document: str = Field(default="")
    citation: str = Field(default="")
    actor_type: Literal["source_defined", "inferred_persona", "user_defined"] = "inferred_persona"
    evidence_type: Literal["verbatim", "inferred", "user_defined", "unsupported"] = "inferred"
    approval_status: str = Field(default="pending")

    @model_validator(mode="before")
    @classmethod
    def _normalize_role(cls, data: Any) -> Any:
        if isinstance(data, dict):
            r_id = str(data.get("role_id") or data.get("id") or "").strip()
            data["role_id"] = r_id or "ROLE-001"
            
            resps = data.get("responsibilities") or data.get("permissions") or []
            if isinstance(resps, str):
                resps = [line.strip("-•* ").strip() for line in resps.split("\n") if line.strip()]
            data["responsibilities"] = resps if isinstance(resps, list) else []

            rests = data.get("restrictions") or []
            if isinstance(rests, str):
                rests = [line.strip("-•* ").strip() for line in rests.split("\n") if line.strip()]
            data["restrictions"] = rests if isinstance(rests, list) else []

            name = str(data.get("name") or data.get("role_name") or data.get("role") or data.get("title") or "").strip()
            if not name or name.lower() in ("stakeholder", "actor", "user", "role"):
                # Infer authentic name from responsibilities or description
                combined_desc = " ".join(data.get("responsibilities", []) + [data.get("description", "")]).lower()
                if "architect" in combined_desc or "strategy" in combined_desc:
                    name = "Cloud Security Architect"
                elif "iam" in combined_desc or "identity" in combined_desc or "privilege" in combined_desc:
                    name = "IAM Administrator"
                elif "incident" in combined_desc or "forensic" in combined_desc or "alert" in combined_desc:
                    name = "SecOps & Incident Responder"
                elif "guest operating system" in combined_desc or "workload" in combined_desc or "developer" in combined_desc:
                    name = "Workload Owner / Developer"
                elif "compliance" in combined_desc or "audit" in combined_desc or "regulatory" in combined_desc:
                    name = "Compliance & Security Auditor"
                else:
                    name = "Systems Operator"
            data["name"] = name
        return data


class OnboardingScenarioOut(BaseModel):
    scenario_id: str = Field(default="SCENARIO-001")
    title: str = Field(default="Operational Scenario")
    description: str = Field(default="")
    regulatory_ref: str = Field(default="")
    actor: str = Field(default="")
    business_rules: list[str] = Field(default_factory=list)
    preconditions: list[str] = Field(default_factory=list)
    steps: list[str] = Field(default_factory=list)
    expected_outcome: str = Field(default="")
    evidence_type: Literal["verbatim", "inferred", "user_defined", "unsupported"] = "inferred"
    inference_rationale: str = Field(default="")
    approval_status: str = Field(default="pending")

    @model_validator(mode="before")
    @classmethod
    def _normalize_scenario(cls, data: Any) -> Any:
        if isinstance(data, dict):
            s_id = str(data.get("scenario_id") or data.get("id") or "").strip()
            data["scenario_id"] = s_id or "SCENARIO-001"
            
            steps = data.get("steps") or []
            if isinstance(steps, str):
                steps = [line.strip("-•* 0123456789.)").strip() for line in steps.split("\n") if line.strip()]
            data["steps"] = steps if isinstance(steps, list) else []

            preconds = data.get("preconditions") or []
            if isinstance(preconds, str):
                preconds = [line.strip("-•* ").strip() for line in preconds.split("\n") if line.strip()]
            data["preconditions"] = preconds if isinstance(preconds, list) else []

            title = str(data.get("title") or data.get("name") or data.get("scenario_name") or data.get("scenario") or "").strip()
            if not title or title.lower() in ("operational scenario", "scenario", "workflow"):
                combined_text = " ".join(data.get("preconditions", []) + data.get("steps", []) + [data.get("expected_outcome", "")]).lower()
                if "account" in combined_text or "isolate" in combined_text:
                    title = "Workload Account Separation & Environment Isolation"
                elif "emergency" in combined_text or "break-glass" in combined_text or "break glass" in combined_text:
                    title = "Emergency Access Management & Break-Glass Governance"
                elif "incident" in combined_text or "remediation" in combined_text or "forensic" in combined_text:
                    title = "Automated Incident Investigation & Threat Containment"
                elif "patch" in combined_text or "vulnerability" in combined_text or "update" in combined_text:
                    title = "Managed Service Security Patching & Vulnerability Management"
                elif "credential" in combined_text or "temporary" in combined_text or "mfa" in combined_text:
                    title = "Temporary Credential Authentication & Least Privilege Enforcement"
                elif "encryption" in combined_text or "transit" in combined_text or "rest" in combined_text:
                    title = "Data Protection at Rest and in Transit via KMS"
                else:
                    title = "Operational Security Workflow"
            data["title"] = title
        return data


class OnboardingCrossDocInsightOut(BaseModel):
    insight_id: str = Field(default="XDOC-001")
    title: str = Field(default="Cross-Document Scope")
    regime_a: str = Field(default="")
    regime_b: str = Field(default="")
    reconciliation: str = Field(default="")
    source_citations: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)
    evidence_type: Literal["verbatim", "inferred", "user_defined", "unsupported"] = "inferred"
    approval_status: str = Field(default="pending")

    @model_validator(mode="before")
    @classmethod
    def _normalize_insight(cls, data: Any) -> Any:
        if isinstance(data, dict):
            i_id = str(data.get("insight_id") or data.get("id") or "").strip()
            data["insight_id"] = i_id or "XDOC-001"
            title = str(data.get("title") or data.get("concept") or data.get("name") or "Harmonized Scope").strip()
            data["title"] = title or "Harmonized Scope"
            recon = str(data.get("reconciliation") or data.get("analysis") or data.get("description") or "").strip()
            data["reconciliation"] = recon
        return data


class OnboardingAnalysisOut(BaseModel):
    detected_domain: str = Field(default="Enterprise Quality Engineering")
    product_overview: str = Field(default="Enterprise specification and governance platform.")
    problem_statement: str = Field(default="Automating requirements verification and quality engineering.")
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

    @model_validator(mode="before")
    @classmethod
    def _normalize_analysis(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        
        proj = data.get("project") or data.get("project_metadata") or {}
        if isinstance(proj, dict):
            if not data.get("detected_domain"):
                data["detected_domain"] = proj.get("domain") or proj.get("detected_domain") or proj.get("business_domain") or ""
            if not data.get("product_overview"):
                data["product_overview"] = proj.get("overview") or proj.get("product_overview") or proj.get("description") or ""
            if not data.get("problem_statement"):
                data["problem_statement"] = proj.get("problem_statement") or proj.get("problem") or ""
            if not data.get("business_goals") and proj.get("goals"):
                data["business_goals"] = proj.get("goals")
            if not data.get("target_users") and proj.get("target_users"):
                data["target_users"] = proj.get("target_users")

        if not data.get("detected_domain"):
            data["detected_domain"] = "Cloud Security Architecture"
        if not data.get("product_overview"):
            data["product_overview"] = "Comprehensive cloud workload security, compliance, and governance architecture."
        if not data.get("problem_statement"):
            data["problem_statement"] = "Establishing robust security controls, continuous detection, and compliance auditing across cloud workloads."

        if not data.get("roles") and data.get("roles_and_responsibilities"):
            data["roles"] = data.get("roles_and_responsibilities")
        elif not data.get("roles") and data.get("actor_personas"):
            data["roles"] = data.get("actor_personas")

        if not data.get("scenarios") and data.get("business_scenarios"):
            data["scenarios"] = data.get("business_scenarios")

        if not data.get("cross_document_insights") and data.get("insights"):
            data["cross_document_insights"] = data.get("insights")

        return data


