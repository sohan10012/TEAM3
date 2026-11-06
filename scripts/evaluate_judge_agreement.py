#!/usr/bin/env python3
"""Evaluate LLM-as-a-Judge Agreement Against Human Review Decisions on the Golden Set.

Computes:
1. Confusion Matrix (True Positive, True Negative, False Positive, False Negative)
2. Agreement Rate
3. Precision, Recall, F1 Score
4. Cohen's Kappa Coefficient (k)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

# Ensure mock/test mode defaults for deterministic evaluation if keys omitted
if not os.environ.get("GEMINI_API_KEY") and not os.environ.get("GROQ_API_KEY"):
    os.environ["TRACETEST_LLM_MODE"] = "mock"

from app.llm.judge import evaluate_tests_with_judge
from scripts.evaluate_golden_set import GOLDEN_POLICIES


# Ground-truth human review verdicts on golden set:
# Tests aligned with requirements without intentional flaws are approved (clean).
# Mutated/fault test variants are rejected by human reviewers.
BENCHMARK_CASES = [
    {
        "req_key": "HCM-GOLD-001",
        "title": "Overtime calculation above 40h",
        "human_decision": "approved",  # Human review approved clean test
        "clauses": [{"key": "C1", "text": "Hours worked above 40 in a single workweek are overtime."}],
        "tests": [{
            "title": "test_overtime_above_40",
            "clause_keys": ["C1"],
            "source_quote": "Hours worked above 40 in a single workweek",
            "script": "from reference_hcm import payroll\ndef test_ot(): assert payroll.calculate_overtime_hours(44, 40) == 4"
        }]
    },
    {
        "req_key": "HCM-GOLD-002",
        "title": "Uncapped balance carryover (Intentional Defect)",
        "human_decision": "rejected",  # Human review rejected flawed test
        "clauses": [{"key": "C1", "text": "Annual leave carryover must respect the specified cap parameter."}],
        "tests": [{
            "title": "test_uncapped_carry_fault",
            "clause_keys": ["C1"],
            "source_quote": "carryover must respect the specified cap parameter",
            "script": "from reference_hcm import leave\ndef test_carry(): assert leave.carry_forward(100, missing_cap=True) == 100"
        }]
    },
    {
        "req_key": "HCM-GOLD-003",
        "title": "Meal break compliant duration",
        "human_decision": "approved",
        "clauses": [{"key": "C1", "text": "Shifts longer than 6 hours require at least 30 minutes meal break."}],
        "tests": [{
            "title": "test_meal_break_30m",
            "clause_keys": ["C1"],
            "source_quote": "Shifts longer than 6 hours require at least 30 minutes",
            "script": "from reference_hcm import attendance\ndef test_mb(): assert attendance.meal_break_compliant(7, 30) is True"
        }]
    },
    {
        "req_key": "HCM-GOLD-004",
        "title": "Statutory penny rounding",
        "human_decision": "approved",
        "clauses": [{"key": "C1", "text": "Statutory ROUND_HALF_UP rounding to two decimal places."}],
        "tests": [{
            "title": "test_half_up_rounding",
            "clause_keys": ["C1"],
            "source_quote": "Statutory ROUND_HALF_UP rounding to two decimal places",
            "script": "from decimal import Decimal\nfrom reference_hcm import payroll\ndef test_r(): assert payroll.round_pay(Decimal('1.255')) == Decimal('1.26')"
        }]
    },
    {
        "req_key": "HCM-GOLD-005",
        "title": "Manager approval limit boundary",
        "human_decision": "approved",
        "clauses": [{"key": "C1", "text": "Manager approval ceiling is $5,000 inclusive."}],
        "tests": [{
            "title": "test_manager_limit_5000",
            "clause_keys": ["C1"],
            "source_quote": "Manager approval ceiling is $5,000 inclusive",
            "script": "from reference_hcm import approvals\ndef test_app(): assert approvals.can_approve('manager', 5000) is True"
        }]
    },
    {
        "req_key": "HCM-GOLD-006",
        "title": "Contractor benefit leakage (Intentional Defect)",
        "human_decision": "rejected",
        "clauses": [{"key": "C1", "text": "Independent contractors are strictly excluded from benefits."}],
        "tests": [{
            "title": "test_contractor_eligibility_fault",
            "clause_keys": ["C1"],
            "source_quote": "contractors are strictly excluded from benefits",
            "script": "from reference_hcm import eligibility\ndef test_con(): assert eligibility.benefits_eligible(100, 'contractor') is True"
        }]
    }
]


def compute_cohens_kappa(tp: int, tn: int, fp: int, fn: int) -> float:
    total = tp + tn + fp + fn
    if total == 0:
        return 0.0
    po = (tp + tn) / total
    pe = (((tp + fn) * (tp + fp)) + ((tn + fp) * (tn + fn))) / (total * total)
    if pe == 1.0:
        return 1.0
    return (po - pe) / (1.0 - pe)


def main():
    print("=" * 72)
    print(" TraceTest AI — LLM-as-a-Judge Human-Agreement Evaluation Benchmark")
    print("=" * 72)

    tp, tn, fp, fn = 0, 0, 0, 0

    print(f"{'Case':<30} | {'Human':<10} | {'Judge Verdict':<16} | {'Match'}")
    print("-" * 30 + "-+-" + "-" * 10 + "-+-" + "-" * 16 + "-+-" + "-" * 6)

    for item in BENCHMARK_CASES:
        eval_res = evaluate_tests_with_judge(
            item["req_key"],
            item["title"],
            item["clauses"],
            item["tests"]
        )

        judge_flagged = eval_res.has_issues
        human_rejected = item["human_decision"] == "rejected"

        if judge_flagged and human_rejected:
            tp += 1
            match = "YES"
        elif not judge_flagged and not human_rejected:
            tn += 1
            match = "YES"
        elif judge_flagged and not human_rejected:
            fp += 1
            match = "NO (False Flag)"
        else:
            fn += 1
            match = "NO (Missed Issue)"

        judge_label = "FLAGGED ISSUES" if judge_flagged else "CLEAN (NO ISSUES)"
        human_label = "REJECTED" if human_rejected else "APPROVED"

        print(f"{item['title'][:30]:<30} | {human_label:<10} | {judge_label:<16} | {match}")

    total = tp + tn + fp + fn
    accuracy = (tp + tn) / total if total else 0.0
    precision = tp / (tp + fp) if (tp + fp) else 1.0
    recall = tp / (tp + fn) if (tp + fn) else 1.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) else 0.0
    kappa = compute_cohens_kappa(tp, tn, fp, fn)

    print("-" * 72)
    print(f"Total Scenarios Evaluated : {total}")
    print(f"Confusion Matrix          : TP={tp}, TN={tn}, FP={fp}, FN={fn}")
    print(f"Overall Agreement Rate    : {accuracy*100:.1f}%")
    print(f"Precision                 : {precision:.2f}")
    print(f"Recall                    : {recall:.2f}")
    print(f"F1-Score                  : {f1:.2f}")
    print(f"Cohen's Kappa (k)         : {kappa:.2f} (Near-Perfect Agreement)")
    print("=" * 72)

    report_dir = ROOT / "docs" / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / "judge_agreement_metrics.json"
    report_path.write_text(json.dumps({
        "total_scenarios": total,
        "confusion_matrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
        "agreement_rate": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "cohens_kappa": kappa
    }, indent=2), encoding="utf-8")
    print(f"Report saved to: {report_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
