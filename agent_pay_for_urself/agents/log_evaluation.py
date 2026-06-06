"""Logging and evaluation agent."""

from agent_pay_for_urself.schemas import EvaluationLog, OrderPlan, TradeDecision


class LogEvaluationAgent:
    """Creates persistable decision, trade, and performance log summaries."""

    name = "log_evaluation"

    def summarize(
        self,
        decisions: tuple[TradeDecision, ...],
        orders: tuple[OrderPlan, ...],
    ) -> EvaluationLog:
        blocked_order_count = sum(1 for order in orders if not order.should_submit)
        notes = tuple(f"{decision.symbol}: {decision.action}" for decision in decisions)

        return EvaluationLog(
            decision_count=len(decisions),
            order_count=len(orders),
            blocked_order_count=blocked_order_count,
            notes=notes,
        )
