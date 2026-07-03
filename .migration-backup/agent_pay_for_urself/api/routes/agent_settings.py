"""Agent settings routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from agent_pay_for_urself.api.dependencies import get_agent_settings_service
from agent_pay_for_urself.api.models import (
    AgentSettingsItem,
    AgentSettingsSaveResponse,
    AgentSettingsUpdateRequest,
)
from agent_pay_for_urself.api.services.agent_settings import AgentSettingsService

router = APIRouter(prefix="/agent-settings", tags=["agent-settings"])
AgentSettingsServiceDependency = Annotated[
    AgentSettingsService,
    Depends(get_agent_settings_service),
]


@router.get("", response_model=list[AgentSettingsItem], summary="List persisted agent settings")
def list_agent_settings(
    agent_settings_service: AgentSettingsServiceDependency,
) -> list[AgentSettingsItem]:
    """Return all persisted agent settings in display order."""

    return agent_settings_service.list()


@router.get(
    "/{agent_key}",
    response_model=AgentSettingsItem,
    summary="Get one persisted agent settings record",
)
def get_agent_settings(
    agent_key: str,
    agent_settings_service: AgentSettingsServiceDependency,
) -> AgentSettingsItem:
    """Return one stored agent settings record by key."""

    item = agent_settings_service.get(agent_key)
    if item is None:
        raise HTTPException(status_code=404, detail="Agent settings not found.")
    return item


@router.put(
    "/{agent_key}",
    response_model=AgentSettingsSaveResponse,
    summary="Update one persisted agent settings record",
)
def update_agent_settings(
    agent_key: str,
    request: AgentSettingsUpdateRequest,
    agent_settings_service: AgentSettingsServiceDependency,
) -> AgentSettingsSaveResponse:
    """Persist one agent settings record and return the saved value."""

    try:
        item = agent_settings_service.update(agent_key, request)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Agent settings not found.") from exc
    return AgentSettingsSaveResponse(item=item)
