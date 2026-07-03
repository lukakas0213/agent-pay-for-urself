"""Agent prompt routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from agent_pay_for_urself.api.dependencies import get_agent_prompt_service
from agent_pay_for_urself.api.models import (
    AgentPromptItem,
    AgentPromptSaveResponse,
    AgentPromptUpdateRequest,
)
from agent_pay_for_urself.api.services.agent_prompts import AgentPromptService

router = APIRouter(prefix="/agent-prompts", tags=["agent-prompts"])
AgentPromptServiceDependency = Annotated[AgentPromptService, Depends(get_agent_prompt_service)]


@router.get("", response_model=list[AgentPromptItem], summary="List persisted agent prompts")
def list_agent_prompts(agent_prompt_service: AgentPromptServiceDependency) -> list[AgentPromptItem]:
    """Return all persisted agent prompts in display order."""

    return agent_prompt_service.list()


@router.get(
    "/{agent_key}",
    response_model=AgentPromptItem,
    summary="Get one persisted agent prompt",
)
def get_agent_prompt(
    agent_key: str,
    agent_prompt_service: AgentPromptServiceDependency,
) -> AgentPromptItem:
    """Return one stored agent prompt by key."""

    prompt = agent_prompt_service.get(agent_key)
    if prompt is None:
        raise HTTPException(status_code=404, detail="Agent prompt not found.")
    return prompt


@router.put(
    "/{agent_key}",
    response_model=AgentPromptSaveResponse,
    summary="Update one persisted agent prompt",
)
def update_agent_prompt(
    agent_key: str,
    request: AgentPromptUpdateRequest,
    agent_prompt_service: AgentPromptServiceDependency,
) -> AgentPromptSaveResponse:
    """Persist one agent prompt and return the saved record."""

    try:
        item = agent_prompt_service.update(agent_key, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Agent prompt not found.") from exc
    return AgentPromptSaveResponse(item=item)
