"""LangGraph requirement-to-test workflow.

ingest -> sanitize -> clause_parser -> ambiguity_detector -> acceptance_criteria_generator
       -> [analyse mode: END] -> test_generator -> edge_case_generator -> validator -> gap_checker
       -> (interrupt) human_review

State is checkpointed in SQLite so the human-review interruption survives restarts.
"""
from __future__ import annotations

import sqlite3
import threading
from typing import Any, TypedDict, cast

from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from sqlalchemy import select

from app.core.config import get_settings
from app.db.base import session_scope, utcnow
from app.db.models import AcceptanceCriterion, Clause, Requirement, TestCase
from app.execution.sandbox import ScriptSpec, run_pytest
from app.guardrails.ambiguity import detect_ambiguity, detect_missing_information
from app.guardrails.ast_validator import validate_script
from app.guardrails.coverage import clause_coverage
from app.guardrails.quotes import verify_quote
from app.guardrails.sanitize import as_untrusted_block, detect_injection
from app.llm import prompts, router
from app.llm.schemas import AcceptanceCriteriaBatch, RequirementAnalysis, TestCaseBatch
from app.services import audit, tasks
from app.services.requirements import clauses_for, current_version
from app.services.tests import create_test

GROUP_SIZE = 2


class ReqState(TypedDict, total=False):
    requirement_id: int
    run_id: int
    actor_id: int | None
    mode: str  # analyse | generate
    version: int
    req_key: str
    title: str
    clauses: list[dict]
    untrusted: str
    injection_markers: list[str]
    criteria: list[dict]
    generated_tests: list[str]
    invalid_items: list[dict]
    provider_errors: list[str]
    providers_used: list[str]
    coverage: dict
    degraded: bool
    review_complete: bool


def _groups(items: list, n: int = GROUP_SIZE) -> list[list]:
    return [items[i:i + n] for i in range(0, len(items), n)]


def _llm(state: Any, task: str, user: str, schema) -> tuple[Any, dict[str, Any]]:
    try:
        res = router.generate(task, prompts.SYSTEM_BASE, user, schema, run_id=state["run_id"])
        used = set(state.get("providers_used", []))
        used.add(f"{res.provider}:{res.model}")
        return res, {"providers_used": sorted(used)}
    except router.StructuredOutputError as exc:
        return None, {"invalid_items": state.get("invalid_items", []) + [
            {"task": task, "error": str(exc), "raw_excerpt": exc.raw[:1500], "provider": exc.provider}],
            "degraded": True}
    except (router.AllProvidersFailed, router.NoProviderConfigured) as exc:
        return None, {"provider_errors": state.get("provider_errors", []) + [str(exc)], "degraded": True}


def ingest(state: ReqState) -> ReqState:
    with session_scope() as db:
        req = db.get(Requirement, state["requirement_id"])
        v = current_version(db, req)
        tasks.step(state["run_id"], "ingest", detail={"version": v.version}, progress=0.05)
        return {"version": v.version, "req_key": req.key, "title": v.title,
                "untrusted": v.description, "invalid_items": [], "provider_errors": [], "providers_used": [],
                "generated_tests": [], "degraded": False}


def sanitize(state: ReqState) -> ReqState:
    markers = detect_injection(state["untrusted"])
    tasks.step(state["run_id"], "sanitize", detail={"injection_markers": markers}, progress=0.1)
    return {"injection_markers": markers, "untrusted": as_untrusted_block("REQUIREMENT", state["untrusted"])}


def clause_parser(state: ReqState) -> ReqState:
    with session_scope() as db:
        req = db.get(Requirement, state["requirement_id"])
        cl = clauses_for(db, current_version(db, req))
        clauses = [{"key": c.clause_key, "text": c.text} for c in cl]
    tasks.step(state["run_id"], "clause_parser", detail={"clauses": len(clauses)}, progress=0.15)
    return {"clauses": clauses}


