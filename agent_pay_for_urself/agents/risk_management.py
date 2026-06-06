"""Risk management agent."""

from agent_pay_for_urself.schemas import AnalysisSignal, InvestmentRequest, RiskAssessment

MIN_POSITION_WEIGHT = 0.0
MAX_POSITION_WEIGHT = 1.0


class RiskManagementAgent:
    """Validates position limits and basic trade eligibility."""

    name = "risk_management"

    def assess(
        self,
        request: InvestmentRequest,
        signals: tuple[AnalysisSignal, ...],
    ) -> tuple[RiskAssessment, ...]:
        return tuple(self._assess_symbol(request, signal) for signal in signals)

    def _assess_symbol(
        self,
        request: InvestmentRequest,
        signal: AnalysisSignal,
    ) -> RiskAssessment:
        reasons: list[str] = []
        approved = True

        if not MIN_POSITION_WEIGHT < request.max_position_weight <= MAX_POSITION_WEIGHT:
            approved = False
            reasons.append("max_position_weight must be greater than 0 and less than or equal to 1")

        if not signal.rationale:
            approved = False
            reasons.append("investment rationale is required")

        if approved:
            reasons.append("risk rules passed")

        return RiskAssessment(
            symbol=signal.symbol,
            approved=approved,
            reasons=tuple(reasons),
            max_position_weight=request.max_position_weight,
        )
