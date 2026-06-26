"""Application service for direct market data lookups."""

from dataclasses import replace

from agent_pay_for_urself.adapters import (
    MarketDataProvider,
    YahooFinanceMarketDataProvider,
)
from agent_pay_for_urself.adapters.market_data import normalize_yahoo_finance_symbol
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

        provider_symbol = self._resolve_provider_symbol(normalized_symbol)
        market_data = self._market_data_provider.get_market_data(provider_symbol)
        if market_data.symbol != normalized_symbol:
            return replace(market_data, symbol=normalized_symbol)
        return market_data

    def _resolve_provider_symbol(self, symbol: str) -> str:
        if isinstance(self._market_data_provider, YahooFinanceMarketDataProvider):
            return normalize_yahoo_finance_symbol(symbol)
        return symbol
