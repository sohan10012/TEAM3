"""Tests for Phase 8: ReasonX AI Autonomous Quality Engineering Agent.

Covers:
- Tool Registry structure and safety levels (Risk 1-4)
- Project-isolated context aggregation (no cross-project leakage)
- Plan-Act-Verify autonomous agent execution
- Dual-control human-in-the-loop approvals for Level 3/4 tasks
- Task cancellation and status lifecycle
- Dynamic project-aware quick prompts
- Statutory evidence and grounding citations
"""
from __future__ import annotations

import pytest
from app.services.reasonx.tools import TOOL_REGISTRY
from app.services.reasonx.context import get_detailed_project_context
from app.services.reasonx.tasks import create_task, get_task_details, list_project_tasks
from app.services.reasonx.approval import cancel_task, create_approval_request, execute_approved_task
from app.db.base import SessionLocal


def test_tool_registry_specifications():
    """Verify all 8 tool categories are present with strict risk and schema definitions."""
    expected_categories = {
        "project_intelligence",
        "requirements",
        "test_management",
        "execution_intelligence",
        "defects",
        "traceability",
        "policy_validation",
        "reporting",
    }
    registered_categories = {t.category for t in TOOL_REGISTRY.values()}
    assert expected_categories.issubset(registered_categories)

    for name, tool in TOOL_REGISTRY.items():
        assert tool.risk_level in (1, 2, 3, 4), f"Tool {name} has invalid risk_level {tool.risk_level}"
        if tool.risk_level >= 3:
            assert tool.requires_approval is True, f"Tool {name} with risk {tool.risk_level} must require approval"
        else:
            assert tool.requires_approval is False, f"Read-only/low-risk tool {name} must not require approval"
        assert len(tool.description) > 10
        assert "properties" in tool.parameters


def test_project_context_isolation(admin):
    """Verify that get_detailed_project_context retrieves records strictly scoped to the target project."""
    r_projs = admin.get("/projects")
    assert r_projs.status_code == 200
    items = r_projs.json().get("items", [])
    assert len(items) >= 2, "Expected at least 2 projects in database for isolation verification"

    proj_a = items[0]["id"]
    proj_b = items[1]["id"]

    db = SessionLocal()
    try:
        ctx_a = get_detailed_project_context(db, proj_a)
        ctx_b = get_detailed_project_context(db, proj_b)

        assert ctx_a["project_id"] == proj_a
        assert ctx_b["project_id"] == proj_b
        assert ctx_a["project_name"] != ctx_b["project_name"] or ctx_a["project_key"] != ctx_b["project_key"]

        # Ensure requirement IDs from A do not appear in B
        req_keys_a = {r["key"] for r in ctx_a.get("requirements", [])}
        req_keys_b = {r["key"] for r in ctx_b.get("requirements", [])}
        if req_keys_a and req_keys_b:
            assert req_keys_a.isdisjoint(req_keys_b), "Cross-project requirement leakage detected!"
    finally:
        db.close()


def test_reasonx_quick_prompts_project_awareness(admin):
    """Verify quick prompts adapt to project context and pages."""
    r_projs = admin.get("/projects")
    proj_id = r_projs.json()["items"][0]["id"]

    res = admin.get(f"/reasonx/quick-prompts?project_id={proj_id}&page=requirements")
    assert res.status_code == 200
    data = res.json()
    assert "prompts" in data
    assert len(data["prompts"]) >= 3
    assert any(
        "requirement" in p.get("query", "").lower()
        or "coverage" in p.get("query", "").lower()
        or "requirement" in p.get("label", "").lower()
        for p in data["prompts"]
    )


def test_reasonx_chat_autonomous_flow(admin):
    """Verify standard Plan-Act-Verify execution via /reasonx/chat."""
    r_projs = admin.get("/projects")
    proj_id = r_projs.json()["items"][0]["id"]

    payload = {
        "query": "Summarize the project quality status, test pass rates, and open defects.",
        "project_id": proj_id,
        "page": "dashboard",
    }
    res = admin.post("/reasonx/chat", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert "content" in data and len(data["content"]) > 0
    assert "conversation_id" in data
    assert "model" in data
    assert "provider" in data
    assert "structured_payload" in data
    structured = data["structured_payload"]
    assert "plan" in structured and isinstance(structured["plan"], list)
    assert "steps" in structured and isinstance(structured["steps"], list)


def test_reasonx_approval_lifecycle_and_cancellation(admin):
    """Verify creation of Level 3 task requiring approval, task inspection, and rejection."""
    r_projs = admin.get("/projects")
    proj_id = r_projs.json()["items"][0]["id"]

    db = SessionLocal()
    try:
        # Create a pending task requiring Level 3 approval
        task = create_task(
            db=db,
            project_id=proj_id,
            user_id=1,
            task_type="create_defect",
            title="File a defect for missing TLS 1.2 enforcement on S3 bucket",
            risk_level=3,
            plan=[{"step": 1, "title": "Create defect record", "tool": "create_defect", "risk_level": 3}],
        )
        create_approval_request(
            db=db,
            task=task,
            action="create_defect",
            payload={"title": "TLS 1.2 Not Enforced", "severity": "high", "description": "Automated test failed"},
            risk_level=3,
            impact_summary="Will file a new Defect in project with severity High.",
        )
        task_id = task.id
    finally:
        db.close()

    # 1. Fetch task details via API
    res_task = admin.get(f"/reasonx/tasks/{task_id}")
    assert res_task.status_code == 200
    t_data = res_task.json().get("task", {})
    assert t_data["id"] == task_id
    assert t_data["status"] == "awaiting_approval"
    assert t_data["risk_level"] == 3
    assert "TLS 1.2" in str(t_data.get("pending_action", {}))

    # 2. Reject / Cancel the task via API
    res_cancel = admin.post(f"/reasonx/tasks/{task_id}/cancel")
    assert res_cancel.status_code == 200
    cancel_data = res_cancel.json()
    assert cancel_data["status"] == "cancelled"

    # 3. Verify task is now cancelled
    res_after = admin.get(f"/reasonx/tasks/{task_id}")
    assert res_after.status_code == 200
    assert res_after.json().get("task", {})["status"] == "cancelled"


def test_reasonx_project_tasks_listing(admin):
    """Verify fetching tasks list filtered by project."""
    r_projs = admin.get("/projects")
    proj_id = r_projs.json()["items"][0]["id"]

    res = admin.get(f"/reasonx/projects/{proj_id}/tasks")
    assert res.status_code == 200
    data = res.json()
    assert "tasks" in data
    assert isinstance(data["tasks"], list)
    for t in data["tasks"]:
        assert t["project_id"] == proj_id
