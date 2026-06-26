"""Broker adapter boundary.

Live broker submission is intentionally kept outside of the decision-planning
workflow. The default implementation records that live submission is not
available yet.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

from agent_pay_for_urself.schemas import OrderPlan


@dataclass(frozen=True)
class BrokerSubmission:
    """Submission result returned by a broker adapter."""

    symbol: str
    accepted: bool
    broker_order_id: str | None
    message: str


@dataclass(frozen=True)
class BrokerAccountHolding:
    """One normalized holding item returned by a broker account lookup."""

    symbol: str
    name: str
    quantity: int
    average_price: float
    current_price: float
    market_value: float
    profit_loss: float
    profit_loss_rate: float


@dataclass(frozen=True)
class BrokerAccountSummary:
    """Normalized account summary returned by a broker account lookup."""

    cash_balance: float
    total_purchase_amount: float
    total_evaluation_amount: float
    total_profit_loss: float
    total_profit_loss_rate: float


@dataclass(frozen=True)
class BrokerAccountSnapshot:
    """Account lookup result returned by a broker adapter."""

    available: bool
    broker: str
    account_masked: str | None
    summary: BrokerAccountSummary | None
    holdings: tuple[BrokerAccountHolding, ...]
    message: str


class BrokerAdapter(ABC):
    """Boundary for live broker submission and order-status lookup."""

    supports_live_submission = False

    @abstractmethod
    def submit_order(self, order_plan: OrderPlan) -> BrokerSubmission:
        """Submit one executable order plan to the configured broker."""

    @abstractmethod
    def get_order_status(self, broker_order_id: str) -> str:
        """Fetch the current order status for a broker order id."""

    @abstractmethod
    def get_account_snapshot(self) -> BrokerAccountSnapshot:
        """Fetch one normalized account snapshot from the configured broker."""


class NoopBrokerAdapter(BrokerAdapter):
    """Placeholder adapter used before real broker integration exists."""

    def submit_order(self, order_plan: OrderPlan) -> BrokerSubmission:
        return BrokerSubmission(
            symbol=order_plan.symbol,
            accepted=False,
            broker_order_id=None,
            message="live broker submission is not configured",
        )

    def get_order_status(self, broker_order_id: str) -> str:
        return "unavailable"

    def get_account_snapshot(self) -> BrokerAccountSnapshot:
        return BrokerAccountSnapshot(
            available=False,
            broker="noop",
            account_masked=None,
            summary=None,
            holdings=(),
            message="live broker account lookup is not configured",
        )
