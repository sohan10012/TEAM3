"""ReasonX Task Service — Orchestrates and persists multi-step quality engineering agent tasks."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.db.models import ReasonXTask

logger = logging.getLogger(__name__)


def create_task(
    db: Session,
    project_id: int,
    conversation_id: int | None = None,
    user_id: int | None = None,
    task_type: str = "general_query",
    title: str = "ReasonX Task",
    plan: list[dict[str, Any]] | None = None,
    risk_level: int = 1,
) -> ReasonXTask:
    """Create a new ReasonX task record."""
    initial_plan = plan or [{"step": 1, "title": "Analyze request and inspect project data", "status": "running"}]
    task = ReasonXTask(
        project_id=project_id,
        conversation_id=conversation_id,
        user_id=user_id,
        task_type=task_type,
        title=title[:250],
        status="running",
        risk_level=risk_level,
        plan=initial_plan,
        steps=[],
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def record_step(
    db: Session,
    task_id: int,
    step_number: int,
    title: str,
    status: str,
    tool_called: str | None = None,
    output_summary: str | None = None,
) -> None:
    """Append a step progress event to a task."""
    task = db.get(ReasonXTask, task_id)
    if not task:
        return
    steps = list(task.steps or [])
    steps.append({
        "step_number": step_number,
        "title": title,
        "status": status,
        "tool": tool_called,
        "output": output_summary,
        "timestamp": utcnow().isoformat(),
    })
    task.steps = steps
    task.updated_at = utcnow()
    db.commit()


def get_task_details(db: Session, task_id: int) -> dict[str, Any] | None:
    """Retrieve full task information."""
    task = db.get(ReasonXTask, task_id)
    if not task:
        return None
    return {
        "id": task.id,
        "project_id": task.project_id,
        "conversation_id": task.conversation_id,
        "task_type": task.task_type,
        "title": task.title,
        "status": task.status,
        "risk_level": task.risk_level,
        "plan": task.plan,
        "steps": task.steps,
        "pending_action": task.pending_action,
        "result_summary": task.result_summary,
        "evidence": task.evidence,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
    }


def list_project_tasks(db: Session, project_id: int, limit: int = 15) -> list[dict[str, Any]]:
    """List recent ReasonX agent tasks for a project."""
    tasks = db.execute(
        select(ReasonXTask)
        .where(ReasonXTask.project_id == project_id)
        .order_by(desc(ReasonXTask.created_at))
        .limit(limit)
    ).scalars().all()

    return [
        {
            "id": t.id,
            "project_id": t.project_id,
            "title": t.title,
            "task_type": t.task_type,
            "status": t.status,
            "risk_level": t.risk_level,
            "step_count": len(t.steps or []),
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tasks
    ]

