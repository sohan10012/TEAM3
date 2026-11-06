"""Treat uploaded requirement text as untrusted data, never as instructions."""
from __future__ import annotations

import re
import unicodedata

INJECTION_PATTERNS = [
    r"ignore (all|any|the)? ?(previous|prior|above)? ?(instructions|prompts|rules)",
    r"disregard (all|any|the)? ?(previous|prior|above)?",
    r"you are now",
    r"system prompt",
    r"act as (an?|the) ",
    r"new instructions?:",
    r"</?(system|assistant|user)>",
    r"reveal (your|the) (prompt|instructions|api key|secrets?)",
    r"mark (all|every) tests? as (passed|approved)",
    r"approve (all|every|the|this|any)?",
    r"ignore .* rules",
    r"bypass .* (review|checks?|validation)",
]
_PATTERNS = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
MAX_REQUIREMENT_CHARS = 20_000


def sanitize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    text = _CONTROL.sub("", text).replace("\r\n", "\n").replace("\r", "\n")
    return text[:MAX_REQUIREMENT_CHARS].strip()


def detect_injection(text: str) -> list[str]:
    hits = []
    for pat in _PATTERNS:
        m = pat.search(text or "")
        if m:
            hits.append(m.group(0))
    return hits


def as_untrusted_block(label: str, text: str) -> str:
    """Wrap untrusted content in delimiters the prompts instruct the model to treat as data."""
    safe = text.replace("<<<", "‹‹‹").replace(">>>", "›››")
    return f"<<<UNTRUSTED_{label}_BEGIN>>>\n{safe}\n<<<UNTRUSTED_{label}_END>>>"
