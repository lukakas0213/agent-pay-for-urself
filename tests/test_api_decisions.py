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
    assert isinstance(payload["runtime"]["data_mode"], str)
    assert payload["runtime"]["llm_mode"] in {"fallback", "model"}
    assert isinstance(payload["runtime"]["live_order_enabled"], bool)
    assert payload["mandate"]["max_position_weight"] == 0.2
    assert payload["mandate_violations"] == []
    assert len(payload["market_data"]) == 2
    assert len(payload["analysis_signals"]) == 2
    assert len(payload["risk_assessments"]) == 2
    assert len(payload["decisions"]) == 2
    assert len(payload["orders"]) == 2
    assert payload["evaluation_log"]["decision_count"] == 2
    assert {
        "symbol",
        "latest_price",
        "broker_exchange_code",
        "news_headlines",
        "financial_metrics",
    } <= payload["market_data"][0].keys()
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


def test_create_decision_accepts_user_mandate_and_returns_violations() -> None:
    client = TestClient(app)

    response = client.post(
        "/decisions",
        json={
            "symbols": ["AAPL"],
            "max_position_weight": 0.2,
            "mandate": {
                "objective": "Only analyze explicitly allowed symbols.",
                "allowed_symbols": ["MSFT"],
                "excluded_symbols": [],
                "risk_tolerance": "low",
                "requires_approval_for_live_orders": True,
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["mandate"]["objective"] == "Only analyze explicitly allowed symbols."
    assert payload["mandate"]["allowed_symbols"] == ["MSFT"]
    assert payload["runtime"]["llm_mode"] in {"fallback", "model"}
    assert payload["mandate_violations"][0]["rule"] == "allowed_symbols"
    assert payload["decisions"][0]["action"] == "HOLD"
    assert payload["orders"][0]["should_submit"] is False


def test_create_decision_rejects_blank_symbols() -> None:
    client = TestClient(app)

    response = client.post(
        "/decisions",
        json={"symbols": ["   ", "AAPL"], "max_position_weight": 0.2},
    )

    assert response.status_code == 422
    assert "non-whitespace" in response.text
