"""Logging and evaluation agent."""

from agent_pay_for_urself.agents.base import LLMEnabledAgent
from agent_pay_for_urself.llm import AgentLLMClient, to_json_object
from agent_pay_for_urself.llm.serde import parse_evaluation_log
from agent_pay_for_urself.schemas import EvaluationLog, OrderPlan, TradeDecision

LOG_EVALUATION_LLM_INSTRUCTION = (
    "You are the log and evaluation agent in an investment workflow. Return JSON only. "
    "Preserve the evaluation_log schema and summarize the supplied decisions conservatively."
)


class LogEvaluationAgent(LLMEnabledAgent):
    """Creates persistable decision, trade, and performance log summaries."""

    name = "log_evaluation"

    def __init__(self, llm_client: AgentLLMClient | None = None) -> None:
        super().__init__(llm_client=llm_client)

    def summarize(
        self,
        decisions: tuple[TradeDecision, ...],
        orders: tuple[OrderPlan, ...],
        prompt_override: str = "",
    ) -> EvaluationLog:
        blocked_order_count = sum(1 for order in orders if not order.should_submit)
        notes = tuple(f"{decision.symbol}: {decision.action}" for decision in decisions)
        fallback = EvaluationLog(
            decision_count=len(decisions),
            order_count=len(orders),
            blocked_order_count=blocked_order_count,
            notes=notes,
        )
        payload = self._resolve_llm_payload(
            operation_name="summarize",
            input_payload={
                "trade_decisions": to_json_object({"trade_decisions": decisions})[
                    "trade_decisions"
                ],
                "order_plans": to_json_object({"order_plans": orders})["order_plans"],
            },
            fallback_payload={
                "evaluation_log": to_json_object({"evaluation_log": fallback})["evaluation_log"]
            },
            system_instruction=LOG_EVALUATION_LLM_INSTRUCTION,
            prompt_override=prompt_override,
        )
        try:
            return parse_evaluation_log(payload["evaluation_log"])
        except (KeyError, TypeError, ValueError):
            return fallback
