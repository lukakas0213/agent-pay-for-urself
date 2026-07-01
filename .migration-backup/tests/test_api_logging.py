from io import StringIO

from fastapi.testclient import TestClient

from agent_pay_for_urself.api.app import create_app
from agent_pay_for_urself.api.logging import logger as app_logger


def _capture_console_output() -> tuple[StringIO, object]:
    buffer = StringIO()
    handler = next(
        handler
        for handler in app_logger.handlers
        if getattr(handler, "_agent_pay_for_urself_console_handler", False)
    )
    original_stream = handler.stream
    handler.setStream(buffer)
    return buffer, original_stream


def _restore_console_output(original_stream: object) -> None:
    handler = next(
        handler
        for handler in app_logger.handlers
        if getattr(handler, "_agent_pay_for_urself_console_handler", False)
    )
    handler.setStream(original_stream)


def test_health_request_emits_cli_request_logs() -> None:
    app = create_app()
    buffer, original_stream = _capture_console_output()
    try:
        with TestClient(app) as client:
            response = client.get("/health")
    finally:
        _restore_console_output(original_stream)

    assert response.status_code == 200
    output = buffer.getvalue()
    assert "request_started method=GET path=/health" in output
    assert "request_completed method=GET path=/health status=200" in output


def test_decisions_request_emits_workflow_completion_log() -> None:
    app = create_app()
    buffer, original_stream = _capture_console_output()
    try:
        with TestClient(app) as client:
            response = client.post(
                "/decisions",
                json={"symbols": ["AAPL"], "max_position_weight": 0.2},
            )
    finally:
        _restore_console_output(original_stream)

    assert response.status_code == 200
    run_id = response.json()["run_id"]
    output = buffer.getvalue()
    assert (
        f"workflow_completed run_id={run_id} symbols=AAPL decisions=1 orders=1 "
        "mandate_violations=0" in output
    )
    assert "request_started method=POST path=/decisions" in output
    assert "request_completed method=POST path=/decisions status=200" in output
