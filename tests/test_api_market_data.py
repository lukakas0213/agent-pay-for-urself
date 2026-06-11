from fastapi.testclient import TestClient

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
        "news_headlines": ["AAPL provider headline"],
        "financial_metrics": {"pe_ratio": 18.0},
    }
    app.dependency_overrides.clear()


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
