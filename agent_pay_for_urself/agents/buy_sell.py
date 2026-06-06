"""Buy/sell decision agent."""

from agent_pay_for_urself.schemas import AnalysisSignal, RiskAssessment, TradeDecision

BUY_THRESHOLD = 0.6
SELL_THRESHOLD = 0.35


class BuySellAgent:
    """Creates explainable buy, sell, or hold decisions."""

    name = "buy_sell"

    def decide(
        self,
        signals: tuple[AnalysisSignal, ...],
        risks: tuple[RiskAssessment, ...],
    ) -> tuple[TradeDecision, ...]:
        risk_by_symbol = {risk.symbol: risk for risk in risks}
        return tuple(
            self._decide_symbol(signal, risk_by_symbol[signal.symbol]) for signal in signals
        )

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
