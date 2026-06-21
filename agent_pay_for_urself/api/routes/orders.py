"""Live order submission route."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from agent_pay_for_urself.api.dependencies import get_order_submission_service
from agent_pay_for_urself.api.models.orders import (
    DirectOrderSubmitRequest,
    DirectOrderSubmitResponse,
    LiveOrderSubmitRequest,
    LiveOrderSubmitResponse,
)
from agent_pay_for_urself.api.services.order_submission import OrderSubmissionService

router = APIRouter(prefix="/orders", tags=["orders"])
OrderSubmissionServiceDependency = Annotated[
    OrderSubmissionService, Depends(get_order_submission_service)
]


@router.post(
    "/submit",
    response_model=DirectOrderSubmitResponse,
    summary="Submit one direct broker order",
    description=(
        "Submits one explicit order through the configured broker adapter. This endpoint can "
        "place real or paper broker orders and requires explicit confirmation in the request body."
    ),
)
def submit_direct_order(
    request: DirectOrderSubmitRequest,
    order_submission_service: OrderSubmissionServiceDependency,
) -> DirectOrderSubmitResponse:
    """Submit one explicit broker order through the configured broker adapter."""

    try:
        return order_submission_service.submit_direct(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post(
    "/submissions",
    response_model=LiveOrderSubmitResponse,
    summary="Submit stored live orders",
    description=(
        "Submits executable order plans from a previously stored workflow run through the "
        "configured broker adapter. This endpoint can place real or paper broker orders and "
        "requires explicit confirmation in the request body."
    ),
)
def submit_live_orders(
    request: LiveOrderSubmitRequest,
    order_submission_service: OrderSubmissionServiceDependency,
) -> LiveOrderSubmitResponse:
    """Submit executable stored order plans for one workflow run."""

    try:
        return order_submission_service.submit(request)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
