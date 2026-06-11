"""Console assistant routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from agent_pay_for_urself.api.dependencies import (
    get_console_assistant_service,
    get_decision_workflow_service,
)
from agent_pay_for_urself.api.mappers.workflow import to_decision_response
from agent_pay_for_urself.api.models import (
    AgentInteractionRequest,
    AgentInteractionResponse,
    DecisionResponse,
)
from agent_pay_for_urself.api.services.console_assistant import ConsoleAssistantService
from agent_pay_for_urself.api.services.decision_workflow import DecisionWorkflowService

router = APIRouter(tags=["console"])
WorkflowService = Annotated[DecisionWorkflowService, Depends(get_decision_workflow_service)]
ConsoleAssistant = Annotated[ConsoleAssistantService, Depends(get_console_assistant_service)]


def _resolve_current_result(
    request: AgentInteractionRequest,
    workflow_service: DecisionWorkflowService,
) -> DecisionResponse | None:
    """Resolve the workflow result from a stored run id or a deprecated inline payload."""

    if request.run_id is not None:
        workflow_result = workflow_service.get(request.run_id)
        if workflow_result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"workflow run not found: {request.run_id}",
            )
        return to_decision_response(
            request.run_id,
            workflow_result,
            workflow_service.runtime_summary(),
        )

    return request.current_result


@router.post(
    "/console/interactions",
    response_model=AgentInteractionResponse,
    summary="Ask the console assistant",
    description=(
        "Returns a deterministic explanation for a stored workflow run. Prefer passing "
        "the run_id returned by POST /decisions. This endpoint does not submit broker orders."
    ),
)
@router.post(
    "/agent/interactions",
    response_model=AgentInteractionResponse,
    summary="Ask the console assistant",
    description=(
        "Deprecated alias for /console/interactions. Prefer passing the run_id returned by "
        "POST /decisions. This endpoint does not submit broker orders."
    ),
    deprecated=True,
)
def interact_with_console(
    request: AgentInteractionRequest,
    workflow_service: WorkflowService,
    console_assistant: ConsoleAssistant,
) -> AgentInteractionResponse:
    """Explain the stored workflow result for a console-style follow-up message."""

    current_result = _resolve_current_result(request, workflow_service)
    return console_assistant.reply(request.message, current_result)
