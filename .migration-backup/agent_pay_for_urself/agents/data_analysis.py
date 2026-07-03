"""Data analysis agent for price, news, and financial signals."""

from agent_pay_for_urself.agents.base import LLMEnabledAgent
from agent_pay_for_urself.llm import AgentLLMClient, to_json_object
from agent_pay_for_urself.llm.serde import parse_analysis_signals
from agent_pay_for_urself.schemas import AnalysisSignal, MarketData

PRICE_SCORE_NEUTRAL = 0.5
NEWS_SCORE_SINGLE_HEADLINE = 0.55
FINANCIAL_SCORE_ATTRACTIVE = 0.7
FINANCIAL_SCORE_NEUTRAL = 0.5
ATTRACTIVE_PE_RATIO = 25.0
ANALYSIS_LLM_INSTRUCTION = (
    "You are the data analysis agent in an investment workflow. Return JSON only. "
    "Preserve the analysis_signals schema and do not invent extra fields."
)


class DataAnalysisAgent(LLMEnabledAgent):
    """Converts collected market data into structured investment signals."""

    name = "data_analysis"

    def __init__(self, llm_client: AgentLLMClient | None = None) -> None:
        super().__init__(llm_client=llm_client)

    def analyze(
        self,
        market_data: tuple[MarketData, ...],
        prompt_override: str = "",
    ) -> tuple[AnalysisSignal, ...]:
        fallback = tuple(self._analyze_symbol(data) for data in market_data)
        payload = self._resolve_llm_payload(
            operation_name="analyze",
            input_payload={
                "market_data": to_json_object({"market_data": market_data})["market_data"]
            },
            fallback_payload={
                "analysis_signals": to_json_object({"analysis_signals": fallback})[
                    "analysis_signals"
                ]
            },
            system_instruction=ANALYSIS_LLM_INSTRUCTION,
            prompt_override=prompt_override,
        )
        try:
            return parse_analysis_signals(payload["analysis_signals"])
        except (KeyError, TypeError, ValueError):
            return fallback

    def _analyze_symbol(self, data: MarketData) -> AnalysisSignal:
        pe_ratio = data.financial_metrics.get("pe_ratio")
        financial_score = (
            FINANCIAL_SCORE_ATTRACTIVE
            if pe_ratio is not None and pe_ratio <= ATTRACTIVE_PE_RATIO
            else FINANCIAL_SCORE_NEUTRAL
        )
        rationale = (
            f"{data.symbol}: price, news, and financial data were reviewed; PE ratio={pe_ratio}."
        )
        return AnalysisSignal(
            symbol=data.symbol,
            price_score=PRICE_SCORE_NEUTRAL,
            news_score=(
                NEWS_SCORE_SINGLE_HEADLINE if data.news_headlines else FINANCIAL_SCORE_NEUTRAL
            ),
            financial_score=financial_score,
            rationale=rationale,
        )
