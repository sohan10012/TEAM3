"""ReasonX AI API Router."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import Principal, current_principal, get_db, scoped_project_ids
from app.services.reasonx import (
    delete_conversation,
    get_conversation_messages,
    get_quick_prompts,
    list_conversations,
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


@router.post("/chat")
def reasonx_chat(
    body: ReasonXChatIn,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Send a question to ReasonX AI with active screen and project context."""
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
        raise HTTPException(status_code=500, detail=f"ReasonX query processing failed: {e}")


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
    p: Principal = Depends(current_principal),
):
    """Get context-aware suggested quick prompts for the active screen."""
    return {"prompts": get_quick_prompts(page)}
