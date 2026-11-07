"""Concrete providers: Groq (OpenAI-compatible), Gemini (official SDK), Ollama, Mock.
Supports multi-credential rotation, least-recently-used (LRU) slot selection,
concurrency pacing, fallback models, and auth invalidation.
"""
from __future__ import annotations

import json
import random
import threading
import time
from contextlib import contextmanager
from typing import Any

import httpx

from app.core.config import Settings
from app.llm.base import Completion, LLMProvider, ProviderError


class ManagedSlot:
    def __init__(self, secret: str, slot_id: int, provider: str, concurrency_limit: int = 2):
        self.secret = secret.strip()
        self.slot_id = slot_id
        self.provider = provider
        self.concurrency_limit = max(1, concurrency_limit)
        self.masked = (
            (self.secret[:6] + "..." + self.secret[-4:])
            if len(self.secret) > 10
            else ("***" if len(self.secret) < 4 else (self.secret[:2] + "..." + self.secret[-2:]))
        )
        self.state = "healthy"  # healthy | rate_limited | invalid | degraded
        self.cooldown_until: float = 0.0
        self.last_used_at: float = 0.0
        self.consecutive_errors: int = 0
        self.total_requests: int = 0
        self.total_errors: int = 0
        self.active_requests: int = 0
        self._sem = threading.Semaphore(self.concurrency_limit)
        self._lock = threading.Lock()

        # Validate shape: empty, whitespace or non-string are invalid
        if not self.secret or any(c.isspace() for c in self.secret) or len(self.secret) < 4:
            self.state = "invalid"

    @contextmanager
    def throttle(self, timeout: float = 30.0):
        acquired = self._sem.acquire(timeout=timeout)
        if not acquired:
            raise ProviderError(
                f"Slot {self.slot_id} concurrency limit ({self.concurrency_limit}) exceeded",
                True,
                429,
            )
        try:
            with self._lock:
                self.active_requests += 1
            yield
        finally:
            with self._lock:
                self.active_requests = max(0, self.active_requests - 1)
            self._sem.release()


class SlotPool:
    def __init__(self, secrets: list[str], provider: str, concurrency_limit: int = 2):
        self.provider = provider
        self.concurrency_limit = concurrency_limit
        self.slots = [
            ManagedSlot(s, i + 1, provider, concurrency_limit=concurrency_limit)
            for i, s in enumerate(secrets)
            if s and s.strip()
        ]
        self._lock = threading.Lock()

    def configured(self) -> bool:
        return any(s.state != "invalid" for s in self.slots)

    def mark_used(self, slot: ManagedSlot) -> None:
        with self._lock:
            slot.last_used_at = time.monotonic()

    def get_candidate_slots(self, allow_rate_limited: bool = False) -> list[ManagedSlot]:
        now = time.monotonic()
        with self._lock:
            for s in self.slots:
                if s.state in ("rate_limited", "degraded") and now >= s.cooldown_until:
                    s.state = "healthy"
                    s.cooldown_until = 0.0
            if allow_rate_limited:
                candidates = [s for s in self.slots if s.state != "invalid"]
            else:
                candidates = [s for s in self.slots if s.state == "healthy"]
            # Least-recently-used rotation: sort by oldest last_used_at first
            candidates.sort(key=lambda s: s.last_used_at)
            return candidates

    def record_success(self, slot: ManagedSlot) -> None:
        with self._lock:
            slot.state = "healthy"
            slot.consecutive_errors = 0
            slot.cooldown_until = 0.0
            slot.total_requests += 1

    def record_failure(
        self,
        slot: ManagedSlot,
        is_auth: bool = False,
        is_rate_limit: bool = False,
        retry_after: float | None = None,
        is_daily_quota: bool = False,
        is_server_error: bool = False,
    ) -> None:
        with self._lock:
            slot.total_requests += 1
            slot.total_errors += 1
            slot.consecutive_errors += 1
            now = time.monotonic()
            if is_auth:
                slot.state = "invalid"
            elif is_rate_limit:
                slot.state = "rate_limited"
                if is_daily_quota or (retry_after and retry_after > 60.0):
                    cooldown = min(300.0, retry_after if retry_after else 300.0)
                else:
                    cooldown = retry_after if (retry_after and retry_after > 0) else 15.0
                slot.cooldown_until = now + cooldown
            elif is_server_error:
                slot.state = "degraded"
                backoff_base = min(30.0, 2.0 ** min(slot.consecutive_errors, 5))
                jitter = random.uniform(0.0, 0.1 * backoff_base)
                slot.cooldown_until = now + backoff_base + jitter
            else:
                if slot.consecutive_errors >= 3:
                    slot.state = "rate_limited"
                    slot.cooldown_until = now + 30.0

    def status(self) -> list[dict[str, Any]]:
        now = time.monotonic()
        with self._lock:
            return [
                {
                    "slot": s.slot_id,
                    "masked": s.masked,
                    "state": s.state,
                    "cooldown_sec": max(0, int(s.cooldown_until - now))
                    if s.state in ("rate_limited", "degraded")
                    else 0,
                    "requests": s.total_requests,
                    "errors": s.total_errors,
                    "error_rate": round(s.total_errors / s.total_requests, 4) if s.total_requests > 0 else 0.0,
                    "active_requests": s.active_requests,
                }
                for s in self.slots
            ]


