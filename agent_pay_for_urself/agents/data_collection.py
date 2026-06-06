"""Data collection agent.

The current implementation is a deterministic stub. Real price, news, and
financial data clients should be injected here later.
"""

from agent_pay_for_urself.schemas import InvestmentRequest, MarketData

DEFAULT_PRICE = 100.0
DEFAULT_PE_RATIO = 20.0


class DataCollectionAgent:
    """Collects price, news, and financial data for requested symbols."""

    name = "data_collection"

    def collect(self, request: InvestmentRequest) -> tuple[MarketData, ...]:
        return tuple(
            MarketData(
                symbol=symbol.upper(),
                latest_price=DEFAULT_PRICE,
                news_headlines=(f"{symbol.upper()} market update",),
                financial_metrics={"pe_ratio": DEFAULT_PE_RATIO},
            )
            for symbol in request.symbols
        )
