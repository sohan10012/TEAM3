"""Tests for No-Code Policy YAML Engine, Safe Rule Interpreter, and Multi-Agent Simulation Endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.services.yaml_workflow import (
    PolicyYamlSpec,
    RuleSpec,
    evaluate_timesheet,
    get_golden_policies,
    infer_yaml_spec_from_policy,
    ingest_policy_pipeline,
    parse_shifts,
    run_table_tests,
)


def test_rule_spec_and_yaml_roundtrip():
    """Verify that PolicyYamlSpec serializes and deserializes to and from YAML cleanly."""
    rules = [
        RuleSpec(rule_id="RULE-W40", rule_type="weekly_threshold", threshold_hours=40.0, multiplier=1.5),
        RuleSpec(rule_id="RULE-D8", rule_type="daily_threshold", threshold_hours=8.0, multiplier=1.5, max_hours=12.0),
    ]
    spec = PolicyYamlSpec(
        policy_id="POL-TEST",
        policy_name="Test Policy",
        jurisdiction="US-Federal",
        rules=rules,
    )
    yaml_text = spec.to_yaml()
    assert "RULE-W40" in yaml_text
    assert "weekly_threshold" in yaml_text

    loaded = PolicyYamlSpec.from_yaml(yaml_text)
    assert loaded.policy_id == "POL-TEST"
    assert len(loaded.rules) == 2
    assert loaded.rules[0].threshold_hours == 40.0


def test_parse_shifts_validation():
    """Verify that shift inputs are validated and negative numbers are rejected safely."""
    assert parse_shifts(40) == [40.0]
    assert parse_shifts([8, 8, 8, 8, 8]) == [8.0, 8.0, 8.0, 8.0, 8.0]
    assert parse_shifts({"mon": 8, "tue": 10}) == [8.0, 10.0]

    with pytest.raises(ValueError, match="Shift hours cannot be negative"):
        parse_shifts(-5)

    with pytest.raises(ValueError, match="Shift hours cannot be negative"):
        parse_shifts([8, -2, 8])


def test_golden_pol001_weekly_overtime():
    """POL001: Standard FLSA 40h weekly overtime."""
    policies = {p["policy_id"]: p for p in get_golden_policies()}
    pol001 = policies["POL001"]
    spec = PolicyYamlSpec.from_yaml(pol001["yaml_spec"])

    # 40h standard week -> 40 reg, 0 ot
    ev1 = evaluate_timesheet(spec, [8, 8, 8, 8, 8])
    assert ev1.regular_hours == 40.0
    assert ev1.overtime_hours == 0.0
    assert ev1.double_time_hours == 0.0
    assert ev1.equivalent_pay_hours == 40.0

    # 45h overtime week -> 40 reg, 5 ot, pay hours = 40 + (5 * 1.5) = 47.5
    ev2 = evaluate_timesheet(spec, [9, 9, 9, 9, 9])
    assert ev2.regular_hours == 40.0
    assert ev2.overtime_hours == 5.0
    assert ev2.double_time_hours == 0.0
    assert ev2.equivalent_pay_hours == 47.5


def test_golden_pol002_california_daily():
    """POL002: California daily 8h overtime and weekly 40h."""
    policies = {p["policy_id"]: p for p in get_golden_policies()}
    pol002 = policies["POL002"]
    spec = PolicyYamlSpec.from_yaml(pol002["yaml_spec"])

    # 4 days of 10h (40h total) -> each day has 8 reg, 2 OT. Total: 32 reg, 8 OT
    ev1 = evaluate_timesheet(spec, [10, 10, 10, 10])
    assert ev1.regular_hours == 32.0
    assert ev1.overtime_hours == 8.0
    assert ev1.double_time_hours == 0.0
    assert ev1.equivalent_pay_hours == 44.0

    # Single 12h shift -> 8 reg, 4 OT
    ev2 = evaluate_timesheet(spec, [12])
    assert ev2.regular_hours == 8.0
    assert ev2.overtime_hours == 4.0
    assert ev2.double_time_hours == 0.0
    assert ev2.equivalent_pay_hours == 14.0


def test_golden_pol003_california_double_time():
    """POL003: California 8h OT (1.5x) and 12h Double-Time (2.0x)."""
    policies = {p["policy_id"]: p for p in get_golden_policies()}
    pol003 = policies["POL003"]
    spec = PolicyYamlSpec.from_yaml(pol003["yaml_spec"])

    # 14h shift -> 8 reg, 4 OT (8-12h), 2 DT (>12h)
    # Pay hours: 8 + (4 * 1.5) + (2 * 2.0) = 8 + 6 + 4 = 18.0
    ev1 = evaluate_timesheet(spec, [14])
    assert ev1.regular_hours == 8.0
    assert ev1.overtime_hours == 4.0
    assert ev1.double_time_hours == 2.0
    assert ev1.equivalent_pay_hours == 18.0

    # 16h shift -> 8 reg, 4 OT, 4 DT -> 8 + 6 + 8 = 22.0
    ev2 = evaluate_timesheet(spec, [16])
    assert ev2.regular_hours == 8.0
    assert ev2.overtime_hours == 4.0
    assert ev2.double_time_hours == 4.0
    assert ev2.equivalent_pay_hours == 22.0


def test_golden_pol004_cba_35_hour_week():
    """POL004: CBA 35-hour workweek with overtime beyond 35h."""
    policies = {p["policy_id"]: p for p in get_golden_policies()}
    pol004 = policies["POL004"]
    spec = PolicyYamlSpec.from_yaml(pol004["yaml_spec"])

    # 35h -> 35 reg, 0 ot
    ev1 = evaluate_timesheet(spec, [7, 7, 7, 7, 7])
    assert ev1.regular_hours == 35.0
    assert ev1.overtime_hours == 0.0

    # 40h -> 35 reg, 5 ot -> pay hours = 35 + 7.5 = 42.5
    ev2 = evaluate_timesheet(spec, [8, 8, 8, 8, 8])
    assert ev2.regular_hours == 35.0
    assert ev2.overtime_hours == 5.0
    assert ev2.equivalent_pay_hours == 42.5


def test_golden_pol005_heavy_industry_double_time():
    """POL005: Heavy industry 10h threshold with immediate 2.0x double-time."""
    policies = {p["policy_id"]: p for p in get_golden_policies()}
    pol005 = policies["POL005"]
    spec = PolicyYamlSpec.from_yaml(pol005["yaml_spec"])

    # 12h shift -> 10 reg, 0 ot, 2 dt -> pay hours = 10 + (2 * 2.0) = 14.0
    ev1 = evaluate_timesheet(spec, [12])
    assert ev1.regular_hours == 10.0
    assert ev1.overtime_hours == 0.0
    assert ev1.double_time_hours == 2.0
    assert ev1.equivalent_pay_hours == 14.0


def test_red_to_green_and_mutation_verification():
    """Verify that table-driven runner produces Red (stub), Green (actual), and Red (mutation)."""
    policies = {p["policy_id"]: p for p in get_golden_policies()}
    pol001 = policies["POL001"]

    res = run_table_tests(spec_input=pol001["yaml_spec"], policy_id="POL001")

    # 1. Red stub must fail tests that expect overtime
    assert res["red_stub"]["status"] == "FAILED"
    assert res["red_stub"]["failed"] > 0

    # 2. Green actual must pass all tests
    assert res["green_actual"]["status"] == "PASSED"
    assert res["green_actual"]["failed"] == 0
    assert res["green_actual"]["passed"] == res["summary"]["total_tests"]

    # 3. Mutation must be caught (failed tests in mutant)
    assert res["mutation_red"]["status"] == "FAILED"
    assert res["mutation_red"]["mutation_killed"] is True
    assert res["summary"]["red_to_green_verified"] is True
    assert res["summary"]["mutation_detected"] is True


def test_ingest_policy_pipeline():
    """Verify pipeline decomposes clauses, detects ambiguities, and creates YAML spec."""
    policy_text = (
        "Non-exempt employees working in excess of 40 hours in a workweek must receive 1.5x overtime. "
        "Overtime compensation shall be paid promptly as appropriate without undue delay."
    )
    res = ingest_policy_pipeline(policy_text, title="Test FLSA Policy", policy_id="POL-INGEST-01")

    assert res["policy_id"] == "POL-INGEST-01"
    assert len(res["clauses"]) >= 1
    assert any("promptly" in a["term"] or "appropriate" in a["term"] for a in res["ambiguities"])
    assert "rules:" in res["yaml_spec"]
    assert len(res["agent_traces"]) == 9


# ---------------------------------------------------------------------------
# API Router Integration Tests
# ---------------------------------------------------------------------------

def test_api_simulation_golden_policies(app):
    """GET /api/v1/simulation/golden-policies returns POL001 to POL005."""
    client = TestClient(app)
    resp = client.get("/api/v1/simulation/golden-policies")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    policy_ids = [p["policy_id"] for p in data["policies"]]
    assert set(policy_ids) == {"POL001", "POL002", "POL003", "POL004", "POL005"}


def test_api_simulation_ingest_policy(app):
    """POST /api/v1/simulation/ingest-policy decomposes policy and outputs YAML spec."""
    client = TestClient(app)
    body = {
        "policy_text": "Employees working beyond 8 hours daily and 40 hours weekly must receive overtime at 1.5x.",
        "title": "Dual Threshold Policy",
        "policy_id": "POL-TEST-002",
    }
    resp = client.post("/api/v1/simulation/ingest-policy", json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["policy_id"] == "POL-TEST-002"
    assert len(data["clauses"]) > 0
    assert "rules:" in data["yaml_spec"]
    assert len(data["agent_traces"]) == 9


def test_api_simulation_run_interpreter(app):
    """POST /api/v1/simulation/run-interpreter runs Red->Green->Mutation verification."""
    client = TestClient(app)
    policies = {p["policy_id"]: p for p in get_golden_policies()}
    pol001 = policies["POL001"]

    body = {
        "yaml_spec": pol001["yaml_spec"],
        "policy_id": "POL001",
    }
    resp = client.post("/api/v1/simulation/run-interpreter", json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["red_stub"]["status"] == "FAILED"
    assert data["green_actual"]["status"] == "PASSED"
    assert data["mutation_red"]["mutation_killed"] is True
    assert data["summary"]["red_to_green_verified"] is True


def test_api_simulation_agent_traces(app):
    """GET /api/v1/simulation/agent-traces returns 9-stage pipeline traces and metrics."""
    client = TestClient(app)
    resp = client.get("/api/v1/simulation/agent-traces?policy_id=POL001")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["stages"]) == 9
    assert data["ast_allowlist_scan_rate"] == 1.0
    assert data["judge_agreement"] > 0.9


def test_rounding_increment_minutes():
    """Verify that shifts are properly rounded when rounding_increment_minutes > 0."""
    spec = PolicyYamlSpec(
        policy_id="POL-ROUND",
        policy_name="15-minute Rounding Policy",
        rounding_increment_minutes=15,
        rules=[RuleSpec(rule_id="RULE-W40", rule_type="weekly_threshold", threshold_hours=40.0)],
    )
    # 8.1h = 486 min -> nearest 15 min is 480 min = 8.0h
    ev1 = evaluate_timesheet(spec, [8.1])
    assert ev1.total_worked_hours == 8.0
    assert ev1.regular_hours == 8.0

    # 8.2h = 492 min -> nearest 15 min is 495 min = 8.25h
    ev2 = evaluate_timesheet(spec, [8.2])
    assert ev2.total_worked_hours == 8.25


def test_custom_rule_multipliers_and_multiplier_rule_type():
    """Verify that rule-specified multipliers are accurately applied instead of hardcoded 1.5/2.0."""
    # Custom daily overtime with 1.75x
    spec_custom = PolicyYamlSpec(
        policy_id="POL-CUSTOM-MULT",
        policy_name="Custom 1.75x OT Policy",
        rate_base=20.0,
        rules=[RuleSpec(rule_id="RULE-D8", rule_type="daily_threshold", threshold_hours=8.0, multiplier=1.75)],
    )
    # 10h worked -> 8h reg (1.0x) + 2h OT (1.75x) = 8.0 + 3.5 = 11.5 pay hours
    ev = evaluate_timesheet(spec_custom, [10.0])
    assert ev.regular_hours == 8.0
    assert ev.overtime_hours == 2.0
    assert ev.equivalent_pay_hours == 11.5
    assert ev.total_pay_estimate == 230.0  # 11.5 * 20.0

    # Standalone multiplier rule type (e.g. general 1.25x premium)
    spec_mult_rule = PolicyYamlSpec(
        policy_id="POL-GLOBAL-MULT",
        policy_name="Global Hazard Multiplier",
        rate_base=20.0,
        rules=[RuleSpec(rule_id="RULE-M-HAZARD", rule_type="multiplier", multiplier=1.25)],
    )
    ev_mult = evaluate_timesheet(spec_mult_rule, [8.0])
    assert ev_mult.equivalent_pay_hours == 10.0  # 8.0 * 1.25
    assert ev_mult.total_pay_estimate == 200.0


def test_infer_yaml_natural_language_variations():
    """Verify that infer_yaml_spec_from_policy handles various phrasing: after, exceeding, more than, round."""
    text1 = "Employees receive overtime after 8 hours per day and double time after 12 hours. Rate is $30 per hour."
    spec1 = infer_yaml_spec_from_policy(text1)
    assert any(r.rule_type == "daily_threshold" and r.threshold_hours == 8.0 for r in spec1.rules)
    assert any(r.rule_type == "daily_threshold" and r.threshold_hours == 12.0 for r in spec1.rules)
    assert spec1.rate_base == 30.0

    text2 = "Overtime is paid for hours exceeding 37.5 hours per week. Time is rounded to nearest 15 minutes."
    spec2 = infer_yaml_spec_from_policy(text2)
    assert any(r.rule_type == "weekly_threshold" and r.threshold_hours == 37.5 for r in spec2.rules)
    assert spec2.rounding_increment_minutes == 15


def test_api_simulation_run_interpreter_invalid_input(app):
    """POST /api/v1/simulation/run-interpreter returns 400 Bad Request on invalid YAML or negative hours."""
    client = TestClient(app)

    # Invalid YAML syntax
    resp1 = client.post("/api/v1/simulation/run-interpreter", json={"yaml_spec": "invalid: [yaml: {"})
    assert resp1.status_code == 400
    assert "Invalid simulation parameters" in resp1.text

    # Negative hours
    resp2 = client.post(
        "/api/v1/simulation/run-interpreter",
        json={
            "yaml_spec": "policy_id: P1\npolicy_name: Test\nrules: []\n",
            "test_cases": [{"name": "Negative shift", "shifts": [-5], "expected": {}}],
        },
    )
    assert resp2.status_code == 400
    assert "cannot be negative" in resp2.text


def test_parse_shifts_extended_types_and_safety():
    """Verify parse_shifts handles strings, None, and rejects NaN/inf."""
    # None
    assert parse_shifts(None) == []

    # Comma and space separated strings
    assert parse_shifts("8, 8.5, 10, 12") == [8.0, 8.5, 10.0, 12.0]
    assert parse_shifts("8 8 8 8") == [8.0, 8.0, 8.0, 8.0]

    # NaN / Inf rejection
    with pytest.raises(ValueError, match="finite number"):
        parse_shifts(float("nan"))

    with pytest.raises(ValueError, match="finite number"):
        parse_shifts([float("inf")])

    with pytest.raises(ValueError, match="Invalid shift"):
        parse_shifts("not_a_number")


def test_rulespec_boundary_validation():
    """Verify RuleSpec validates non-negative thresholds and positive multipliers."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        RuleSpec(rule_id="R_NEG", rule_type="weekly_threshold", threshold_hours=-5.0)

    with pytest.raises(ValidationError):
        RuleSpec(rule_id="R_ZERO_MULT", rule_type="weekly_threshold", multiplier=0.0)


