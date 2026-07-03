"""Workflow run history routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from agent_pay_for_urself.api.dependencies import get_workflow_history_service
from agent_pay_for_urself.api.models import WorkflowRunDetailResponse, WorkflowRunListItem
from agent_pay_for_urself.api.services.history import WorkflowHistoryService

router = APIRouter(prefix="/runs", tags=["history"])
WorkflowHistory = Annotated[WorkflowHistoryService, Depends(get_workflow_history_service)]


@router.get("", response_model=list[WorkflowRunListItem], summary="List stored workflow runs")
def list_workflow_runs(workflow_history_service: WorkflowHistory) -> list[WorkflowRunListItem]:
    """Return stored workflow runs in newest-first order for history and reports pages."""

    return workflow_history_service.list_runs()


@router.get(
    "/{run_id}",
    response_model=WorkflowRunDetailResponse,
    summary="Get one stored workflow run",
)
def get_workflow_run(
    run_id: str,
    workflow_history_service: WorkflowHistory,
) -> WorkflowRunDetailResponse:
    """Return one stored workflow run including derived timeline details."""

    response = workflow_history_service.get_run(run_id)
    if response is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"workflow run not found: {run_id}",
        )
    return response
