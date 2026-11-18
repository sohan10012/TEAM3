"""ReasonX Conversation & Dynamic Quick Prompts Management."""
from __future__ import annotations

from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.db.models import (
    Defect,
    Execution,
    Project,
    ReasonXConversation,
    ReasonXMessage,
    Requirement,
    TestCase,
)


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


def get_quick_prompts(page: str = "workspace", project_id: int | None = None, db: Session | None = None) -> list[dict[str, str]]:
    """Return dynamic, context-aware quick actions and templates based on screen and active project data."""
    # Context-aware templates based on actual project metrics if DB provided
    has_defects = False
    has_failed_tests = False
    has_uncovered_reqs = False

    if db and project_id:
        def_count = db.scalar(select(Defect.id).where(Defect.project_id == project_id, Defect.status != "closed").limit(1))
        has_defects = def_count is not None
        failed_count = db.scalar(
            select(Execution.id).where(Execution.project_id == project_id, (Execution.failed > 0) | (Execution.errored > 0)).limit(1)
        )
        has_failed_tests = failed_count is not None

    prompts_by_page = {
        "intelligence_report": [
            {"label": "Assess Release Readiness", "query": "Assess release readiness for this project and list all blocking quality risks."},
            {"label": "Explain Executive Summary", "query": "Explain this executive summary in plain English for our leadership team."},
            {"label": "Review Critical Gaps", "query": "What are the critical gaps identified in this report and what actions should we take?"},
            {"label": "Summarize Action Plan", "query": "Give me the top 3 highest priority recommendations in 3 bullet points."},
        ],
        "requirements": [
            {"label": "Find Uncovered Requirements", "query": "Find all uncovered requirements in this project and explain the coverage gaps."},
            {"label": "Analyze Requirement Quality", "query": "Analyze requirement quality and identify any ambiguity or missing calculation rules."},
            {"label": "Audit Statutory Evidence", "query": "Which source documents, sections, and quotes substantiate these requirements?"},
            {"label": "Generate Missing Test Scenarios", "query": "Draft test case specifications for uncovered regulatory requirements."},
        ],
        "acceptance-criteria": [
            {"label": "Audit Gherkin BDD Specs", "query": "Audit all acceptance criteria for strict Given-When-Then format and normative keywords."},
            {"label": "Identify Untested Criteria", "query": "Which acceptance criteria currently have zero linked test cases?"},
            {"label": "Draft Missing Tests", "query": "Generate executable test case specifications for uncovered acceptance criteria."},
        ],
        "tests": [
            {"label": "Review Test Suite Quality", "query": "Review the quality, coverage, and approval status of our test cases."},
            {"label": "Detect Duplicate Tests", "query": "Identify duplicate or overlapping test cases that validate the exact same clause keys."},
            {"label": "Prepare Regression Suite", "query": "Recommend an optimized regression test selection based on high-risk requirements."},
            {"label": "Explain Test Assertions", "query": "Explain what the highest priority tests verify and how they validate their requirements."},
        ],
        "executions": [
            {"label": "Investigate Failed Runs", "query": "Why did the latest test run fail? Compare expected versus actual results and diagnose root cause."},
            {"label": "Explain Execution Telemetry", "query": "Summarize latest execution results, pass rate, and execution duration."},
            {"label": "Create Defects for Failures", "query": "Prepare defect proposals with reproduction steps for all confirmed test failures."},
        ],
        "defects": [
            {"label": "Summarize Open Defects", "query": "Summarize open defects, their severity breakdown, and business impact."},
            {"label": "Recommend Defect Remediation", "query": "What are the recommended actions to fix and verify these open defect records?"},
            {"label": "Verify Retest Plan", "query": "How should we construct a targeted retest scenario to verify these defects are resolved?"},
            {"label": "Root Cause Analysis", "query": "Explain the underlying root cause for the highest severity defects."},
        ],
        "traceability": [
            {"label": "Traceability Governance Audit", "query": "Perform a traceability governance audit: check requirement-to-AC-to-test alignment."},
            {"label": "Analyze Coverage Gaps", "query": "Analyze clause-level coverage gaps and calculate residual risk score."},
            {"label": "Simulate Change Impact", "query": "Simulate the blast-radius impact of updating core requirements on existing test cases."},
            {"label": "Explain Duplicate Tests", "query": "Identify overlapping or duplicate test cases that cover the exact same clauses and criteria."},
        ],
        "dashboard": [
            {"label": "Summarize Project Status", "query": "Summarize the overall quality status, pass rates, and release readiness of this project."},
            {"label": "Highlight Major Risks", "query": "What are the top 3 risks currently threatening our compliance or test pass rate?"},
            {"label": "Explain QA Journey", "query": "What stage is this project at in the 6-stage QA journey and what is the recommended next step?"},
        ],
    }

    selected = prompts_by_page.get(page, prompts_by_page["dashboard"])
    # If project has defects, ensure defect prompt is present
    if has_defects and not any("defect" in p["label"].lower() for p in selected):
        selected = [{"label": "Investigate Open Defects", "query": "Summarize all open defects and their root causes."}] + selected[:3]

    return selected

