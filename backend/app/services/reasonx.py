"""ReasonX AI Context-Aware Intelligence Service.

Provides conversational, screen-aware, and source-grounded intelligence across
TraceTest AI. Uses structured database retrieval to explain, simplify, compare,
and recommend actions without fabricating data.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.db.models import (
    Defect,
    Document,
    Execution,
    ExecutionResult,
    ExtractedContent,
    Project,
    ProjectIntelligenceReport,
    ReasonXConversation,
    ReasonXMessage,
    Requirement,
    RequirementClarification,
    TestCase,
)
from app.llm.router import generate
from app.llm.schemas import ReasonXResponse
from app.services.yaml_workflow import get_golden_policies


def get_or_create_conversation(
    db: Session,
    project_id: int,
    conversation_id: int | None = None,
    user_id: int | None = None,
    title: str | None = None,
    page_context: str | None = None,
) -> ReasonXConversation:
    if conversation_id:
        conv = db.get(ReasonXConversation, conversation_id)
        if conv and conv.project_id == project_id:
            return conv

    conv = ReasonXConversation(
        project_id=project_id,
        user_id=user_id,
        title=(title or f"Discussion ({page_context or 'Workspace'})")[:180],
        page_context=page_context or "workspace",
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def list_conversations(db: Session, project_id: int, limit: int = 20) -> list[dict[str, Any]]:
    convs = db.execute(
        select(ReasonXConversation)
        .where(ReasonXConversation.project_id == project_id)
        .order_by(desc(ReasonXConversation.updated_at))
        .limit(limit)
    ).scalars().all()

    out: list[dict[str, Any]] = []
    for c in convs:
        last_msg = c.messages[-1].content if c.messages else "No messages"
        out.append({
            "id": c.id,
            "title": c.title,
            "page_context": c.page_context,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "message_count": len(c.messages),
            "preview": last_msg[:120],
        })
    return out


def get_conversation_messages(db: Session, conversation_id: int) -> list[dict[str, Any]]:
    conv = db.get(ReasonXConversation, conversation_id)
    if not conv:
        return []
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "structured_payload": m.structured_payload,
            "screen_context": m.screen_context,
            "created_at": m.created_at.isoformat(),
        }
        for m in conv.messages
    ]


def delete_conversation(db: Session, conversation_id: int) -> bool:
    conv = db.get(ReasonXConversation, conversation_id)
    if not conv:
        return False
    db.delete(conv)
    db.commit()
    return True


def get_context_for_screen(
    db: Session,
    project_id: int,
    page: str,
    active_tab: str | None = None,
    selected_id: Any | None = None,
) -> dict[str, Any]:
    project = db.get(Project, project_id)
    if not project:
        return {"project_id": project_id, "error": "Project not found"}

    ctx: dict[str, Any] = {
        "project_id": project.id,
        "project_key": project.key,
        "project_name": project.name,
        "business_domain": project.business_domain,
        "product_type": project.product_type,
        "primary_goal": project.business_goal,
        "page": page,
        "active_tab": active_tab,
        "selected_id": selected_id,
    }

    if page in ("requirements", "requirement_detail"):
        if selected_id:
            try:
                rid = int(selected_id)
                req = db.get(Requirement, rid)
                if req and req.project_id == project_id:
                    clauses = [c.text for c in req.current_clauses] if hasattr(req, "current_clauses") else []
                    clarifications = [c.question for c in req.clarifications] if hasattr(req, "clarifications") else []
                    src_loc = f"{req.source_section or 'Section'} (p. {req.source_page})" if req.source_page else (req.source_section or "Section 1.0")
                    ctx["selected_requirement"] = {
                        "id": req.id,
                        "key": req.key,
                        "title": req.title,
                        "description": req.evidence_excerpt or req.title,
                        "category": req.category,
                        "priority": req.priority,
                        "status": req.status,
                        "review_status": req.review_status,
                        "source_location": src_loc,
                        "clauses": clauses,
                        "clarifications": clarifications,
                    }
            except (ValueError, TypeError):
                pass
        top_reqs = db.execute(
            select(Requirement)
            .where(Requirement.project_id == project_id, Requirement.status != "deprecated")
            .limit(5)
        ).scalars().all()
        ctx["visible_requirements"] = [{"key": r.key, "title": r.title, "category": r.category} for r in top_reqs]
        ambigs = db.execute(
            select(RequirementClarification)
            .join(Requirement, Requirement.id == RequirementClarification.requirement_id)
            .where(Requirement.project_id == project_id)
            .limit(5)
        ).scalars().all()
        ctx["active_ambiguities"] = [{"question": a.question, "status": a.status} for a in ambigs]

    elif page in ("tests", "test_detail"):
        if selected_id:
            try:
                tid = int(selected_id)
                test = db.get(TestCase, tid)
                if test and test.project_id == project_id:
                    ctx["selected_test"] = {
                        "id": test.id,
                        "key": test.key,
                        "title": test.title,
                        "test_category": test.test_category,
                        "priority": test.priority,
                        "status": test.status,
                        "preconditions": test.preconditions,
                        "steps": test.steps,
                        "expected_result": test.expected_result,
                        "clause_keys": test.clause_keys,
                    }
            except (ValueError, TypeError):
                pass
        tests = db.execute(select(TestCase).where(TestCase.project_id == project_id).limit(5)).scalars().all()
        ctx["visible_tests"] = [{"key": t.key, "title": t.title, "category": t.test_category, "status": t.status} for t in tests]

    elif page in ("executions", "execution_detail"):
        if selected_id:
            try:
                eid = int(selected_id)
                exec_run = db.get(Execution, eid)
                if exec_run and exec_run.project_id == project_id:
                    results = db.execute(select(ExecutionResult).where(ExecutionResult.execution_id == eid).limit(10)).scalars().all()
                    ctx["selected_execution"] = {
                        "id": exec_run.id,
                        "key": exec_run.key,
                        "status": exec_run.status,
                        "passed": exec_run.passed,
                        "failed": exec_run.failed,
                        "errored": exec_run.errored,
                        "results_sample": [
                            {"test_case_id": r.test_case_id, "status": r.status, "message": (r.message or "")[:120]}
                            for r in results if r.status in ("failed", "error")
                        ] or [{"test_case_id": r.test_case_id, "status": r.status} for r in results[:3]],
                    }
            except (ValueError, TypeError):
                pass

    elif page in ("simulation", "validation"):
        policy_id = str(selected_id) if selected_id else "POL001"
        golden_policies = get_golden_policies()
        matched = next((p for p in golden_policies if p["policy_id"] == policy_id), golden_policies[0] if golden_policies else None)
        if matched:
            ctx["selected_policy"] = {
                "policy_id": matched["policy_id"],
                "policy_name": matched["policy_name"],
                "jurisdiction": matched["jurisdiction"],
                "description": matched["description"],
                "parsed_rules": matched.get("parsed_rules", []),
                "test_matrix_sample": matched.get("test_matrix", [])[:2],
            }

    elif page in ("intelligence_report", "report"):
        cached = db.execute(
            select(ProjectIntelligenceReport)
            .where(ProjectIntelligenceReport.project_id == project_id)
            .order_by(ProjectIntelligenceReport.generated_at.desc())
        ).scalars().first()
        if cached:
            ctx["intelligence_report"] = {
                "readiness_score": cached.readiness_score,
                "headline": cached.executive_summary.get("headline", ""),
                "critical_gaps_count": len(cached.critical_gaps),
                "critical_gaps": cached.critical_gaps[:3],
                "top_recommendations": cached.recommendations[:3],
            }

    elif page in ("traceability", "coverage", "matrix"):
        from app.services.analytics import traceability
        trace_data = traceability(db, [project_id])
        ctx["traceability_summary"] = trace_data.get("summary", {})
        ctx["health_assessment"] = trace_data.get("health_assessment", {})
        uncovered = [r for r in trace_data.get("requirements", []) if r["coverage_status"] == "uncovered"]
        ctx["uncovered_requirements_sample"] = [
            {"key": r["key"], "title": r["title"], "category": r["category"], "priority": r["priority"]}
            for r in uncovered[:5]
        ]
        ctx["duplicate_tests_sample"] = trace_data.get("duplicate_test_details", [])[:4]

    docs = db.execute(select(Document).where(Document.project_id == project_id).limit(3)).scalars().all()
    ctx["primary_documents"] = [d.filename for d in docs]
    return ctx


def process_reasonx_chat(
    db: Session,
    project_id: int,
    query: str,
    page: str = "workspace",
    active_tab: str | None = None,
    selected_id: Any | None = None,
    conversation_id: int | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    project = db.get(Project, project_id)
    if not project:
        raise ValueError(f"Project #{project_id} not found")

    conv = get_or_create_conversation(
        db,
        project_id=project_id,
        conversation_id=conversation_id,
        user_id=user_id,
        title=query[:60],
        page_context=page,
    )

    screen_context = get_context_for_screen(db, project_id, page, active_tab, selected_id)

    # Save user message
    user_msg = ReasonXMessage(
        conversation_id=conv.id,
        role="user",
        content=query,
        screen_context={"page": page, "tab": active_tab, "selected_id": str(selected_id) if selected_id else None},
        created_at=utcnow(),
    )
    db.add(user_msg)
    db.commit()

    # Load history (last 4 prior messages)
    prior_messages = conv.messages[-5:-1] if len(conv.messages) > 1 else []
    history_lines: list[str] = []
    for pm in prior_messages:
        history_lines.append(f"{pm.role.upper()}: {pm.content}")
    history_prompt = "\n".join(history_lines) if history_lines else "None (Start of conversation)"

    system_prompt = (
        "You are ReasonX AI, the principal enterprise intelligence assistant for TraceTest AI. "
        "Your mission is to assist HR managers, business analysts, QA engineers, and compliance officers "
        "in understanding, simplifying, validating, and auditing business requirements, tests, policies, and quality reports.\n\n"
        "STRICT GUIDELINES:\n"
        "1. Business information first: Use clear, professional, human-readable English. Avoid obscure jargon unless specifically explaining a technical rule.\n"
        "2. Strict source grounding: Every factual conclusion must cite the source document, clause key, or requirement ID from the provided context.\n"
        "3. Zero hallucinations: Never invent facts, page numbers, or statistics. If the data is missing from the project context, explicitly state: 'I cannot determine this from the available project information.'\n"
        "4. Follow-up continuity: Resolve pronouns (e.g. 'it', 'this requirement', 'why did it fail?') using conversation history and active screen context.\n"
        "5. Output must conform to the ReasonXResponse JSON schema.\n"
    )

    # Prepare LLM payload
    primary_docs = screen_context.get("primary_documents")
    doc_name = primary_docs[0] if primary_docs else "Specification.pdf"
    item_title = (
        screen_context.get("selected_requirement", {}).get("title")
        or screen_context.get("selected_policy", {}).get("policy_name")
        or project.name
    )
    req_key = screen_context.get("selected_requirement", {}).get("key") or "EV_PAY-REQ-001"

    payload_dict = {
        "query": query,
        "page": page,
        "item_title": item_title,
        "requirement_key": req_key,
        "document_name": doc_name,
        "screen_context": screen_context,
        "conversation_history": history_prompt,
    }
    payload_json = json.dumps(payload_dict, indent=2)

    user_prompt = (
        f"TASK: reasonx_query\n"
        f"PAYLOAD_JSON:\n"
        f"{payload_json}\n\n"
        f"USER QUESTION: {query}"
    )

    llm_res = generate(
        task="reasonx_query",
        system=system_prompt,
        user=user_prompt,
        schema=ReasonXResponse,
        use_cache=False,
    )

    res_data = llm_res.data
    structured_payload = res_data.model_dump()

    # Save assistant message
    asst_msg = ReasonXMessage(
        conversation_id=conv.id,
        role="assistant",
        content=res_data.direct_answer + "\n\n" + res_data.explanation,
        structured_payload=structured_payload,
        screen_context={"page": page, "tab": active_tab, "selected_id": str(selected_id) if selected_id else None},
        created_at=utcnow(),
    )
    db.add(asst_msg)
    conv.updated_at = utcnow()
    db.commit()
    db.refresh(asst_msg)

    return {
        "conversation_id": conv.id,
        "message_id": asst_msg.id,
        "role": "assistant",
        "content": asst_msg.content,
        "structured_payload": structured_payload,
        "screen_context": asst_msg.screen_context,
        "created_at": asst_msg.created_at.isoformat(),
        "provider": llm_res.provider,
        "model": llm_res.model,
    }


def get_quick_prompts(page: str) -> list[dict[str, str]]:
    prompts_by_page = {
        "intelligence_report": [
            {"label": "Explain Executive Summary", "query": "Explain this executive summary in plain English for our HR leadership team."},
            {"label": "Review Critical Gaps", "query": "What are the critical gaps identified in this report and what actions should we take?"},
            {"label": "Simplify Readiness Score", "query": "Break down what the readiness score means and which areas need the most improvement."},
            {"label": "Summarize Action Plan", "query": "Give me the top 3 highest priority recommendations in 3 bullet points."},
        ],
        "requirements": [
            {"label": "Explain Ambiguities", "query": "Why are these requirements marked as ambiguous and how can we clarify them?"},
            {"label": "Simplify Requirements", "query": "Explain these extracted requirements in simple business language without technical terms."},
            {"label": "Find Missing Information", "query": "What important policy or calculation details appear to be missing from these requirements?"},
            {"label": "Check Source Grounding", "query": "Which source documents and clauses substantiate these requirements?"},
        ],
        "simulation": [
            {"label": "Explain Policy Rules", "query": "Explain this business policy and how its calculation rules apply to employee overtime."},
            {"label": "HR Impact Analysis", "query": "What is the operational and financial impact of this policy for our organization?"},
            {"label": "Walkthrough Scenario", "query": "Walk me through this simulation scenario step-by-step and explain the expected outcome."},
            {"label": "Check Rule Exceptions", "query": "What edge cases or threshold boundaries could cause this policy to fail?"},
        ],
        "validation": [
            {"label": "Explain Policy Rules", "query": "Explain this business policy and how its calculation rules apply to employee overtime."},
            {"label": "HR Impact Analysis", "query": "What is the operational and financial impact of this policy for our organization?"},
            {"label": "Walkthrough Scenario", "query": "Walk me through this simulation scenario step-by-step and explain the expected outcome."},
            {"label": "Check Rule Exceptions", "query": "What edge cases or threshold boundaries could cause this policy to fail?"},
        ],
        "tests": [
            {"label": "Explain Test Scenarios", "query": "Explain what this test case verifies and how it validates the originating requirement."},
            {"label": "Missing Edge Cases", "query": "What boundary conditions or negative scenarios are missing from our test suite?"},
            {"label": "Review Four-Eyes Status", "query": "Why are tests pending review and what must a reviewer check before approval?"},
        ],
        "executions": [
            {"label": "Explain Execution Results", "query": "Summarize these execution results and explain why any tests failed."},
            {"label": "Compare Expected vs Actual", "query": "What was the difference between expected and actual results in this test run?"},
            {"label": "Root Cause Analysis", "query": "What is the probable root cause of the latest test failure?"},
        ],
        "defects": [
            {"label": "Explain Business Impact", "query": "Explain the business severity and impact of these defects on payroll/compliance."},
            {"label": "Remediation Steps", "query": "What are the recommended actions to fix and verify these defect records?"},
            {"label": "Root Cause Analysis", "query": "What is the underlying root cause of these defect failures?"},
            {"label": "Verify Retest Plan", "query": "How should we construct a targeted retest scenario to verify these defects are resolved?"},
        ],
        "dashboard": [
            {"label": "Summarize Project Status", "query": "Summarize the overall quality status and release readiness of this project."},
            {"label": "Explain QA Journey", "query": "What stage is this project at in the 6-stage QA journey and what is the next step?"},
            {"label": "Highlight Major Risks", "query": "What are the top 3 risks currently threatening our compliance or test pass rate?"},
        ],
        "traceability": [
            {"label": "Explain Coverage Gaps", "query": "Why do 227 out of 228 requirements have no test coverage, and what are the highest-risk gaps?"},
            {"label": "Explain Duplicate Tests", "query": "Why are 24 tests marked as duplicates and how does that affect our clause coverage?"},
            {"label": "Recommend Test Generation", "query": "Which uncovered regulatory requirements should we generate test scenarios for first?"},
            {"label": "Trace Source Evidence", "query": "How are requirements mapped to source clauses and acceptance criteria in this project?"},
        ],
    }
    return prompts_by_page.get(page, [
        {"label": "Summarize Page", "query": "Summarize this page and explain its key findings in plain English."},
        {"label": "What Actions Next?", "query": "Based on what is shown on this screen, what actions should happen next?"},
    ])
