"""LLM Model Pricing Registry & Cost Calculation Engine.

Maintains model-specific rate cards, versions, effective dates, and reproducible
cost calculation logic per million tokens.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

CURRENT_PRICING_VERSION = "2026.1"


@dataclass(frozen=True)
class ModelPricing:
    provider: str
    model: str
    input_price_per_million: float
    output_price_per_million: float
    cached_input_price_per_million: float = 0.0
    reasoning_price_per_million: float = 0.0
    currency: str = "USD"
    pricing_unit: str = "1M tokens"
    effective_date: str = "2026-01-01"
    pricing_source: str = "Official Provider Documentation (Google AI Studio / Groq Cloud)"
    pricing_version: str = CURRENT_PRICING_VERSION


# Official published rate cards (USD per 1,000,000 tokens)
MODEL_PRICING_REGISTRY: dict[tuple[str, str, str], ModelPricing] = {
    # -------------------------------------------------------------------------
    # Google Gemini Models
    # -------------------------------------------------------------------------
    ("gemini", "gemini-3.8-flash", CURRENT_PRICING_VERSION): ModelPricing(
        provider="gemini",
        model="gemini-3.8-flash",
        input_price_per_million=0.075,
        output_price_per_million=0.30,
        cached_input_price_per_million=0.01875,
        reasoning_price_per_million=0.30,
        pricing_source="Google Cloud Vertex & AI Studio Rate Card (gemini-3.8-flash)",
    ),
    ("gemini", "gemini-3.1-pro-preview", CURRENT_PRICING_VERSION): ModelPricing(
        provider="gemini",
        model="gemini-3.1-pro-preview",
        input_price_per_million=1.25,
        output_price_per_million=5.00,
        cached_input_price_per_million=0.3125,
        reasoning_price_per_million=5.00,
        pricing_source="Google Cloud Vertex & AI Studio Rate Card (gemini-3.1-pro-preview)",
    ),
    ("gemini", "gemini-2.5-flash", CURRENT_PRICING_VERSION): ModelPricing(
        provider="gemini",
        model="gemini-2.5-flash",
        input_price_per_million=0.075,
        output_price_per_million=0.30,
        cached_input_price_per_million=0.01875,
        pricing_source="Google Cloud AI Studio Rate Card",
    ),
    ("gemini", "gemini-2.5-pro", CURRENT_PRICING_VERSION): ModelPricing(
        provider="gemini",
        model="gemini-2.5-pro",
        input_price_per_million=1.25,
        output_price_per_million=5.00,
        cached_input_price_per_million=0.3125,
        pricing_source="Google Cloud AI Studio Rate Card",
    ),
    ("gemini", "gemini-2.0-flash", CURRENT_PRICING_VERSION): ModelPricing(
        provider="gemini",
        model="gemini-2.0-flash",
        input_price_per_million=0.10,
        output_price_per_million=0.40,
        cached_input_price_per_million=0.025,
        pricing_source="Google Cloud AI Studio Rate Card",
    ),
    # -------------------------------------------------------------------------
    # Groq Cloud Models
    # -------------------------------------------------------------------------
    ("groq", "openai/gpt-oss-120b", CURRENT_PRICING_VERSION): ModelPricing(
        provider="groq",
        model="openai/gpt-oss-120b",
        input_price_per_million=0.15,
        output_price_per_million=0.60,
        cached_input_price_per_million=0.075,
        pricing_source="Groq Cloud Production Pricing",
    ),
    ("groq", "llama-3.3-70b-versatile", CURRENT_PRICING_VERSION): ModelPricing(
        provider="groq",
        model="llama-3.3-70b-versatile",
        input_price_per_million=0.59,
        output_price_per_million=0.79,
        cached_input_price_per_million=0.295,
        pricing_source="Groq Cloud Production Pricing",
    ),
    ("groq", "mixtral-8x7b-32768", CURRENT_PRICING_VERSION): ModelPricing(
        provider="groq",
        model="mixtral-8x7b-32768",
        input_price_per_million=0.24,
        output_price_per_million=0.24,
        cached_input_price_per_million=0.12,
        pricing_source="Groq Cloud Production Pricing",
    ),
}

# Provider fallback rate cards if a specific model identifier is unknown
DEFAULT_PROVIDER_PRICING: dict[str, ModelPricing] = {
    "gemini": ModelPricing(
        provider="gemini",
        model="gemini-default",
        input_price_per_million=0.075,
        output_price_per_million=0.30,
        cached_input_price_per_million=0.01875,
        pricing_source="Default Gemini Rate Card",
    ),
    "groq": ModelPricing(
        provider="groq",
        model="groq-default",
        input_price_per_million=0.15,
        output_price_per_million=0.60,
        cached_input_price_per_million=0.075,
        pricing_source="Default Groq Rate Card",
    ),
}


def get_model_pricing(
    provider: str,
    model: str,
    version: str = CURRENT_PRICING_VERSION,
) -> ModelPricing:
    """Retrieve rate card for a given provider, model, and version."""
    key = (provider.lower().strip(), model.strip(), version)
    if key in MODEL_PRICING_REGISTRY:
        return MODEL_PRICING_REGISTRY[key]

    # Partial / substring match on model name
    prov = provider.lower().strip()
    for (p, m, v), rate in MODEL_PRICING_REGISTRY.items():
        if p == prov and v == version and (m in model or model in m):
            return rate

    return DEFAULT_PROVIDER_PRICING.get(
        prov,
        ModelPricing(
            provider=prov,
            model=model,
            input_price_per_million=0.10,
            output_price_per_million=0.30,
            pricing_source="Generic Standard Rate Card",
        ),
    )


def calculate_cost(
    provider: str,
    model: str,
    input_tokens: int | None,
    output_tokens: int | None,
    cached_input_tokens: int | None = 0,
    reasoning_tokens: int | None = 0,
    pricing_version: str = CURRENT_PRICING_VERSION,
) -> tuple[float, str]:
    """Calculate exact estimated cost in USD based on model rate card.

    Cost = (input_tokens * input_rate / 1M)
         + (output_tokens * output_rate / 1M)
         + (cached_input_tokens * cached_rate / 1M)
         + (reasoning_tokens * reasoning_rate / 1M)

    Returns:
        (cost_usd, pricing_version)
    """
    pricing = get_model_pricing(provider, model, version=pricing_version)
    inp = max(0, input_tokens or 0)
    out = max(0, output_tokens or 0)
    cached = max(0, cached_input_tokens or 0)
    reasoning = max(0, reasoning_tokens or 0)

    # If cached tokens are reported, un-cached regular input tokens are (inp - cached)
    regular_inp = max(0, inp - cached)

    cost = (
        (regular_inp * pricing.input_price_per_million / 1_000_000.0)
        + (cached * pricing.cached_input_price_per_million / 1_000_000.0)
        + (out * pricing.output_price_per_million / 1_000_000.0)
        + (reasoning * pricing.reasoning_price_per_million / 1_000_000.0)
    )

    return round(cost, 6), pricing.pricing_version


def list_pricing_catalog() -> list[dict[str, Any]]:
    """Return all active rate cards for Settings UI transparency."""
    return [asdict(p) for p in MODEL_PRICING_REGISTRY.values()]
