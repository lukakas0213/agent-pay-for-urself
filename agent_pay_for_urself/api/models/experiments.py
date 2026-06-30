"""Request and response models for saved experiment runs."""

from pydantic import BaseModel, Field, field_validator

from agent_pay_for_urself.api.models.decisions import (
    DecisionRequest,
    DecisionResponse,
    RuntimeSummaryItem,
    TradeAction,
)


class AgentPromptOverridesRequest(BaseModel):
    """Optional per-agent prompt additions for one experiment run."""

    main_agent: str = ""
    data_collection: str = ""
    data_analysis: str = ""
    report: str = ""
    buy_sell: str = ""
    order_execution: str = ""
    log_evaluation: str = ""


class ExperimentCreateRequest(BaseModel):
    """Request body for running and saving one experiment."""

    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    decision: DecisionRequest
    prompt_overrides: AgentPromptOverridesRequest = Field(
        default_factory=AgentPromptOverridesRequest
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: str) -> str:
        cleaned_name = name.strip()
        if not cleaned_name:
            raise ValueError("Experiment name must contain non-whitespace characters.")
        return cleaned_name

    @field_validator("description")
    @classmethod
    def validate_description(cls, description: str) -> str:
        return description.strip()


class ExperimentSaveRequest(BaseModel):
    """Request body for saving an already completed workflow run."""

    run_id: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)

    @field_validator("name")
    @classmethod
    def validate_name(cls, name: str) -> str:
        cleaned_name = name.strip()
        if not cleaned_name:
            raise ValueError("Experiment name must contain non-whitespace characters.")
        return cleaned_name

    @field_validator("description")
    @classmethod
    def validate_description(cls, description: str) -> str:
        return description.strip()


class ExperimentListItem(BaseModel):
    """Compact saved experiment item for the history list."""

    experiment_id: str
    run_id: str
    name: str
    description: str
    created_at: str
    symbols: list[str]
    decision_actions: dict[str, TradeAction]
    runtime: RuntimeSummaryItem


class ExperimentResponse(BaseModel):
    """Saved experiment detail including the workflow result."""

    experiment_id: str
    run_id: str
    name: str
    description: str
    created_at: str
    decision: DecisionRequest
    prompt_overrides: AgentPromptOverridesRequest
    runtime: RuntimeSummaryItem
    result: DecisionResponse
