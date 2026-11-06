"""Provider routing: Gemini -> Groq -> (Ollama) -> explicit failure. Retries, backoff, circuit breakers,
structured-output validation with at most two repair attempts, caching and persisted traces."""
from __future__ import annotations

import hashlib
import json
import random
import re
import threading
import time
from dataclasses import dataclass
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.core.config import get_settings
from app.llm.base import Completion, LLMProvider, ProviderError
from app.llm.prompts import repair_prompt
from app.llm.providers import GeminiProvider, GroqProvider, MockProvider, OllamaProvider

T = TypeVar("T", bound=BaseModel)
MAX_REPAIRS = 2

SECRET_PATTERNS = [
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[^-]+-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", re.DOTALL),
    re.compile(r"\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b"),
    re.compile(r"\bgsk_[a-zA-Z0-9]{32,}\b"),
    re.compile(r"\bAIzaSy[a-zA-Z0-9_-]{33}\b"),
    re.compile(r"(?i)(?:api_key|secret_key|private_key)\s*[:=]\s*['\"][0-9a-zA-Z_\-]{16,}['\"]"),
]


def redact_secrets(text: str) -> str:
    """Scans and redacts host/cloud credentials before transmission to external LLMs."""
    if not text:
        return ""
    redacted = text
    for pat in SECRET_PATTERNS:
        redacted = pat.sub("[REDACTED_SECRET]", redacted)
    return redacted



class NoProviderConfigured(Exception):
    pass


class AllProvidersFailed(Exception):
    def __init__(self, errors: list[str]):
        super().__init__("All AI providers failed: " + " | ".join(errors))
        self.errors = errors


class StructuredOutputError(Exception):
    def __init__(self, message: str, raw: str, provider: str, model: str):
        super().__init__(message)
        self.raw, self.provider, self.model = raw, provider, model


@dataclass
class LLMResult:
    data: BaseModel
    provider: str
    model: str
    repairs: int
    cached: bool


class CircuitBreaker:
    def __init__(self, threshold: int = 3, cooldown: float = 60.0):
        self.threshold, self.cooldown = threshold, cooldown
        self.failures: dict[str, int] = {}
        self.opened_at: dict[str, float] = {}
        self.lock = threading.Lock()

    def is_open(self, name: str) -> bool:
        with self.lock:
            t = self.opened_at.get(name)
            if t is None:
                return False
            if time.monotonic() - t > self.cooldown:  # half-open: allow one try
                self.opened_at.pop(name, None)
                self.failures[name] = self.threshold - 1
                return False
            return True

    def record(self, name: str, ok: bool) -> None:
        with self.lock:
            if ok:
                self.failures[name] = 0
                self.opened_at.pop(name, None)
            else:
                self.failures[name] = self.failures.get(name, 0) + 1
                if self.failures[name] >= self.threshold:
                    self.opened_at[name] = time.monotonic()

    def state(self, name: str) -> str:
        return "open" if self.is_open(name) else "closed"


BREAKER = CircuitBreaker()
_mock_override: MockProvider | None = None


def set_mock_provider(p: MockProvider | None) -> None:
    """Test hook to inject a custom MockProvider responder."""
    global _mock_override
    _mock_override = p


def provider_chain() -> list[LLMProvider]:
    s = get_settings()
    if s.llm_mode == "mock":
        return [_mock_override or MockProvider()]
    configured: dict[str, LLMProvider] = {}
    groq = GroqProvider(s)
    if groq.configured():
        configured["groq"] = groq
    gemini = GeminiProvider(s)
    if gemini.configured():
        configured["gemini"] = gemini
    ollama = OllamaProvider(s)
    if ollama.configured():
        configured["ollama"] = ollama
    order = [s.primary_provider] + [p for p in ["groq", "ollama", "gemini"] if p != s.primary_provider]
    return [configured[p] for p in order if p in configured]


def provider_status() -> dict:
    s = get_settings()
    out: dict[str, Any] = {"mode": s.llm_mode, "providers": []}
    for p in (GeminiProvider(s), GroqProvider(s), OllamaProvider(s)):
        p_info: dict[str, Any] = {
            "name": p.name,
            "model": getattr(p, "model", ""),
            "primary_model": getattr(p, "primary_model", getattr(p, "model", "")),
            "fallback_model": getattr(p, "fallback_model", None),
            "configured": p.configured(),
            "circuit": BREAKER.state(p.name),
        }
        if hasattr(p, "slot_status"):
            slots = p.slot_status()
            p_info["slots"] = slots
            p_info["pool_size"] = len(slots)
            p_info["healthy_slots"] = sum(1 for s in slots if s.get("state") == "healthy")
        out["providers"].append(p_info)
    out["any_configured"] = s.llm_mode == "mock" or any(p["configured"] for p in out["providers"])
    return out


