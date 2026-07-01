"""Structured schemas exchanged between investment agents."""

from dataclasses import dataclass, field
from typing import Literal

TradeAction = Literal["BUY", "SELL", "HOLD"]
RiskTolerance = Literal["low", "medium", "high"]


@dataclass(frozen=True)
class AgentPromptOverrides:
    """Optional per-agent experiment instructions appended to default prompts."""

    main_agent: str = ""
    data_collection: str = ""
    data_analysis: str = ""
    report: str = ""
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
    user_prompt: str = ""
    chat_messages: tuple[str, ...] = field(default_factory=tuple)
    prompt_overrides: AgentPromptOverrides = field(default_factory=AgentPromptOverrides)


@dataclass(frozen=True)
class SupervisorDirective:
    """Main-agent interpretation of user natural language before code orchestration."""

    objective: str
    focus_symbols: tuple[str, ...] = field(default_factory=tuple)
    watch_symbols: tuple[str, ...] = field(default_factory=tuple)
    guidance: tuple[str, ...] = field(default_factory=tuple)
    summary: str = ""


@dataclass(frozen=True)
class MarketData:
    """Collected source data for one stock symbol."""

    symbol: str
    latest_price: float
    broker_exchange_code: str | None = None
    news_headlines: tuple[str, ...] = field(default_factory=tuple)
    financial_metrics: dict[str, float] = field(default_factory=dict)


@dataclass(frozen=True)
class AnalysisSignal:
    """Analysis output used by downstream decision and report agents."""

    symbol: str
    price_score: float
    news_score: float
    financial_score: float
    rationale: str

    @property
    def total_score(self) -> float:
        return (self.price_score + self.news_score + self.financial_score) / 3


@dataclass(frozen=True)
class InvestmentReport:
    """Structured report that combines analysis summary and pre-trade risk review."""

    symbol: str
    summary: str
    bull_points: tuple[str, ...]
    bear_points: tuple[str, ...]
    risk_flags: tuple[str, ...]
    risk_approved: bool
    max_position_weight: float
    recommended_action_bias: TradeAction
    signal_strength: float
    rationale: str


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
    broker_exchange_code: str | None = None
    limit_price: float | None = None
    should_submit: bool = False
    reason: str = ""


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
    supervisor_directive: SupervisorDirective
    market_data: tuple[MarketData, ...]
    analysis_signals: tuple[AnalysisSignal, ...]
    investment_reports: tuple[InvestmentReport, ...]
    trade_decisions: tuple[TradeDecision, ...]
    order_plans: tuple[OrderPlan, ...]
    evaluation_log: EvaluationLog
    mandate_violations: tuple[MandateViolation, ...] = field(default_factory=tuple)
