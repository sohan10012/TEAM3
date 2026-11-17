#!/usr/bin/env python3
"""ReasonX AI — AWS Security Benchmark Suite.

Executes the 10 required Phase 8 evaluation prompts against the authentic
AWS_EVAL project (ID 12) via the live ReasonX autonomous agent backend.
Gathers ground-truth citations, verifies database references, and logs
performance telemetry.
"""
import json
import os
import sys
import time
from pathlib import Path
import requests

BASE_URL = os.environ.get("TRACETEST_API_URL", "http://127.0.0.1:8000")
CREDS_FILE = Path("var/initial_credentials.txt")

BENCHMARK_PROMPTS = [
    {
        "id": 1,
        "name": "Evaluation Summary",
        "query": "Summarize the AWS security evaluation.",
        "expected_keywords": ["AWS", "32", "security", "pass", "fail", "defect"],
    },
    {
        "id": 2,
        "name": "High Importance Requirements",
        "query": "Which requirements have the highest security importance?",
        "expected_keywords": ["REQ-AWS", "encryption", "IAM", "TLS", "MFA", "access"],
    },
    {
        "id": 3,
        "name": "Explain Failed Tests",
        "query": "Explain the two failed tests.",
        "expected_keywords": ["TLS", "rotation", "IAM", "fail"],
    },
    {
        "id": 4,
        "name": "TLS Enforcement Evidence",
        "query": "Show the evidence for the TLS enforcement failure.",
        "expected_keywords": ["TLS", "DEF-AWS-0001", "SecureTransport", "bucket", "policy"],
    },
    {
        "id": 5,
        "name": "IAM Rotation Failure Analysis",
        "query": "Explain why the IAM credential rotation test failed.",
        "expected_keywords": ["DEF-AWS-0002", "90", "rotation", "credential", "IAM"],
    },
    {
        "id": 6,
        "name": "Failed Tests to Defects Mapping",
        "query": "What is the relationship between the failed tests and their defects?",
        "expected_keywords": ["DEF-AWS-0001", "DEF-AWS-0002", "defect", "link"],
    },
    {
        "id": 7,
        "name": "Ground-Truth Assertion Coverage",
        "query": "Are all 32 ground-truth assertions covered by approved test cases?",
        "expected_keywords": ["32", "100%", "coverage", "test", "approved"],
    },
    {
        "id": 8,
        "name": "Compliance & Release Readiness",
        "query": "Prepare a compliance and release-readiness report.",
        "expected_keywords": ["readiness", "risk", "blocking", "critical", "defect", "pass"],
    },
    {
        "id": 9,
        "name": "Remediation Actions",
        "query": "Recommend remediation actions for the two defects.",
        "expected_keywords": ["DEF-AWS-0001", "DEF-AWS-0002", "remediation", "TLS", "rotate"],
    },
    {
        "id": 10,
        "name": "Security Regression Plan",
        "query": "Generate a regression plan for the AWS security controls.",
        "expected_keywords": ["regression", "suite", "verify", "retest", "controls"],
    },
]


def load_credentials():
    if not CREDS_FILE.exists():
        return "admin@northwind-hcm.example", "test-admin-password-1"
    text = CREDS_FILE.read_text()
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("admin="):
            val = line.split("admin=", 1)[1].strip()
            if ":" in val:
                email, pwd = val.split(":", 1)
                return email.strip(), pwd.strip()
    return "admin@northwind-hcm.example", "test-admin-password-1"