def _extract_json(text: str) -> object:
    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):] if "{" in text else text
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        raise ValueError("No JSON object in response")
    return json.loads(text[start:end + 1])


def _trace(run_id, provider, model, task, phash, status, latency, attempt, comp: Completion | None, error=None):
    from app.db.base import session_scope
    from app.db.models import ProviderTrace
    with session_scope() as db:
        db.add(ProviderTrace(run_id=run_id, provider=provider, model=model,
                             slot_id=comp.slot_id if comp else None,
                             task=task, prompt_hash=phash,
                             status=status, latency_ms=latency, attempt=attempt,
                             input_tokens=comp.input_tokens if comp else None,
                             output_tokens=comp.output_tokens if comp else None,
                             error=(error or "")[:2000] or None,
                             response_text=(comp.text[:4000] if comp else None)))


def _cache_get(phash: str, task: str):
    from app.db.base import session_scope
    from app.db.models import AICache
    with session_scope() as db:
        row = db.query(AICache).filter_by(prompt_hash=phash, task=task).first()
        return (row.response, row.provider, row.model) if row else None


def _cache_put(phash, task, provider, model, response: dict) -> None:
    from sqlalchemy.exc import IntegrityError

    from app.db.base import session_scope
    from app.db.models import AICache
    try:
        with session_scope() as db:
            db.add(AICache(prompt_hash=phash, task=task, provider=provider, model=model, response=response))
    except IntegrityError:
        pass


def generate(task: str, system: str, user: str, schema: type[T], run_id: int | None = None,
             use_cache: bool = True, chain: list[LLMProvider] | None = None) -> LLMResult:
    system = redact_secrets(system)
    user = redact_secrets(user)
    settings = get_settings()
    explicit = chain is not None
    chain = chain if explicit else provider_chain()
    if not chain:
        raise NoProviderConfigured("No AI provider is configured. Set GROQ_API_KEY or GEMINI_API_KEY in Settings/.env.")
    phash = hashlib.sha256(f"{task}\x00{system}\x00{user}".encode()).hexdigest()
    if use_cache and not explicit and settings.llm_mode != "mock":
        hit = _cache_get(phash, task)
        if hit:
            resp, prov, model = hit
            _trace(run_id, prov, model, task, phash, "cached", 0, 0, None)
            return LLMResult(schema.model_validate(resp), prov, model, 0, True)

    errors: list[str] = []
    for provider in chain:
        if BREAKER.is_open(provider.name):
            errors.append(f"{provider.name}: circuit open")
            continue
        prompt = user
        repairs = 0
        attempt = 0
        while True:
            attempt += 1
            t0 = time.monotonic()
            try:
                comp = provider.complete_json(system, prompt, settings.llm_timeout_seconds)
            except ProviderError as exc:
                latency = int((time.monotonic() - t0) * 1000)
                _trace(run_id, provider.name, provider.model, task, phash, "error", latency, attempt, None, str(exc))
                BREAKER.record(provider.name, False)
                if exc.retryable and attempt <= settings.llm_max_retries:
                    base = 2.0 if exc.status == 429 else 0.5
                    time.sleep(min(8.0, base * (2 ** (attempt - 1))) + random.uniform(0, 0.3))
                    continue
                errors.append(f"{provider.name}: {exc}")
                break
            latency = int((time.monotonic() - t0) * 1000)
            BREAKER.record(provider.name, True)
            try:
                parsed = schema.model_validate(_extract_json(comp.text))
            except (ValueError, ValidationError) as exc:
                _trace(run_id, comp.provider, comp.model, task, phash, "invalid_output", latency, attempt, comp,
                       str(exc))
                if repairs >= MAX_REPAIRS:
                    raise StructuredOutputError(
                        f"{comp.provider} returned output that failed schema validation after {MAX_REPAIRS} "
                        f"repair attempts: {str(exc)[:500]}", comp.text, comp.provider, comp.model) from exc
                repairs += 1
                prompt = repair_prompt(user, comp.text, str(exc))
                continue
            _trace(run_id, comp.provider, comp.model, task, phash, "ok", latency, attempt, comp)
            if not explicit and settings.llm_mode != "mock":
                _cache_put(phash, task, comp.provider, comp.model, parsed.model_dump())
            return LLMResult(parsed, comp.provider, comp.model, repairs, False)
    raise AllProvidersFailed(errors)


def explicit_chain(name: str) -> list[LLMProvider]:
    """Single-provider chain for evaluations (explicit, never a silent substitution)."""
    s = get_settings()
    if name == "mock":
        return [_mock_override or MockProvider()]
    p = {"groq": GroqProvider, "gemini": GeminiProvider, "ollama": OllamaProvider}[name](s)
    if not p.configured():
        raise NoProviderConfigured(f"{name} is not configured")
    return [p]
