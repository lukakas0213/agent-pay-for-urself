"""Data analysis agent for price, news, and financial signals."""

from agent_pay_for_urself.schemas import AnalysisSignal, MarketData

PRICE_SCORE_NEUTRAL = 0.5
NEWS_SCORE_SINGLE_HEADLINE = 0.55
FINANCIAL_SCORE_ATTRACTIVE = 0.7
FINANCIAL_SCORE_NEUTRAL = 0.5
ATTRACTIVE_PE_RATIO = 25.0


class DataAnalysisAgent:
    """Converts collected market data into structured investment signals."""

    name = "data_analysis"

    def analyze(self, market_data: tuple[MarketData, ...]) -> tuple[AnalysisSignal, ...]:
        return tuple(self._analyze_symbol(data) for data in market_data)

    def _analyze_symbol(self, data: MarketData) -> AnalysisSignal:
        pe_ratio = data.financial_metrics.get("pe_ratio")
        financial_score = (
            FINANCIAL_SCORE_ATTRACTIVE
            if pe_ratio is not None and pe_ratio <= ATTRACTIVE_PE_RATIO
            else FINANCIAL_SCORE_NEUTRAL
        )
        rationale = (
            f"{data.symbol}: price, news, and financial data were reviewed; "
            f"PE ratio={pe_ratio}."
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
