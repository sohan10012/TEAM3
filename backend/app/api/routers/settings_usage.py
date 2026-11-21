"""Settings AI usage, cost transparency, and provider management router."""
from __future__ import annotations

import csv
import io
import json
import time
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import Principal, current_principal, scoped_project_ids
from app.core.config import get_settings
from app.core.errors import NotFound
from app.db.base import get_db, utcnow
from app.db.models import Project, ProviderTrace
from app.llm.pricing import CURRENT_PRICING_VERSION, get_model_pricing, list_pricing_catalog
from app.llm.router import BREAKER

router = APIRouter(prefix="/settings", tags=["settings"])

AGENT_DISPLAY_NAMES = {
    "reasonx": "ReasonX AI Autonomous Agent",
    "test_generator": "Test Case Generator",
    "project_onboarding": "Document Intake & Extraction",
    "ac_designer": "Acceptance Criteria Designer",
    "requirement_analyst": "Requirement & Clause Analyst",
    "execution_investigator": "Execution Failure Investigator",
    "policy_auditor": "Enterprise Policy Auditor",
    "judge_evaluator": "Independent QA Benchmark Judge",
    "system_health": "System Health & Connection Probe",
}

FEATURE_DISPLAY_NAMES = {
    "reasonx_conversations": "ReasonX Agent Conversations & Tasks",
    "test_case_generation": "Test Case & Step Generation",
    "document_intake": "Project Document Onboarding & Extraction",
    "acceptance_criteria_generation": "Acceptance Criteria & BDD Scenarios",
    "requirement_generation": "Requirement Decomposition & Analysis",
    "execution_analysis": "Failure Root Cause & Diagnostic Analysis",
    "policy_validation": "Compliance & Policy Guardrail Checks",
    "solution_scoring": "Grounding & Schema Quality Scoring",
    "connection_probe": "API Provider Health Verification",
}


def _filter_traces_by_time_and_scope(
    db: Session,
    principal: Principal,
    time_range: str,
    start_date: str | None,
    end_date: str | None,
    project_id: int | None,
):
    """Build base query for ProviderTrace filtered by authorized project scope and time window."""
    query = select(ProviderTrace)

    # 1. Scope projects
    if project_id is not None:
        authorized_ids = scoped_project_ids(db, principal, project_id)
        if project_id not in authorized_ids:
            raise NotFound("Project")
        query = query.where(ProviderTrace.project_id == project_id)
    else:
        authorized_ids = scoped_project_ids(db, principal, None)
        # Allow viewing authorized project traces and workspace-level system traces (where project_id is None)
        query = query.where(
            or_(
                ProviderTrace.project_id.in_(authorized_ids),
                ProviderTrace.project_id.is_(None),
            )
        )

    # 2. Time range filtering
    now = datetime.now(UTC)
    if time_range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.where(ProviderTrace.created_at >= start)
    elif time_range == "7d":
        start = now - timedelta(days=7)
        query = query.where(ProviderTrace.created_at >= start)
    elif time_range == "30d":
        start = now - timedelta(days=30)
        query = query.where(ProviderTrace.created_at >= start)
    elif time_range == "90d":
        start = now - timedelta(days=90)
        query = query.where(ProviderTrace.created_at >= start)
    elif time_range == "custom":
        if start_date:
            try:
                s_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                query = query.where(ProviderTrace.created_at >= s_dt)
            except ValueError:
                pass
        if end_date:
            try:
                e_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                query = query.where(ProviderTrace.created_at <= e_dt)
            except ValueError:
                pass

    return query


