"""Request and response models for the decision workflow API."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TradeAction = Literal["BUY", "SELL", "HOLD"]
RiskTolerance = Literal["low", "medium", "high"]


class MandateRequest(BaseModel):
    """Optional user mandate boundaries for a workflow run."""

    objective: str = Field(
        default="Evaluate requested US equity symbols conservatively.",
        description="User-owned objective that the main agent must stay within.",
    )
    allowed_symbols: list[str] = Field(
        default_factory=list,
        description="Optional symbol universe. Empty means the requested symbols are allowed.",
    )
    excluded_symbols: list[str] = Field(
        default_factory=list,
        description="Symbols the main agent must not trade or recommend.",
    )
    max_order_notional: float | None = Field(
        default=None,
        gt=0,
        description="Optional maximum notional value for a single future order.",
    )
    min_cash_weight: float | None = Field(
        default=None,
        ge=0,
        le=1,
        description="Optional minimum cash allocation to preserve.",
    )
    risk_tolerance: RiskTolerance = Field(
        default="medium",
        description="User risk tolerance boundary for future policy checks.",
    )
    requires_approval_for_live_orders: bool = Field(
        default=True,
        description="Whether live broker orders require explicit user approval.",
    )
    user_notes: str = Field(
        default="",
        description="Additional user constraints or context not yet modeled as hard fields.",
    )


class MandateItem(BaseModel):
    """Mandate stored on the workflow result."""

    objective: str
    allowed_symbols: list[str]
    excluded_symbols: list[str]
    max_position_weight: float
    max_order_notional: float | None
    min_cash_weight: float | None
    risk_tolerance: RiskTolerance
    requires_approval_for_live_orders: bool
    user_notes: str


class MandateViolationItem(BaseModel):
    """Policy violation found while checking workflow outputs."""

    symbol: str
    rule: str
    message: str


class SupervisorDirectiveItem(BaseModel):
    """Structured result of the main agent's natural-language interpretation."""

    objective: str
    focus_symbols: list[str]
    watch_symbols: list[str]
    guidance: list[str]
    summary: str


