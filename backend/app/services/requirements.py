"""Requirement management: immutable versions, clause segmentation, diffing and change impact."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BadRequest
from app.core.security import sha256_text
from app.db.base import utcnow
from app.db.models import Clause, Project, Requirement, RequirementVersion, SuiteTestCase, TestCase, TestSuite
from app.guardrails.ambiguity import detect_ambiguity
from app.guardrails.clauses import split_clauses
from app.guardrails.duplicates import similarity
from app.guardrails.sanitize import detect_injection, sanitize_text
from app.services import audit
from app.services.keys import next_key


def content_hash(title: str, description: str, objective: str) -> str:
    return sha256_text("\x1f".join([title.strip(), description.strip(), objective.strip()]))


def current_version(db: Session, req: Requirement) -> RequirementVersion:
    v = db.execute(select(RequirementVersion).where(RequirementVersion.requirement_id == req.id,
                                                    RequirementVersion.version == req.current_version)).scalar_one()
    return v


def clauses_for(db: Session, version: RequirementVersion) -> list[Clause]:
    return list(db.execute(select(Clause).where(Clause.version_id == version.id).order_by(Clause.position)).scalars())


def _insert_clauses(db: Session, req: Requirement, version: RequirementVersion, description: str,
                    previous: list[Clause] | None) -> list[Clause]:
    parsed = split_clauses(req.key, description)
    prev = previous or []
    used: set[str] = set()
    next_num = max([int(c.clause_key.rsplit(".C", 1)[1]) for c in prev], default=0) + 1
    out = []
    for pc in parsed:
        key = None
        same = next((c for c in prev if c.normalized_hash == pc.normalized_hash and c.clause_key not in used), None)
        if same:
            key = same.clause_key
        else:
            best = max(((similarity(c.text, pc.text), c) for c in prev if c.clause_key not in used),
                       key=lambda t: t[0], default=(0.0, None))
            if best[1] is not None and best[0] >= 0.5:
                key = best[1].clause_key
        if key is None:
            if previous is None:
                key = pc.key
            else:
                key = f"{req.key}.C{next_num}"
                next_num += 1
        used.add(key)
        clause = Clause(version_id=version.id, requirement_id=req.id, clause_key=key, position=pc.position,
                        text=pc.text, normalized_hash=pc.normalized_hash, ambiguity_flags=detect_ambiguity(pc.text),
                        analysis={})
        db.add(clause)
        out.append(clause)
    db.flush()
    return out


def create_requirement(db: Session, project: Project, *, title: str, description: str, business_objective: str = "",
                       priority: str = "medium", category: str = "functional", module_id: int | None = None,
                       author_id: int | None = None, source_type: str = "manual", key: str | None = None,
                       origin: str = "manual", source_commit_sha: str | None = None, confidence: float | None = None,
                       document_id: int | None = None, source_section: str | None = None, source_page: str | None = None,
                       evidence_excerpt: str | None = None, related_scenario: str | None = None,
                       dependencies: list[str] | None = None, extraction_provenance: str = "explicit_documented",
                       review_status: str = "pending_review", created_at=None, audit_source: str = "platform") -> Requirement:
    description = sanitize_text(description)
    if len(description) < 10:
        raise BadRequest("Requirement description is too short")
    key = key or next_key(db, Requirement, f"{project.key}-REQ", 3)
    ts = created_at or utcnow()
    initial_status = "needs_confirmation" if (origin == "inferred_from_code" or extraction_provenance == "ai_inferred") else "draft"
    req = Requirement(key=key, project_id=project.id, module_id=module_id, document_id=document_id,
                      title=title.strip(), category=category, priority=priority, status=initial_status,
                      current_version=1, author_id=author_id, source_type=source_type, origin=origin,
                      source_commit_sha=source_commit_sha, source_section=source_section, source_page=source_page,
                      evidence_excerpt=evidence_excerpt, related_scenario=related_scenario,
                      dependencies=dependencies or [], extraction_provenance=extraction_provenance,
                      review_status=review_status, confidence=confidence, created_at=ts, updated_at=ts)
    db.add(req)
    db.flush()
    v = RequirementVersion(requirement_id=req.id, version=1, title=req.title, description=description,
                           business_objective=business_objective.strip(),
                           content_hash=content_hash(req.title, description, business_objective),
                           change_summary="Initial version", author_id=author_id, created_at=ts)
    db.add(v)
    db.flush()
    _insert_clauses(db, req, v, description, None)
    audit.record(db, author_id, "requirement.created", "requirement", req.id, req.key, project.id,
                 {"version": 1, "injection_markers": detect_injection(description), "provenance": extraction_provenance},
                 source=audit_source, created_at=ts)
    return req


def update_requirement(db: Session, req: Requirement, *, actor_id: int | None, title: str | None = None,
                       description: str | None = None, business_objective: str | None = None,
                       priority: str | None = None, category: str | None = None, module_id: int | None = None,
                       status: str | None = None, review_status: str | None = None, dependencies: list[str] | None = None,
                       change_summary: str = "", created_at=None,
                       audit_source: str = "platform") -> dict:
    """Metadata edits update the requirement row; content edits create a new immutable version."""
    cur = current_version(db, req)
    new_title = title.strip() if title is not None else cur.title
    new_desc = sanitize_text(description) if description is not None else cur.description
    new_obj = business_objective.strip() if business_objective is not None else cur.business_objective
    ts = created_at or utcnow()
    for attr, val in (
        ("priority", priority),
        ("category", category),
        ("module_id", module_id),
        ("status", status),
        ("review_status", review_status),
        ("dependencies", dependencies),
    ):
        if val is not None:
            setattr(req, attr, val)
    result: dict = {"new_version": False}
    if content_hash(new_title, new_desc, new_obj) != cur.content_hash:
        prev_clauses = clauses_for(db, cur)
        v = RequirementVersion(requirement_id=req.id, version=cur.version + 1, title=new_title, description=new_desc,
                               business_objective=new_obj, content_hash=content_hash(new_title, new_desc, new_obj),
                               change_summary=change_summary or "Content updated", author_id=actor_id, created_at=ts)
        db.add(v)
        db.flush()
        _insert_clauses(db, req, v, new_desc, prev_clauses)
        req.current_version = v.version
        req.title = new_title
        if req.status in ("analysed", "approved"):
            req.status = "changed"
        impact = impact_analysis(db, req, cur.version, v.version, apply=True, actor_id=actor_id)
        result = {"new_version": True, "version": v.version, "impact": impact}
    req.updated_at = ts
    audit.record(db, actor_id, "requirement.updated", "requirement", req.id, req.key, req.project_id,
                 {"new_version": result.get("version"), "change_summary": change_summary}, source=audit_source,
                 created_at=ts)
    return result


def diff_versions(db: Session, req: Requirement, from_v: int, to_v: int) -> dict:
    va = db.execute(select(RequirementVersion).filter_by(requirement_id=req.id, version=from_v)).scalar_one_or_none()
    vb = db.execute(select(RequirementVersion).filter_by(requirement_id=req.id, version=to_v)).scalar_one_or_none()
    if va is None or vb is None:
        raise BadRequest("Unknown version")
    a = {c.clause_key: c for c in clauses_for(db, va)}
    b = {c.clause_key: c for c in clauses_for(db, vb)}
    added = [{"clause_key": k, "text": c.text} for k, c in b.items() if k not in a]
    removed = [{"clause_key": k, "text": c.text} for k, c in a.items() if k not in b]
    modified = [{"clause_key": k, "before": a[k].text, "after": c.text} for k, c in b.items()
                if k in a and a[k].normalized_hash != c.normalized_hash]
    unchanged = [k for k, c in b.items() if k in a and a[k].normalized_hash == c.normalized_hash]
    return {"requirement": req.key, "from_version": from_v, "to_version": to_v,
            "title_changed": va.title != vb.title, "objective_changed": va.business_objective != vb.business_objective,
            "added": added, "removed": removed, "modified": modified, "unchanged": unchanged}


def impact_analysis(db: Session, req: Requirement, from_v: int, to_v: int, apply: bool = False,
                    actor_id: int | None = None) -> dict:
    diff = diff_versions(db, req, from_v, to_v)
    changed = {c["clause_key"] for c in diff["modified"]} | {c["clause_key"] for c in diff["removed"]}
    tests = list(db.execute(select(TestCase).where(TestCase.requirement_id == req.id,
                                                   TestCase.status != "deprecated")).scalars())
    impacted = [t for t in tests if changed & set(t.clause_keys)]
    suite_rows = db.execute(select(TestSuite.key, TestSuite.name, SuiteTestCase.test_case_id)
                            .join(SuiteTestCase, SuiteTestCase.suite_id == TestSuite.id)
                            .where(SuiteTestCase.test_case_id.in_([t.id for t in impacted] or [-1]))).all()
    suites = sorted({(r[0], r[1]) for r in suite_rows})
    if apply:
        for t in impacted:
            if t.status == "approved":
                t.status = "needs_reapproval"
                t.needs_reapproval_reason = (f"Requirement {req.key} changed v{from_v}→v{to_v}; clauses "
                                             f"{', '.join(sorted(changed & set(t.clause_keys)))} modified or removed")
                audit.record(db, actor_id, "test.reapproval_required", "test_case", t.id, t.key, t.project_id,
                             {"from_version": from_v, "to_version": to_v})
    return {**diff, "changed_clause_keys": sorted(changed),
            "impacted_tests": [{"key": t.key, "id": t.id, "title": t.title, "status": t.status,
                                "clause_keys": t.clause_keys} for t in impacted],
            "impacted_suites": [{"key": k, "name": n} for k, n in suites],
            "uncovered_new_clauses": [c["clause_key"] for c in diff["added"]
                                      if not any(c["clause_key"] in t.clause_keys for t in tests)]}