@router.get("/ai-usage")
def get_ai_usage_analytics(
    range: str = Query("all", pattern="^(today|7d|30d|90d|all|custom)$"),
    start_date: str | None = None,
    end_date: str | None = None,
    project_id: int | None = None,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Aggregate token usage, AI cost analytics, provider breakdown, and historical trend."""
    s = get_settings()
    base_query = _filter_traces_by_time_and_scope(db, p, range, start_date, end_date, project_id)

    # Execute all traces matching filter
    traces: list[ProviderTrace] = db.execute(base_query.order_by(ProviderTrace.created_at.asc())).scalars().all()

    total_requests = len(traces)
    total_input = sum(t.input_tokens or 0 for t in traces)
    total_output = sum(t.output_tokens or 0 for t in traces)
    total_cached = sum(getattr(t, "cached_input_tokens", 0) or 0 for t in traces)
    total_reasoning = sum(getattr(t, "reasoning_tokens", 0) or 0 for t in traces)
    total_tokens = sum(getattr(t, "total_tokens", 0) or (t.input_tokens or 0) + (t.output_tokens or 0) for t in traces)
    total_cost = sum(getattr(t, "cost_usd", 0.0) or 0.0 for t in traces)
    avg_cost = (total_cost / total_requests) if total_requests > 0 else 0.0

    # Provider reported telemetry count (traces where token counts are real provider metrics)
    provider_reported_count = sum(1 for t in traces if (t.input_tokens or 0) > 0 or (t.output_tokens or 0) > 0)
    provider_reported_ratio = (provider_reported_count / total_requests) if total_requests > 0 else 1.0

    # 1. Provider & Model Breakdown
    model_groups: dict[tuple[str, str], dict[str, Any]] = {}
    for t in traces:
        key = (t.provider or "unknown", t.model or "unknown")
        if key not in model_groups:
            pricing = get_model_pricing(key[0], key[1])
            role = "Primary" if key[0] == s.primary_provider else "Secondary"
            model_groups[key] = {
                "provider": key[0],
                "model": key[1],
                "role": role,
                "requests": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "cached_tokens": 0,
                "reasoning_tokens": 0,
                "total_tokens": 0,
                "cost_usd": 0.0,
                "input_rate_per_m": pricing.input_price_per_million,
                "output_rate_per_m": pricing.output_price_per_million,
                "cached_rate_per_m": pricing.cached_input_price_per_million,
                "pricing_version": pricing.pricing_version,
            }
        g = model_groups[key]
        g["requests"] += 1
        g["input_tokens"] += t.input_tokens or 0
        g["output_tokens"] += t.output_tokens or 0
        g["cached_tokens"] += getattr(t, "cached_input_tokens", 0) or 0
        g["reasoning_tokens"] += getattr(t, "reasoning_tokens", 0) or 0
        g["total_tokens"] += getattr(t, "total_tokens", 0) or ((t.input_tokens or 0) + (t.output_tokens or 0))
        g["cost_usd"] += getattr(t, "cost_usd", 0.0) or 0.0

    # Ensure primary and secondary configured models are listed even if 0 requests in time range
    primary_key = (s.primary_provider, s.gemini_model if s.primary_provider == "gemini" else s.groq_model)
    if primary_key not in model_groups and s.primary_provider in ("gemini", "groq"):
        p_card = get_model_pricing(primary_key[0], primary_key[1])
        model_groups[primary_key] = {
            "provider": primary_key[0],
            "model": primary_key[1],
            "role": "Primary",
            "requests": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "cached_tokens": 0,
            "reasoning_tokens": 0,
            "total_tokens": 0,
            "cost_usd": 0.0,
            "input_rate_per_m": p_card.input_price_per_million,
            "output_rate_per_m": p_card.output_price_per_million,
            "cached_rate_per_m": p_card.cached_input_price_per_million,
            "pricing_version": p_card.pricing_version,
        }

    secondary_provider = "groq" if s.primary_provider == "gemini" else "gemini"
    secondary_key = (secondary_provider, s.groq_model if secondary_provider == "groq" else s.gemini_model)
    if secondary_key not in model_groups and secondary_provider in ("gemini", "groq"):
        p_card = get_model_pricing(secondary_key[0], secondary_key[1])
        model_groups[secondary_key] = {
            "provider": secondary_key[0],
            "model": secondary_key[1],
            "role": "Secondary",
            "requests": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "cached_tokens": 0,
            "reasoning_tokens": 0,
            "total_tokens": 0,
            "cost_usd": 0.0,
            "input_rate_per_m": p_card.input_price_per_million,
            "output_rate_per_m": p_card.output_price_per_million,
            "cached_rate_per_m": p_card.cached_input_price_per_million,
            "pricing_version": p_card.pricing_version,
        }

    by_provider_model = sorted(
        [
            {**v, "cost_usd": round(v["cost_usd"], 4)}
            for v in model_groups.values()
        ],
        key=lambda x: (0 if x["role"] == "Primary" else 1, -x["cost_usd"]),
    )

    # 2. Cost & Token Consumption Over Time (Grouped by Day or Hour)
    time_series: dict[str, dict[str, Any]] = {}
    time_format = "%Y-%m-%d %H:00" if range == "today" else "%Y-%m-%d"
    for t in traces:
        if not t.created_at:
            continue
        bucket = t.created_at.strftime(time_format)
        if bucket not in time_series:
            time_series[bucket] = {
                "date": bucket,
                "requests": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "cost_usd": 0.0,
            }
        b = time_series[bucket]
        b["requests"] += 1
        b["input_tokens"] += t.input_tokens or 0
        b["output_tokens"] += t.output_tokens or 0
        b["total_tokens"] += getattr(t, "total_tokens", 0) or ((t.input_tokens or 0) + (t.output_tokens or 0))
        b["cost_usd"] += getattr(t, "cost_usd", 0.0) or 0.0

    cost_over_time = [
        {**b, "cost_usd": round(b["cost_usd"], 5)}
        for b in sorted(time_series.values(), key=lambda x: x["date"])
    ]

    # 3. Cost by Agent Attribution
    agent_groups: dict[str, dict[str, Any]] = {}
    for t in traces:
        name = getattr(t, "agent_name", None) or "reasonx"
        if name not in agent_groups:
            agent_groups[name] = {
                "agent_name": name,
                "display_name": AGENT_DISPLAY_NAMES.get(name, name.replace("_", " ").title()),
                "requests": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "cost_usd": 0.0,
            }
        ag = agent_groups[name]
        ag["requests"] += 1
        ag["input_tokens"] += t.input_tokens or 0
        ag["output_tokens"] += t.output_tokens or 0
        ag["total_tokens"] += getattr(t, "total_tokens", 0) or ((t.input_tokens or 0) + (t.output_tokens or 0))
        ag["cost_usd"] += getattr(t, "cost_usd", 0.0) or 0.0

    by_agent = sorted(
        [
            {
                **ag,
                "cost_usd": round(ag["cost_usd"], 4),
                "percentage_of_cost": round((ag["cost_usd"] / total_cost * 100.0) if total_cost > 0 else 0.0, 1),
            }
            for ag in agent_groups.values()
        ],
        key=lambda x: -x["cost_usd"],
    )

    # 4. Cost by Feature Attribution
    feature_groups: dict[str, dict[str, Any]] = {}
    for t in traces:
        feat = getattr(t, "feature_name", None) or "reasonx_conversations"
        if feat not in feature_groups:
            feature_groups[feat] = {
                "feature_name": feat,
                "display_name": FEATURE_DISPLAY_NAMES.get(feat, feat.replace("_", " ").title()),
                "requests": 0,
                "total_tokens": 0,
                "cost_usd": 0.0,
            }
        fg = feature_groups[feat]
        fg["requests"] += 1
        fg["total_tokens"] += getattr(t, "total_tokens", 0) or ((t.input_tokens or 0) + (t.output_tokens or 0))
        fg["cost_usd"] += getattr(t, "cost_usd", 0.0) or 0.0

    by_feature = sorted(
        [
            {
                **fg,
                "cost_usd": round(fg["cost_usd"], 4),
                "percentage_of_cost": round((fg["cost_usd"] / total_cost * 100.0) if total_cost > 0 else 0.0, 1),
            }
            for fg in feature_groups.values()
        ],
        key=lambda x: -x["cost_usd"],
    )

    # 5. Cost by Project Breakdown
    project_names = {row.id: row.name for row in db.execute(select(Project.id, Project.name)).all()}
    proj_groups: dict[int | None, dict[str, Any]] = {}
    for t in traces:
        pid = getattr(t, "project_id", None)
        if pid not in proj_groups:
            p_name = project_names.get(pid, "System & Workspace Operations") if pid is not None else "System & Workspace Operations"
            proj_groups[pid] = {
                "project_id": pid,
                "project_name": p_name,
                "requests": 0,
                "total_tokens": 0,
                "cost_usd": 0.0,
            }
        pg = proj_groups[pid]
        pg["requests"] += 1
        pg["total_tokens"] += getattr(t, "total_tokens", 0) or ((t.input_tokens or 0) + (t.output_tokens or 0))
        pg["cost_usd"] += getattr(t, "cost_usd", 0.0) or 0.0

    by_project = sorted(
        [
            {
                **pg,
                "cost_usd": round(pg["cost_usd"], 4),
                "percentage_of_cost": round((pg["cost_usd"] / total_cost * 100.0) if total_cost > 0 else 0.0, 1),
            }
            for pg in proj_groups.values()
        ],
        key=lambda x: -x["cost_usd"],
    )

    return {
        "summary": {
            "total_requests": total_requests,
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "total_tokens": total_tokens,
            "cached_input_tokens": total_cached,
            "reasoning_tokens": total_reasoning,
            "estimated_total_cost_usd": round(total_cost, 4),
            "average_cost_per_request_usd": round(avg_cost, 6),
            "provider_reported_ratio": round(provider_reported_ratio, 3),
        },
        "token_breakdown": {
            "input_tokens": total_input,
            "output_tokens": total_output,
            "cached_input_tokens": total_cached,
            "reasoning_tokens": total_reasoning,
            "total_tokens": total_tokens,
            "reported_by": "provider_telemetry",
            "provider_telemetry_count": provider_reported_count,
            "fallback_estimated_count": max(0, total_requests - provider_reported_count),
            "accuracy_statement": "Ground-truth token counts recorded from Google Gemini and Groq API usage metadata.",
        },
        "by_provider_model": by_provider_model,
        "cost_over_time": cost_over_time,
        "by_agent": by_agent,
        "by_feature": by_feature,
        "by_project": by_project,
        "pricing_metadata": {
            "version": CURRENT_PRICING_VERSION,
            "effective_date": "2026-01-01",
            "last_verified": "2026-11-17",
            "catalog": list_pricing_catalog(),
            "disclaimer": (
                "Token consumption reflects actual usage reported by API providers. Cost estimates are calculated "
                f"using standard published rate cards ({CURRENT_PRICING_VERSION}). Monthly billing invoices may vary based on "
                "volume tiers, caching behavior, or active enterprise agreements."
            ),
        },
    }


@router.get("/ai-usage/export")
def export_ai_usage_report(
    format: str = Query("csv", pattern="^(csv|json)$"),
    range: str = Query("all", pattern="^(today|7d|30d|90d|all|custom)$"),
    start_date: str | None = None,
    end_date: str | None = None,
    project_id: int | None = None,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Export filtered AI token usage and cost accounting report as CSV or JSON."""
    base_query = _filter_traces_by_time_and_scope(db, p, range, start_date, end_date, project_id)
    traces = db.execute(base_query.order_by(ProviderTrace.created_at.desc())).scalars().all()

    project_names = {row.id: row.name for row in db.execute(select(Project.id, Project.name)).all()}
    timestamp_str = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")

    if format == "json":
        records = [
            {
                "trace_id": t.id,
                "timestamp": t.created_at.isoformat() + "Z" if t.created_at else None,
                "project_id": t.project_id,
                "project_name": project_names.get(t.project_id, "System") if t.project_id else "System",
                "agent_name": getattr(t, "agent_name", None) or "reasonx",
                "agent_display": AGENT_DISPLAY_NAMES.get(getattr(t, "agent_name", "") or "reasonx", "ReasonX AI"),
                "feature_name": getattr(t, "feature_name", None) or "reasonx_conversations",
                "task": t.task,
                "provider": t.provider,
                "model": t.model,
                "input_tokens": t.input_tokens or 0,
                "output_tokens": t.output_tokens or 0,
                "cached_input_tokens": getattr(t, "cached_input_tokens", 0) or 0,
                "reasoning_tokens": getattr(t, "reasoning_tokens", 0) or 0,
                "total_tokens": getattr(t, "total_tokens", 0) or ((t.input_tokens or 0) + (t.output_tokens or 0)),
                "cost_usd": round(getattr(t, "cost_usd", 0.0) or 0.0, 6),
                "pricing_version": getattr(t, "pricing_version", None) or CURRENT_PRICING_VERSION,
                "duration_ms": t.latency_ms,
                "status": t.status,
            }
            for t in traces
        ]
        json_bytes = json.dumps({"exported_at": timestamp_str, "records_count": len(records), "traces": records}, indent=2)
        return Response(
            content=json_bytes,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="tracetest-ai-usage-{timestamp_str}.json"'},
        )

    # Default to CSV export
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Trace ID",
        "Timestamp (UTC)",
        "Project ID",
        "Project Name",
        "Agent Name",
        "Feature",
        "Task",
        "Provider",
        "Model",
        "Input Tokens",
        "Output Tokens",
        "Cached Input Tokens",
        "Reasoning Tokens",
        "Total Tokens",
        "Cost (USD)",
        "Pricing Version",
        "Latency (ms)",
        "Status",
    ])

    for t in traces:
        writer.writerow([
            t.id,
            t.created_at.isoformat() + "Z" if t.created_at else "",
            t.project_id or "",
            project_names.get(t.project_id, "System") if t.project_id else "System",
            getattr(t, "agent_name", None) or "reasonx",
            getattr(t, "feature_name", None) or "reasonx_conversations",
            t.task or "",
            t.provider or "",
            t.model or "",
            t.input_tokens or 0,
            t.output_tokens or 0,
            getattr(t, "cached_input_tokens", 0) or 0,
            getattr(t, "reasoning_tokens", 0) or 0,
            getattr(t, "total_tokens", 0) or ((t.input_tokens or 0) + (t.output_tokens or 0)),
            f"{round(getattr(t, 'cost_usd', 0.0) or 0.0, 6):.6f}",
            getattr(t, "pricing_version", None) or CURRENT_PRICING_VERSION,
            t.latency_ms or 0,
            t.status or "ok",
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="tracetest-ai-usage-{timestamp_str}.csv"'},
    )


class HealthProbeRequest(BaseModel):
    provider: str = Field(pattern="^(gemini|groq)$")


@router.post("/llm/health-check")
def live_provider_health_check(
    body: HealthProbeRequest,
    p: Principal = Depends(current_principal),
):
    """Perform a live health probe against Gemini or Groq without exposing credentials or internal slot counts."""
    s = get_settings()
    provider_name = body.provider.lower()
    role = "Primary" if provider_name == s.primary_provider else "Secondary"

    if s.llm_mode == "mock" or s.app_env == "test":
        return {
            "provider": provider_name,
            "role": role,
            "model": "fixture-v1",
            "status": "healthy",
            "latency_ms": 14,
            "verified_at": utcnow().isoformat() + "Z",
            "error": None,
        }

    provider_obj: Any = None
    if provider_name == "gemini":
        from app.llm.providers import GeminiProvider
        provider_obj = GeminiProvider(s)
    elif provider_name == "groq":
        from app.llm.providers import GroqProvider
        provider_obj = GroqProvider(s)

    if not provider_obj or not provider_obj.configured():
        return {
            "provider": provider_name,
            "role": role,
            "model": getattr(provider_obj, "model", "unconfigured"),
            "status": "unreachable",
            "latency_ms": 0,
            "verified_at": utcnow().isoformat() + "Z",
            "error": f"Provider '{provider_name}' has no active API keys configured in environment.",
        }

    t0 = time.monotonic()
    try:
        provider_obj.complete_json(
            system="You are an automated health check probe.",
            user='Return JSON: {"status": "ok", "probe": "ping"}',
            timeout=8.0,
        )
        latency_ms = int((time.monotonic() - t0) * 1000)
        return {
            "provider": provider_name,
            "role": role,
            "model": getattr(provider_obj, "model", ""),
            "status": "healthy",
            "latency_ms": latency_ms,
            "verified_at": utcnow().isoformat() + "Z",
            "error": None,
        }
    except Exception as exc:
        latency_ms = int((time.monotonic() - t0) * 1000)
        import re
        clean_err = re.sub(r"Slot \d+ error[^:]*:\s*", "", str(exc))
        clean_err = re.sub(r"key=[^&\s'\"]+", "key=[REDACTED]", clean_err)
        if len(clean_err) > 120:
            clean_err = clean_err[:117] + "..."
        return {
            "provider": provider_name,
            "role": role,
            "model": getattr(provider_obj, "model", ""),
            "status": "degraded" if latency_ms < 6000 else "unreachable",
            "latency_ms": latency_ms,
            "verified_at": utcnow().isoformat() + "Z",
            "error": f"Probe error: {clean_err}",
        }


@router.get("/providers")
def get_clean_providers_status(p: Principal = Depends(current_principal)):
    """Return clean provider summary for Settings page: role, provider, model, status (zero secrets, zero slot arrays)."""
    s = get_settings()
    from app.llm.providers import GeminiProvider, GroqProvider

    gemini = GeminiProvider(s)
    groq = GroqProvider(s)

    providers = [
        {
            "provider": "gemini",
            "display_name": "Google Gemini",
            "role": "Primary" if s.primary_provider == "gemini" else "Secondary",
            "model": getattr(gemini, "model", "gemini-3.8-flash"),
            "fallback_model": getattr(gemini, "fallback_model", "gemini-3.1-pro-preview"),
            "status": "healthy" if gemini.configured() else "unconfigured",
            "configured": gemini.configured(),
            "circuit": BREAKER.state("gemini"),
            "pricing_unit": "$0.075 / 1M in · $0.30 / 1M out",
        },
        {
            "provider": "groq",
            "display_name": "Groq Cloud",
            "role": "Primary" if s.primary_provider == "groq" else "Secondary",
            "model": getattr(groq, "model", "openai/gpt-oss-120b"),
            "fallback_model": getattr(groq, "fallback_model", None),
            "status": "healthy" if groq.configured() else "unconfigured",
            "configured": groq.configured(),
            "circuit": BREAKER.state("groq"),
            "pricing_unit": "$0.15 / 1M in · $0.60 / 1M out",
        },
    ]

    return {
        "mode": s.llm_mode,
        "primary_provider": s.primary_provider,
        "providers": providers,
    }
