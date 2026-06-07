from fastapi.testclient import TestClient

from agent_pay_for_urself.api.main import app


def test_create_decision_returns_console_payload() -> None:
    client = TestClient(app)

    response = client.post(
        "/decisions",
        json={"symbols": ["AAPL", "MSFT"], "max_position_weight": 0.2},
    )

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload["run_id"], str)
    assert payload["symbols"] == ["AAPL", "MSFT"]
    assert len(payload["market_data"]) == 2
    assert len(payload["analysis_signals"]) == 2
    assert len(payload["risk_assessments"]) == 2
    assert len(payload["decisions"]) == 2
    assert len(payload["orders"]) == 2
    assert payload["evaluation_log"]["decision_count"] == 2
    assert {"symbol", "latest_price", "news_headlines", "financial_metrics"} <= payload[
        "market_data"
    ][0].keys()
    assert {
        "symbol",
        "price_score",
        "news_score",
        "financial_score",
        "total_score",
        "rationale",
    } <= payload["analysis_signals"][0].keys()
    assert {"symbol", "approved", "reasons", "max_position_weight"} <= payload["risk_assessments"][
        0
    ].keys()
