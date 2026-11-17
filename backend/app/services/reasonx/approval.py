"""ReasonX Approval Service — Dual-control human-in-the-loop governance for Level 3 & Level 4 actions."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.db.models import AuditLog, ReasonXTask
from app.services.reasonx.executor import execute_tool

logger = logging.getLogger(__name__)


def create_approval_request(
    db: Session,
    task: ReasonXTask,
    action: str,
    payload: dict[str, Any],
    risk_level: int = 3,
    impact_summary: str = "",
) -> dict[str, Any]:
    """Record a pending approval request on a task."""
    task.status = "awaiting_approval"
    task.risk_level = risk_level
    task.pending_action = {
        "action": action,
        "payload": payload,
        "impact_summary": impact_summary or f"Action '{action}' will modify persistent project records.",
        "requested_at": utcnow().isoformat(),
    }
    db.commit()
    db.refresh(task)
    return {
        "task_id": task.id,
        "status": "awaiting_approval",
        "action": action,
        "risk_level": risk_level,
        "impact_summary": task.pending_action["impact_summary"],
        "payload": payload,
    }


def execute_approved_task(
    db: Session,
    task_id: int,
    user_id: int | None = None,
) -> dict[str, Any]:
    """Execute a task that has received user confirmation."""
    task = db.get(ReasonXTask, task_id)
    if not task:
        raise ValueError(f"Task #{task_id} not found")

    if task.status != "awaiting_approval" or not task.pending_action:
        raise ValueError(f"Task #{task_id} is not awaiting approval (current status: {task.status})")

    action = task.pending_action.get("action")
    payload = task.pending_action.get("payload", {})

    task.status = "running"
    db.commit()

    try:
        # Execute the tool with allow_writes=True
        tool_result = execute_tool(
            db=db,
            tool_name=action,
            args=payload,
            project_id=task.project_id,
            user_id=user_id or task.user_id,
            allow_writes=True,
        )

        task.status = "completed"
        task.result_summary = tool_result
        task.pending_action = None

        # Add audit record
        db.add(
            AuditLog(
                user_id=user_id or task.user_id,
                action="reasonx.action_approved",
                entity_type="reasonx_task",
                entity_id=task.id,
                project_id=task.project_id,
                payload={"action": action, "result": tool_result},
            )
        )
        db.commit()
        db.refresh(task)

        return {
            "task_id": task.id,
            "status": "completed",
            "action": action,
            "result": tool_result,
            "verified": True,
        }

    except Exception as exc:
        logger.error(f"Failed to execute approved action '{action}' on task #{task_id}: {exc}")
        task.status = "failed"
        task.result_summary = {"error": str(exc)}
        db.commit()
        raise


def cancel_task(
    db: Session,
    task_id: int,
    reason: str = "User cancelled action",
) -> dict[str, Any]:
    """Cancel a pending or running ReasonX task."""
    task = db.get(ReasonXTask, task_id)
    if not task:
        raise ValueError(f"Task #{task_id} not found")

    task.status = "cancelled"
    task.result_summary = {"cancelled_reason": reason}
    task.pending_action = None
    db.commit()
    db.refresh(task)

    return {
        "task_id": task.id,
        "status": "cancelled",
        "reason": reason,
    }