class DecisionRequest(BaseModel):
    """Request body for running the decision workflow."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "symbols": ["AAPL", "MSFT"],
                    "max_position_weight": 0.2,
                    "user_prompt": "장기적으로 수익을 낼 수 있는 전략과 종목을 중심으로 운용하라.",
                    "chat_messages": ["애플이 요즘 심상치 않으니 좋은 타이밍에 들어가라"],
                    "mandate": {
                        "objective": "Evaluate only allowed symbols.",
                        "allowed_symbols": ["AAPL", "MSFT"],
                        "excluded_symbols": [],
                        "risk_tolerance": "medium",
                        "requires_approval_for_live_orders": True,
                    },
                }
            ]
        }
    )

    symbols: list[str] = Field(
        min_length=1,
        description=(
            "Stock symbols to evaluate. Symbols are normalized to uppercase in workflow "
            "outputs such as decisions, analysis signals, reports, and order plans."
        ),
        examples=[["AAPL", "MSFT"]],
    )
    max_position_weight: float = Field(
        default=0.2,
        gt=0,
        le=1,
        description=(
            "Maximum portfolio weight allowed for one position. Must be greater than 0 "
            "and less than or equal to 1."
        ),
        examples=[0.2],
    )
    user_prompt: str = Field(
        default="",
        description="Primary natural-language objective interpreted by the main agent.",
    )
    chat_messages: list[str] = Field(
        default_factory=list,
        description=(
            "Optional follow-up natural-language instructions interpreted by the main agent."
        ),
    )
    mandate: MandateRequest | None = Field(
        default=None,
        description="Optional user mandate that constrains this workflow run.",
    )

    @field_validator("symbols")
    @classmethod
    def validate_symbols(cls, symbols: list[str]) -> list[str]:
        cleaned_symbols = [symbol.strip() for symbol in symbols]
        if any(not symbol for symbol in cleaned_symbols):
            raise ValueError("Each symbol must contain non-whitespace characters.")
        return cleaned_symbols

    @field_validator("chat_messages")
    @classmethod
    def validate_chat_messages(cls, chat_messages: list[str]) -> list[str]:
        cleaned_messages = [message.strip() for message in chat_messages]
        if any(not message for message in cleaned_messages):
            raise ValueError("Each chat message must contain non-whitespace characters.")
        return cleaned_messages


class MarketDataItem(BaseModel):
    """Collected market data returned by the data collection agent."""

    symbol: str = Field(description="Uppercase stock symbol that was collected.")
    latest_price: float = Field(
        description="Latest price from the configured market data provider."
    )
    broker_exchange_code: str | None = Field(
        default=None,
        description="Optional Korea Investment overseas exchange code derived from market data.",
    )
    news_headlines: list[str] = Field(description="News headlines collected for the symbol.")
    financial_metrics: dict[str, float] = Field(
        description="Financial metrics collected for the symbol."
    )


class AnalysisSignalItem(BaseModel):
    """Price, news, and financial signal scores for one symbol."""

    symbol: str = Field(description="Uppercase stock symbol that was analyzed.")
    price_score: float = Field(description="Price signal score from 0 to 1.")
    news_score: float = Field(description="News signal score from 0 to 1.")
    financial_score: float = Field(description="Financial metric score from 0 to 1.")
    total_score: float = Field(description="Average of price, news, and financial scores.")
    rationale: str = Field(description="Explanation for the analysis signal.")


class InvestmentReportItem(BaseModel):
    """Structured report generated before buy/sell decisions."""

    symbol: str = Field(description="Uppercase stock symbol summarized by the report agent.")
    summary: str = Field(description="Compact report summary used by downstream decisions.")
    bull_points: list[str] = Field(description="Positive drivers identified for the symbol.")
    bear_points: list[str] = Field(description="Negative drivers identified for the symbol.")
    risk_flags: list[str] = Field(description="Risk review flags or pass notes.")
    risk_approved: bool = Field(
        description="Whether the report-level risk review approved the symbol."
    )
    max_position_weight: float = Field(
        description="Position weight limit used for the report review."
    )
    recommended_action_bias: TradeAction = Field(
        description="Report agent's structured action bias."
    )
    signal_strength: float = Field(
        description="Report-level normalized confidence derived from analysis signals."
    )
    rationale: str = Field(description="Full report rationale consumed by the buy/sell agent.")


class DecisionItem(BaseModel):
    """Buy, sell, or hold recommendation for one requested symbol."""

    symbol: str = Field(description="Uppercase stock symbol that was evaluated.")
    action: TradeAction = Field(description="Decision action: BUY, SELL, or HOLD.")
    confidence: float = Field(description="Decision confidence score from 0 to 1.")
    rationale: str = Field(description="Human-readable explanation for the decision.")
    risk_approved: bool = Field(
        description="Whether report-level risk review approved this symbol."
    )


class OrderItem(BaseModel):
    """Broker order plan derived from one decision."""

    symbol: str = Field(description="Uppercase stock symbol for the planned order.")
    action: TradeAction = Field(description="Decision action carried into order planning.")
    quantity: int = Field(description="Planned order quantity. Zero means no executable order.")
    broker_exchange_code: str | None = Field(
        default=None,
        description="Optional Korea Investment overseas exchange code for a future broker order.",
    )
    limit_price: float | None = Field(
        default=None,
        description=(
            "Optional limit price derived from current market data for a future broker order."
        ),
    )
    should_submit: bool = Field(
        description=(
            "Whether this order is ready for a future broker adapter. The current API only "
            "returns the plan; it does not submit an order."
        )
    )
    reason: str = Field(description="Order planning explanation.")


class EvaluationLogItem(BaseModel):
    """Workflow summary intended for decision and performance logging."""

    decision_count: int = Field(description="Number of generated decisions.")
    order_count: int = Field(description="Number of generated order plans.")
    blocked_order_count: int = Field(description="Number of order plans not ready to submit.")
    notes: list[str] = Field(description="Compact per-symbol decision notes.")


class RuntimeSummaryItem(BaseModel):
    """Runtime configuration summary safe to expose in API responses."""

    data_mode: str = Field(description="Configured market data provider mode.")
    llm_mode: str = Field(
        description="Whether the workflow used a model or deterministic fallback."
    )
    model_name: str | None = Field(
        description="Configured default model name when a live LLM client is enabled."
    )
    agent_models: dict[str, str] | None = Field(
        default=None,
        description="Resolved per-agent OpenAI model routing when configured.",
    )
    live_order_enabled: bool = Field(
        description="Whether the current runtime may submit live orders."
    )


class DecisionResponse(BaseModel):
    """Decision workflow result returned by POST /decisions."""

    run_id: str = Field(description="Identifier for the stored workflow result.")
    symbols: list[str] = Field(description="Symbols received in the request.")
    user_prompt: str = Field(description="Primary natural-language objective for the run.")
    chat_messages: list[str] = Field(
        description="Follow-up natural-language instructions attached to the run."
    )
    runtime: RuntimeSummaryItem | None = Field(
        default=None,
        description="Safe runtime summary showing which data and LLM modes were active.",
    )
    mandate: MandateItem = Field(description="User mandate enforced by the main agent.")
    supervisor_directive: SupervisorDirectiveItem = Field(
        description="Structured interpretation produced by the main agent before orchestration."
    )
    market_data: list[MarketDataItem] = Field(description="Market data collected before analysis.")
    analysis_signals: list[AnalysisSignalItem] = Field(
        description="Analysis scores generated before report writing and decision making."
    )
    investment_reports: list[InvestmentReportItem] = Field(
        description="Structured reports generated after analysis and before buy/sell decisions."
    )
    decisions: list[DecisionItem] = Field(description="Decision result for each symbol.")
    orders: list[OrderItem] = Field(description="Order plan for each decision.")
    evaluation_log: EvaluationLogItem = Field(description="Workflow summary and compact notes.")
    mandate_violations: list[MandateViolationItem] = Field(
        description="Mandate violations found and enforced by the main agent."
    )
