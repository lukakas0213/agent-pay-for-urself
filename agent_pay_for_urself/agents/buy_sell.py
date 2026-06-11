"""Buy/sell decision agent."""

from agent_pay_for_urself.agents.base import LLMEnabledAgent
from agent_pay_for_urself.llm import AgentLLMClient, to_json_object
from agent_pay_for_urself.llm.serde import parse_trade_decisions
from agent_pay_for_urself.schemas import AnalysisSignal, RiskAssessment, TradeDecision

BUY_THRESHOLD = 0.6
SELL_THRESHOLD = 0.35
BUY_SELL_LLM_INSTRUCTION = (
    "You are the buy/sell decision agent in an investment workflow. Return JSON only. "
    "Preserve the trade_decisions schema and align decisions with the supplied risk results."
)


class BuySellAgent(LLMEnabledAgent):
    """Creates explainable buy, sell, or hold decisions."""

    name = "buy_sell"

    def __init__(self, llm_client: AgentLLMClient | None = None) -> None:
        super().__init__(llm_client=llm_client)

    def decide(
        self,
        signals: tuple[AnalysisSignal, ...],
        risks: tuple[RiskAssessment, ...],
        prompt_override: str = "",
    ) -> tuple[TradeDecision, ...]:
        risk_by_symbol = {risk.symbol: risk for risk in risks}
        fallback = tuple(
            self._decide_symbol(signal, risk_by_symbol[signal.symbol]) for signal in signals
        )
        payload = self._resolve_llm_payload(
            operation_name="decide",
            input_payload={
                "analysis_signals": to_json_object({"analysis_signals": signals})[
                    "analysis_signals"
                ],
                "risk_assessments": to_json_object({"risk_assessments": risks})["risk_assessments"],
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

    def _decide_symbol(self, signal: AnalysisSignal, risk: RiskAssessment) -> TradeDecision:
        if not risk.approved:
            return TradeDecision(
                symbol=signal.symbol,
                action="HOLD",
                confidence=0.0,
                rationale=f"Risk validation failed: {'; '.join(risk.reasons)}",
                risk_approved=False,
            )

        if signal.total_score >= BUY_THRESHOLD:
            action = "BUY"
        elif signal.total_score <= SELL_THRESHOLD:
            action = "SELL"
        else:
            action = "HOLD"

        return TradeDecision(
            symbol=signal.symbol,
            action=action,
            confidence=round(signal.total_score, 4),
            rationale=signal.rationale,
            risk_approved=True,
        )
