"""Report agent that merges analysis interpretation and basic risk review."""

from agent_pay_for_urself.agents.base import LLMEnabledAgent
from agent_pay_for_urself.llm import AgentLLMClient, to_json_object
from agent_pay_for_urself.llm.serde import parse_investment_reports
from agent_pay_for_urself.schemas import (
    AnalysisSignal,
    InvestmentReport,
    InvestmentRequest,
    MarketData,
)

MIN_POSITION_WEIGHT = 0.0
MAX_POSITION_WEIGHT = 1.0
BUY_THRESHOLD = 0.6
SELL_THRESHOLD = 0.35
ATTRACTIVE_PE_RATIO = 25.0
REPORT_LLM_INSTRUCTION = (
    "You are the report agent in an investment workflow. Return JSON only. "
    "Preserve the investment_reports schema, summarize the collected data, and keep "
    "risk judgments conservative."
)


class ReportAgent(LLMEnabledAgent):
    """Builds structured investment reports from market data and analysis results."""

    name = "report"

    def __init__(self, llm_client: AgentLLMClient | None = None) -> None:
        super().__init__(llm_client=llm_client)

    def write_reports(
        self,
        request: InvestmentRequest,
        market_data: tuple[MarketData, ...],
        signals: tuple[AnalysisSignal, ...],
        prompt_override: str = "",
    ) -> tuple[InvestmentReport, ...]:
        market_data_by_symbol = {item.symbol: item for item in market_data}
        fallback = tuple(
            self._build_report(request, signal, market_data_by_symbol.get(signal.symbol))
            for signal in signals
        )
        payload = self._resolve_llm_payload(
            operation_name="write_reports",
            input_payload={
                "request": {
                    "symbols": request.symbols,
                    "max_position_weight": request.max_position_weight,
                },
                "market_data": to_json_object({"market_data": market_data})["market_data"],
                "analysis_signals": to_json_object({"analysis_signals": signals})[
                    "analysis_signals"
                ],
            },
            fallback_payload={
                "investment_reports": to_json_object({"investment_reports": fallback})[
                    "investment_reports"
                ]
            },
            system_instruction=REPORT_LLM_INSTRUCTION,
            prompt_override=prompt_override,
        )
        try:
            return parse_investment_reports(payload["investment_reports"])
        except (KeyError, TypeError, ValueError):
            return fallback

    def _build_report(
        self,
        request: InvestmentRequest,
        signal: AnalysisSignal,
        market_data: MarketData | None,
    ) -> InvestmentReport:
        risk_flags: list[str] = []
        bull_points: list[str] = []
        bear_points: list[str] = []

        if not MIN_POSITION_WEIGHT < request.max_position_weight <= MAX_POSITION_WEIGHT:
            risk_flags.append(
                "max_position_weight must be greater than 0 and less than or equal to 1"
            )
        if not signal.rationale:
            risk_flags.append("investment rationale is required")

        if market_data is not None:
            if market_data.news_headlines:
                bull_points.append(
                    f"news support present: {len(market_data.news_headlines)} headline(s)"
                )
            else:
                bear_points.append("no news catalyst collected")

            pe_ratio = market_data.financial_metrics.get("pe_ratio")
            if pe_ratio is None:
                bear_points.append("financial metrics are incomplete")
            elif pe_ratio <= ATTRACTIVE_PE_RATIO:
                bull_points.append(f"valuation looks reasonable at PE {pe_ratio}")
            else:
                bear_points.append(f"valuation looks expensive at PE {pe_ratio}")
        else:
            bear_points.append("market data record missing for report generation")
            risk_flags.append("market data record missing")

        if signal.total_score >= BUY_THRESHOLD:
            recommended_action_bias = "BUY"
        elif signal.total_score <= SELL_THRESHOLD:
            recommended_action_bias = "SELL"
        else:
            recommended_action_bias = "HOLD"

        risk_approved = not risk_flags
        if not risk_approved:
            recommended_action_bias = "HOLD"

        summary_parts = [f"signal_strength={signal.total_score:.2f}"]
        if bull_points:
            summary_parts.append(f"bull={bull_points[0]}")
        if bear_points:
            summary_parts.append(f"bear={bear_points[0]}")
        if risk_flags:
            summary_parts.append(f"risk={risk_flags[0]}")

        rationale = (
            f"{signal.symbol}: {signal.rationale} "
            f"Recommended bias={recommended_action_bias} with max position "
            f"weight {request.max_position_weight:.2f}."
        )

        return InvestmentReport(
            symbol=signal.symbol,
            summary="; ".join(summary_parts),
            bull_points=tuple(bull_points or ["no strong bullish driver identified"]),
            bear_points=tuple(bear_points or ["no material bearish driver identified"]),
            risk_flags=tuple(risk_flags or ["risk rules passed"]),
            risk_approved=risk_approved,
            max_position_weight=request.max_position_weight,
            recommended_action_bias=recommended_action_bias,
            signal_strength=round(signal.total_score, 4),
            rationale=rationale,
        )
