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
    # 0. Check for ReasonX Query
    if "reasonx" in system.lower() or "reasonx" in user.lower():
        # Check if query asks for 100 / compensation
        low_u = user.lower()
        compensation_note = " Mandatory compensation of ₹100 per day of delay beyond T+1 must be credited automatically." if "100" in low_u or "compensation" in low_u else ""
        return {
            "direct_answer": f"Verified requirement compliance.{compensation_note}",
            "explanation": f"TraceTest evaluated the cited policy against documented invariants. Under governing directives, financial institutions must maintain auditable settlement logs.{compensation_note}",
            "supporting_evidence": [
                {
                    "source_document": "Uploaded Document",
                    "page": 1,
                    "section": "Clause 2.1",
                    "requirement_id": "REQ-001",
                    "quote": "Compensation must be calculated and credited automatically without insisting on a customer complaint.",
                }
            ],
            "recommended_actions": ["Review linked acceptance criteria in Requirements", "Verify settlement timestamps in telemetry"],
            "confidence_level": "HIGH",
            "simplified_summary": f"Verified compliance against cited specifications.{compensation_note}",
        }

    # 1. Check for Onboarding Analysis task
    if "onboarding" in system.lower() or "untrusted_documents_begin" in user.lower():
        docs_match = re.search(r"<<<UNTRUSTED_DOCUMENTS_BEGIN>>>(.*?)<<<UNTRUSTED_DOCUMENTS_END>>>", user, re.S)
        raw_text = docs_match.group(1) if docs_match else user

        low_txt = raw_text.lower()
        if "tax" in low_txt or "paye" in low_txt or "hmrc" in low_txt:
            domain = "Tax, Fiscal Policy & Payroll Calculations"
        elif "overtime" in low_txt or "flsa" in low_txt or "wage" in low_txt:
            domain = "Labor Standards & Overtime Compliance"
        elif "upi" in low_txt or "payment" in low_txt or "tat" in low_txt:
            domain = "Digital Payments & Transaction Reconciliation"
        elif "security" in low_txt or "iso" in low_txt or "audit" in low_txt:
            domain = "Information Security & Compliance"
        elif "asthma" in low_txt or "patient" in low_txt or "clinical" in low_txt:
            domain = "Healthcare & Clinical Systems"
        else:
            domain = "Enterprise Quality Management"

        doc_blocks = re.findall(r"=== DOCUMENT:\s*([^\n]+)\s*\(Type:\s*([^\)]+)\)\s*===\s*(.*?)(?==== DOCUMENT:|$)", raw_text, re.S)
        if not doc_blocks:
            doc_blocks = [("Uploaded_Document.pdf", "spec", raw_text)]

        rules = []
        rule_idx = 1
        for doc_name, doc_type, doc_content in doc_blocks:
            sentences = re.split(r"(?<=[.!?])\s+", doc_content)
            for s in sentences:
                s_clean = s.strip()
                if len(s_clean) >= 25 and any(k in s_clean.lower() for k in ["shall", "must", "required", "compensat", "revers", "limit", "rate", "cap", "enforce", "calculate", "comply", "rule", "duty", "prohibit"]):
                    clean_quote = re.sub(r"^[-*•\d\.\)\s]+", "", s_clean).strip()
                    if len(clean_quote) >= 15:
                        rules.append({
                            "rule_id": f"BR-{rule_idx:03d}",
                            "title": clean_quote[:60].strip() + ("..." if len(clean_quote) > 60 else ""),
                            "description": clean_quote,
                            "rule_type": "statutory_obligation" if any(w in clean_quote.lower() for w in ["shall", "must", "law", "act", "section"]) else "business_rule",
                            "source_document": doc_name.strip(),
                            "page_number": 1,
                            "clause_ref": f"Clause {rule_idx}.0",
                            "supporting_quote": clean_quote,
                            "confidence": 0.95,
                            "is_inferred": False,
                            "approval_status": "suggested"
                        })
                        rule_idx += 1
                        if len(rules) >= 8:
                            break
            if len(rules) >= 8:
                break

        if not rules:
            first_doc = doc_blocks[0][0].strip()
            rules.append({
                "rule_id": "BR-001",
                "title": "System Specification Compliance Invariant",
                "description": "System shall strictly comply with all mandatory operational invariants defined in specification.",
                "rule_type": "business_rule",
                "source_document": first_doc,
                "page_number": 1,
                "clause_ref": "Clause 1.0",
                "supporting_quote": doc_blocks[0][2][:120].strip() or "Specification compliance mandate",
                "confidence": 0.90,
                "is_inferred": False,
                "approval_status": "suggested"
            })

        roles = [
            {
                "role_id": "ROLE-001",
                "name": "System Administrator",
                "description": f"Manages platform configuration and administrative controls for {domain}.",
                "responsibilities": ["System configuration", "User management", "Platform monitoring"],
                "restrictions": ["Cannot alter immutable audit ledgers"],
                "source_document": doc_blocks[0][0].strip(),
                "citation": "Administrative Controls"
            },
            {
                "role_id": "ROLE-002",
                "name": "Operations Specialist",
                "description": f"Executes day-to-day verification and case management in {domain}.",
                "responsibilities": ["Case processing", "Exception handling", "SLA monitoring"],
                "restrictions": ["Subject to Four-Eyes approval for financial adjustments"],
                "source_document": doc_blocks[0][0].strip(),
                "citation": "Operational Procedures"
            },
            {
                "role_id": "ROLE-003",
                "name": "Compliance & Audit Inspector",
                "description": "Performs independent verification and regulatory oversight.",
                "responsibilities": ["Statutory reporting", "Evidence auditing", "Discrepancy investigation"],
                "restrictions": ["Read-only access to transaction ledgers"],
                "source_document": doc_blocks[0][0].strip(),
                "citation": "Governance & Oversight"
            }
        ]

        scenarios = []
        for i, r in enumerate(rules[:4], start=1):
            scenarios.append({
                "scenario_id": f"SCENARIO-{i:03d}",
                "title": f"Verification of {r['title']}",
                "description": f"End-to-end evaluation scenario validating {r['description']}",
                "regulatory_ref": f"{r['source_document']}: {r['clause_ref']}",
                "preconditions": ["System is online", "Input parameters verified"],
                "steps": [
                    f"Trigger operation requiring compliance with {r['rule_id']}",
                    "System evaluates boundary criteria against specification",
                    "System commits transaction and records audit ledger entry"
                ],
                "expected_outcome": f"Operation succeeds in compliance with {r['rule_id']}"
            })

        insights = []
        if len(doc_blocks) >= 2:
            insights.append({
                "insight_id": "XDOC-001",
                "title": f"Harmonized Scope: {doc_blocks[0][0].strip()} and {doc_blocks[1][0].strip()}",
                "regime_a": f"Primary Obligations under {doc_blocks[0][0].strip()}",
                "regime_b": f"Secondary Requirements under {doc_blocks[1][0].strip()}",
                "reconciliation": f"Both documents operate cohesively within {domain}. The first establishes core obligations while the second defines procedural governance.",
                "source_citations": [doc_blocks[0][0].strip(), doc_blocks[1][0].strip()],
                "confidence": 0.95
            })
        else:
            insights.append({
                "insight_id": "XDOC-001",
                "title": f"Single Document Scope Verification: {doc_blocks[0][0].strip()}",
                "regime_a": f"Direct Mandates in {doc_blocks[0][0].strip()}",
                "regime_b": "External Environment Baseline",
                "reconciliation": "Document provides self-contained functional and operational specifications.",
                "source_citations": [doc_blocks[0][0].strip()],
                "confidence": 0.95
            })

        return {
            "detected_domain": domain,
            "product_overview": f"Enterprise Quality Platform configured for {domain} based on {len(doc_blocks)} uploaded document(s).",
            "problem_statement": f"Automated verification of statutory mandates, operational business rules, and boundary constraints defined in {doc_blocks[0][0].strip()}.",
            "business_goals": [
                f"Ensure 100% compliance with obligations specified in {doc_blocks[0][0].strip()}.",
                "Automate boundary checking and exception detection.",
                "Maintain end-to-end audit traceability from source clauses to verification outcomes."
            ],
            "target_users": [r["name"] for r in roles],
            "product_modules": ["Specification Ingestion", "Policy Engine", "Traceability Matrix", "Verification Runner"],
            "external_integrations": ["Document Ingestion Gateway", "Audit Ledger Service", "Reporting API"],
            "security_expectations": "Role-based access control with immutable audit trail.",
            "privacy_requirements": "Masking of confidential and personally identifiable information.",
            "performance_expectations": "Batch verification completed within standard operational SLA.",
            "availability_expectations": "High availability (> 99.9%) for operational dashboards.",
            "business_rules": rules,
            "roles": roles,
            "scenarios": scenarios,
            "cross_document_insights": insights
        }

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
