"""Model -> JSON serialisers (secrets are never included)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import models as m


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def user_ref(db: Session, uid: int | None) -> dict | None:
    if not uid:
        return None
    u = db.get(m.User, uid)
    return {"id": u.id, "name": u.full_name, "email": u.email} if u else None


def user(u: m.User) -> dict:
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "title": u.title, "is_active": u.is_active,
            "can_login": u.can_login, "roles": sorted(r.role.name for r in u.roles),
            "last_login_at": iso(u.last_login_at), "created_at": iso(u.created_at)}


def project(p: m.Project) -> dict:
    return {
        "id": p.id,
        "key": p.key,
        "name": p.name,
        "description": p.description,
        "status": p.status,
        "project_type": getattr(p, "project_type", "requirements_based") or "requirements_based",
        "business_domain": getattr(p, "business_domain", "") or "",
        "product_type": getattr(p, "product_type", "") or "",
        "target_users_and_roles": getattr(p, "target_users_and_roles", []) or [],
        "objectives": getattr(p, "objectives", []) or [],
        "business_scenarios": getattr(p, "business_scenarios", []) or [],
        "functional_expectations": getattr(p, "functional_expectations", []) or [],
        "non_functional_expectations": getattr(p, "non_functional_expectations", []) or [],
        "constraints_and_assumptions": getattr(p, "constraints_and_assumptions", []) or [],
        "explicit_exclusions": getattr(p, "explicit_exclusions", []) or [],
        "owner_id": p.owner_id,
        "created_at": iso(p.created_at),
        "updated_at": iso(p.updated_at),
    }


def document(d: m.Document) -> dict:
    return {
        "id": d.id,
        "project_id": d.project_id,
        "filename": d.filename,
        "file_type": d.file_type,
        "file_size_bytes": d.file_size_bytes,
        "purpose": d.purpose,
        "description": d.description,
        "status": d.status,
        "error_message": d.error_message,
        "extracted_text_preview": (d.extracted_text or "")[:500],
        "metadata": d.metadata_json or {},
        "created_at": iso(d.created_at),
        "updated_at": iso(d.updated_at),
    }


def requirement_clarification(c: m.RequirementClarification) -> dict:
    return {
        "id": c.id,
        "project_id": c.project_id,
        "requirement_id": c.requirement_id,
        "type": c.type,
        "question": c.question,
        "context": c.context,
        "impact": c.impact,
        "suggested_resolution": c.suggested_resolution,
        "user_response": c.user_response,
        "status": c.status,
        "created_at": iso(c.created_at),
        "resolved_at": iso(c.resolved_at) if c.resolved_at else None,
    }


def simulation_model(sm: m.SimulationModel) -> dict:
    return {
        "id": sm.id,
        "project_id": sm.project_id,
        "name": sm.name,
        "version": sm.version,
        "domain": sm.domain,
        "definition": sm.definition_json or {},
        "status": sm.status,
        "created_at": iso(sm.created_at),
        "updated_at": iso(sm.updated_at),
    }


def module(x: m.Module) -> dict:
    return {"id": x.id, "project_id": x.project_id, "code": x.code, "name": x.name, "description": x.description}


def environment(e: m.Environment) -> dict:
    return {"id": e.id, "project_id": e.project_id, "name": e.name, "kind": e.kind, "hcm_version": e.hcm_version,
            "base_url": e.base_url, "is_default": e.is_default}


def requirement(db: Session, r: m.Requirement) -> dict:
    mod = db.get(m.Module, r.module_id) if r.module_id else None
    proj = db.get(m.Project, r.project_id)
    clauses_count = db.scalar(select(func.count(m.Clause.id)).where(m.Clause.requirement_id == r.id)) or 0
    approved_tests = db.scalar(
        select(func.count(m.TestCase.id)).where(
            m.TestCase.requirement_id == r.id,
            m.TestCase.status.in_(["approved", "verified"]),
        )
    ) or 0
    coverage_pct = (
        min(100.0, round((approved_tests / max(1, clauses_count)) * 100.0, 1))
        if clauses_count > 0
        else 0.0
    )

    return {
        "id": r.id,
        "key": r.key,
        "project_id": r.project_id,
        "project_key": proj.key if proj else None,
        "module": module(mod) if mod else None,
        "title": r.title,
        "category": r.category,
        "priority": r.priority,
        "status": r.status,
        "version": r.current_version,
        "source_type": r.source_type,
        "origin": getattr(r, "origin", "documented") or "documented",
        "source_commit_sha": getattr(r, "source_commit_sha", None),
        "document_id": getattr(r, "document_id", None),
        "source_section": getattr(r, "source_section", None),
        "source_page": getattr(r, "source_page", None),
        "evidence_excerpt": getattr(r, "evidence_excerpt", None),
        "related_scenario": getattr(r, "related_scenario", None),
        "dependencies": getattr(r, "dependencies", []) or [],
        "extraction_provenance": getattr(r, "extraction_provenance", "explicit_documented") or "explicit_documented",
        "review_status": getattr(r, "review_status", "pending_review") or "pending_review",
        "confidence": getattr(r, "confidence", None),
        "clauses_count": clauses_count,
        "coverage_pct": coverage_pct,
        "author": user_ref(db, r.author_id),
        "analysed_at": iso(r.analysed_at),
        "created_at": iso(r.created_at),
        "updated_at": iso(r.updated_at),
    }


def version(db: Session, v: m.RequirementVersion) -> dict:
    return {"id": v.id, "version": v.version, "title": v.title, "description": v.description,
            "business_objective": v.business_objective, "content_hash": v.content_hash,
            "change_summary": v.change_summary, "author": user_ref(db, v.author_id), "created_at": iso(v.created_at)}


def clause(c: m.Clause) -> dict:
    return {"id": c.id, "clause_key": c.clause_key, "position": c.position, "text": c.text,
            "ambiguity_flags": c.ambiguity_flags, "analysis": c.analysis}


def criterion(a: m.AcceptanceCriterion) -> dict:
    return {"id": a.id, "key": a.key, "requirement_id": a.requirement_id, "requirement_version": a.requirement_version,
            "clause_keys": a.clause_keys, "description": a.description, "preconditions": a.preconditions,
            "expected_behaviour": a.expected_behaviour, "validation_conditions": a.validation_conditions,
            "actor": getattr(a, "actor", None), "action": getattr(a, "action", None),
            "input_conditions": getattr(a, "input_conditions", []) or [],
            "expected_output": getattr(a, "expected_output", None),
            "business_rules": getattr(a, "business_rules", []) or [],
            "source_quote": a.source_quote, "quote_verified": a.quote_verified, "confidence": a.confidence,
            "rationale": a.rationale, "assumptions": a.assumptions, "review_status": a.review_status,
            "provider": a.provider, "model": a.model, "created_at": iso(a.created_at)}


def test_case(db: Session, t: m.TestCase, full: bool = False) -> dict:
    req = db.get(m.Requirement, t.requirement_id)
    out = {"id": t.id, "key": t.key, "project_id": t.project_id, "requirement_id": t.requirement_id,
           "requirement_key": req.key if req else None, "requirement_version": t.requirement_version,
           "clause_keys": t.clause_keys, "ac_keys": t.ac_keys, "title": t.title, "priority": t.priority,
           "test_type": t.test_type, "confidence": t.confidence, "automation": t.automation, "status": t.status,
           "test_category": getattr(t, "test_category", "positive") or "positive",
           "execution_capability": getattr(t, "execution_capability", "specification_validation") or "specification_validation",
           "approval_status": getattr(t, "approval_status", "draft") or "draft",
           "generation_provenance": getattr(t, "generation_provenance", "ai_generated") or "ai_generated",
           "steps_json": getattr(t, "steps_json", []) or [],
           "validation_status": t.validation_status, "version": t.version, "provider": t.provider, "model": t.model,
           "duplicate_of": t.duplicate_of, "quote_verified": t.quote_verified,
           "needs_reapproval_reason": t.needs_reapproval_reason, "updated_at": iso(t.updated_at),
           "created_at": iso(t.created_at)}
    if full:
        out.update({"description": t.description, "preconditions": t.preconditions, "test_data": t.test_data,
                    "expected_result": t.expected_result, "source_quote": t.source_quote, "rationale": t.rationale,
                    "script": t.script, "script_hash": t.script_hash, "validation_errors": t.validation_errors,
                    "steps": [{"position": s.position, "action": s.action, "expected": s.expected} for s in t.steps],
                    "created_by": user_ref(db, t.created_by), "reviewer": user_ref(db, t.reviewer_id)})
    return out


def suite(db: Session, s: m.TestSuite, count: int | None = None) -> dict:
    mod = db.get(m.Module, s.module_id) if s.module_id else None
    return {"id": s.id, "key": s.key, "project_id": s.project_id, "module": module(mod) if mod else None,
            "name": s.name, "description": s.description, "priority": s.priority, "test_count": count,
            "created_at": iso(s.created_at), "updated_at": iso(s.updated_at)}


def execution(db: Session, e: m.Execution) -> dict:
    env = db.get(m.Environment, e.environment_id)
    s = db.get(m.TestSuite, e.suite_id) if e.suite_id else None
    return {"id": e.id, "key": e.key, "project_id": e.project_id, "suite": {"id": s.id, "key": s.key, "name": s.name}
            if s else None, "environment": environment(env) if env else None, "source": e.source, "runner": e.runner,
            "status": e.status, "isolation_level": getattr(e, "isolation_level", "none") or "none",
            "execution_type": getattr(e, "execution_type", "simulation") or "simulation",
            "model_id": getattr(e, "model_id", None),
            "log_excerpt": getattr(e, "log_excerpt", "") or "",
            "hcm_version": e.hcm_version, "total": e.total, "passed": e.passed,
            "failed": e.failed, "errored": e.errored, "skipped": e.skipped, "duration_ms": e.duration_ms,
            "commit_sha": e.commit_sha, "branch": e.branch, "retry_of_id": e.retry_of_id, "run_id": e.run_id,
            "triggered_by": user_ref(db, e.triggered_by), "started_at": iso(e.started_at),
            "finished_at": iso(e.finished_at), "created_at": iso(e.created_at)}


def result(db: Session, r: m.ExecutionResult) -> dict:
    t = db.get(m.TestCase, r.test_case_id)
    return {"id": r.id, "execution_id": r.execution_id, "test_case_id": r.test_case_id,
            "test_key": t.key if t else None, "test_title": t.title if t else None,
            "test_case_version": r.test_case_version, "script_hash": r.script_hash, "status": r.status,
            "duration_ms": r.duration_ms, "message": r.message, "stack_trace": r.stack_trace, "stdout": r.stdout,
            "failure_analysis": r.failure_analysis, "started_at": iso(r.started_at), "finished_at": iso(r.finished_at)}


def defect(db: Session, d: m.Defect, full: bool = False) -> dict:
    out = {"id": d.id, "key": d.key, "project_id": d.project_id, "title": d.title, "severity": d.severity,
           "priority": d.priority, "status": d.status, "approval_status": d.approval_status,
           "evidence_type": getattr(d, "evidence_type", "manual") or "manual",
           "owner": user_ref(db, d.owner_id), "test_case_id": d.test_case_id, "requirement_id": d.requirement_id,
           "execution_id": d.execution_id, "github_issue_url": d.github_issue_url,
           "github_issue_state": d.github_issue_state, "created_at": iso(d.created_at),
           "updated_at": iso(d.updated_at), "resolved_at": iso(d.resolved_at)}
    if full:
        t = db.get(m.TestCase, d.test_case_id) if d.test_case_id else None
        r = db.get(m.Requirement, d.requirement_id) if d.requirement_id else None
        e = db.get(m.Execution, d.execution_id) if d.execution_id else None
        ve = db.get(m.Execution, d.verified_execution_id) if d.verified_execution_id else None
        out.update({"description": d.description, "expected_result": d.expected_result,
                    "actual_result": d.actual_result, "reproduction_steps": d.reproduction_steps,
                    "error_log": d.error_log, "stack_trace": d.stack_trace, "ai_analysis": d.ai_analysis,
                    "reporter": user_ref(db, d.reporter_id), "execution_result_id": d.execution_result_id,
                    "test_key": t.key if t else None, "requirement_key": r.key if r else None,
                    "execution_key": e.key if e else None, "verified_execution": {"id": ve.id, "key": ve.key}
                    if ve else None, "github_issue_number": d.github_issue_number})
    return out


def audit_entry(db: Session, a: m.AuditLog) -> dict:
    return {"id": a.id, "actor": user_ref(db, a.actor_id), "action": a.action, "entity_type": a.entity_type,
            "entity_id": a.entity_id, "entity_key": a.entity_key, "project_id": a.project_id, "source": a.source,
            "details": a.details, "trace_id": a.trace_id, "created_at": iso(a.created_at)}


def run(r: m.Run, steps: list[m.RunStep] | None = None) -> dict:
    out = {"id": r.id, "kind": r.kind, "status": r.status, "subject_type": r.subject_type, "subject_id": r.subject_id,
           "progress": r.progress, "message": r.message, "result": r.result, "error": r.error,
           "created_at": iso(r.created_at), "started_at": iso(r.started_at), "finished_at": iso(r.finished_at)}
    if steps is not None:
        out["steps"] = [{"name": s.name, "status": s.status, "detail": s.detail, "at": iso(s.finished_at)}
                        for s in steps]
    return out


def eval_run(e: m.EvalRun) -> dict:
    return {"id": e.id, "provider": e.provider, "model": e.model, "is_fixture": e.is_fixture, "status": e.status,
            "metrics": e.metrics, "scenario_count": e.scenario_count, "error": e.error,
            "started_at": iso(e.started_at), "finished_at": iso(e.finished_at)}
