"""LLM-as-a-Judge: Independent Quality & Grounding Auditor.

Architectural Invariants:
1. Model Family Separation: Evaluates tests using a model family distinct from the generation model.
2. Flagging-Only Principle: Only flags potential hallucinations, missing boundaries, or logic bugs.
   Under NO circumstances can the judge approve a test. Dual-control human sign-off is mandatory.
"""
from __future__ import annotations

import os
from typing import Any

from app.core.config import get_settings
from app.llm import router
from app.llm.base import LLMProvider
from app.llm.prompts import SYSTEM_BASE, payload
from app.llm.providers import GeminiProvider, GroqProvider, MockProvider, OllamaProvider
from app.llm.schemas import JudgeEvaluation

JUDGE_SYSTEM_PROMPT = f"""{SYSTEM_BASE}
You are an expert, adversarial Senior Software Quality Assurance Auditor (LLM-as-a-Judge).
Your sole purpose is to independently audit generated automated test cases and acceptance criteria
against their originating business requirements.

AUDIT CRITERIA:
1. Grounding & Faithfulness: Does any test assert a constraint or calculation not grounded in the requirement?
2. Boundary Completeness: Did the requirement specify an exact numeric threshold, cutoff, or cap that the tests failed to probe?
3. Assertion Strength: Are assertions specific and rigorous, or weak tautologies?
4. Logic Inversion: Is the expected value inverted from the specification?

STRICT GOVERNANCE RULE:
You are an AUDITOR, not an approver. You must identify issues and explain why they pose a risk.
Never output a blanket approval if there are ambiguities.
Schema: {{"requirement_key":str,"has_issues":bool,"issues":[{{"category":"ungrounded_assertion|missing_boundary|syntax_error|logic_inconsistency|policy_violation|weak_assertion","severity":"critical|high|medium|low","item_type":"test_case|acceptance_criterion","item_title":str,"description":str,"suggested_correction":str}}],"grounding_score":0.0..1.0,"completeness_score":0.0..1.0,"confidence":0.0..1.0,"summary_verdict":str}}"""


def get_judge_provider() -> LLMProvider:
    """Returns the configured judge provider from a separate model family."""
    s = get_settings()
    if s.llm_mode == "mock" or os.environ.get("TRACETEST_LLM_MODE") == "mock":
        def mock_judge_responder(system: str, user: str) -> dict[str, Any]:
            # Deterministic mock audit response
            has_issues = "missing_cap" in user.lower() or "fault" in user.lower()
            issues = []
            if has_issues:
                issues.append({
                    "category": "missing_boundary",
                    "severity": "medium",
                    "item_type": "test_case",
                    "item_title": "Audit Flagged Item",
                    "description": "Requirement specifies boundary not explicitly exercised in test cases.",
                    "suggested_correction": "Add a test function asserting boundary threshold equality."
                })
            return {
                "requirement_key": "REQ-AUDIT",
                "has_issues": has_issues,
                "issues": issues,
                "grounding_score": 0.95 if not has_issues else 0.70,
                "completeness_score": 0.90 if not has_issues else 0.65,
                "confidence": 0.92,
                "summary_verdict": "Audited with clean grounding" if not has_issues else "Flagged potential boundary gap"
            }
        return MockProvider(responder=mock_judge_responder)

    target_provider = s.judge_provider.lower().strip()
    p: LLMProvider
    if target_provider == "gemini":
        p = GeminiProvider(s)
        if p.configured():
            return p
    elif target_provider == "groq":
        p = GroqProvider(s)
        if p.configured():
            return p
    elif target_provider == "ollama":
        p = OllamaProvider(s)
        if p.configured():
            return p

    # Fallback to any configured provider distinct from generator or first available
    chain = router.provider_chain()
    return chain[0] if chain else MockProvider()


def evaluate_tests_with_judge(
    req_key: str,
    requirement_text: str,
    clauses: list[dict[str, Any]],
    tests: list[dict[str, Any]],
    provider_override: LLMProvider | None = None
) -> JudgeEvaluation:
    """Dispatches the requirement and tests to the judge for evaluation."""
    judge = provider_override or get_judge_provider()

    audit_payload = {
        "requirement_key": req_key,
        "source_requirement": requirement_text,
        "clauses": clauses,
        "tests": [
            {
                "key": t.get("key", ""),
                "title": t.get("title", ""),
                "clause_keys": t.get("clause_keys", []),
                "source_quote": t.get("source_quote", ""),
                "expected_result": t.get("expected_result", ""),
                "script": t.get("script", "")[:1200] if t.get("script") else None
            }
            for t in tests
        ]
    }

    user_prompt = payload("judge_evaluation", audit_payload) + "\n\nCritique the provided tests against the source clauses. Return JudgeEvaluation schema."

    result = router.generate(
        task="judge_evaluation",
        system=JUDGE_SYSTEM_PROMPT,
        user=user_prompt,
        schema=JudgeEvaluation,
        chain=[judge]
    )

    return result.data  # type: ignore[return-value]