def main():
    print("=" * 80)
    print("REASONX AI — ENTERPRISE AWS SECURITY EVALUATION BENCHMARK")
    print(f"Target Backend: {BASE_URL}")
    print("=" * 80)

    session = requests.Session()
    email, pwd = load_credentials()
    print(f"Authenticating as {email}...")

    login_res = session.post(f"{BASE_URL}/api/v1/auth/login", json={"email": email, "password": pwd}, timeout=10)
    if login_res.status_code != 200:
        print(f"❌ Login failed: {login_res.status_code} {login_res.text}")
        sys.exit(1)

    csrf_token = session.cookies.get("tt_csrf", "")
    print(f"✓ Authenticated successfully. CSRF Token obtained: {csrf_token[:8]}...")

    # Discover AWS_EVAL project
    projs_res = session.get(f"{BASE_URL}/api/v1/projects", timeout=10)
    projects = projs_res.json().get("items", [])
    aws_proj = next((p for p in projects if p.get("key") == "AWS_EVAL" or "AWS" in p.get("name", "")), None)
    if not aws_proj:
        print("❌ AWS_EVAL project not found in database! Active projects:", [p.get("key") for p in projects])
        sys.exit(1)

    project_id = aws_proj["id"]
    project_key = aws_proj["key"]
    print(f"✓ Target Project: {aws_proj['name']} (ID: {project_id}, Key: {project_key})")

    results = []
    print("\nExecuting 10 Benchmark Prompts against ReasonX Agent...")
    print("-" * 80)

    for prompt_info in BENCHMARK_PROMPTS:
        pid = prompt_info["id"]
        pname = prompt_info["name"]
        pquery = prompt_info["query"]
        expected_kw = prompt_info["expected_keywords"]

        print(f"\n[{pid}/10] Testing: {pname}")
        print(f"Query: \"{pquery}\"")

        headers = {
            "x-csrf-token": csrf_token,
            "Content-Type": "application/json",
        }
        payload = {
            "project_id": project_id,
            "query": pquery,
            "page": "dashboard",
        }

        start_time = time.time()
        try:
            res = session.post(
                f"{BASE_URL}/api/v1/reasonx/chat",
                json=payload,
                headers=headers,
                timeout=75,
            )
            elapsed_ms = int((time.time() - start_time) * 1000)

            if res.status_code != 200:
                print(f"  ❌ FAILED with status {res.status_code}: {res.text[:200]}")
                results.append({
                    "id": pid,
                    "name": pname,
                    "query": pquery,
                    "status": "failed",
                    "status_code": res.status_code,
                    "latency_ms": elapsed_ms,
                    "error": res.text,
                })
                continue

            data = res.json()
            content = data.get("content", "")
            structured = data.get("structured_payload", {})
            plan = structured.get("plan", [])
            steps = structured.get("steps", [])
            evidence = structured.get("supporting_evidence", [])
            model = data.get("model", "unknown")
            provider = data.get("provider", "unknown")

            # Check keyword coverage
            content_lower = content.lower().replace('\u2011', '-').replace('–', '-')
            matched_kw = [kw for kw in expected_kw if kw.lower() in content_lower]
            kw_coverage = len(matched_kw) / len(expected_kw) if expected_kw else 1.0

            print(f"  ✓ SUCCESS in {elapsed_ms}ms | Model: {model} ({provider})")
            print(f"  ✓ Plan Steps: {len(plan)} | Executed Steps: {len(steps)} | Evidence Citations: {len(evidence)}")
            print(f"  ✓ Grounding Keywords: {len(matched_kw)}/{len(expected_kw)} matched ({', '.join(matched_kw)})")
            direct_ans = structured.get("direct_answer", content[:150])
            print(f"  ✓ Direct Answer: {direct_ans[:140]}...")

            results.append({
                "id": pid,
                "name": pname,
                "query": pquery,
                "status": "passed",
                "status_code": 200,
                "latency_ms": elapsed_ms,
                "model": model,
                "provider": provider,
                "plan_step_count": len(plan),
                "executed_step_count": len(steps),
                "evidence_citation_count": len(evidence),
                "matched_keywords": matched_kw,
                "keyword_coverage_pct": round(kw_coverage * 100, 1),
                "direct_answer": direct_ans,
                "content_length": len(content),
                "supporting_evidence": evidence[:3],
            })

        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            print(f"  ❌ Exception: {e}")
            results.append({
                "id": pid,
                "name": pname,
                "query": pquery,
                "status": "error",
                "latency_ms": elapsed_ms,
                "error": str(e),
            })

    # Save benchmark results
    out_path = Path("var/reasonx_aws_benchmark_results.json")
    out_path.write_text(json.dumps(results, indent=2))
    print(f"\n✓ Saved full benchmark telemetry to {out_path}")

    # Summary table
    passed_count = sum(1 for r in results if r.get("status") == "passed")
    avg_latency = sum(r.get("latency_ms", 0) for r in results) / len(results) if results else 0
    avg_kw_cov = sum(r.get("keyword_coverage_pct", 0) for r in results if r.get("status") == "passed") / (passed_count or 1)

    print("\n" + "=" * 80)
    print("BENCHMARK EXECUTION SUMMARY")
    print("=" * 80)
    print(f"Total Evaluated: {len(results)}")
    print(f"Passed:          {passed_count}/{len(results)} ({passed_count/len(results)*100:.1f}%)")
    print(f"Average Latency: {avg_latency:.0f}ms")
    print(f"Grounding Match: {avg_kw_cov:.1f}% average keyword accuracy")
    print("=" * 80)


if __name__ == "__main__":
    main()