def ambiguity_detector(state: ReqState) -> ReqState:
    out: ReqState = {}
    res, extra = _llm(state, "requirement_analysis",
                      prompts.analysis_prompt(state["req_key"], state["title"], state["clauses"], state["untrusted"]),
                      RequirementAnalysis)
    out.update(cast(ReqState, extra))
    insights = {c.clause_key: c for c in res.data.clauses} if res else {}
    valid_keys = {c["key"] for c in state["clauses"]}
    with session_scope() as db:
        for c in db.execute(select(Clause).join(Clause.version).where(
                Clause.requirement_id == state["requirement_id"])).scalars():
            if c.version.version != state["version"]:
                continue
            flags = detect_ambiguity(c.text)
            analysis: dict[str, Any] = {"source_fact": c.text, "missing_information": detect_missing_information(c.text),
                                        "deterministic_flags": flags}
            ins = insights.get(c.clause_key)
            if ins:
                analysis.update({
                    "ai_business_rules": ins.business_rules, "ai_interpretation": ins.interpretation,
                    "ai_ambiguities": ins.ambiguities, "ai_missing_information": ins.missing_information,
                    "conflicts_with": [k for k in ins.conflicts_with if k in valid_keys and k != c.clause_key],
                    "clarifying_questions": ins.clarifying_questions, "provider": res.provider, "model": res.model})
            c.ambiguity_flags = flags
            c.analysis = analysis
        if res:
            req = db.get(Requirement, state["requirement_id"])
            req.status = "analysed" if req.status in ("draft", "changed") else req.status
            req.analysed_at = utcnow()
            audit.record(db, state.get("actor_id"), "requirement.analysed", "requirement", req.id, req.key,
                         req.project_id, {"provider": res.provider, "model": res.model,
                                          "assumptions": res.data.assumptions})
    tasks.step(state["run_id"], "ambiguity_detector", "completed" if res else "degraded",
               {"ai": bool(res)}, progress=0.3)
    return out


