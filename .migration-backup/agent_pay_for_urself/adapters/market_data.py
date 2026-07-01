"""Market data provider boundary.

The current implementation keeps a deterministic stub provider for tests and
offline runs, while allowing opt-in live market data through Yahoo Finance.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable, Mapping
from math import isnan
from typing import Any

from agent_pay_for_urself.schemas import MarketData

DEFAULT_PRICE = 100.0
DEFAULT_PE_RATIO = 20.0
DEFAULT_YAHOO_NEWS_COUNT = 3
DEFAULT_YAHOO_HISTORY_PERIOD = "5d"
YAHOO_FINANCE_SYMBOL_OVERRIDES = {
    "005930": "005930.KS",
}

YAHOO_TO_KIS_ORDER_EXCHANGE_CODE = {
    "nasdaq": "NASD",
    "nasdaqcm": "NASD",
    "nasdaqgm": "NASD",
    "nasdaqgs": "NASD",
    "nms": "NASD",
    "nas": "NASD",
    "nyse": "NYSE",
    "newyorkstockexchange": "NYSE",
    "nyq": "NYSE",
    "nys": "NYSE",
    "nyseamerican": "AMEX",
    "nysemkt": "AMEX",
    "amex": "AMEX",
    "americanstockexchange": "AMEX",
    "ase": "AMEX",
    "ams": "AMEX",
}


def normalize_yahoo_finance_symbol(symbol: str) -> str:
    """Return the Yahoo Finance lookup symbol for one normalized stock code.

    The public API keeps the original symbol for workflow outputs, but Yahoo
    Finance needs the exchange suffix for domestic Korea listings.
    """

    normalized_symbol = symbol.strip().upper()
    if not normalized_symbol:
        return normalized_symbol
    if normalized_symbol.endswith((".KS", ".KQ")):
        return normalized_symbol
    return YAHOO_FINANCE_SYMBOL_OVERRIDES.get(normalized_symbol, normalized_symbol)


class MarketDataProvider(ABC):
    """Provides normalized market data to the data collection agent."""

    mode_name = "configured"

    @abstractmethod
    def get_market_data(self, symbol: str) -> MarketData:
        """Return current market data for one already-normalized symbol."""


class StubMarketDataProvider(MarketDataProvider):
    """Deterministic provider used until real data clients are introduced."""

    mode_name = "stub"

    def get_market_data(self, symbol: str) -> MarketData:
        return MarketData(
            symbol=symbol,
            latest_price=DEFAULT_PRICE,
            broker_exchange_code=None,
            news_headlines=(f"{symbol} market update",),
            financial_metrics={"pe_ratio": DEFAULT_PE_RATIO},
        )


class YahooFinanceMarketDataProvider(MarketDataProvider):
    """Live market data provider backed by Yahoo Finance via ``yfinance``."""

    mode_name = "yahoo"

    def __init__(
        self,
        ticker_factory: Callable[[str], object] | None = None,
        news_count: int = DEFAULT_YAHOO_NEWS_COUNT,
        history_period: str = DEFAULT_YAHOO_HISTORY_PERIOD,
    ) -> None:
        self._ticker_factory = ticker_factory or self._build_default_ticker_factory()
        self._news_count = news_count
        self._history_period = history_period

    def get_market_data(self, symbol: str) -> MarketData:
        """Fetch and normalize the subset of Yahoo data used by the workflow."""

        ticker = self._ticker_factory(symbol)
        latest_price = self._extract_latest_price(ticker, symbol)
        news_headlines = self._extract_news_headlines(ticker)
        financial_metrics = self._extract_financial_metrics(ticker)
        broker_exchange_code = self._extract_broker_exchange_code(ticker)
        return MarketData(
            symbol=symbol,
            latest_price=latest_price,
            broker_exchange_code=broker_exchange_code,
            news_headlines=news_headlines,
            financial_metrics=financial_metrics,
        )

    def _build_default_ticker_factory(self) -> Callable[[str], object]:
        try:
            import yfinance as yf
        except ImportError as exc:
            raise RuntimeError(
                "Yahoo Finance provider requires the 'yfinance' package to be installed."
            ) from exc
        return yf.Ticker

    def _extract_latest_price(self, ticker: object, _symbol: str) -> float:
        fast_info = getattr(ticker, "fast_info", {}) or {}
        latest_price = self._coerce_optional_float(fast_info.get("lastPrice"))
        if latest_price is not None:
            return latest_price

        try:
            history = ticker.history(period=self._history_period)
        except Exception:
            return DEFAULT_PRICE
        if getattr(history, "empty", True):
            return DEFAULT_PRICE

        close_prices = history["Close"].dropna()
        if len(close_prices) == 0:
            return DEFAULT_PRICE
        return float(close_prices.iloc[-1])

    def _extract_news_headlines(self, ticker: object) -> tuple[str, ...]:
        news_items: list[Any]
        get_news = getattr(ticker, "get_news", None)
        try:
            if callable(get_news):
                news_items = list(get_news(count=self._news_count))
            else:
                news_items = list(getattr(ticker, "news", []) or [])
        except Exception:
            return ()

        headlines: list[str] = []
        for item in news_items:
            title = self._extract_news_title(item)
            if title is not None:
                headlines.append(title)
            if len(headlines) >= self._news_count:
                break
        return tuple(headlines)

    def _extract_financial_metrics(self, ticker: object) -> dict[str, float]:
        info = self._safe_ticker_info(ticker)
        if not isinstance(info, Mapping):
            return {}

        pe_ratio = self._coerce_optional_float(info.get("trailingPE"))
        if pe_ratio is None:
            pe_ratio = self._coerce_optional_float(info.get("forwardPE"))
        if pe_ratio is None:
            return {}
        return {"pe_ratio": pe_ratio}

    def _extract_broker_exchange_code(self, ticker: object) -> str | None:
        info = self._safe_ticker_info(ticker)
        if not isinstance(info, Mapping):
            return None

        for raw_value in (info.get("exchange"), info.get("fullExchangeName")):
            normalized = self._normalize_exchange_name(raw_value)
            if normalized is None:
                continue
            broker_exchange_code = YAHOO_TO_KIS_ORDER_EXCHANGE_CODE.get(normalized)
            if broker_exchange_code is not None:
                return broker_exchange_code
        return None

    def _extract_news_title(self, item: Any) -> str | None:
        if not isinstance(item, Mapping):
            return None

        direct_title = item.get("title")
        if isinstance(direct_title, str) and direct_title.strip():
            return direct_title.strip()

        content = item.get("content")
        if isinstance(content, Mapping):
            nested_title = content.get("title")
            if isinstance(nested_title, str) and nested_title.strip():
                return nested_title.strip()
        return None

    def _coerce_optional_float(self, value: Any) -> float | None:
        if value is None or isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            numeric_value = float(value)
            if isnan(numeric_value):
                return None
            return numeric_value
        return None

    def _normalize_exchange_name(self, value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        collapsed = "".join(character for character in value.lower() if character.isalnum())
        return collapsed or None

    def _safe_ticker_info(self, ticker: object) -> Mapping[str, Any]:
        """Return Yahoo ticker metadata when available and otherwise fall back to empty data.

        yfinance can raise for some symbols when Yahoo omits exchange timezone metadata or
        returns a partial quoteSummary payload. The workflow should keep going when price data
        is still available, so metadata lookups stay best effort instead of failing the request.
        """

        try:
            info = getattr(ticker, "info", {}) or {}
        except Exception:
            return {}
        if not isinstance(info, Mapping):
            return {}
        return info
