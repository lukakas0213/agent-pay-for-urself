"""Order execution agent.

This module only creates order plans. Real broker submission must be added
behind an explicit adapter and must never run in tests.
"""

from agent_pay_for_urself.schemas import OrderPlan, TradeDecision

DEFAULT_ORDER_QUANTITY = 1


class OrderExecutionAgent:
    """Builds broker order plans after decision and risk validation."""

    name = "order_execution"

    def plan_orders(self, decisions: tuple[TradeDecision, ...]) -> tuple[OrderPlan, ...]:
        return tuple(self._plan_order(decision) for decision in decisions)

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
