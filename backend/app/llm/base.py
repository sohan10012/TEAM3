"""Provider abstraction."""
from __future__ import annotations

from dataclasses import dataclass


class ProviderError(Exception):
    def __init__(self, message: str, retryable: bool = True, status: int | None = None):
        super().__init__(message)
        self.retryable, self.status = retryable, status


@dataclass
class Completion:
    text: str
    provider: str
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    slot_id: int | None = None
    cached_input_tokens: int | None = None
    reasoning_tokens: int | None = None
    total_tokens: int | None = None


class LLMProvider:
    name: str = "base"
    model: str = ""

    def configured(self) -> bool:
        raise NotImplementedError

    def complete_json(self, system: str, user: str, timeout: float) -> Completion:
        raise NotImplementedError
