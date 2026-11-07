"""Requirement Intelligence Service: Grounded extraction, classification, provenance tracking,

ambiguity and contradiction detection, and clarification generation.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BadRequest
from app.db.base import utcnow
from app.db.models import Document, Project, Requirement, RequirementClarification
from app.services import audit
from app.services.requirements import create_requirement

log = logging.getLogger("tracetest.intelligence")

# Category classification heuristics
CATEGORY_KEYWORDS = {
    "security": ["token", "jwt", "auth", "permission", "encryption", "hash", "rbac", "secret", "password", "cors", "vulnerability"],
    "business_rule": ["eligibility", "calculation", "tax", "policy", "threshold", "rule", "salary", "bonus", "discount", "accrual"],
    "validation_rule": ["validate", "must be between", "regex", "format", "length", "boundary", "mandatory", "non-empty", "required field"],
    "performance_constraint": ["latency", "throughput", "response time", "concurrency", "qps", "sla", "ms", "load"],
    "data_requirement": ["schema", "database", "store", "persist", "dynamodb", "sqlite", "retention", "archive", "export"],
    "integration_requirement": ["api", "webhook", "endpoint", "rest", "grpc", "third-party", "gateway", "service"],
    "permission_role": ["role", "admin", "doctor", "patient", "manager", "anonymous", "authenticated", "viewer", "editor"],
    "operational_requirement": ["log", "audit", "monitoring", "telemetry", "backup", "disaster recovery", "uptime"],
    "non_functional": ["scalability", "maintainability", "reliability", "availability", "usability"],
}

AMBIGUITY_PATTERNS = [
    (r"\b(fast|speedy|quickly|real[- ]time)\b", "unspecified_boundary", "Unspecified latency boundary",
     "The term '{match}' is vague. What is the maximum acceptable latency in milliseconds?"),
    (r"\b(user[- ]friendly|intuitive|seamless|simple)\b", "ambiguity", "Subjective usability criterion",
     "The term '{match}' cannot be verified deterministically. Define specific UX success metrics."),
    (r"\b(robust|resilient|fault[- ]tolerant)\b", "missing_error_handling", "Vague reliability statement",
     "The term '{match}' does not define failure modes. Specify expected behavior during system outages or errors."),
    (r"\b(as appropriate|as needed|if necessary|where applicable)\b", "incomplete_rule", "Incomplete conditional rule",
     "The clause '{match}' lacks explicit criteria. Specify the exact conditions when this applies."),
    (r"\b(etc\.|and so on|such as)\b", "unspecified_boundary", "Open-ended specification",
     "The list ending in '{match}' is non-exhaustive. Enumerate all supported cases explicitly."),
    (r"\b(high[- ]volume|large number|scalable)\b", "unspecified_boundary", "Unquantified scale requirement",
     "Specify the exact concurrent requests per second and storage capacity target."),
]


def classify_category(text: str) -> str:
    t_lower = text.lower()
    for cat, kws in CATEGORY_KEYWORDS.items():
        if any(kw in t_lower for kw in kws):
            return cat
    return "functional"


def classify_priority(text: str) -> str:
    t_lower = text.lower()
    if any(w in t_lower for w in ["critical", "must not", "security breach", "data loss", "fatal", "strict"]):
        return "critical"
    if any(w in t_lower for w in ["shall", "must", "mandatory", "required", "high"]):
        return "high"
    if any(w in t_lower for w in ["should", "recommended", "medium"]):
        return "medium"
    return "low"


def extract_requirements_from_text(text: str, source_doc: Document) -> list[dict[str, Any]]:
    """Extract individual grounded requirement statements from text with section and quote provenance."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    extracted: list[dict[str, Any]] = []

    current_section = "General Specification"
    current_page = "Page 1"

    # Split text into chunks/sentences that look like requirements
    buffer: list[str] = []
    for line in lines:
        if line.startswith("--- [Page ") or line.startswith("--- [Sheet: "):
            current_page = line.replace("---", "").strip()
            continue
        if re.match(r"^(\d+(\.\d+)*|[A-Z]\.)\s+[A-Za-z0-9\s_-]{3,80}$", line):
            current_section = line
            continue

        # Requirement indicator triggers
        is_req = any(kw in line.lower() for kw in [
            "shall", "must", "should", "will support", "required to", "endpoint:", "api:", "allows",
            "enforces", "validates", "prohibits", "rejects", "returns status", "stores"
        ])
        if is_req and len(line) >= 20:
            buffer.append(line)
        elif buffer:
            combined = " ".join(buffer)
            extracted.append({
                "raw_text": combined,
                "section": current_section,
                "page": current_page,
            })
            buffer = []

    if buffer:
        extracted.append({
            "raw_text": " ".join(buffer),
            "section": current_section,
            "page": current_page,
        })

    return extracted


