"""AI Evaluation Runner: Evaluates Groq vs Gemini on Golden HCM & EchoBox Scenarios.

Supports multi-iteration benchmarking (3 iterations per provider) to report empirical mean,
spread (stddev or min-max), exact hallucinated/ungrounded quotes, and transparent rate-limit handling.
"""
from __future__ import annotations

import json
import math
import time
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.db.base import session_scope, utcnow
from app.db.models import EvalResult, EvalRun
from app.llm import router
from app.services.evals import AGG, evaluate_scenario

GOLDEN_SCENARIOS_PATH = Path(__file__).resolve().parents[2] / "evals" / "golden_scenarios.json"
ECHBOX_SCENARIOS_PATH = Path(__file__).resolve().parents[2] / "evals" / "echobox_scenarios.json"


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _stddev(values: list[float]) -> float:
    if len(values) <= 1:
        return 0.0
    m = _mean(values)
    variance = sum((x - m) ** 2 for x in values) / (len(values) - 1)
    return math.sqrt(variance)


def evaluate_single_iteration(
    provider_name: str,
    model_name: str,
    iteration: int = 1
) -> dict[str, Any]:
    """Runs a single evaluation iteration over scenarios."""
    scenarios = json.loads(GOLDEN_SCENARIOS_PATH.read_text())
    chain = router.explicit_chain(provider_name)

    eval_run_id = None
    with session_scope() as db:
        eval_run = EvalRun(
            provider=provider_name,
            model=model_name,
            status="running",
            scenario_count=len(scenarios),
            started_at=utcnow()
        )
        db.add(eval_run)
        db.commit()
        eval_run_id = eval_run.id

    results = []
    ungrounded_quotes: list[dict[str, Any]] = []

    for sc in scenarios:
        t0 = time.time()
        try:
            r = evaluate_scenario(chain, sc)
            dur_ms = int((time.time() - t0) * 1000)
            r["metrics"]["latency_ms"] = dur_ms
            # Collect quotes
            for q in r["metrics"].get("ungrounded_quotes", []):
                ungrounded_quotes.append({
                    "scenario": sc["key"],
                    "clause": q.get("clauses"),
                    "quote": q.get("quote"),
                    "why": q.get("rationale") or "Quote did not match clause text verbatim",
                })
        except Exception as exc:
            dur_ms = int((time.time() - t0) * 1000)
            err_str = str(exc)
            is_rate_limited = (
                "429" in err_str
                or "quota" in err_str.lower()
                or "resource_exhausted" in err_str.lower()
                or "rate limited" in err_str.lower()
                or "circuit open" in err_str.lower()
            )
            r = {
                "passed": False,
                "metrics": {
                    "error": err_str[:500],
                    "is_429": is_rate_limited,
                    "clause_coverage": 0.0,
                    "ungrounded_rate": 1.0,
                    "latency_ms": dur_ms,
                }
            }

        results.append((sc["key"], r))

        with session_scope() as db:
            db.add(EvalResult(
                eval_run_id=eval_run_id,
                scenario_key=sc["key"],
                passed=r["passed"],
                metrics=r["metrics"],
                notes=f"Iteration {iteration} on {provider_name} ({model_name}) in {dur_ms}ms"
            ))

    agg: dict[str, Any] = {}
    for m in AGG:
        vals = [r["metrics"].get(m) for _, r in results if isinstance(r["metrics"].get(m), (int, float))]
        agg[m] = round(_mean(vals), 3) if vals else None

    fc = [r["metrics"].get("failure_classification_correct") for _, r in results if "error" not in r["metrics"]]
    agg["failure_classification_accuracy"] = round(sum(1 for x in fc if x) / len(fc), 3) if fc else 0.0
    agg["scenarios_passed"] = sum(1 for _, r in results if r["passed"])
    agg["avg_latency_ms"] = round(_mean([r["metrics"].get("latency_ms", 0) for _, r in results]), 1)
    agg["ungrounded_quotes"] = ungrounded_quotes
    agg["has_429"] = any(r["metrics"].get("is_429") for _, r in results)
    finished_count = sum(1 for _, r in results if "error" not in r["metrics"])
    agg["finished_scenarios"] = f"{finished_count}/{len(scenarios)}"

    errored = any("error" in r["metrics"] for _, r in results)
    with session_scope() as db:
        er = db.get(EvalRun, eval_run_id)
        if er:
            er.metrics = agg
            er.status = "degraded" if errored else "completed"
            er.finished_at = utcnow()

    return {
        "eval_run_id": eval_run_id,
        "iteration": iteration,
        "provider": provider_name,
        "metrics": agg,
        "results": results,
    }


