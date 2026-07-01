"""Request and response models for persisted agent prompt settings."""

from pydantic import BaseModel, Field, field_validator


class AgentPromptItem(BaseModel):
    """Stored prompt text for one agent."""

    agent_key: str = Field(description="Stable agent identifier used by the orchestrator.")
    label: str = Field(description="Human-readable label for the agent.")
    prompt: str = Field(description="Persisted base prompt text for the agent.")
    updated_at: str = Field(description="ISO timestamp of the last update or default seed.")
    source: str = Field(
        description="Whether the prompt comes from the built-in default or a user update."
    )


class AgentPromptUpdateRequest(BaseModel):
    """Request body for updating one persisted agent prompt."""

    prompt: str = Field(default="", description="Replacement prompt text for the selected agent.")

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, prompt: str) -> str:
        return prompt.strip()


class AgentPromptSaveResponse(BaseModel):
    """Response returned after a prompt update."""

    item: AgentPromptItem