def acceptance_criteria_generator(state: ReqState) -> ReqState:
    with session_scope() as db:
        existing = db.execute(select(AcceptanceCriterion).where(
            AcceptanceCriterion.requirement_id == state["requirement_id"],
            AcceptanceCriterion.requirement_version == state["version"],
            AcceptanceCriterion.review_status != "rejected")).scalars().all()
        if existing:
            reused = [{"key": a.key, "clause_keys": a.clause_keys, "description": a.description} for a in existing]
            tasks.step(state["run_id"], "acceptance_criteria_generator", "reused", {"count": len(reused)}, 0.45)
            return {"criteria": reused}
    out: ReqState = {"invalid_items": list(state.get("invalid_items", []))}
    crit: list[dict] = []
    texts = {c["key"]: c["text"] for c in state["clauses"]}
    for group in _groups(state["clauses"]):
        merged = cast(ReqState, {**state, **out})
        prompt_text = prompts.ac_prompt(state["req_key"], group, state["untrusted"])
        res, extra = _llm(merged, "acceptance_criteria", prompt_text, AcceptanceCriteriaBatch)
        out.update(cast(ReqState, extra))
        if not res:
            continue

        valid_criteria = []
        pending = []
        for item in res.data.criteria:
            unknown = [k for k in item.clause_keys if k not in texts]
            verified = not unknown and verify_quote(item.source_quote, [texts[k] for k in item.clause_keys])
            if verified:
                valid_criteria.append(item)
            else:
                reason = f"Unknown clauses {unknown}" if unknown else f"Source quotation '{item.source_quote}' not found verbatim in cited clauses {item.clause_keys}"
                pending.append({"item": item, "clause_keys": item.clause_keys, "description": item.description,
                                "source_quote": item.source_quote, "_failure_reason": reason})

        attempt = 0
        while pending and attempt < 2:
            attempt += 1
            repair_msg = prompts.quote_repair_prompt("acceptance_criteria", prompt_text, pending, texts)
            rep_res, _ = _llm(merged, "acceptance_criteria", repair_msg, AcceptanceCriteriaBatch)
            if not rep_res:
                break
            new_pending = []
            for item in rep_res.data.criteria:
                unknown = [k for k in item.clause_keys if k not in texts]
                verified = not unknown and verify_quote(item.source_quote, [texts[k] for k in item.clause_keys])
                if verified:
                    valid_criteria.append(item)
                else:
                    reason = f"Unknown clauses {unknown}" if unknown else f"Source quotation '{item.source_quote}' not found verbatim in cited clauses {item.clause_keys}"
                    new_pending.append({"item": item, "clause_keys": item.clause_keys, "description": item.description,
                                        "source_quote": item.source_quote, "_failure_reason": reason})
            pending = new_pending

        for p in pending:
            out["invalid_items"].append({
                "task": "acceptance_criteria",
                "description": p["description"],
                "clause_keys": p["clause_keys"],
                "quote": p["source_quote"],
                "error": f"Ungrounded: {p['_failure_reason']} (rejected after {attempt} repair attempts)"
            })

        with session_scope() as db:
            n = db.query(AcceptanceCriterion).filter_by(requirement_id=state["requirement_id"]).count()
            for item in valid_criteria:
                n += 1
                ac = AcceptanceCriterion(
                    key=f"{state['req_key']}.AC{n}", requirement_id=state["requirement_id"],
                    requirement_version=state["version"], clause_keys=item.clause_keys, description=item.description,
                    preconditions=item.preconditions, expected_behaviour=item.expected_behaviour,
                    validation_conditions=item.validation_conditions, source_quote=item.source_quote,
                    quote_verified=True, confidence=item.confidence, rationale=item.rationale,
                    assumptions=item.assumptions, review_status="pending", provider=res.provider, model=res.model)
                db.add(ac)
                crit.append({"key": ac.key, "clause_keys": ac.clause_keys, "description": ac.description})
    tasks.step(state["run_id"], "acceptance_criteria_generator", "completed" if crit else "degraded",
               {"count": len(crit)}, 0.45)
    out["criteria"] = crit
    return out


