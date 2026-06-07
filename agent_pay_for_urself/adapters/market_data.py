"""Market data provider boundary.

The current implementation keeps the provider deterministic so the workflow
remains testable while the API and agent boundaries are being stabilized.
"""

from abc import ABC, abstractmethod

from agent_pay_for_urself.schemas import MarketData

DEFAULT_PRICE = 100.0
DEFAULT_PE_RATIO = 20.0


class MarketDataProvider(ABC):
    """Provides normalized market data to the data collection agent."""

    @abstractmethod
    def get_market_data(self, symbol: str) -> MarketData:
        """Return current market data for one already-normalized symbol."""


class StubMarketDataProvider(MarketDataProvider):
    """Deterministic provider used until real data clients are introduced."""

    def get_market_data(self, symbol: str) -> MarketData:
        return MarketData(
            symbol=symbol,
            latest_price=DEFAULT_PRICE,
            news_headlines=(f"{symbol} market update",),
            financial_metrics={"pe_ratio": DEFAULT_PE_RATIO},
        )