def test_multi_tier_daily_thresholds():
    """Verify 3-tier daily rules: 8h @ 1.5x, 10h @ 1.75x, 12h @ 2.0x."""
    spec = PolicyYamlSpec(
        policy_id="POL-3TIER",
        policy_name="Three Tier Daily Policy",
        rate_base=20.0,
        rules=[
            RuleSpec(rule_id="RULE-D8", rule_type="daily_threshold", threshold_hours=8.0, max_hours=10.0, multiplier=1.5),
            RuleSpec(rule_id="RULE-D10", rule_type="daily_threshold", threshold_hours=10.0, max_hours=12.0, multiplier=1.75),
            RuleSpec(rule_id="RULE-D12", rule_type="daily_threshold", threshold_hours=12.0, multiplier=2.0),
        ],
    )
    # 14 hours shift:
    # 0 to 8h: regular = 8.0h (1.0x)
    # 8 to 10h: tier 1 = 2.0h @ 1.5x = 3.0 pay hours (OT)
    # 10 to 12h: tier 2 = 2.0h @ 1.75x = 3.5 pay hours (OT)
    # 12 to 14h: tier 3 = 2.0h @ 2.0x = 4.0 pay hours (DT)
    # Total reg = 8.0, OT = 4.0, DT = 2.0, Pay hours = 8.0 + 3.0 + 3.5 + 4.0 = 18.5
    ev = evaluate_timesheet(spec, [14.0])
    assert ev.regular_hours == 8.0
    assert ev.overtime_hours == 4.0
    assert ev.double_time_hours == 2.0
    assert ev.equivalent_pay_hours == 18.5
    assert ev.total_pay_estimate == 370.0  # 18.5 * 20.0


def test_run_table_tests_custom_spec_fallback():
    """Verify run_table_tests dynamically creates passing tests for custom specs without hardcoding 40h."""
    custom_spec = PolicyYamlSpec(
        policy_id="POL-CUSTOM-32H",
        policy_name="Four-Day 32h Week",
        rules=[RuleSpec(rule_id="RULE-W32", rule_type="weekly_threshold", threshold_hours=32.0, multiplier=1.5)],
    )
    # Run with test_cases=None
    res = run_table_tests(spec_input=custom_spec, test_cases=None, policy_id="POL-CUSTOM-32H")
    assert res["green_actual"]["status"] == "PASSED"
    assert res["green_actual"]["failed"] == 0
    assert res["summary"]["red_to_green_verified"] is True
    assert res["summary"]["mutation_detected"] is True