def _generate_tests(state: ReqState, edge: bool) -> ReqState:
    out: ReqState = {"invalid_items": list(state.get("invalid_items", [])),
                     "generated_tests": list(state.get("generated_tests", []))}
    crit = state.get("criteria", [])
    texts = {c["key"]: c["text"] for c in state["clauses"]}
    task = "edge_case_tests" if edge else "test_cases"
    for group in _groups(state["clauses"]):
        keys = {c["key"] for c in group}
        group_crit = [c for c in crit if keys & set(c["clause_keys"])]
        merged = cast(ReqState, {**state, **out})
        prompt_text = prompts.test_prompt(state["req_key"], group, group_crit, state["untrusted"], edge)
        res, extra = _llm(merged, task, prompt_text, TestCaseBatch)
        out.update(cast(ReqState, {k: v for k, v in extra.items() if k != "invalid_items"}))
        if "invalid_items" in extra:
            out["invalid_items"] = extra["invalid_items"]
        if not res:
            continue

        def _check_items(items):
            passed = []
            quote_errs = []
            script_errs = []
            for item in items:
                unknown = [k for k in item.clause_keys if k not in texts]
                verified = not unknown and verify_quote(item.source_quote, [texts[k] for k in item.clause_keys])
                if not verified:
                    reason = f"Unknown clauses {unknown}" if unknown else f"Source quotation '{item.source_quote}' not found verbatim in cited clauses {item.clause_keys}"
                    quote_errs.append({"item": item, "clause_keys": item.clause_keys, "title": item.title,
                                       "source_quote": item.source_quote, "_failure_reason": reason})
                    continue
                if item.automation == "pytest" and item.script:
                    rep = validate_script(item.script, env_kind="reference_hcm")
                    if not rep.valid:
                        script_errs.append({"item": item, "title": item.title, "script": item.script,
                                            "error": "AST error: " + "; ".join(rep.errors)})
                        continue
                    try:
                        trial = run_pytest([ScriptSpec("TC-TRIAL", item.script)], hcm_version="1.1", timeout_s=4, env_kind="reference_hcm")
                        o = trial.outcomes.get("TC-TRIAL")
                        if o and o.status not in ("passed", "skipped"):
                            script_errs.append({"item": item, "title": item.title, "script": item.script,
                                                "error": f"Trial run {o.status}: {(o.message or o.stack_trace)[:300]}"})
                            continue
                    except Exception:
                        pass
                passed.append(item)
            return passed, quote_errs, script_errs

        valid_tests, pending_quotes, pending_scripts = _check_items(res.data.tests)
        attempt = 0
        while (pending_quotes or pending_scripts) and attempt < 2:
            attempt += 1
            if pending_quotes:
                repair_msg = prompts.quote_repair_prompt(task, prompt_text, pending_quotes, texts)
            else:
                repair_msg = prompts.test_repair_prompt(task, prompt_text, pending_scripts)
            rep_res, _ = _llm(merged, task, repair_msg, TestCaseBatch)
            if not rep_res:
                break
            repaired_valid, pending_quotes, pending_scripts = _check_items(rep_res.data.tests)
            valid_tests.extend(repaired_valid)

        for p in pending_quotes:
            out["invalid_items"].append({
                "task": task, "description": p["title"], "clause_keys": p["clause_keys"],
                "quote": p["source_quote"], "error": f"Ungrounded quote: {p['_failure_reason']} (after {attempt} repairs)"
            })
        for s in pending_scripts:
            out["invalid_items"].append({
                "task": task, "description": s["title"], "clause_keys": getattr(s["item"], "clause_keys", []),
                "quote": getattr(s["item"], "source_quote", ""), "error": f"Script failure: {s['error']} (after {attempt} repairs)"
            })

        with session_scope() as db:
            req = db.get(Requirement, state["requirement_id"])
            clauses = clauses_for(db, current_version(db, req))
            for item in valid_tests:
                data = item.model_dump()
                data["ac_keys"] = [group_crit[i - 1]["key"] for i in item.ac_refs if 0 < i <= len(group_crit)]
                t = create_test(db, req, data, actor_id=state.get("actor_id"), provider=res.provider,
                                model=res.model, clauses=clauses)
                out["generated_tests"].append(t.key)
    tasks.step(state["run_id"], task, "completed", {"total_generated": len(out["generated_tests"])},
               0.75 if edge else 0.6)
    return out


def test_generator(state: ReqState) -> ReqState:
    return _generate_tests(state, edge=False)


def edge_case_generator(state: ReqState) -> ReqState:
    if state.get("degraded") and not state.get("generated_tests"):
        return {}
    return _generate_tests(state, edge=True)


def validator(state: ReqState) -> ReqState:
    with session_scope() as db:
        rows = db.execute(select(TestCase).where(TestCase.key.in_(state.get("generated_tests", []) or ["-"]))).scalars()
        summary = {"valid": 0, "invalid": 0, "duplicates": 0, "low_confidence": 0}
        for t in rows:
            summary["valid" if t.validation_status == "valid" else "invalid"] += 1
            summary["duplicates"] += 1 if t.duplicate_of else 0
            summary["low_confidence"] += 1 if t.confidence < 0.6 else 0
    tasks.step(state["run_id"], "validator", detail=summary, progress=0.85)
    return {}


