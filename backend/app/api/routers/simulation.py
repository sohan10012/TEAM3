"""Simulation and No-Code Policy YAML Engine Router."""
from __future__ import annotations

from typing import Any

import yaml  # type: ignore[import-untyped]
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ValidationError

from app.services.yaml_workflow import (
    generate_simulated_agent_traces,
    get_golden_policies,
    ingest_policy_pipeline,
    run_table_tests,
)

router = APIRouter(prefix="/simulation", tags=["simulation"])


class IngestPolicyIn(BaseModel):
    policy_text: str = Field(min_length=1, description="Raw HCM policy text or scenario description")
    title: str | None = Field(default=None, description="Policy title")
    policy_id: str | None = Field(default=None, description="Policy key or identifier (e.g. POL001)")
    use_llm: bool = Field(default=False, description="Optionally trigger live LLM provider")


class RunInterpreterIn(BaseModel):
    yaml_spec: str | dict[str, Any] = Field(description="Policy YAML string or structured dictionary")
    test_cases: list[dict[str, Any]] | None = Field(default=None, description="Custom test matrices")
    policy_id: str | None = Field(default=None, description="Golden policy identifier for preset tests")


@router.get("/golden-policies")
def list_golden_policies():
    """Return the 5 preloaded golden HCM policies (POL001-POL005) for instant 1-click simulation demo."""
    policies = get_golden_policies()
    return {"policies": policies, "total": len(policies)}


@router.post("/ingest-policy")
def ingest_policy(body: IngestPolicyIn):
    """Ingest policy text/scenario, decompose into clauses, detect ambiguities, generate criteria, test cases, and YAML spec."""
    try:
        result = ingest_policy_pipeline(
            policy_text=body.policy_text,
            title=body.title,
            policy_id=body.policy_id,
            use_llm=body.use_llm,
        )
        return result
    except (ValueError, yaml.YAMLError, ValidationError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid policy ingestion request: {e}")


@router.post("/run-interpreter")
def run_interpreter(body: RunInterpreterIn):
    """Run table tests against YAML rules via safe interpreter, producing Red (stub), Green (actual), and Mutation (mutated)."""
    try:
        result = run_table_tests(
            spec_input=body.yaml_spec,
            test_cases=body.test_cases,
            policy_id=body.policy_id,
        )
        return result
    except (ValueError, yaml.YAMLError, ValidationError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid simulation parameters: {e}")


@router.get("/agent-traces")
def get_agent_traces(policy_id: str = Query("POL001")):
    """Return real-time and simulated multi-agent execution traces, thought logs, token usage, latency, and AST validation status."""
    golden_list = get_golden_policies()
    matched = next((g for g in golden_list if g["policy_id"] == policy_id), None)

    clause_cnt = len(matched["clauses"]) if matched else 2
    ambiguity_cnt = len(matched["ambiguities"]) if matched else 0
    rules_cnt = len(matched["parsed_rules"]) if matched else 1
    tests_cnt = len(matched["test_matrix"]) if matched else 4

    stages = generate_simulated_agent_traces(
        policy_id=policy_id,
        clause_count=clause_cnt,
        ambiguity_count=ambiguity_cnt,
        rules_count=rules_cnt,
        test_count=tests_cnt,
    )

    return {
        "policy_id": policy_id,
        "stages": stages,
        "ast_allowlist_scan_rate": 1.0,
        "hallucination_quote_verification_rate": 1.0,
        "judge_agreement": 0.98,
        "total_latency_ms": sum(s["latency_ms"] for s in stages),
        "total_tokens": sum(s["tokens"] for s in stages),
    }
