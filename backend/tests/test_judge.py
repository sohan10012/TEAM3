"""Tests for the LLM-as-a-Judge Evaluation & Flagging Module."""
from __future__ import annotations

from app.llm.judge import evaluate_tests_with_judge
from app.llm.schemas import JudgeEvaluation


def test_judge_evaluates_and_flags_cleanly(app):
    """Verify that the judge parses tests and outputs a valid JudgeEvaluation schema."""
    clauses = [
        {"key": "PAY-REQ-001.C1", "text": "Hours worked above 40 in a workweek must be paid at 1.5x regular rate."}
    ]
    tests = [
        {
            "key": "TC-PAY-0001",
            "title": "Verify overtime above 40 hours",
            "clause_keys": ["PAY-REQ-001.C1"],
            "source_quote": "Hours worked above 40 in a workweek",
            "expected_result": "Overtime hours calculated",
            "script": "from reference_hcm import payroll\ndef test_ot(): assert payroll.calculate_overtime_hours(42, 40) == 2.0"
        }
    ]

    eval_out = evaluate_tests_with_judge("PAY-REQ-001", "Employees receive overtime after 40 hours.", clauses, tests)
    assert isinstance(eval_out, JudgeEvaluation)
    assert 0.0 <= eval_out.grounding_score <= 1.0
    assert 0.0 <= eval_out.completeness_score <= 1.0
    assert isinstance(eval_out.issues, list)


def test_judge_flags_missing_cap_defect(app):
    """Verify that when a fault/defect is present, the judge correctly flags an issue."""
    clauses = [
        {"key": "LVE-REQ-001.C1", "text": "Employees may carry forward up to cap days; balance with missing_cap will be truncated."}
    ]
    tests = [
        {
            "key": "TC-LVE-0001",
            "title": "Carry forward test with fault",
            "clause_keys": ["LVE-REQ-001.C1"],
            "source_quote": "carry forward up to cap days",
            "expected_result": "Capped balance",
            "script": "from reference_hcm import leave\ndef test_carry(): assert leave.carry_forward(20, 10) == 10"
        }
    ]

    eval_out = evaluate_tests_with_judge("LVE-REQ-001", "Leave carry forward rule with fault", clauses, tests)
    assert isinstance(eval_out, JudgeEvaluation)
    assert eval_out.has_issues is True
    assert len(eval_out.issues) > 0
    assert eval_out.issues[0].category == "missing_boundary"
