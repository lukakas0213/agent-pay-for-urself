"""Order execution agent.

This module only creates order plans. Real broker submission must be added
behind an explicit adapter and must never run in tests.
"""

from agent_pay_for_urself.adapters.broker import (
    BrokerAdapter,
    BrokerSubmission,
    NoopBrokerAdapter,
)
from agent_pay_for_urself.agents.base import LLMEnabledAgent
from agent_pay_for_urself.llm import AgentLLMClient, to_json_object
from agent_pay_for_urself.llm.serde import parse_order_plans
from agent_pay_for_urself.schemas import OrderPlan, TradeDecision

DEFAULT_ORDER_QUANTITY = 1
ORDER_EXECUTION_LLM_INSTRUCTION = (
    "You are the order execution planning agent in an investment workflow. Return JSON only. "
    "Preserve the order_plans schema and never mark unsupported trades as executable."
)


class OrderExecutionAgent(LLMEnabledAgent):
    """Builds order plans and keeps live submission behind a broker adapter."""

    name = "order_execution"

    def __init__(
        self,
        broker_adapter: BrokerAdapter | None = None,
        llm_client: AgentLLMClient | None = None,
    ) -> None:
        super().__init__(llm_client=llm_client)
        self.broker_adapter = broker_adapter or NoopBrokerAdapter()

    def plan_orders(
        self,
        decisions: tuple[TradeDecision, ...],
        prompt_override: str = "",
    ) -> tuple[OrderPlan, ...]:
        fallback = tuple(self._plan_order(decision) for decision in decisions)
        payload = self._resolve_llm_payload(
            operation_name="plan_orders",
            input_payload={
                "trade_decisions": to_json_object({"trade_decisions": decisions})["trade_decisions"]
            },
            fallback_payload={
                "order_plans": to_json_object({"order_plans": fallback})["order_plans"]
            },
            system_instruction=ORDER_EXECUTION_LLM_INSTRUCTION,
            prompt_override=prompt_override,
        )
        try:
            return parse_order_plans(payload["order_plans"])
        except (KeyError, TypeError, ValueError):
            return fallback

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
