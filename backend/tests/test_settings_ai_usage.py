"""Tests for Settings Redesign: LLM Token Usage, AI Cost Transparency, and Provider Management."""
from __future__ import annotations

import csv
import io
import json
import pytest

from app.llm.pricing import (
    CURRENT_PRICING_VERSION,
    calculate_cost,
    get_model_pricing,
    list_pricing_catalog,
)


def test_pricing_catalog_integrity():
    """Verify published rate cards, unit prices per million, and pricing version."""
    catalog = list_pricing_catalog()
    assert len(catalog) >= 5, "Catalog should have multiple verified models"

    # Gemini 3.8 Flash
    gemini_flash = get_model_pricing("gemini", "gemini-3.8-flash")
    assert gemini_flash.input_price_per_million == 0.075
    assert gemini_flash.output_price_per_million == 0.30
    assert gemini_flash.cached_input_price_per_million == 0.01875
    assert gemini_flash.pricing_version == CURRENT_PRICING_VERSION

    # Gemini 3.1 Pro Preview
    gemini_pro = get_model_pricing("gemini", "gemini-3.1-pro-preview")
    assert gemini_pro.input_price_per_million == 1.25
    assert gemini_pro.output_price_per_million == 5.00
    assert gemini_pro.cached_input_price_per_million == 0.3125

    # Groq openai/gpt-oss-120b
    groq_oss = get_model_pricing("groq", "openai/gpt-oss-120b")
    assert groq_oss.input_price_per_million == 0.15
    assert groq_oss.output_price_per_million == 0.60
    assert groq_oss.cached_input_price_per_million == 0.075


def test_calculate_cost_accuracy():
    """Verify exact cost calculations for input, output, and cached tokens."""
    # 1M input tokens on Gemini 3.8 Flash = $0.075
    cost, version = calculate_cost("gemini", "gemini-3.8-flash", 1_000_000, 0)
    assert cost == 0.075
    assert version == CURRENT_PRICING_VERSION

    # 1M output tokens on Gemini 3.8 Flash = $0.30
    cost, _ = calculate_cost("gemini", "gemini-3.8-flash", 0, 1_000_000)
    assert cost == 0.30

    # 1M input with 500k cached on Gemini 3.8 Flash
    # 500k regular = 500,000 * 0.075 / 1M = 0.0375
    # 500k cached = 500,000 * 0.01875 / 1M = 0.009375
    # Total = 0.046875
    cost, _ = calculate_cost("gemini", "gemini-3.8-flash", 1_000_000, 0, cached_input_tokens=500_000)
    assert cost == 0.046875

    # Groq openai/gpt-oss-120b: 1M in ($0.15) + 1M out ($0.60) = $0.75
    cost, _ = calculate_cost("groq", "openai/gpt-oss-120b", 1_000_000, 1_000_000)
    assert cost == 0.75


def test_get_ai_usage_analytics_endpoint(admin):
    """Verify GET /api/v1/settings/ai-usage endpoint returns full usage, cost, and breakdowns."""
    res = admin.get("/settings/ai-usage?range=all")
    assert res.status_code == 200
    data = res.json()

    # Summary
    assert "summary" in data
    summary = data["summary"]
    for key in ("total_requests", "total_input_tokens", "total_output_tokens", "total_tokens", "estimated_total_cost_usd", "average_cost_per_request_usd"):
        assert key in summary
        assert summary[key] >= 0

    # Token breakdown
    assert "token_breakdown" in data
    tb = data["token_breakdown"]
    assert "input_tokens" in tb
    assert "output_tokens" in tb
    assert "total_tokens" in tb
    assert tb["reported_by"] == "provider_telemetry"

    # Provider & model breakdown
    assert "by_provider_model" in data
    assert isinstance(data["by_provider_model"], list)
    for m in data["by_provider_model"]:
        assert m["role"] in ("Primary", "Secondary")
        assert "requests" in m
        assert "cost_usd" in m
        assert "input_rate_per_m" in m
        assert "output_rate_per_m" in m

    # Cost over time
    assert "cost_over_time" in data
    assert isinstance(data["cost_over_time"], list)

    # Agent attribution
    assert "by_agent" in data
    for ag in data["by_agent"]:
        assert "agent_name" in ag
        assert "display_name" in ag
        assert "cost_usd" in ag
        assert "percentage_of_cost" in ag

    # Feature attribution
    assert "by_feature" in data
    for ft in data["by_feature"]:
        assert "feature_name" in ft
        assert "display_name" in ft
        assert "cost_usd" in ft

    # Project breakdown
    assert "by_project" in data
    for pj in data["by_project"]:
        assert "project_name" in pj
        assert "cost_usd" in pj

    # Pricing metadata
    assert "pricing_metadata" in data
    assert data["pricing_metadata"]["version"] == CURRENT_PRICING_VERSION


