"""Saved experiment routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from agent_pay_for_urself.api.dependencies import get_experiment_service
from agent_pay_for_urself.api.models import (
    ExperimentCreateRequest,
    ExperimentListItem,
    ExperimentResponse,
)
from agent_pay_for_urself.api.services.experiments import ExperimentService

router = APIRouter(prefix="/experiments", tags=["experiments"])
ExperimentServiceDependency = Annotated[ExperimentService, Depends(get_experiment_service)]


@router.post("", response_model=ExperimentResponse, summary="Run and save an experiment")
def create_experiment(
    request: ExperimentCreateRequest,
    experiment_service: ExperimentServiceDependency,
) -> ExperimentResponse:
    """Run an experiment workflow and persist the complete result."""

    return experiment_service.create(request)


@router.get("", response_model=list[ExperimentListItem], summary="List saved experiments")
def list_experiments(
    experiment_service: ExperimentServiceDependency,
) -> list[ExperimentListItem]:
    """Return saved experiments in newest-first order."""

    return experiment_service.list()


@router.get(
    "/{experiment_id}",
    response_model=ExperimentResponse,
    summary="Get one saved experiment",
)
def get_experiment(
    experiment_id: str,
    experiment_service: ExperimentServiceDependency,
) -> ExperimentResponse:
    """Return one saved experiment detail by id."""

    experiment = experiment_service.get(experiment_id)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    return experiment
