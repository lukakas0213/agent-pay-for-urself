from fastapi.testclient import TestClient

from agent_pay_for_urself.adapters import YahooFinanceMarketDataProvider
from agent_pay_for_urself.api.dependencies import get_market_data_service
from agent_pay_for_urself.api.main import app
from agent_pay_for_urself.api.services.market_data import MarketDataService
from agent_pay_for_urself.schemas import MarketData


class RecordingMarketDataProvider:
    def __init__(self) -> None:
        self.requested_symbols: list[str] = []

    def get_market_data(self, symbol: str) -> MarketData:
        self.requested_symbols.append(symbol)
        return MarketData(
            symbol=symbol,
            latest_price=123.45,
            broker_exchange_code="NASD",
            news_headlines=(f"{symbol} provider headline",),
            financial_metrics={"pe_ratio": 18.0},
        )


class ExplodingMarketDataProvider:
    def get_market_data(self, symbol: str) -> MarketData:
        raise RuntimeError("provider unavailable")


def test_market_data_endpoint_returns_one_symbol_payload() -> None:
    provider = RecordingMarketDataProvider()
    app.dependency_overrides[get_market_data_service] = lambda: MarketDataService(provider)
    client = TestClient(app)

    response = client.get("/market-data/aapl")

    assert response.status_code == 200
    assert provider.requested_symbols == ["AAPL"]
    assert response.json() == {
        "symbol": "AAPL",
        "latest_price": 123.45,
        "broker_exchange_code": "NASD",
        "news_headlines": ["AAPL provider headline"],
        "financial_metrics": {"pe_ratio": 18.0},
    }
    app.dependency_overrides.clear()


def test_market_data_service_uses_yahoo_suffix_for_samsung_but_keeps_response_symbol() -> None:
    requested_symbols: list[str] = []

    class FakeTicker:
        fast_info = {"lastPrice": 321.0}
        info = {}

        def get_news(self, count: int) -> list[dict[str, object]]:
            return []

        def history(self, period: str):
            raise AssertionError("history should not be called when fast_info has a price")

    provider = YahooFinanceMarketDataProvider(
        ticker_factory=lambda symbol: requested_symbols.append(symbol) or FakeTicker()
    )
    service = MarketDataService(provider)

    data = service.get("005930")

    assert requested_symbols == ["005930.KS"]
    assert data.symbol == "005930"
    assert data.latest_price == 321.0
    assert data.broker_exchange_code is None
    assert data.news_headlines == ()
    assert data.financial_metrics == {}


def test_market_data_endpoint_rejects_blank_symbol() -> None:
    provider = RecordingMarketDataProvider()
    app.dependency_overrides[get_market_data_service] = lambda: MarketDataService(provider)
    client = TestClient(app)

    response = client.get("/market-data/%20%20%20")

    assert response.status_code == 422
    assert response.json()["detail"] == "symbol must contain non-whitespace characters"
    app.dependency_overrides.clear()


def test_market_data_endpoint_surfaces_provider_failure() -> None:
    app.dependency_overrides[get_market_data_service] = lambda: MarketDataService(
        ExplodingMarketDataProvider()
    )
    client = TestClient(app)

    response = client.get("/market-data/AAPL")

    assert response.status_code == 500
    assert response.json()["detail"] == "provider unavailable"
    app.dependency_overrides.clear()