def test_ai_usage_time_and_project_filtering(admin):
    """Verify time range filters and project scoping on AI usage endpoint."""
    # Test time ranges
    for r in ("today", "7d", "30d", "90d", "all"):
        res = admin.get(f"/settings/ai-usage?range={r}")
        assert res.status_code == 200

    # Test invalid range
    res_bad = admin.get("/settings/ai-usage?range=invalid_range")
    assert res_bad.status_code == 422

    # Test non-existent project returns 404
    res_404 = admin.get("/settings/ai-usage?project_id=999999")
    assert res_404.status_code == 404


def test_ai_usage_export_csv_and_json(admin):
    """Verify CSV and JSON export functionality."""
    # CSV Export
    res_csv = admin.get("/settings/ai-usage/export?format=csv&range=all")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "attachment; filename=" in res_csv.headers["content-disposition"]
    csv_text = res_csv.text
    reader = csv.reader(io.StringIO(csv_text))
    header = next(reader)
    assert "Trace ID" in header
    assert "Project Name" in header
    assert "Agent Name" in header
    assert "Cost (USD)" in header

    # JSON Export
    res_json = admin.get("/settings/ai-usage/export?format=json&range=all")
    assert res_json.status_code == 200
    assert "application/json" in res_json.headers["content-type"]
    json_data = res_json.json()
    assert "exported_at" in json_data
    assert "records_count" in json_data
    assert "traces" in json_data


def test_live_provider_health_check_endpoint(admin):
    """Verify live health probe returns clean status without exposing slot secrets or key arrays."""
    # Gemini probe
    res_gem = admin.post("/settings/llm/health-check", json={"provider": "gemini"})
    assert res_gem.status_code == 200
    data_gem = res_gem.json()
    assert data_gem["provider"] == "gemini"
    assert data_gem["role"] == "Primary"
    assert data_gem["status"] in ("healthy", "degraded", "unreachable")
    assert "latency_ms" in data_gem
    assert "verified_at" in data_gem
    assert "slots" not in data_gem, "Zero slot internals must be returned"
    assert "key" not in data_gem

    # Groq probe
    res_groq = admin.post("/settings/llm/health-check", json={"provider": "groq"})
    assert res_groq.status_code == 200
    data_groq = res_groq.json()
    assert data_groq["provider"] == "groq"
    assert data_groq["role"] == "Secondary"
    assert "slots" not in data_groq


def test_clean_providers_summary_endpoint(admin):
    """Verify GET /api/v1/settings/providers lists strictly Gemini and Groq with clean metadata."""
    res = admin.get("/settings/providers")
    assert res.status_code == 200
    data = res.json()
    assert data["primary_provider"] == "gemini"

    providers = data["providers"]
    assert len(providers) == 2
    prov_names = {p["provider"] for p in providers}
    assert prov_names == {"gemini", "groq"}

    for p in providers:
        assert p["role"] in ("Primary", "Secondary")
        assert "slots" not in p, "Slot numbers and credentials must be removed"
        assert "circuit" in p
        assert "pricing_unit" in p


def test_config_sanitization_no_filesystem_leak(admin):
    """Verify /config endpoint does not expose raw user filesystem paths."""
    res = admin.get("/config")
    assert res.status_code == 200
    data = res.json()
    data_dir = data.get("data_dir")
    if data_dir:
        assert not data_dir.startswith("/home/"), "Raw user home path must never be exposed"