def detect_ambiguities_and_clarifications(
    project_id: int,
    req_id: int | None,
    text: str,
    context_section: str = ""
) -> list[dict[str, Any]]:
    """Scan requirement text for ambiguous terms, missing boundaries, and incomplete rules."""
    clarifications: list[dict[str, Any]] = []

    for pattern, clar_type, impact, question_tmpl in AMBIGUITY_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            matched_str = match.group(0)
            q = question_tmpl.format(match=matched_str)
            clarifications.append({
                "project_id": project_id,
                "requirement_id": req_id,
                "type": clar_type,
                "question": q,
                "context": f"Found in section '{context_section}': \"{text[:200]}...\"",
                "impact": impact,
                "suggested_resolution": f"Replace '{matched_str}' with quantified metrics and deterministic criteria.",
                "status": "open",
            })

    # Check for missing error handling
    if any(k in text.lower() for k in ["upload", "submit", "request", "call", "post"]) and not any(
        k in text.lower() for k in ["error", "fail", "reject", "invalid", "status 4", "status 5"]
    ):
        clarifications.append({
            "project_id": project_id,
            "requirement_id": req_id,
            "type": "missing_error_handling",
            "question": "What error code and message should be returned when the operation fails or inputs are invalid?",
            "context": f"In \"{text[:150]}...\"",
            "impact": "Missing error handling allows silent failures or unhandled server exceptions.",
            "suggested_resolution": "Specify exact HTTP status codes (e.g. 400 Bad Request, 401 Unauthorized) and error payload format.",
            "status": "open",
        })

    return clarifications


