"""ReasonX Tool Registry — Typed, allowlisted tools with permission and risk classification."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict[str, Any]
    risk_level: int  # 1: read-only, 2: low-risk draft, 3: persistent write, 4: high impact
    requires_approval: bool
    category: str


TOOL_REGISTRY: dict[str, ToolDefinition] = {
    # -------------------------------------------------------------------------
    # 1. Project Intelligence Tools
    # -------------------------------------------------------------------------
    "get_project_context": ToolDefinition(
        name="get_project_context",
        description="Retrieve comprehensive project metadata, active documents, requirements count, test count, defects, and status.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="project_intelligence",
    ),
    "get_project_overview": ToolDefinition(
        name="get_project_overview",
        description="Retrieve high-level executive health summary including pass rate, requirement coverage, and open defect counts.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="project_intelligence",
    ),
    "get_project_quality_metrics": ToolDefinition(
        name="get_project_quality_metrics",
        description="Retrieve exact quantitative metrics for tests, execution pass rates, traceability coverage, and defect severity breakdown.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="project_intelligence",
    ),
    "get_project_coverage": ToolDefinition(
        name="get_project_coverage",
        description="Retrieve requirement and clause coverage percentages, total covered versus uncovered items.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="project_intelligence",
    ),
    "get_release_readiness": ToolDefinition(
        name="get_release_readiness",
        description="Evaluate formal release readiness (Go/No-Go score, blocking defects, test pass rate, and residual risks).",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="project_intelligence",
    ),

    # -------------------------------------------------------------------------
    # 2. Document & Requirement Tools
    # -------------------------------------------------------------------------
    "list_project_documents": ToolDefinition(
        name="list_project_documents",
        description="List all ingested source documents with filenames, cryptographic SHA-256 hashes, and intake dates.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="requirements",
    ),
    "search_project_documents": ToolDefinition(
        name="search_project_documents",
        description="Search ingested project documentation and extracted clauses by text keywords.",
        parameters={"type": "object", "properties": {"query": {"type": "string", "description": "Search keyword or phrase"}}, "required": ["query"]},
        risk_level=1,
        requires_approval=False,
        category="requirements",
    ),
    "inspect_document_evidence": ToolDefinition(
        name="inspect_document_evidence",
        description="Retrieve exact statutory quote, document name, section title, and page number for a requirement or clause key.",
        parameters={"type": "object", "properties": {"key": {"type": "string", "description": "Requirement key (e.g. AWS-REQ-0001)"}}, "required": ["key"]},
        risk_level=1,
        requires_approval=False,
        category="requirements",
    ),
    "analyze_requirements": ToolDefinition(
        name="analyze_requirements",
        description="Analyze requirement distribution by category, security/business priority, and review status.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="requirements",
    ),
    "identify_requirement_gaps": ToolDefinition(
        name="identify_requirement_gaps",
        description="Identify requirements that lack linked acceptance criteria or have zero associated test cases.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="requirements",
    ),
    "analyze_acceptance_criteria": ToolDefinition(
        name="analyze_acceptance_criteria",
        description="Retrieve and audit Gherkin Given-When-Then acceptance criteria and normative keywords (SHALL, MUST, SHOULD).",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="requirements",
    ),
    "generate_test_cases": ToolDefinition(
        name="generate_test_cases",
        description="Draft executable test case specifications for uncovered acceptance criteria. Returns preview for review.",
        parameters={"type": "object", "properties": {"ac_keys": {"type": "array", "items": {"type": "string"}, "description": "List of ac_keys to generate tests for"}}},
        risk_level=2,
        requires_approval=False,
        category="test_management",
    ),
    "create_test_cases": ToolDefinition(
        name="create_test_cases",
        description="Persist approved test cases into the database with steps, preconditions, and clause linkages. Requires user confirmation.",
        parameters={"type": "object", "properties": {"test_cases": {"type": "array", "items": {"type": "object"}, "description": "List of test case dicts to persist"}}, "required": ["test_cases"]},
        risk_level=3,
        requires_approval=True,
        category="test_management",
    ),

    # -------------------------------------------------------------------------
    # 3. Test Management Tools
    # -------------------------------------------------------------------------
    "list_test_cases": ToolDefinition(
        name="list_test_cases",
        description="List project test cases with approval status, automation readiness, category, priority, and keys.",
        parameters={"type": "object", "properties": {"status": {"type": "string", "description": "Optional status filter (e.g. approved, pending_review)"}}},
        risk_level=1,
        requires_approval=False,
        category="test_management",
    ),
    "get_test_case_details": ToolDefinition(
        name="get_test_case_details",
        description="Retrieve full details for a specific test case including sequential steps, preconditions, and expected results.",
        parameters={"type": "object", "properties": {"test_key_or_id": {"type": "string", "description": "Test case key or ID (e.g. TC-AWS-0001 or 45)"}}, "required": ["test_key_or_id"]},
        risk_level=1,
        requires_approval=False,
        category="test_management",
    ),
    "identify_untested_criteria": ToolDefinition(
        name="identify_untested_criteria",
        description="Find acceptance criteria in the active project that have zero linked test cases.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="test_management",
    ),
    "identify_duplicate_tests": ToolDefinition(
        name="identify_duplicate_tests",
        description="Detect duplicate or overlapping test cases that validate the exact same clause keys.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="test_management",
    ),

    # -------------------------------------------------------------------------
    # 4. Execution Intelligence Tools
    # -------------------------------------------------------------------------
    "get_recent_test_runs": ToolDefinition(
        name="get_recent_test_runs",
        description="List recent execution runs with overall pass, fail, error counts, environment, and execution date.",
        parameters={"type": "object", "properties": {"limit": {"type": "integer", "default": 5}}},
        risk_level=1,
        requires_approval=False,
        category="execution_intelligence",
    ),
    "get_execution_details": ToolDefinition(
        name="get_execution_details",
        description="Retrieve detailed results, environment config, and duration for a specific execution run.",
        parameters={"type": "object", "properties": {"execution_key_or_id": {"type": "string", "description": "Execution key or ID (e.g. EX-AWS-0001 or 15)"}}, "required": ["execution_key_or_id"]},
        risk_level=1,
        requires_approval=False,
        category="execution_intelligence",
    ),
    "get_failed_test_results": ToolDefinition(
        name="get_failed_test_results",
        description="Retrieve all failed or errored test results from the latest execution, including error message, expected vs actual values.",
        parameters={"type": "object", "properties": {"execution_id": {"type": "integer", "description": "Optional execution ID. Defaults to latest."}}},
        risk_level=1,
        requires_approval=False,
        category="execution_intelligence",
    ),
    "analyze_test_failures": ToolDefinition(
        name="analyze_test_failures",
        description="Perform evidence-grounded root-cause investigation on test failures from the latest execution.",
        parameters={"type": "object", "properties": {"execution_id": {"type": "integer", "description": "Optional execution ID"}}},
        risk_level=1,
        requires_approval=False,
        category="execution_intelligence",
    ),
    "compare_execution_runs": ToolDefinition(
        name="compare_execution_runs",
        description="Compare two execution runs side-by-side to identify new failures, fixed regressions, or flakiness.",
        parameters={"type": "object", "properties": {"baseline_id": {"type": "integer"}, "comparison_id": {"type": "integer"}}},
        risk_level=1,
        requires_approval=False,
        category="execution_intelligence",
    ),
    "recommend_regression_tests": ToolDefinition(
        name="recommend_regression_tests",
        description="Recommend an optimized test suite selection for regression testing based on recent defects and critical requirements.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="execution_intelligence",
    ),

    # -------------------------------------------------------------------------
    # 5. Defect Management Tools
    # -------------------------------------------------------------------------
    "list_project_defects": ToolDefinition(
        name="list_project_defects",
        description="List open and resolved defects for the active project with severity, status, linked test cases, and titles.",
        parameters={"type": "object", "properties": {"status": {"type": "string", "description": "Optional status filter (e.g. open, in_triage, resolved)"}}},
        risk_level=1,
        requires_approval=False,
        category="defects",
    ),
    "get_defect_details": ToolDefinition(
        name="get_defect_details",
        description="Retrieve full details for a defect including root cause, reproduction steps, linked test, and verification status.",
        parameters={"type": "object", "properties": {"defect_key_or_id": {"type": "string", "description": "Defect key or ID (e.g. DEF-AWS-0001)"}}, "required": ["defect_key_or_id"]},
        risk_level=1,
        requires_approval=False,
        category="defects",
    ),
    "create_defect": ToolDefinition(
        name="create_defect",
        description="Create a persistent defect record from a confirmed test failure with reproduction steps and severity. Requires user confirmation.",
        parameters={
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Defect title"},
                "description": {"type": "string", "description": "Detailed explanation of defect"},
                "severity": {"type": "string", "enum": ["critical", "high", "medium", "low"], "default": "high"},
                "reproduction_steps": {"type": "string", "description": "Step-by-step reproduction instructions"},
                "linked_test_case_id": {"type": "integer", "description": "ID of failing test case"},
            },
            "required": ["title", "description"],
        },
        risk_level=3,
        requires_approval=True,
        category="defects",
    ),

    # -------------------------------------------------------------------------
    # 6. Policy & Compliance Tools
    # -------------------------------------------------------------------------
    "list_policy_rules": ToolDefinition(
        name="list_policy_rules",
        description="List active regulatory policies, rules, threshold boundaries, and jurisdiction guidelines.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="policy_validation",
    ),
    "validate_policy": ToolDefinition(
        name="validate_policy",
        description="Validate business policy calculation rules against employee payroll or security scenario vectors.",
        parameters={"type": "object", "properties": {"policy_id": {"type": "string", "default": "POL001"}}},
        risk_level=1,
        requires_approval=False,
        category="policy_validation",
    ),

    # -------------------------------------------------------------------------
    # 7. Traceability Governance Tools
    # -------------------------------------------------------------------------
    "get_traceability_matrix": ToolDefinition(
        name="get_traceability_matrix",
        description="Retrieve end-to-end traceability mapping linking requirements to clauses, acceptance criteria, test cases, executions, and defects.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="traceability",
    ),
    "analyze_coverage_gaps": ToolDefinition(
        name="analyze_coverage_gaps",
        description="Inspect uncovered requirements, missing acceptance criteria, and calculate residual risk score.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="traceability",
    ),
    "analyze_change_impact": ToolDefinition(
        name="analyze_change_impact",
        description="Simulate blast-radius impact of modifying a requirement or rule on downstream test cases and past executions.",
        parameters={"type": "object", "properties": {"requirement_key": {"type": "string", "description": "Requirement key to simulate impact for"}}, "required": ["requirement_key"]},
        risk_level=1,
        requires_approval=False,
        category="traceability",
    ),

    # -------------------------------------------------------------------------
    # 8. Reporting & Workflow Tools
    # -------------------------------------------------------------------------
    "generate_quality_report": ToolDefinition(
        name="generate_quality_report",
        description="Generate comprehensive executive intelligence report covering compliance, readiness, defects, and quality trends.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="reporting",
    ),
    "generate_release_readiness_report": ToolDefinition(
        name="generate_release_readiness_report",
        description="Generate formal Go/No-Go release certification report with blocking risks, measured pass rates, and mitigation recommendations.",
        parameters={"type": "object", "properties": {}},
        risk_level=1,
        requires_approval=False,
        category="reporting",
    ),
}

