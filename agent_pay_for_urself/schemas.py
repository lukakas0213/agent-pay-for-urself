"""Structured schemas exchanged between investment agents."""

from dataclasses import dataclass, field
from typing import Literal

TradeAction = Literal["BUY", "SELL", "HOLD"]


@dataclass(frozen=True)
class InvestmentRequest:
    """Input from the Web UI or API into the main agent."""

    symbols: tuple[str, ...]
    max_position_weight: float = 0.2


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
    market_data: tuple[MarketData, ...]
    analysis_signals: tuple[AnalysisSignal, ...]
    risk_assessments: tuple[RiskAssessment, ...]
    trade_decisions: tuple[TradeDecision, ...]
    order_plans: tuple[OrderPlan, ...]
    evaluation_log: EvaluationLog
