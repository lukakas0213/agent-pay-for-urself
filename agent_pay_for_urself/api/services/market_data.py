"""Application service for direct market data lookups."""

from agent_pay_for_urself.adapters import MarketDataProvider
from agent_pay_for_urself.schemas import MarketData


class MarketDataService:
    """Fetch normalized market data for a single symbol through the provider boundary."""

    def __init__(self, market_data_provider: MarketDataProvider) -> None:
        self._market_data_provider = market_data_provider

    def get(self, symbol: str) -> MarketData:
        """Normalize the requested symbol and fetch one market data payload."""

        normalized_symbol = symbol.strip().upper()
        if not normalized_symbol:
            raise ValueError("symbol must contain non-whitespace characters")
        return self._market_data_provider.get_market_data(normalized_symbol)
