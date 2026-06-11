from __future__ import annotations

import pytest

from agent_pay_for_urself.adapters import StubMarketDataProvider, YahooFinanceMarketDataProvider
from agent_pay_for_urself.api.dependencies import _build_market_data_provider


class FakeSeries:
    def __init__(self, values: list[float]) -> None:
        self._values = values

    def dropna(self) -> FakeSeries:
        return self

    def __len__(self) -> int:
        return len(self._values)

    @property
    def iloc(self) -> FakeSeries:
        return self

    def __getitem__(self, index: int) -> float:
        return self._values[index]


class FakeHistoryFrame:
    def __init__(self, close_values: list[float]) -> None:
        self.empty = len(close_values) == 0
        self._close_series = FakeSeries(close_values)

    def __getitem__(self, key: str) -> FakeSeries:
        assert key == "Close"
        return self._close_series


class FakeTicker:
    def __init__(
        self,
        *,
        fast_info: dict[str, object] | None = None,
        info: dict[str, object] | None = None,
        news: list[dict[str, object]] | None = None,
        history_values: list[float] | None = None,
    ) -> None:
        self.fast_info = fast_info or {}
        self.info = info or {}
        self._news = news or []
        self._history = FakeHistoryFrame(history_values or [])
        self.requested_history_period: str | None = None

    def get_news(self, count: int) -> list[dict[str, object]]:
        return self._news[:count]

    def history(self, period: str) -> FakeHistoryFrame:
        self.requested_history_period = period
        return self._history


def test_yahoo_finance_provider_uses_fast_info_and_normalizes_news() -> None:
    ticker = FakeTicker(
        fast_info={"lastPrice": 212.34},
        info={"trailingPE": 31.2},
        news=[
            {"title": "Apple launches new feature"},
            {"content": {"title": "Analysts revisit Apple outlook"}},
            {"title": "   "},
        ],
    )
    provider = YahooFinanceMarketDataProvider(ticker_factory=lambda symbol: ticker)

    data = provider.get_market_data("AAPL")

    assert data.symbol == "AAPL"
    assert data.latest_price == 212.34
    assert data.news_headlines == (
        "Apple launches new feature",
        "Analysts revisit Apple outlook",
    )
    assert data.financial_metrics == {"pe_ratio": 31.2}
    assert ticker.requested_history_period is None


def test_yahoo_finance_provider_falls_back_to_history_and_forward_pe() -> None:
    ticker = FakeTicker(
        fast_info={},
        info={"trailingPE": None, "forwardPE": 18.5},
        news=[],
        history_values=[101.25, 103.75],
    )
    provider = YahooFinanceMarketDataProvider(ticker_factory=lambda symbol: ticker)

    data = provider.get_market_data("MSFT")

    assert data.symbol == "MSFT"
    assert data.latest_price == 103.75
    assert data.news_headlines == ()
    assert data.financial_metrics == {"pe_ratio": 18.5}
    assert ticker.requested_history_period == "5d"


def test_build_market_data_provider_returns_stub_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("MARKET_DATA_PROVIDER", raising=False)

    provider = _build_market_data_provider()

    assert isinstance(provider, StubMarketDataProvider)


def test_build_market_data_provider_returns_yahoo_when_requested(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "yahoo")

    provider = _build_market_data_provider()

    assert isinstance(provider, YahooFinanceMarketDataProvider)


def test_build_market_data_provider_rejects_unknown_name(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "bloomberg")

    with pytest.raises(RuntimeError, match="Unsupported MARKET_DATA_PROVIDER"):
        _build_market_data_provider()
