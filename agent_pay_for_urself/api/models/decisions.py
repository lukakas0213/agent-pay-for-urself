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


class DecisionRequest(BaseModel):
    """Request body for running the decision workflow."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "symbols": ["AAPL", "MSFT"],
                    "max_position_weight": 0.2,
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
            "outputs such as decisions, analysis signals, risk results, and order plans."
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
    mandate: MandateRequest | None = Field(
        default=None,
        description="Optional user mandate that constrains this workflow run.",
    )

    @field_validator("symbols")
    @classmethod
    def validate_symbols(cls, symbols: list[str]) -> list[str]:
        """Strip surrounding whitespace and reject blank symbols before workflow execution."""

        cleaned_symbols = [symbol.strip() for symbol in symbols]
        if any(not symbol for symbol in cleaned_symbols):
            raise ValueError("Each symbol must contain non-whitespace characters.")
        return cleaned_symbols


class MarketDataItem(BaseModel):
    """Collected market data returned by the data collection agent."""

    symbol: str = Field(description="Uppercase stock symbol that was collected.")
    latest_price: float = Field(
        description="Latest price from the configured market data provider."
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


class RiskAssessmentItem(BaseModel):
    """Risk validation result for one symbol."""

    symbol: str = Field(description="Uppercase stock symbol that was checked.")
    approved: bool = Field(description="Whether risk validation approved the symbol.")
    reasons: list[str] = Field(description="Risk approval or rejection reasons.")
    max_position_weight: float = Field(description="Position weight limit used for validation.")


class DecisionItem(BaseModel):
    """Buy, sell, or hold recommendation for one requested symbol."""

    symbol: str = Field(description="Uppercase stock symbol that was evaluated.")
    action: TradeAction = Field(description="Decision action: BUY, SELL, or HOLD.")
    confidence: float = Field(description="Decision confidence score from 0 to 1.")
    rationale: str = Field(description="Human-readable explanation for the decision.")
    risk_approved: bool = Field(description="Whether risk validation approved this symbol.")


class OrderItem(BaseModel):
    """Broker order plan derived from one decision."""

    symbol: str = Field(description="Uppercase stock symbol for the planned order.")
    action: TradeAction = Field(description="Decision action carried into order planning.")
    quantity: int = Field(description="Planned order quantity. Zero means no executable order.")
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
        description="Configured model name when a live LLM client is enabled."
    )
    live_order_enabled: bool = Field(
        description="Whether the current runtime may submit live orders."
    )


class DecisionResponse(BaseModel):
    """Decision workflow result returned by POST /decisions."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "run_id": "run_123",
                    "symbols": ["AAPL", "MSFT"],
                    "runtime": {
                        "data_mode": "stub",
                        "llm_mode": "fallback",
                        "model_name": None,
                        "live_order_enabled": False,
                    },
                    "mandate": {
                        "objective": "Evaluate requested US equity symbols conservatively.",
                        "allowed_symbols": [],
                        "excluded_symbols": [],
                        "max_position_weight": 0.2,
                        "max_order_notional": None,
                        "min_cash_weight": None,
                        "risk_tolerance": "medium",
                        "requires_approval_for_live_orders": True,
                        "user_notes": "",
                    },
                    "market_data": [
                        {
                            "symbol": "AAPL",
                            "latest_price": 100.0,
                            "news_headlines": ["AAPL market update"],
                            "financial_metrics": {"pe_ratio": 20.0},
                        }
                    ],
                    "analysis_signals": [
                        {
                            "symbol": "AAPL",
                            "price_score": 0.5,
                            "news_score": 0.55,
                            "financial_score": 0.7,
                            "total_score": 0.5833,
                            "rationale": (
                                "AAPL: price, news, and financial data were reviewed; "
                                "PE ratio=20.0."
                            ),
                        }
                    ],
                    "risk_assessments": [
                        {
                            "symbol": "AAPL",
                            "approved": True,
                            "reasons": ["risk rules passed"],
                            "max_position_weight": 0.2,
                        }
                    ],
                    "decisions": [
                        {
                            "symbol": "AAPL",
                            "action": "HOLD",
                            "confidence": 0.5833,
                            "rationale": (
                                "AAPL: price, news, and financial data were reviewed; "
                                "PE ratio=20.0."
                            ),
                            "risk_approved": True,
                        }
                    ],
                    "orders": [
                        {
                            "symbol": "AAPL",
                            "action": "HOLD",
                            "quantity": 0,
                            "should_submit": False,
                            "reason": "no executable order",
                        }
                    ],
                    "evaluation_log": {
                        "decision_count": 2,
                        "order_count": 2,
                        "blocked_order_count": 2,
                        "notes": ["AAPL: HOLD", "MSFT: HOLD"],
                    },
                    "mandate_violations": [],
                }
            ]
        }
    )

    run_id: str = Field(description="Identifier for the stored workflow result.")
    symbols: list[str] = Field(description="Symbols received in the request.")
    runtime: RuntimeSummaryItem | None = Field(
        default=None,
        description="Safe runtime summary showing which data and LLM modes were active.",
    )
    mandate: MandateItem = Field(description="User mandate enforced by the main agent.")
    market_data: list[MarketDataItem] = Field(description="Market data collected before analysis.")
    analysis_signals: list[AnalysisSignalItem] = Field(
        description="Analysis scores generated before risk validation and decision making."
    )
    risk_assessments: list[RiskAssessmentItem] = Field(
        description="Risk validation results generated before buy/sell/hold decisions."
    )
    decisions: list[DecisionItem] = Field(description="Decision result for each symbol.")
    orders: list[OrderItem] = Field(description="Order plan for each decision.")
    evaluation_log: EvaluationLogItem = Field(description="Workflow summary and compact notes.")
    mandate_violations: list[MandateViolationItem] = Field(
        description="Mandate violations found and enforced by the main agent."
    )
