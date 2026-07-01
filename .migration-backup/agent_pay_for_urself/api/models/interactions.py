"""Request and response models for console assistant interactions."""

from pydantic import BaseModel, ConfigDict, Field

from agent_pay_for_urself.api.models.decisions import DecisionResponse


class AgentInteractionRequest(BaseModel):
    """Message sent to the console assistant around a stored workflow run."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "message": "애플이 요즘 심상치 않으니 좋은 타이밍에 들어가라",
                    "run_id": "run_123",
                    "apply_to_workflow": True,
                }
            ]
        }
    )

    message: str = Field(min_length=1, description="User message for the console assistant.")
    run_id: str | None = Field(
        default=None,
        description="Stored workflow run id returned by POST /decisions.",
    )
    apply_to_workflow: bool = Field(
        default=False,
        description=(
            "When true, append the message to the stored run as a follow-up natural-language "
            "instruction and rerun the workflow before generating the reply."
        ),
    )
    current_result: DecisionResponse | None = Field(
        default=None,
        description=(
            "Deprecated compatibility field for callers that still send the full decision "
            "payload back to the console assistant."
        ),
    )


class AgentInteractionResponse(BaseModel):
    """Deterministic reply for the console interaction panel."""

    focus: str = Field(description="Detected topic of the user message.")
    reply: str = Field(description="Console assistant response based on the workflow result.")
    suggested_actions: list[str] = Field(description="Safe next actions the user can take.")
    applied_to_workflow: bool = Field(
        default=False,
        description="Whether the message was applied as a follow-up workflow instruction.",
    )
    updated_run_id: str | None = Field(
        default=None,
        description="New workflow run id after applying the message, if one was created.",
    )
    updated_result: DecisionResponse | None = Field(
        default=None,
        description="Updated workflow result after applying the message, when requested.",
    )
