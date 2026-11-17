"""ReasonX AI API Router — Enterprise Autonomous Quality Engineering Agent Endpoints."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import Principal, current_principal, get_db, scoped_project_ids
from app.services.reasonx import (
    cancel_task,
    delete_conversation,
    execute_approved_task,
    get_conversation_messages,
    get_quick_prompts,
    get_task_details,
    list_conversations,
    list_project_tasks,
    process_reasonx_chat,
)

router = APIRouter(prefix="/reasonx", tags=["reasonx"])


class ReasonXChatIn(BaseModel):
    project_id: int
    query: str = Field(min_length=1, max_length=2000)
    page: str = Field(default="workspace")
    active_tab: str | None = None
    selected_id: Any | None = None
    conversation_id: int | None = None


class TaskCancelIn(BaseModel):
    reason: str = Field(default="User cancelled action")


@router.post("/chat")
def reasonx_chat(
    body: ReasonXChatIn,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Send a query to ReasonX AI Autonomous Agent with active screen and project context."""
    scoped_project_ids(db, p, body.project_id)
    try:
        res = process_reasonx_chat(
            db=db,
            project_id=body.project_id,
            query=body.query,
            page=body.page,
            active_tab=body.active_tab,
            selected_id=body.selected_id,
            conversation_id=body.conversation_id,
            user_id=p.id if hasattr(p, "id") else None,
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ReasonX agent processing failed: {e}")


@router.post("/chat/stream")
def reasonx_chat_stream(
    body: ReasonXChatIn,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Server-Sent Events (SSE) streaming endpoint for ReasonX Autonomous Agent."""
    scoped_project_ids(db, p, body.project_id)

    def event_generator():
        yield f"event: thinking\ndata: {json.dumps({'stage': 'context_resolution', 'detail': 'Resolving active project records and permissions'})}\n\n"
        yield f"event: thinking\ndata: {json.dumps({'stage': 'task_planning', 'detail': 'Formulating autonomous execution plan'})}\n\n"

        try:
            res = process_reasonx_chat(
                db=db,
                project_id=body.project_id,
                query=body.query,
                page=body.page,
                active_tab=body.active_tab,
                selected_id=body.selected_id,
                conversation_id=body.conversation_id,
                user_id=p.id if hasattr(p, "id") else None,
            )

            structured = res.get("structured_payload", {})
            plan = structured.get("plan", [])
            steps = structured.get("steps", [])

            yield f"event: task_plan\ndata: {json.dumps({'task_id': res.get('task_id'), 'plan': plan, 'steps': steps})}\n\n"

            # Stream response content chunks
            content = res.get("content", "")
            words = content.split(" ")
            chunk_size = 6
            for i in range(0, len(words), chunk_size):
                chunk = " ".join(words[i:i + chunk_size]) + " "
                yield f"event: token\ndata: {json.dumps({'content': chunk})}\n\n"

            if "approval_request" in structured and structured["approval_request"]:
                yield f"event: awaiting_approval\ndata: {json.dumps(structured['approval_request'])}\n\n"

            yield f"event: done\ndata: {json.dumps(res)}\n\n"

        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/tasks/{task_id}")
def get_task(
    task_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Retrieve full task status, execution trace, and planned steps."""
    task = get_task_details(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    scoped_project_ids(db, p, task["project_id"])
    return {"task": task}


@router.post("/tasks/{task_id}/approve")
def approve_task_action(
    task_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Approve and execute a pending Level 3/4 action on a ReasonX task."""
    task = get_task_details(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    scoped_project_ids(db, p, task["project_id"])
    try:
        res = execute_approved_task(db, task_id, user_id=p.id if hasattr(p, "id") else None)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Task approval execution failed: {e}")


@router.post("/tasks/{task_id}/cancel")
def cancel_task_action(
    task_id: int,
    body: TaskCancelIn | None = None,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Cancel a pending or running ReasonX task."""
    task = get_task_details(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    scoped_project_ids(db, p, task["project_id"])
    res = cancel_task(db, task_id, reason=body.reason if body else "User cancelled action")
    return res


@router.get("/projects/{project_id}/tasks")
def get_project_tasks(
    project_id: int,
    limit: int = Query(15, ge=1, le=50),
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """List recent ReasonX agent tasks for a project."""
    scoped_project_ids(db, p, project_id)
    return {"tasks": list_project_tasks(db, project_id, limit=limit)}


@router.get("/projects/{project_id}/conversations")
def get_project_conversations(
    project_id: int,
    limit: int = Query(20, ge=1, le=100),
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """List recent ReasonX conversations for a project."""
    scoped_project_ids(db, p, project_id)
    return {"conversations": list_conversations(db, project_id, limit=limit)}


@router.get("/conversations/{conversation_id}/messages")
def get_conversation_history(
    conversation_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Retrieve full message history for a conversation."""
    return {"messages": get_conversation_messages(db, conversation_id)}


@router.delete("/conversations/{conversation_id}")
def delete_conv(
    conversation_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Delete a conversation."""
    ok = delete_conversation(db, conversation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True, "conversation_id": conversation_id}


@router.get("/quick-prompts")
def quick_prompts(
    page: str = Query("workspace"),
    project_id: int | None = Query(None),
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Get context-aware suggested quick prompts for the active screen and project."""
    if project_id is not None:
        scoped_project_ids(db, p, project_id)
    return {"prompts": get_quick_prompts(page, project_id=project_id, db=db)}