def analyze_and_extract_project_requirements(
    db: Session,
    project_id: int,
    author_id: int | None = None
) -> dict[str, Any]:
    """Execute complete requirement analysis across documents and manual project specifications."""
    proj = db.get(Project, project_id)
    if not proj:
        raise BadRequest(f"Project {project_id} not found")

    docs = db.execute(
        select(Document).where(Document.project_id == project_id, Document.status == "completed")
    ).scalars().all()

    existing_req_titles = {
        r.title.lower() for r in db.execute(
            select(Requirement).where(Requirement.project_id == project_id)
        ).scalars().all()
    }

    created_requirements: list[Requirement] = []
    new_clarifications: list[RequirementClarification] = []

    # 1. Extract from Document Ingestion (Explicit Documented)
    for doc in docs:
        if not doc.extracted_text:
            continue
        req_statements = extract_requirements_from_text(doc.extracted_text, doc)
        for stmt in req_statements:
            raw = stmt["raw_text"]
            # Derive title from first sentence or clause
            first_sentence = raw.split(".")[0].strip()
            title = first_sentence[:120] if len(first_sentence) > 10 else f"{doc.purpose.upper()} Requirement: {raw[:80]}"
            if title.lower() in existing_req_titles:
                continue

            category = classify_category(raw)
            priority = classify_priority(raw)

            req = create_requirement(
                db,
                proj,
                title=title,
                description=raw,
                business_objective=f"Extracted from {doc.filename} ({stmt['section']})",
                category=category,
                priority=priority,
                document_id=doc.id,
                source_section=stmt["section"],
                source_page=stmt["page"],
                evidence_excerpt=raw[:500],
                extraction_provenance="explicit_documented",
                review_status="pending_review",
                confidence=0.95,
                author_id=author_id,
            )
            existing_req_titles.add(title.lower())
            created_requirements.append(req)

            # Check for ambiguities
            clars = detect_ambiguities_and_clarifications(project_id, req.id, raw, stmt["section"])
            for c in clars:
                clar_obj = RequirementClarification(**c)
                db.add(clar_obj)
                new_clarifications.append(clar_obj)

    # 2. Extract from Manual Project Scenarios & Expectations (User Provided)
    manual_scenarios = proj.business_scenarios or []
    for sc_idx, sc in enumerate(manual_scenarios, start=1):
        sc_text = sc if isinstance(sc, str) else str(sc)
        if len(sc_text.strip()) < 10:
            continue
        title = f"Scenario {sc_idx}: {sc_text[:80].strip()}"
        if title.lower() in existing_req_titles:
            continue
        category = classify_category(sc_text)
        priority = classify_priority(sc_text)
        req = create_requirement(
            db,
            proj,
            title=title,
            description=sc_text,
            business_objective=f"Provided in Project Business Scenarios",
            category=category,
            priority=priority,
            related_scenario=f"Business Scenario #{sc_idx}",
            extraction_provenance="user_provided",
            review_status="pending_review",
            confidence=1.0,
            author_id=author_id,
        )
        existing_req_titles.add(title.lower())
        created_requirements.append(req)

    functional_expectations = proj.functional_expectations or []
    for f_idx, f_exp in enumerate(functional_expectations, start=1):
        f_text = f_exp if isinstance(f_exp, str) else str(f_exp)
        if len(f_text.strip()) < 10:
            continue
        title = f"Functional Expectation {f_idx}: {f_text[:80].strip()}"
        if title.lower() in existing_req_titles:
            continue
        req = create_requirement(
            db,
            proj,
            title=title,
            description=f_text,
            business_objective="Direct project functional expectation",
            category="functional",
            priority="high",
            extraction_provenance="user_provided",
            review_status="pending_review",
            confidence=1.0,
            author_id=author_id,
        )
        existing_req_titles.add(title.lower())
        created_requirements.append(req)

    # 3. Derive Essential Inferred Requirements (Marked as AI Inferred, strictly requiring confirmation)
    # E.g. If authentication exists but session timeout or invalid token rejection is missing
    all_descriptions = " ".join([(r.evidence_excerpt or r.title).lower() for r in created_requirements])
    if "token" in all_descriptions or "auth" in all_descriptions:
        inferred_title = "Authentication Token Expiration & Rejection"
        if inferred_title.lower() not in existing_req_titles:
            inferred_desc = "The system must reject expired or malformed authentication tokens with HTTP 401 Unauthorized and prevent unauthorized access to protected endpoints."
            req = create_requirement(
                db,
                proj,
                title=inferred_title,
                description=inferred_desc,
                business_objective="Inferred security requirement from authentication mechanisms",
                category="security",
                priority="critical",
                extraction_provenance="ai_inferred",
                review_status="pending_review",
                confidence=0.85,
                author_id=author_id,
            )
            existing_req_titles.add(inferred_title.lower())
            created_requirements.append(req)

    db.commit()

    explicit_count = sum(1 for r in created_requirements if r.extraction_provenance == "explicit_documented")
    user_provided_count = sum(1 for r in created_requirements if r.extraction_provenance == "user_provided")
    inferred_count = sum(1 for r in created_requirements if r.extraction_provenance == "ai_inferred")

    audit.record(
        db,
        author_id,
        "requirements.analyzed",
        "project",
        project_id,
        proj.key,
        project_id,
        {
            "total_extracted": len(created_requirements),
            "explicit": explicit_count,
            "user_provided": user_provided_count,
            "inferred": inferred_count,
            "clarifications": len(new_clarifications),
        },
    )

    return {
        "project_id": project_id,
        "total_extracted": len(created_requirements),
        "explicit_documented": explicit_count,
        "user_provided": user_provided_count,
        "ai_inferred": inferred_count,
        "clarifications_opened": len(new_clarifications),
        "requirements": [r.key for r in created_requirements],
    }
