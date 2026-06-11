"""Structured schemas exchanged between investment agents."""

from dataclasses import dataclass, field
from typing import Literal

TradeAction = Literal["BUY", "SELL", "HOLD"]
RiskTolerance = Literal["low", "medium", "high"]


@dataclass(frozen=True)
class AgentPromptOverrides:
    """Optional per-agent experiment instructions appended to default prompts."""

    data_collection: str = ""
    data_analysis: str = ""
    risk_management: str = ""
    buy_sell: str = ""
    order_execution: str = ""
    log_evaluation: str = ""


@dataclass(frozen=True)
class InvestmentMandate:
    """User-owned operating boundary that the main agent must enforce."""

    objective: str = "Evaluate requested US equity symbols conservatively."
    allowed_symbols: tuple[str, ...] = field(default_factory=tuple)
    excluded_symbols: tuple[str, ...] = field(default_factory=tuple)
    max_position_weight: float = 0.2
    max_order_notional: float | None = None
    min_cash_weight: float | None = None
    risk_tolerance: RiskTolerance = "medium"
    requires_approval_for_live_orders: bool = True
    user_notes: str = ""


@dataclass(frozen=True)
class MandateViolation:
    """One policy violation found while checking workflow outputs."""

    symbol: str
    rule: str
    message: str


@dataclass(frozen=True)
class InvestmentRequest:
    """Input from the Web UI or API into the main agent."""

    symbols: tuple[str, ...]
    max_position_weight: float = 0.2
    mandate: InvestmentMandate | None = None
    prompt_overrides: AgentPromptOverrides = field(default_factory=AgentPromptOverrides)


@dataclass(frozen=True)
class MarketData:
    """Collected source data for one stock symbol."""

    symbol: str
    latest_price: float
    news_headlines: tuple[str, ...] = field(default_factory=tuple)
    financial_metrics: dict[str, float] = field(default_factory=dict)


@dataclass(frozen=True)
class AnalysisSignal:
    """Analysis output used by downstream decision and risk agents."""

    symbol: str
    price_score: float
    news_score: float
    financial_score: float
    rationale: str

    @property
    def total_score(self) -> float:
        return (self.price_score + self.news_score + self.financial_score) / 3


@dataclass(frozen=True)
class RiskAssessment:
    """Risk validation result for a potential trade."""

    symbol: str
    approved: bool
    reasons: tuple[str, ...]
    max_position_weight: float


@dataclass(frozen=True)
class TradeDecision:
    """Buy, sell, or hold decision with explainable reasoning."""

    symbol: str
    action: TradeAction
    confidence: float
    rationale: str
    risk_approved: bool


@dataclass(frozen=True)
class OrderPlan:
    """Order execution plan. This does not submit a real order."""

    symbol: str
    action: TradeAction
    quantity: int
    should_submit: bool
    reason: str


@dataclass(frozen=True)
class EvaluationLog:
    """Persistable log summary for decisions and performance evaluation."""

    decision_count: int
    order_count: int
    blocked_order_count: int
    notes: tuple[str, ...]


@dataclass(frozen=True)
class WorkflowResult:
    """Full result returned by the main agent orchestrator."""

    request: InvestmentRequest
    mandate: InvestmentMandate
    market_data: tuple[MarketData, ...]
    analysis_signals: tuple[AnalysisSignal, ...]
    risk_assessments: tuple[RiskAssessment, ...]
    trade_decisions: tuple[TradeDecision, ...]
    order_plans: tuple[OrderPlan, ...]
    evaluation_log: EvaluationLog
    mandate_violations: tuple[MandateViolation, ...] = field(default_factory=tuple)
