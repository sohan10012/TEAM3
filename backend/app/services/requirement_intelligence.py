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
from app.db.models import (
    BusinessScenario,
    Document,
    Project,
    ProjectContext,
    ProjectRole,
    Requirement,
    RequirementClarification,
)
from app.services import audit
from app.services.requirements import create_requirement

log = logging.getLogger("tracetest.intelligence")

# Category classification heuristics
CATEGORY_KEYWORDS = {
    "security": ["token", "jwt", "auth", "permission", "encryption", "hash", "rbac", "credential", "passcode", "cors", "vulnerability"],
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


def _classify_category(stmt: str) -> str:
    s = stmt.lower()
    if any(k in s for k in ["statute", "regulation", "act", "law", "flsa", "paye", "hmrc", "penalty", "statutory", "compliance", "legal"]):
        return "compliance"
    if any(k in s for k in ["rate", "calculate", "multiplier", "formula", "threshold", "percent", "deduction", "payout", "gross pay", "net pay"]):
        return "business_rule"
    if any(k in s for k in ["maximum", "minimum", "cap", "exceed", "limit", "at least", "not more than", "boundary"]):
        return "boundary_value"
    if any(k in s for k in ["permission", "role", "encrypt", "sanitize", "credential", "auth", "token", "secret", "prohibit"]):
        return "security"
    if any(k in s for k in ["store", "audit", "timestamp", "log", "persist", "foreign key", "unique", "database"]):
        return "data_integrity"
    if any(k in s for k in ["latency", "throughput", "concurrent", "performance", "availability", "scale", "load"]):
        return "non_functional"
    return "functional"


def _calc_confidence(stmt: str) -> float:
    s = stmt.lower()
    score = 0.86
    if "shall" in s or "must" in s or "enforces" in s:
        score += 0.05
    elif "should" in s or "allows" in s:
        score += 0.02
    if re.search(r"\b\d+(\.\d+)?\b", s):
        score += 0.04
    if 40 <= len(stmt) <= 300:
        score += 0.03
    if any(amb in s for amb in ["reasonable", "promptly", "as needed", "etc", "user friendly", "appropriate", "fast"]):
        score -= 0.12
    return round(min(0.98, max(0.68, score)), 2)


def extract_requirements_from_text(text: str, source_doc: Document) -> list[dict[str, Any]]:
    """Extract individual grounded requirement statements from text with section and quote provenance."""
    raw_lines = [ln.strip() for ln in text.splitlines()]
    extracted: list[dict[str, Any]] = []
    seen_hashes: set[str] = set()

    current_section = "General Specification"
    current_page = "Page 1"

    # AI-EXT-01 & AI-REQ-01: Reconstruct paragraphs across line wraps before sentence tokenization
    paragraphs: list[tuple[str, str, str]] = []  # (content, page, section)
    current_para_lines: list[str] = []

    for line in raw_lines:
        if not line:
            if current_para_lines:
                paragraphs.append((" ".join(current_para_lines), current_page, current_section))
                current_para_lines = []
            continue

        if line.startswith("--- [Page ") or line.startswith("--- [Sheet: "):
            if current_para_lines:
                paragraphs.append((" ".join(current_para_lines), current_page, current_section))
                current_para_lines = []
            current_page = line.replace("---", "").strip()
            continue

        if line.startswith("#"):
            if current_para_lines:
                paragraphs.append((" ".join(current_para_lines), current_page, current_section))
                current_para_lines = []
            current_section = line.lstrip("#").strip()
            continue

        is_heading = (
            re.match(r"^(\d+(\.\d+)*|[A-Z]\.|§\s*\d+(\.\d+)*)\s+[A-Za-z0-9\s_\-\.]{3,80}$", line)
            or re.match(r"^(Section|Chapter|Part|Clause|Subpart)\s+[0-9A-Z\.]+", line, re.IGNORECASE)
        )
        if is_heading:
            if current_para_lines:
                paragraphs.append((" ".join(current_para_lines), current_page, current_section))
                current_para_lines = []
            current_section = line
            continue

        current_para_lines.append(line)

    if current_para_lines:
        paragraphs.append((" ".join(current_para_lines), current_page, current_section))

    for para_text, page, section in paragraphs:
        # Split paragraph into complete sentences
        sentences = re.split(r"(?<=[.!?])\s+", para_text)
        for s in sentences:
            s_clean = s.strip()
            if not s_clean:
                continue
            is_req = any(kw in s_clean.lower() for kw in [
                "shall", "must", "should", "will support", "required to", "endpoint:", "api:", "allows",
                "enforces", "validates", "prohibits", "rejects", "returns status", "stores", "calculates", "complies"
            ])
            if is_req and len(s_clean) >= 20:
                clean_stmt = re.sub(r"^[-*•\d\.\)\s]+", "", s_clean).strip()
                if len(clean_stmt) >= 15:
                    # Semantic deduplication
                    norm_key = re.sub(r"[^\w]", "", clean_stmt.lower())[:80]
                    if norm_key in seen_hashes:
                        continue
                    seen_hashes.add(norm_key)

                    category = _classify_category(clean_stmt)
                    confidence = _calc_confidence(clean_stmt)

                    extracted.append({
                        "raw_text": clean_stmt,
                        "section": section,
                        "page": page,
                        "category": category,
                        "confidence": confidence,
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


def detect_contradictions_across_requirements(
    db: Session,
    project_id: int,
) -> list[RequirementClarification]:
    """Scan all project requirements to identify conflicting policies, rates, and thresholds across documents."""
    reqs = db.execute(
        select(Requirement).where(Requirement.project_id == project_id)
    ).scalars().all()

    existing_clars = db.execute(
        select(RequirementClarification).where(
            RequirementClarification.project_id == project_id,
            RequirementClarification.type.in_(["contradiction", "conflict"]),
        )
    ).scalars().all()
    existing_questions = {c.question for c in existing_clars}

    new_contradictions: list[RequirementClarification] = []

    extractors = [
        (
            "Overtime Multiplier Rate",
            re.compile(r"overtime.*?(?:rate|multiplier|paid at|calculated at|rate is)?.*?(\d+(?:\.\d+)?)\s*x", re.IGNORECASE),
            "Document contradiction on Overtime Rate: '{r1_key}' specifies {val1}x regular pay whereas '{r2_key}' specifies {val2}x regular pay. Which multiplier should the payroll calculation engine enforce?",
            "Contradicting multiplier rates lead to erroneous gross pay calculation and non-compliant audit runs.",
            "Confirm authoritative overtime multiplier (e.g. 1.5x FLSA vs 2.0x weekend rate) with payroll stakeholders.",
        ),
        (
            "Leave Eligibility / Probation Period",
            re.compile(r"(?:probation(?:ary)?|eligib(?:ility|le)|waiting).*?(\d+)\s*days?", re.IGNORECASE),
            "Document contradiction on Leave Eligibility: '{r1_key}' requires {val1} days whereas '{r2_key}' requires {val2} days. What is the authoritative probation threshold?",
            "Conflicting waiting periods lead to premature leave approvals or wrongful leave request rejections.",
            "Confirm standard probationary period with HR policy documentation.",
        ),
        (
            "Session Inactivity Timeout",
            re.compile(r"(?:session|inactivity|idle).*?(\d+)\s*(?:minutes?|mins?)", re.IGNORECASE),
            "Document contradiction on Session Inactivity Timeout: '{r1_key}' specifies {val1} minutes whereas '{r2_key}' specifies {val2} minutes. What is the required timeout threshold?",
            "Varying session lifetimes compromise security boundaries and create inconsistent logout behavior.",
            "Establish unified idle session timeout across all product tiers.",
        ),
    ]

    for _topic, pattern, q_tmpl, impact, resolution in extractors:
        matches = []
        for r in reqs:
            full_txt = f"{r.title} {r.evidence_excerpt or ''} {r.related_scenario or ''}"
            m = pattern.search(full_txt)
            if m:
                matches.append((r, m.group(1)))

        for i in range(len(matches)):
            for j in range(i + 1, len(matches)):
                r1, v1 = matches[i]
                r2, v2 = matches[j]
                if v1 != v2:
                    q = q_tmpl.format(r1_key=r1.key, val1=v1, r2_key=r2.key, val2=v2)
                    if q not in existing_questions:
                        c = RequirementClarification(
                            project_id=project_id,
                            requirement_id=r1.id,
                            type="contradiction",
                            question=q,
                            context=f"Discrepancy detected between {r1.key} (citing {v1}) and {r2.key} (citing {v2}).",
                            impact=impact,
                            suggested_resolution=resolution,
                            status="open",
                        )
                        db.add(c)
                        new_contradictions.append(c)
                        existing_questions.add(q)

    return new_contradictions


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

            category = stmt.get("category") or classify_category(raw)
            priority = classify_priority(raw)
            confidence = stmt.get("confidence", 0.90)

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
                confidence=confidence,
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

    # 2. Extract from Structured Business Scenarios & Roles (User Provided)
    db_scenarios = db.execute(
        select(BusinessScenario).where(BusinessScenario.project_id == project_id)
    ).scalars().all()
    for sc in db_scenarios:
        title = f"Scenario: {sc.title[:80].strip()}"
        if title.lower() in existing_req_titles:
            continue
        body_parts = [sc.description]
        if sc.actor:
            body_parts.append(f"Actor: {sc.actor}.")
        if sc.preconditions:
            body_parts.append(f"Preconditions: {sc.preconditions}.")
        if sc.expected_outcome:
            body_parts.append(f"Expected Outcome: {sc.expected_outcome}.")
        if sc.business_rules:
            body_parts.append(f"Business Rules: {sc.business_rules}.")
        desc = " ".join(body_parts)
        category = classify_category(desc)
        priority = classify_priority(desc)
        req = create_requirement(
            db,
            proj,
            title=title,
            description=desc,
            business_objective=f"Structured Business Scenario '{sc.title}'",
            category=category,
            priority=priority,
            related_scenario=sc.title,
            extraction_provenance="user_provided",
            review_status="pending_review",
            confidence=1.0,
            author_id=author_id,
        )
        existing_req_titles.add(title.lower())
        created_requirements.append(req)

    db_roles = db.execute(
        select(ProjectRole).where(ProjectRole.project_id == project_id)
    ).scalars().all()
    for r in db_roles:
        title = f"Role Access Control: {r.role_name[:60].strip()}"
        if title.lower() in existing_req_titles:
            continue
        perms_str = ", ".join(r.permissions) if isinstance(r.permissions, list) else str(r.permissions or "")
        desc = (
            f"The system shall enforce role boundaries for '{r.role_name}'. "
            f"Description: {r.description or 'N/A'}. "
            f"Allowed Permissions: {perms_str or 'Standard user permissions'}. "
            f"Responsibilities: {r.responsibilities or 'N/A'}. "
            f"Restrictions: {r.restrictions or 'N/A'}."
        )
        req = create_requirement(
            db,
            proj,
            title=title,
            description=desc,
            business_objective=f"Role Authorization Specification for {r.role_name}",
            category="permission_role",
            priority="high",
            extraction_provenance="user_provided",
            review_status="pending_review",
            confidence=1.0,
            author_id=author_id,
        )
        existing_req_titles.add(title.lower())
        created_requirements.append(req)

    # 3. Extract from Project Context (Rules, Security, Compliance)
    proj_ctx = db.execute(
        select(ProjectContext).where(ProjectContext.project_id == project_id)
    ).scalar_one_or_none()
    if proj_ctx:
        if proj_ctx.business_rules and isinstance(proj_ctx.business_rules, list):
            for b_idx, brule in enumerate(proj_ctx.business_rules, start=1):
                b_text = str(brule).strip()
                if len(b_text) >= 10:
                    title = f"Business Rule #{b_idx}: {b_text[:80].strip()}"
                    if title.lower() not in existing_req_titles:
                        req = create_requirement(
                            db,
                            proj,
                            title=title,
                            description=b_text,
                            business_objective="Enterprise Business Rule from Project Context",
                            category="business_rule",
                            priority="high",
                            extraction_provenance="user_provided",
                            review_status="pending_review",
                            confidence=1.0,
                            author_id=author_id,
                        )
                        existing_req_titles.add(title.lower())
                        created_requirements.append(req)

        if proj_ctx.security_expectations and len(proj_ctx.security_expectations.strip()) >= 15:
            title = "Project Security Specification"
            if title.lower() not in existing_req_titles:
                req = create_requirement(
                    db,
                    proj,
                    title=title,
                    description=proj_ctx.security_expectations.strip(),
                    business_objective="Security and Data Protection Expectations",
                    category="security",
                    priority="critical",
                    extraction_provenance="user_provided",
                    review_status="pending_review",
                    confidence=1.0,
                    author_id=author_id,
                )
                existing_req_titles.add(title.lower())
                created_requirements.append(req)

        if proj_ctx.regulatory_standards and isinstance(proj_ctx.regulatory_standards, list):
            for std in proj_ctx.regulatory_standards:
                std_text = str(std).strip()
                if len(std_text) >= 3:
                    title = f"Compliance Standard: {std_text}"
                    if title.lower() not in existing_req_titles:
                        desc = f"The product must maintain demonstrable adherence to {std_text} regulatory and security guidelines."
                        req = create_requirement(
                            db,
                            proj,
                            title=title,
                            description=desc,
                            business_objective=f"Regulatory Governance for {std_text}",
                            category="compliance",
                            priority="high",
                            extraction_provenance="user_provided",
                            review_status="pending_review",
                            confidence=1.0,
                            author_id=author_id,
                        )
                        existing_req_titles.add(title.lower())
                        created_requirements.append(req)

    # 4. Extract from Manual Project Scenarios & Expectations JSON fields
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
            business_objective="Provided in Project Business Scenarios",
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

    # 4. Multi-document Contradiction & Conflict Detection
    contradictions = detect_contradictions_across_requirements(db, project_id)
    new_clarifications.extend(contradictions)

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


def reprocess_document_and_requirements(
    db: Session,
    document_id: int,
    author_id: int | None = None,
) -> dict[str, Any]:
    """Reprocess an individual document, refresh text extraction, and safely reconcile extracted requirements."""
    from app.db.base import utcnow
    from app.services.document_processor import process_document

    doc = db.get(Document, document_id)
    if not doc:
        raise BadRequest(f"Document {document_id} not found")

    # 1. Re-parse stored file and recreate ExtractedContent
    doc = process_document(db, doc.id)
    if not doc.extracted_text or not doc.project_id:
        return {"document_id": doc.id, "extracted_requirements": 0, "clarifications": 0}

    proj = db.get(Project, doc.project_id)
    if not proj:
        return {"document_id": doc.id, "extracted_requirements": 0, "clarifications": 0}

    # 2. Extract grounded requirement statements
    extracted_stmts = extract_requirements_from_text(doc.extracted_text, doc)

    # Fetch existing requirements for this project
    existing_reqs = db.execute(
        select(Requirement).where(Requirement.project_id == proj.id)
    ).scalars().all()
    existing_by_title = {r.title.lower().strip(): r for r in existing_reqs}

    new_reqs: list[Requirement] = []
    updated_reqs: list[Requirement] = []
    new_clarifications: list[RequirementClarification] = []

    for stmt in extracted_stmts:
        raw = stmt["raw_text"]
        first_sentence = raw.split(".")[0].strip()
        title = first_sentence[:120] if len(first_sentence) > 10 else f"{doc.purpose.upper()} Requirement: {raw[:80]}"
        norm_title = title.lower().strip()

        category = stmt.get("category") or classify_category(raw)
        priority = classify_priority(raw)
        confidence = stmt.get("confidence", 0.90)

        if norm_title in existing_by_title:
            existing_r = existing_by_title[norm_title]
            if not existing_r.document_id:
                existing_r.document_id = doc.id
            if not existing_r.source_page:
                existing_r.source_page = stmt["page"]
            if not existing_r.source_section:
                existing_r.source_section = stmt["section"]
            if not existing_r.evidence_excerpt:
                existing_r.evidence_excerpt = raw[:500]
            existing_r.updated_at = utcnow()
            updated_reqs.append(existing_r)
        else:
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
                confidence=confidence,
                author_id=author_id,
            )
            existing_by_title[norm_title] = req
            new_reqs.append(req)

            clars = detect_ambiguities_and_clarifications(proj.id, req.id, raw, stmt["section"])
            for c in clars:
                clar_obj = RequirementClarification(**c)
                db.add(clar_obj)
                new_clarifications.append(clar_obj)

    contradictions = detect_contradictions_across_requirements(db, proj.id)
    new_clarifications.extend(contradictions)

    db.commit()

    audit.record(
        db,
        author_id,
        "document.reprocessed",
        "document",
        doc.id,
        doc.filename,
        doc.project_id,
        {"new_requirements": len(new_reqs), "updated_requirements": len(updated_reqs), "clarifications": len(new_clarifications)},
    )

    return {
        "document_id": doc.id,
        "new_requirements": len(new_reqs),
        "updated_requirements": len(updated_reqs),
        "total_for_document": len(new_reqs) + len(updated_reqs),
        "clarifications_opened": len(new_clarifications),
    }


def process_all_project_documents_and_requirements(
    db: Session,
    project_id: int,
    author_id: int | None = None,
) -> dict[str, Any]:
    """Execute complete end-to-end processing: document validation, text extraction, requirement extraction, classification, and analysis."""
    from app.services.document_processor import process_document
    from app.services.requirements_dashboard import get_requirements_project_dashboard_data

    proj = db.get(Project, project_id)
    if not proj:
        raise BadRequest(f"Project {project_id} not found")

    docs = db.execute(
        select(Document).where(Document.project_id == project_id)
    ).scalars().all()

    for doc in docs:
        if not doc.extracted_text or doc.status != "completed":
            process_document(db, doc.id)

    result = analyze_and_extract_project_requirements(db, project_id, author_id=author_id)

    dash = get_requirements_project_dashboard_data(db, project_id)
    req_summary = dash["requirements_summary"]

    total_docs = len(docs)
    total_reqs = req_summary["total"]
    func_cnt = req_summary["functional"]
    nf_cnt = req_summary["non_functional"]
    br_cnt = req_summary["business_rules"]
    amb_cnt = req_summary["ambiguities"]
    con_cnt = req_summary["contradictions"]

    msg = (
        f"Processing completed: {total_docs} document{'s' if total_docs != 1 else ''} processed, "
        f"{total_reqs} requirements extracted, {amb_cnt} ambiguities identified, "
        f"{con_cnt} contradictions detected."
    )

    audit.record(
        db,
        author_id,
        "requirements.process_all",
        "project",
        project_id,
        proj.key,
        project_id,
        {
            "documents_processed": total_docs,
            "total_requirements": total_reqs,
            "newly_extracted": result.get("total_extracted", 0),
            "functional": func_cnt,
            "non_functional": nf_cnt,
            "business_rules": br_cnt,
            "ambiguities": amb_cnt,
            "contradictions": con_cnt,
        },
    )

    return {
        "project_id": project_id,
        "documents_processed": total_docs,
        "total_requirements": total_reqs,
        "newly_extracted": result.get("total_extracted", 0),
        "functional": func_cnt,
        "non_functional": nf_cnt,
        "business_rules": br_cnt,
        "ambiguities_count": amb_cnt,
        "contradictions_count": con_cnt,
        "dashboard_summary": req_summary,
        "message": msg,
    }
