"""Decision workflow route."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from agent_pay_for_urself.api.dependencies import get_decision_workflow_service
from agent_pay_for_urself.api.mappers.workflow import to_decision_response
from agent_pay_for_urself.api.models import DecisionRequest, DecisionResponse
from agent_pay_for_urself.api.services.decision_workflow import DecisionWorkflowService
from agent_pay_for_urself.schemas import InvestmentMandate

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
        "decisions, and non-submitted order plans even when a broker adapter is configured."
    ),
)
def create_decision(
    request: DecisionRequest,
    workflow_service: WorkflowService,
) -> DecisionResponse:
    """Run the orchestrated decision workflow and return a stored result."""

    try:
        run_id, result = workflow_service.run(
            symbols=request.symbols,
            max_position_weight=request.max_position_weight,
            mandate=_to_investment_mandate(request),
        )
        return to_decision_response(run_id, result, workflow_service.runtime_summary())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"decision workflow failed: {exc}") from exc


def _to_investment_mandate(request: DecisionRequest) -> InvestmentMandate | None:
    if request.mandate is None:
        return None

    return InvestmentMandate(
        objective=request.mandate.objective,
        allowed_symbols=tuple(request.mandate.allowed_symbols),
        excluded_symbols=tuple(request.mandate.excluded_symbols),
        max_position_weight=request.max_position_weight,
        max_order_notional=request.mandate.max_order_notional,
        min_cash_weight=request.mandate.min_cash_weight,
        risk_tolerance=request.mandate.risk_tolerance,
        requires_approval_for_live_orders=request.mandate.requires_approval_for_live_orders,
        user_notes=request.mandate.user_notes,
    )
