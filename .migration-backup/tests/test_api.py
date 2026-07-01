from fastapi.testclient import TestClient

from agent_pay_for_urself.api.main import app

client = TestClient(app)


def test_create_decision_returns_decisions_order_plans_and_run_id() -> None:
    response = client.post(
        "/decisions",
        json={
            "symbols": ["aapl", "MSFT"],
            "max_position_weight": 0.2,
            "user_prompt": "장기 수익 중심으로 운용하라",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload["run_id"], str)
    assert payload["run_id"]
    assert payload["symbols"] == ["AAPL", "MSFT"]
    assert payload["user_prompt"] == "장기 수익 중심으로 운용하라"
    assert [decision["symbol"] for decision in payload["decisions"]] == ["AAPL", "MSFT"]
    assert [order["symbol"] for order in payload["orders"]] == ["AAPL", "MSFT"]
    assert payload["supervisor_directive"]["focus_symbols"] == ["AAPL", "MSFT"]
    assert {"broker_exchange_code", "limit_price", "should_submit", "reason"} <= payload["orders"][
        0
    ].keys()


def test_decisions_openapi_documents_usage_summary() -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    post_schema = paths["/decisions"]["post"]
    console_schema = paths["/console/interactions"]["post"]
    alias_schema = paths["/agent/interactions"]["post"]
    assert post_schema["summary"] == "Run investment decisions"
    assert "follow-up chat messages" in post_schema["description"]
    assert "DecisionResponse" in str(post_schema["responses"]["200"])
    assert "/account" in paths
    assert paths["/account"]["get"]["summary"] == "Fetch broker account holdings"
    assert console_schema["summary"] == "Ask the console assistant"
    assert alias_schema["deprecated"] is True


def test_console_interaction_uses_stored_run_id() -> None:
    decision_response = client.post(
        "/decisions",
        json={"symbols": ["AAPL"], "max_position_weight": 0.2},
    )
    response = client.post(
        "/console/interactions",
        json={
            "message": "결과 요약해줘",
            "run_id": decision_response.json()["run_id"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["focus"] == "summary"
    assert "AAPL" in payload["reply"]
    assert payload["suggested_actions"]
    assert payload["applied_to_workflow"] is False


def test_console_interaction_requires_analysis_for_contextual_reply() -> None:
    response = client.post(
        "/console/interactions",
        json={"message": "리스크 설명해줘", "current_result": None},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["focus"] == "analysis_required"
    assert "분석 결과가 없습니다" in payload["reply"]


def test_console_interaction_returns_not_found_for_unknown_run_id() -> None:
    response = client.post(
        "/console/interactions",
        json={"message": "리스크 설명해줘", "run_id": "missing-run"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "workflow run not found: missing-run"


def test_console_interaction_can_apply_followup_instruction_to_workflow() -> None:
    decision_response = client.post(
        "/decisions",
        json={
            "symbols": ["MSFT"],
            "max_position_weight": 0.2,
            "user_prompt": "장기 전략 중심으로 운용하라",
        },
    )
    response = client.post(
        "/console/interactions",
        json={
            "message": "애플이 요즘 심상치 않으니 좋은 타이밍에 들어가라",
            "run_id": decision_response.json()["run_id"],
            "apply_to_workflow": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["focus"] == "workflow_update"
    assert payload["applied_to_workflow"] is True
    assert payload["updated_run_id"]
    assert payload["updated_result"]["chat_messages"] == [
        "애플이 요즘 심상치 않으니 좋은 타이밍에 들어가라"
    ]
    assert payload["updated_result"]["supervisor_directive"]["watch_symbols"] == ["AAPL"]


def test_deprecated_console_alias_keeps_backward_compatibility() -> None:
    decision_response = client.post(
        "/decisions",
        json={"symbols": ["AAPL"], "max_position_weight": 0.2},
    )
    response = client.post(
        "/agent/interactions",
        json={
            "message": "주문 설명해줘",
            "run_id": decision_response.json()["run_id"],
        },
    )

    assert response.status_code == 200
    assert response.json()["focus"] == "order"
