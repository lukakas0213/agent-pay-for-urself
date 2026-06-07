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


class BrokerAdapter(ABC):
    """Boundary for live broker submission and order-status lookup."""

    supports_live_submission = False

    @abstractmethod
    def submit_order(self, order_plan: OrderPlan) -> BrokerSubmission:
        """Submit one executable order plan to the configured broker."""

    @abstractmethod
    def get_order_status(self, broker_order_id: str) -> str:
        """Fetch the current order status for a broker order id."""


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