def gap_checker(state: ReqState) -> ReqState:
    with session_scope() as db:
        tests = db.execute(select(TestCase.clause_keys).where(
            TestCase.requirement_id == state["requirement_id"],
            TestCase.status.notin_(["rejected", "deprecated"]))).scalars().all()
    cov = clause_coverage([c["key"] for c in state["clauses"]], list(tests))
    tasks.step(state["run_id"], "gap_checker", detail=cov, progress=0.9)
    return {"coverage": cov}


def human_review(state: ReqState) -> ReqState:
    with session_scope() as db:
        req = db.get(Requirement, state["requirement_id"])
        audit.record(db, state.get("actor_id"), "workflow.review_completed", "requirement", req.id, req.key,
                     req.project_id, {"run_id": state["run_id"]})
    return {"review_complete": True}


def _after_ac(state: ReqState) -> str:
    return END if state.get("mode") == "analyse" else "test_generator"


def build_graph() -> StateGraph:
    g = StateGraph(ReqState)
    for name, fn in [("ingest", ingest), ("sanitize", sanitize), ("clause_parser", clause_parser),
                     ("ambiguity_detector", ambiguity_detector),
                     ("acceptance_criteria_generator", acceptance_criteria_generator),
                     ("test_generator", test_generator), ("edge_case_generator", edge_case_generator),
                     ("validator", validator), ("gap_checker", gap_checker), ("human_review", human_review)]:
        g.add_node(name, fn)
    g.add_edge(START, "ingest")
    for a, b in [("ingest", "sanitize"), ("sanitize", "clause_parser"), ("clause_parser", "ambiguity_detector"),
                 ("ambiguity_detector", "acceptance_criteria_generator"), ("test_generator", "edge_case_generator"),
                 ("edge_case_generator", "validator"), ("validator", "gap_checker"), ("gap_checker", "human_review"),
                 ("human_review", END)]:
        g.add_edge(a, b)
    g.add_conditional_edges("acceptance_criteria_generator", _after_ac, ["test_generator", END])
    return g


_compiled = None
_conn_lock = threading.Lock()


def compiled():
    global _compiled
    with _conn_lock:
        if _compiled is None:
            conn = sqlite3.connect(str(get_settings().checkpoint_db_path), check_same_thread=False)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA busy_timeout=10000")
            _compiled = build_graph().compile(checkpointer=SqliteSaver(conn), interrupt_before=["human_review"])
        return _compiled


def reset_compiled() -> None:
    global _compiled
    _compiled = None


def run_requirement_workflow(run_id: int, requirement_id: int, actor_id: int | None, mode: str) -> dict:
    thread = {"configurable": {"thread_id": f"run-{run_id}"}}
    tasks.update_run(run_id, thread_id=f"run-{run_id}")
    final = compiled().invoke({"requirement_id": requirement_id, "run_id": run_id, "actor_id": actor_id,
                               "mode": mode}, thread)
    status = "completed"
    if final.get("degraded"):
        status = "degraded"
    elif mode == "generate":
        status = "awaiting_review"
    return {"_status": status, "mode": mode, "criteria": len(final.get("criteria", [])),
            "generated_tests": final.get("generated_tests", []), "invalid_items": final.get("invalid_items", []),
            "provider_errors": final.get("provider_errors", []), "providers_used": final.get("providers_used", []),
            "injection_markers": final.get("injection_markers", []), "coverage": final.get("coverage")}


def resume_after_review(run_id: int) -> bool:
    """Resume an interrupted workflow once every generated test has a review decision."""
    thread = {"configurable": {"thread_id": f"run-{run_id}"}}
    snap = compiled().get_state(thread)
    if not snap.next or "human_review" not in snap.next:
        return False
    keys = snap.values.get("generated_tests", [])
    with session_scope() as db:
        pending = db.query(TestCase).filter(TestCase.key.in_(keys or ["-"]),
                                            TestCase.status == "pending_review").count()
    if pending:
        return False
    compiled().invoke(None, thread)
    tasks.update_run(run_id, status="completed", finished_at=utcnow(), message="Human review completed", progress=1.0)
    return True
