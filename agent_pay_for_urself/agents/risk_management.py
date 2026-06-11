"""Risk management agent."""

from agent_pay_for_urself.agents.base import LLMEnabledAgent
from agent_pay_for_urself.llm import AgentLLMClient, to_json_object
from agent_pay_for_urself.llm.serde import parse_risk_assessments
from agent_pay_for_urself.schemas import AnalysisSignal, InvestmentRequest, RiskAssessment

MIN_POSITION_WEIGHT = 0.0
MAX_POSITION_WEIGHT = 1.0
RISK_LLM_INSTRUCTION = (
    "You are the risk management agent in an investment workflow. Return JSON only. "
    "Preserve the risk_assessments schema and keep approval decisions conservative."
)


class RiskManagementAgent(LLMEnabledAgent):
    """Validates position limits and basic trade eligibility."""

    name = "risk_management"

    def __init__(self, llm_client: AgentLLMClient | None = None) -> None:
        super().__init__(llm_client=llm_client)

    def assess(
        self,
        request: InvestmentRequest,
        signals: tuple[AnalysisSignal, ...],
        prompt_override: str = "",
    ) -> tuple[RiskAssessment, ...]:
        fallback = tuple(self._assess_symbol(request, signal) for signal in signals)
        payload = self._resolve_llm_payload(
            operation_name="assess",
            input_payload={
                "request": {
                    "symbols": request.symbols,
                    "max_position_weight": request.max_position_weight,
                },
                "analysis_signals": to_json_object({"analysis_signals": signals})[
                    "analysis_signals"
                ],
            },
            fallback_payload={
                "risk_assessments": to_json_object({"risk_assessments": fallback})[
                    "risk_assessments"
                ]
            },
            system_instruction=RISK_LLM_INSTRUCTION,
            prompt_override=prompt_override,
        )
        try:
            return parse_risk_assessments(payload["risk_assessments"])
        except (KeyError, TypeError, ValueError):
            return fallback

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
