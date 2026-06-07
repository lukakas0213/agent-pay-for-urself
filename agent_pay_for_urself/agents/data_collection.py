"""Data collection agent.

The current implementation consumes a provider interface so the orchestrator
can stay stable while real data clients are introduced behind an adapter
boundary.
"""

from agent_pay_for_urself.adapters.market_data import MarketDataProvider, StubMarketDataProvider
from agent_pay_for_urself.schemas import InvestmentRequest, MarketData


class DataCollectionAgent:
    """Collects price, news, and financial data for requested symbols."""

    name = "data_collection"

    def __init__(self, market_data_provider: MarketDataProvider | None = None) -> None:
        self.market_data_provider = market_data_provider or StubMarketDataProvider()

    def collect(self, request: InvestmentRequest) -> tuple[MarketData, ...]:
        return tuple(
            self.market_data_provider.get_market_data(symbol.upper()) for symbol in request.symbols
        )
