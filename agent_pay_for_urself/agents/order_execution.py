"""Order execution agent.

This module only creates order plans. Real broker submission must be added
behind an explicit adapter and must never run in tests.
"""

from agent_pay_for_urself.adapters.broker import (
    BrokerAdapter,
    BrokerSubmission,
    NoopBrokerAdapter,
)
from agent_pay_for_urself.schemas import OrderPlan, TradeDecision

DEFAULT_ORDER_QUANTITY = 1


class OrderExecutionAgent:
    """Builds order plans and keeps live submission behind a broker adapter."""

    name = "order_execution"

    def __init__(self, broker_adapter: BrokerAdapter | None = None) -> None:
        self.broker_adapter = broker_adapter or NoopBrokerAdapter()

    def plan_orders(self, decisions: tuple[TradeDecision, ...]) -> tuple[OrderPlan, ...]:
        return tuple(self._plan_order(decision) for decision in decisions)

    def submit_orders(self, orders: tuple[OrderPlan, ...]) -> tuple[BrokerSubmission, ...]:
        """Submit only executable orders through the configured broker adapter."""

        executable_orders = tuple(order for order in orders if order.should_submit)
        return tuple(self.broker_adapter.submit_order(order) for order in executable_orders)

    def _plan_order(self, decision: TradeDecision) -> OrderPlan:
        should_submit = decision.action in {"BUY", "SELL"} and decision.risk_approved
        quantity = DEFAULT_ORDER_QUANTITY if should_submit else 0
        reason = "ready for broker adapter" if should_submit else "no executable order"

        return OrderPlan(
            symbol=decision.symbol,
            action=decision.action,
            quantity=quantity,
            should_submit=should_submit,
            reason=reason,
        )
