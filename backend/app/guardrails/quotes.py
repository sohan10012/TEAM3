"""Deterministic normalised quote verification."""
from __future__ import annotations

import re

_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-"})
_WS = re.compile(r"\s+")
_EDGE = re.compile(r"^[\s\"'.,;:]+|[\s\"'.,;:]+$")


def normalize(text: str) -> str:
    text = (text or "").translate(_QUOTES).lower()
    text = text.replace("…", "...")
    return _WS.sub(" ", text).strip()


def _token_sequence(text: str) -> list[str]:
    t = normalize(text)
    # Strip punctuation for resilient token comparison
    t = re.sub(r"[^\w\s]", "", t)
    return [w for w in t.split() if w]


def verify_quote(quote: str, source_texts: list[str], min_len: int = 12) -> bool:
    """A quote is verified if its normalised form occurs verbatim or as a resilient token match in a cited source clause."""
    q = _EDGE.sub("", normalize(quote))
    if len(q) < min_len:
        return False

    # 1. Verbatim check (including elided quotes "a ... b")
    fragments = [f.strip() for f in q.split("...") if f.strip()]
    for src in source_texts:
        s = normalize(src)
        pos = 0
        ok = True
        for frag in fragments:
            idx = s.find(frag, pos)
            if idx < 0:
                ok = False
                break
            pos = idx + len(frag)
        if ok:
            return True

    # Check across joined clauses
    joined = normalize(" ".join(source_texts))
    if all(f in joined for f in fragments) and len(fragments) == 1 and q in joined:
        return True

    # 2. Resilient token-sequence check (AI-AC-01): Handles minor OCR/PDF whitespace, hyphenation, or punctuation variations
    q_tokens = _token_sequence(q)
    if len(q_tokens) < 3:
        return False

    q_sub = " ".join(q_tokens)
    for src in source_texts:
        s_tokens = _token_sequence(src)
        s_sub = " ".join(s_tokens)
        if q_sub in s_sub:
            return True
        # Check high token overlap for long sentences (> 8 tokens)
        if len(q_tokens) >= 8:
            match_count = sum(1 for w in q_tokens if w in s_tokens)
            if match_count / len(q_tokens) >= 0.88:
                return True

    return False
