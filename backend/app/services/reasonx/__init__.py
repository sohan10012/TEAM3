"""ReasonX AI Module Exports."""
from __future__ import annotations

from app.services.reasonx.agent import (
    iter_reasonx_agent_events,
)
from app.services.reasonx.agent import (
    run_reasonx_agent as process_reasonx_chat,
)
from app.services.reasonx.approval import cancel_task, execute_approved_task
from app.services.reasonx.context import get_detailed_project_context as get_context_for_screen
from app.services.reasonx.conversations import (
    delete_conversation,
    get_conversation_messages,
    get_or_create_conversation,
    get_quick_prompts,
    list_conversations,
)
from app.services.reasonx.tasks import get_task_details, list_project_tasks
from app.services.reasonx.tools import TOOL_REGISTRY

__all__ = [
    "process_reasonx_chat",
    "iter_reasonx_agent_events",
    "get_context_for_screen",
    "get_or_create_conversation",
    "list_conversations",
    "get_conversation_messages",
    "delete_conversation",
    "get_quick_prompts",
    "execute_approved_task",
    "cancel_task",
    "get_task_details",
    "list_project_tasks",
    "TOOL_REGISTRY",
]