class GroqProvider(LLMProvider):
    name = "groq"

    def __init__(self, s: Settings):
        self.keys = s.groq_keys
        self.key = self.keys[0] if self.keys else s.groq_api_key
        concurrency = getattr(s, "groq_concurrency_per_slot", 2)
        self.pool = SlotPool(self.keys, self.name, concurrency_limit=concurrency)
        self.primary_model = s.groq_model
        self.fallback_model = s.groq_fallback_model
        self.model = s.groq_model
        self.base = s.groq_base_url.rstrip("/")
        self._client: httpx.Client | None = None

    def configured(self) -> bool:
        return self.pool.configured()

    def slot_status(self) -> list[dict[str, Any]]:
        return self.pool.status()

    def _post(self, url: str, headers: dict[str, str], json_body: dict[str, Any], timeout: float) -> httpx.Response:
        if self._client is not None:
            return self._client.post(url, headers=headers, json=json_body, timeout=timeout)
        return httpx.post(url, headers=headers, json=json_body, timeout=timeout)

    def complete_json(self, system: str, user: str, timeout: float) -> Completion:
        models_to_try = [self.primary_model]
        if self.fallback_model and self.fallback_model != self.primary_model:
            models_to_try.append(self.fallback_model)

        errors: list[str] = []
        for idx, model in enumerate(models_to_try):
            candidates = self.pool.get_candidate_slots(allow_rate_limited=(idx > 0))
            if not candidates:
                continue

            for slot in candidates:
                try:
                    with slot.throttle(timeout=min(timeout, 15.0)):
                        self.pool.mark_used(slot)
                        r = self._post(
                            f"{self.base}/chat/completions",
                            timeout=timeout,
                            headers={
                                "Authorization": f"Bearer {slot.secret}",
                                "User-Agent": "TraceTest-AI/1.0 (Dayforce HCM Innovation Challenge)",
                            },
                            json_body={
                                "model": model,
                                "temperature": 0.1,
                                "max_tokens": 4096,
                                "response_format": {"type": "json_object"},
                                "messages": [
                                    {"role": "system", "content": system},
                                    {"role": "user", "content": user},
                                ],
                            },
                        )
                except httpx.TimeoutException as exc:
                    self.pool.record_failure(slot, is_server_error=True)
                    errors.append(f"Slot {slot.slot_id} timeout: {exc}")
                    continue
                except httpx.HTTPError as exc:
                    self.pool.record_failure(slot, is_server_error=True)
                    errors.append(f"Slot {slot.slot_id} transport: {exc}")
                    continue
                except ProviderError as exc:
                    # Concurrency throttle timeout
                    errors.append(f"Slot {slot.slot_id} {exc}")
                    continue

                if r.status_code in (401, 403):
                    self.pool.record_failure(slot, is_auth=True)
                    errors.append(f"Slot {slot.slot_id} auth rejected HTTP {r.status_code}")
                    continue

                if r.status_code == 429:
                    retry_after_hdr = r.headers.get("Retry-After")
                    reset_hdr = r.headers.get("x-ratelimit-reset") or r.headers.get("x-ratelimit-reset-requests")
                    retry_after_sec: float | None = None
                    if retry_after_hdr and retry_after_hdr.isdigit():
                        retry_after_sec = float(retry_after_hdr)
                    elif reset_hdr and reset_hdr.isdigit():
                        retry_after_sec = float(reset_hdr)

                    body_lower = r.text.lower()
                    is_daily = (
                        "daily" in body_lower
                        or "per day" in body_lower
                        or "tpd" in body_lower
                        or "rpd" in body_lower
                        or (retry_after_sec is not None and retry_after_sec > 60.0)
                    )
                    self.pool.record_failure(
                        slot,
                        is_rate_limit=True,
                        retry_after=retry_after_sec,
                        is_daily_quota=is_daily,
                    )
                    errors.append(f"Slot {slot.slot_id} rate limited HTTP 429 (model {model})")
                    continue

                if r.status_code >= 500:
                    self.pool.record_failure(slot, is_server_error=True)
                    errors.append(f"Slot {slot.slot_id} server error HTTP {r.status_code}")
                    continue

                if r.status_code >= 400:
                    if "json_validate_failed" in r.text:
                        self.pool.record_failure(slot, is_rate_limit=True, retry_after=10.0)
                        errors.append(f"Slot {slot.slot_id} json_validate_failed HTTP 400")
                        continue
                    self.pool.record_failure(slot, is_server_error=False)
                    raise ProviderError(
                        f"Groq rejected request HTTP {r.status_code}: {r.text[:300]}",
                        False,
                        r.status_code,
                    )

                data = r.json()
                usage = data.get("usage") or {}
                self.pool.record_success(slot)
                return Completion(
                    text=data["choices"][0]["message"]["content"] or "",
                    provider=self.name,
                    model=model,
                    input_tokens=usage.get("prompt_tokens"),
                    output_tokens=usage.get("completion_tokens"),
                    slot_id=slot.slot_id,
                )

        raise ProviderError(f"Groq failover failed: {' | '.join(errors)}", True, 429)


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, s: Settings):
        self.keys = s.gemini_keys
        self.key = self.keys[0] if self.keys else s.gemini_api_key
        self.pool = SlotPool(self.keys, self.name, concurrency_limit=2)
        # gemini-3.1-flash-lite provides verified active quota and fast response times
        if s.gemini_model in ("gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"):
            self.primary_model = "gemini-3.1-flash-lite"
        else:
            self.primary_model = s.gemini_model
        self.fallback_model = s.gemini_fallback_model
        self.model = self.primary_model

    def configured(self) -> bool:
        return self.pool.configured()

    def slot_status(self) -> list[dict[str, Any]]:
        return self.pool.status()

    def complete_json(self, system: str, user: str, timeout: float) -> Completion:
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:  # pragma: no cover
            raise ProviderError("google-genai SDK not installed", False) from exc

        models_to_try = [self.primary_model]
        if self.fallback_model and self.fallback_model != self.primary_model:
            models_to_try.append(self.fallback_model)

        errors: list[str] = []
        for idx, model in enumerate(models_to_try):
            candidates = self.pool.get_candidate_slots(allow_rate_limited=(idx > 0))
            if not candidates:
                continue

            for slot in candidates:
                try:
                    with slot.throttle(timeout=min(timeout, 15.0)):
                        self.pool.mark_used(slot)
                        client = genai.Client(
                            api_key=slot.secret,
                            http_options={"timeout": int(timeout * 1000)},
                        )
                        resp = client.models.generate_content(
                            model=model,
                            contents=user,
                            config=types.GenerateContentConfig(
                                system_instruction=system,
                                temperature=0.1,
                                response_mime_type="application/json",
                            ),
                        )
                        usage = getattr(resp, "usage_metadata", None)
                        self.pool.record_success(slot)
                        return Completion(
                            text=resp.text or "",
                            provider=self.name,
                            model=model,
                            input_tokens=getattr(usage, "prompt_token_count", None),
                            output_tokens=getattr(usage, "candidates_token_count", None),
                            slot_id=slot.slot_id,
                        )
                except ProviderError as exc:
                    errors.append(f"Slot {slot.slot_id} {exc}")
                    continue
                except Exception as exc:
                    msg = str(exc)
                    is_auth = any(x in msg for x in ("401", "403", "API_KEY_INVALID", "PERMISSION_DENIED"))
                    is_rate = any(x in msg for x in ("429", "RESOURCE_EXHAUSTED", "quota"))
                    is_server = any(x in msg for x in ("500", "503", "INTERNAL", "UNAVAILABLE", "deadline"))
                    self.pool.record_failure(
                        slot,
                        is_auth=is_auth,
                        is_rate_limit=is_rate,
                        is_server_error=is_server,
                    )
                    errors.append(f"Slot {slot.slot_id} error (model {model}): {msg[:200]}")
                    continue

        raise ProviderError(f"Gemini failover failed: {' | '.join(errors)}", True, 429)


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(self, s: Settings):
        self.base, self.model = (s.ollama_base_url or "").rstrip("/"), s.ollama_model

    def configured(self) -> bool:
        return bool(self.base)

    def complete_json(self, system: str, user: str, timeout: float) -> Completion:
        try:
            r = httpx.post(
                f"{self.base}/api/chat",
                timeout=timeout,
                json={
                    "model": self.model,
                    "stream": False,
                    "format": "json",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            )
            r.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderError(f"Ollama error: {exc}") from exc
        return Completion(r.json().get("message", {}).get("content", ""), self.name, self.model)


class MockProvider(LLMProvider):
    """Deterministic fixture provider. ONLY active when TRACETEST_LLM_MODE=mock (tests/CI)."""

    name = "mock"
    model = "fixture-v1"

    def __init__(self, responder=None):
        from app.llm.mock_fixtures import respond

        self.responder = responder or respond

    def configured(self) -> bool:
        return True

    def complete_json(self, system: str, user: str, timeout: float) -> Completion:
        return Completion(json.dumps(self.responder(system, user)), self.name, self.model, slot_id=1)
