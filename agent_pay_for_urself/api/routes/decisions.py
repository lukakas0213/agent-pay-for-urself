"""Decision workflow route."""

from typing import Annotated

from fastapi import APIRouter, Depends

from agent_pay_for_urself.api.dependencies import get_decision_workflow_service
from agent_pay_for_urself.api.mappers.workflow import to_decision_response
from agent_pay_for_urself.api.models import DecisionRequest, DecisionResponse
from agent_pay_for_urself.api.services.decision_workflow import DecisionWorkflowService

router = APIRouter(tags=["decisions"])
WorkflowService = Annotated[DecisionWorkflowService, Depends(get_decision_workflow_service)]


@router.post(
    "/decisions",
    response_model=DecisionResponse,
    summary="Run investment decisions",
    description=(
        "Runs the current multi-agent workflow for the requested symbols: data collection, "
        "signal analysis, risk validation, buy/sell/hold decision, order planning, and "
        "evaluation summary. Use this endpoint to inspect analysis scores, risk checks, "
        "decisions, and non-submitted order plans before any real broker integration exists."
    ),
)
def create_decision(
    request: DecisionRequest,
    workflow_service: WorkflowService,
) -> DecisionResponse:
    """Run the orchestrated decision workflow and return a stored result."""

    run_id, result = workflow_service.run(
        symbols=request.symbols,
        max_position_weight=request.max_position_weight,
    )
    return to_decision_response(run_id, result)
