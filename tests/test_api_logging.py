import logging

from fastapi.testclient import TestClient

from agent_pay_for_urself.api.main import app


def test_health_request_emits_cli_request_logs(caplog) -> None:
    caplog.set_level(logging.INFO, logger="agent_pay_for_urself.api")

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    messages = [record.getMessage() for record in caplog.records]
    assert any(message == "request_started method=GET path=/health" for message in messages)
    assert any(
        message.startswith("request_completed method=GET path=/health status=200")
        for message in messages
    )


def test_decisions_request_emits_workflow_completion_log(caplog) -> None:
    caplog.set_level(logging.INFO, logger="agent_pay_for_urself.api")

    with TestClient(app) as client:
        response = client.post(
            "/decisions",
            json={"symbols": ["AAPL"], "max_position_weight": 0.2},
        )

    assert response.status_code == 200
    run_id = response.json()["run_id"]
    expected_message = (
        f"workflow_completed run_id={run_id} symbols=AAPL decisions=1 orders=1 mandate_violations=0"
    )
    messages = [record.getMessage() for record in caplog.records]
    assert any(message == expected_message for message in messages)
    assert any(message == "request_started method=POST path=/decisions" for message in messages)
    assert any(
        message.startswith("request_completed method=POST path=/decisions status=200")
        for message in messages
    )
