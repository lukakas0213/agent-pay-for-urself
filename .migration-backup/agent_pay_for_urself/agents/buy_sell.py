"""Buy/sell decision agent."""

from agent_pay_for_urself.agents.base import LLMEnabledAgent
from agent_pay_for_urself.llm import AgentLLMClient, to_json_object
from agent_pay_for_urself.llm.serde import parse_trade_decisions
from agent_pay_for_urself.schemas import InvestmentReport, TradeDecision

BUY_SELL_LLM_INSTRUCTION = (
    "You are the buy/sell decision agent in an investment workflow. Return JSON only. "
    "Preserve the trade_decisions schema and align decisions with the supplied reports."
)


class BuySellAgent(LLMEnabledAgent):
    """Creates explainable buy, sell, or hold decisions from report outputs."""

    name = "buy_sell"

    def __init__(self, llm_client: AgentLLMClient | None = None) -> None:
        super().__init__(llm_client=llm_client)

    def decide(
        self,
        reports: tuple[InvestmentReport, ...],
        prompt_override: str = "",
    ) -> tuple[TradeDecision, ...]:
        fallback = tuple(self._decide_symbol(report) for report in reports)
        payload = self._resolve_llm_payload(
            operation_name="decide",
            input_payload={
                "investment_reports": to_json_object({"investment_reports": reports})[
                    "investment_reports"
                ],
            },
            fallback_payload={
                "trade_decisions": to_json_object({"trade_decisions": fallback})["trade_decisions"]
            },
            system_instruction=BUY_SELL_LLM_INSTRUCTION,
            prompt_override=prompt_override,
        )
        try:
            return parse_trade_decisions(payload["trade_decisions"])
        except (KeyError, TypeError, ValueError):
            return fallback

    def _decide_symbol(self, report: InvestmentReport) -> TradeDecision:
        if not report.risk_approved:
            return TradeDecision(
                symbol=report.symbol,
                action="HOLD",
                confidence=0.0,
                rationale=(
                    f"Report risk review failed: {'; '.join(report.risk_flags)}. {report.summary}"
                ),
                risk_approved=False,
            )

        return TradeDecision(
            symbol=report.symbol,
            action=report.recommended_action_bias,
            confidence=report.signal_strength,
            rationale=report.rationale,
            risk_approved=True,
        )
