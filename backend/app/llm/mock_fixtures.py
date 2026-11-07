"""Deterministic fixture responses for MockProvider (tests and CI only — never used in live mode).

Responses are derived mechanically from the clause payload so that grounding checks can be exercised.
"""
from __future__ import annotations

import json
import re

_NUM = re.compile(r"(\d+(?:\.\d+)?)")


def _payload(user: str) -> tuple[str, dict]:
    m = re.search(r"TASK: (\w+)\nPAYLOAD_JSON:\n(.*?)(?:\n\n|$)", user, re.S)
    if not m:
        return "unknown", {}
    task, blob = m.group(1), m.group(2)
    # PAYLOAD_JSON is followed by a blank line; json may contain blank lines in strings only escaped
    try:
        return task, json.loads(blob)
    except json.JSONDecodeError:
        end = blob.rfind("}")
        return task, json.loads(blob[:end + 1])


def _quote(text: str) -> str:
    return text.strip().rstrip(".")[:160]


def _script_for(clause: str) -> tuple[str | None, dict]:
    low = clause.lower()
    nums = [float(n) for n in _NUM.findall(clause)]
    if "overtime" in low and nums:
        t = nums[0]
        return (f"from reference_hcm import payroll\n\n\ndef test_threshold_is_not_overtime():\n"
                f"    assert payroll.calculate_overtime_hours({t}, threshold={t}) == 0\n\n\n"
                f"def test_one_hour_above_threshold():\n"
                f"    assert payroll.calculate_overtime_hours({t + 1}, threshold={t}) == 1\n"), {"threshold": t}
    if "carry" in low and nums:
        cap = nums[0]
        return (f"from reference_hcm import leave\n\n\ndef test_balance_above_cap_is_capped():\n"
                f"    assert leave.carry_forward({cap + 5}, cap={cap}) == {cap}\n"), {"cap": cap}
    if "meal" in low and len(nums) >= 2:
        h, mins = nums[0], nums[1]
        return (f"from reference_hcm import attendance\n\n\ndef test_exact_minimum_break_is_compliant():\n"
                f"    assert attendance.meal_break_compliant({h + 2}, {int(mins)}, min_shift_hours={h}, "
                f"required_minutes={int(mins)}) is True\n"), {"shift_hours": h, "break": mins}
    if "contractor" in low:
        return ("from reference_hcm import eligibility\n\n\ndef test_contractor_not_eligible():\n"
                "    assert eligibility.benefits_eligible(400, 'contractor') is False\n"), {}
    return None, {}


def respond(system: str, user: str) -> dict:
    task, data = _payload(user)
    clauses = data.get("clauses", [])
    if task == "requirement_analysis":
        from app.guardrails.ambiguity import detect_ambiguity
        return {"clauses": [{"clause_key": c["key"], "business_rules": [c["text"]],
                             "ambiguities": [f["term"] for f in detect_ambiguity(c["text"])],
                             "missing_information": [], "conflicts_with": [],
                             "clarifying_questions": [f"Clarify '{f['term']}' in {c['key']}"
                                                      for f in detect_ambiguity(c["text"])],
                             "interpretation": c["text"]} for c in clauses],
                "assumptions": [], "summary": f"Fixture analysis of {data.get('requirement')}"}
    if task == "acceptance_criteria":
        return {"criteria": [{"clause_keys": [c["key"]], "description": f"System satisfies: {_quote(c['text'])}",
                              "preconditions": "Reference HCM environment available",
                              "expected_behaviour": _quote(c["text"]),
                              "validation_conditions": ["Observed output matches clause"],
                              "source_quote": _quote(c["text"]), "confidence": 0.9,
                              "rationale": "Derived directly from clause text", "assumptions": []}
                             for c in clauses]}
    if task in ("test_cases", "edge_case_tests"):
        tests = []
        for i, c in enumerate(clauses, start=1):
            script, tdata = _script_for(c["text"])
            if task == "edge_case_tests" and script is None:
                continue
            tests.append({
                "title": ("Boundary: " if task == "edge_case_tests" else "Verify ") + _quote(c["text"])[:120],
                "description": f"Fixture test for {c['key']}", "clause_keys": [c["key"]], "ac_refs": [i],
                "preconditions": "Reference HCM build selected", "test_data": tdata,
                "steps": [{"action": "Invoke the Reference HCM API with the boundary input",
                           "expected": "Result matches the clause"}],
                "expected_result": _quote(c["text"]), "priority": "high",
                "test_type": "boundary" if task == "edge_case_tests" else "functional",
                "confidence": 0.85, "source_quote": _quote(c["text"]), "rationale": "Fixture",
                "automation": "pytest" if script else "manual", "script": script})
        if not tests:
            c = clauses[0]
            tests.append({"title": "Edge: " + _quote(c["text"])[:120], "clause_keys": [c["key"]],
                          "steps": [{"action": "Review behaviour manually", "expected": "Matches clause"}],
                          "expected_result": _quote(c["text"]), "test_type": "boundary", "confidence": 0.5,
                          "source_quote": _quote(c["text"]), "automation": "manual"})
        return {"tests": tests}
    if task == "failure_analysis":
        msg = (data.get("message") or "") + (data.get("stack_trace") or "")
        cat = "timeout" if "timed out" in msg.lower() else (
            "test_automation_defect" if "Rejected by AST" in msg or "SyntaxError" in msg else "application_defect")
        return {"category": cat, "observed_facts": [f"Assertion failed: {data.get('message', '')[:200]}"],
                "hypotheses": ["Implementation deviates from the requirement boundary"],
                "probable_cause": "Implementation result differs from requirement-derived expectation",
                "suggested_actions": ["Compare implementation with cited clause"], "confidence": 0.7,
                "recommended_severity": "high", "recommended_priority": "p2",
                "defect_title": f"{data.get('test_title', 'Test')} fails on {data.get('environment', 'env')}",
                "defect_summary": "Fixture defect summary"}
    if task == "reasonx_query":
        query = data.get("query", "")
        page = data.get("page", "dashboard")
        item_title = data.get("item_title", "Project Intelligence")
        doc_name = data.get("document_name", "US_DOL_FLSA_Part_778_Overtime_Compensation.pdf")
        req_id = data.get("requirement_key") or data.get("requirement_id") or "EV_PAY-REQ-001"
        return {
            "direct_answer": f"Analysis for: '{query}'. Based on {item_title} on the {page} screen, the system verified compliance against documented business requirements.",
            "explanation": f"TraceTest evaluated {item_title}. The underlying specification establishes verified rules and boundary constraints. No conflicting overrides were detected for the active scope.",
            "supporting_evidence": [
                {
                    "source_document": doc_name,
                    "page": 1,
                    "section": "Section 1.1",
                    "requirement_id": str(req_id),
                    "quote": "System shall enforce statutory overtime threshold at 40 standard hours.",
                }
            ],
            "recommended_actions": [
                "Review linked acceptance criteria in the Requirements section.",
                "Verify edge-case simulation results in Policy & Scenario Validation.",
                "Ensure Four-Eyes dual control review is approved before release execution.",
            ],
            "confidence_level": "HIGH",
            "simplified_summary": f"Verified {item_title} is compliant with {doc_name} rules.",
        }
    return {}