def evaluate_provider_multi_run(
    provider_name: str,
    model_name: str,
    iterations: int = 3
) -> dict[str, Any]:
    """Runs multiple evaluation iterations, aggregating mean ± stddev and capturing hallucinated quotes."""
    print("\n==================================================")
    print(f" Multi-Run AI Benchmark: {provider_name} ({model_name}) [{iterations} iterations]")
    print("==================================================")

    runs = []
    quota_exhausted = False
    exhaustion_note = ""

    for i in range(1, iterations + 1):
        if quota_exhausted:
            break
        print(f"--- Iteration {i}/{iterations} for {provider_name} ---")
        run_data = evaluate_single_iteration(provider_name, model_name, iteration=i)
        runs.append(run_data)

        if run_data["metrics"].get("has_429"):
            quota_exhausted = True
            fin = run_data["metrics"].get("finished_scenarios", "0/10")
            exhaustion_note = f"not completed (finished {fin} scenarios before upstream HTTP 429 quota exhaustion). Runs {i+1}-{iterations} skipped."
            print(f"  [WARN] {exhaustion_note}")
            break

    # Aggregate metrics across completed runs
    latencies = [r["metrics"]["avg_latency_ms"] for r in runs if r["metrics"].get("avg_latency_ms")]
    coverages = [r["metrics"]["clause_coverage"] for r in runs if r["metrics"].get("clause_coverage") is not None]
    ungrounded_rates = [r["metrics"]["ungrounded_rate"] for r in runs if r["metrics"].get("ungrounded_rate") is not None]
    schema_passes = [r["metrics"]["schema_pass_rate"] for r in runs if r["metrics"].get("schema_pass_rate") is not None]
    ambiguities = [r["metrics"]["ambiguity_recall"] for r in runs if r["metrics"].get("ambiguity_recall") is not None]

    # Collect distinct ungrounded quotes across all iterations
    all_quotes = []
    seen = set()
    for r in runs:
        for q in r["metrics"].get("ungrounded_quotes", []):
            k = (q.get("scenario"), q.get("quote"), tuple(q.get("clause") or []))
            if k not in seen:
                seen.add(k)
                all_quotes.append({
                    "scenario": q.get("scenario"),
                    "clause": q.get("clause"),
                    "quote": q.get("quote"),
                    "why": q.get("why") or "Quote did not match clause text verbatim"
                })

    lat_mean = round(_mean(latencies), 1)
    lat_std = round(_stddev(latencies), 1)
    cov_mean = round(_mean(coverages), 3)
    ung_mean = round(_mean(ungrounded_rates), 3)
    summary: dict[str, Any] = {
        "provider": provider_name,
        "model": model_name,
        "status": "not completed" if quota_exhausted else "completed",
        "iterations_completed": len(runs),
        "iterations_requested": iterations,
        "quota_exhausted": quota_exhausted,
        "note": exhaustion_note if quota_exhausted else "All iterations completed successfully.",
        "latency_ms": {
            "mean": lat_mean,
            "stddev": lat_std,
            "min": min(latencies) if latencies else 0,
            "max": max(latencies) if latencies else 0,
        },
        "clause_coverage": {
            "mean": cov_mean,
            "stddev": round(_stddev(coverages), 3),
        },
        "ungrounded_rate": {
            "mean": ung_mean,
            "stddev": round(_stddev(ungrounded_rates), 3),
        },
        "schema_pass_rate": {
            "mean": round(_mean(schema_passes), 3),
            "percentage": f"{round(_mean(schema_passes) * 100, 1)}%",
        },
        "ambiguity_recall": {
            "mean": round(_mean(ambiguities), 3),
            "stddev": round(_stddev(ambiguities), 3),
        },
        "hallucinated_quotes": all_quotes,
    }
    print(f"Summary for {provider_name}: {lat_mean}ms ± {lat_std}ms | Coverage: {cov_mean} | Ungrounded: {ung_mean}\n")
    return summary


def run_comparative_benchmark(iterations: int = 3, provider: str = "all") -> dict[str, Any]:
    """Runs multi-run comparative benchmark across Mock, Groq, and Gemini providers."""
    settings = get_settings()
    results = {}

    target = provider.lower()

    # 1. Mock baseline (deterministic)
    if target in ("all", "mock"):
        print("\n--- Evaluating Mock Baseline ---")
        results["mock"] = evaluate_provider_multi_run("mock", "fixture-v1", iterations=iterations)

    # 2. Groq (if configured)
    if target in ("all", "groq"):
        if settings.groq_keys:
            print("\n--- Evaluating Groq Provider ---")
            results["groq"] = evaluate_provider_multi_run("groq", settings.groq_model, iterations=iterations)
        else:
            results["groq"] = {"status": "skipped", "reason": "No Groq API keys configured"}

    # 3. Gemini (if configured)
    if target in ("all", "gemini"):
        if settings.gemini_keys:
            print("\n--- Evaluating Gemini Provider ---")
            results["gemini"] = evaluate_provider_multi_run("gemini", settings.gemini_model, iterations=iterations)
        else:
            results["gemini"] = {"status": "skipped", "reason": "No Gemini API keys configured"}

    return results


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Run AI Evaluation Benchmark")
    parser.add_argument("--provider", default="all", choices=["groq", "gemini", "mock", "all"], help="Provider to benchmark")
    parser.add_argument("--iterations", type=int, default=3, help="Number of benchmark iterations")
    args = parser.parse_args()

    benchmark = run_comparative_benchmark(iterations=args.iterations, provider=args.provider)
    repo_root = Path(__file__).resolve().parents[3]
    out_file = repo_root / "docs" / "ai_eval_benchmark.json"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(benchmark, indent=2))
    print(f"Benchmark results written to {out_file}")


if __name__ == "__main__":
    main()
