"""Request and response models for persisted agent settings."""

from typing import Literal

from pydantic import BaseModel, Field

AgentKey = Literal[
    "main_agent",
    "data_collection",
    "data_analysis",
    "report",
    "buy_sell",
    "order_execution",
    "log_evaluation",
]
FollowupMode = Literal["suggest_only", "apply_with_confirmation", "auto_apply"]
ScoreBias = Literal["conservative", "balanced", "aggressive"]
DefaultOrderType = Literal["market", "limit"]


class AgentSettingsCommonItem(BaseModel):
    """Shared settings fields for all agents."""

    enabled: bool = Field(description="Whether the agent is enabled in the UI configuration.")
    use_llm: bool = Field(description="Whether the UI should treat this agent as LLM-enabled.")
    llm_model: str | None = Field(
        default=None,
        description="Optional per-agent model hint stored for the settings screen.",
    )


class MainAgentSettingsItem(BaseModel):
    followup_mode: FollowupMode
    max_watch_symbols: int = Field(ge=1, le=20)
    allow_symbol_expansion: bool


class DataCollectionSettingsItem(BaseModel):
    news_limit: int = Field(ge=0, le=20)
    include_financials: bool
    include_exchange_code: bool


class DataAnalysisSettingsItem(BaseModel):
    score_bias: ScoreBias
    include_news_sentiment: bool
    include_financial_score: bool


class ReportSettingsItem(BaseModel):
    max_bull_points: int = Field(ge=1, le=10)
    max_bear_points: int = Field(ge=1, le=10)
    include_risk_flags: bool


class BuySellSettingsItem(BaseModel):
    hold_threshold: float = Field(ge=0.0, le=1.0)
    allow_sell_recommendations: bool
    respect_report_risk_gate: bool


class OrderExecutionSettingsItem(BaseModel):
    default_order_type: DefaultOrderType
    require_limit_price: bool
    allow_live_submission: bool


class LogEvaluationSettingsItem(BaseModel):
    include_notes: bool
    max_notes: int = Field(ge=0, le=50)
    include_blocked_order_summary: bool


class AgentSettingsItem(BaseModel):
    """Persisted settings for one agent."""

    agent_key: AgentKey
    label: str
    updated_at: str
    source: str
    common: AgentSettingsCommonItem
    specialized: (
        MainAgentSettingsItem
        | DataCollectionSettingsItem
        | DataAnalysisSettingsItem
        | ReportSettingsItem
        | BuySellSettingsItem
        | OrderExecutionSettingsItem
        | LogEvaluationSettingsItem
    )


class AgentSettingsUpdateRequest(BaseModel):
    """Request body for updating one persisted agent settings record."""

    common: AgentSettingsCommonItem
    specialized: (
        MainAgentSettingsItem
        | DataCollectionSettingsItem
        | DataAnalysisSettingsItem
        | ReportSettingsItem
        | BuySellSettingsItem
        | OrderExecutionSettingsItem
        | LogEvaluationSettingsItem
    )


class AgentSettingsSaveResponse(BaseModel):
    """Response returned after an agent settings update."""

    item: AgentSettingsItem
