from fastapi.testclient import TestClient

from agent_pay_for_urself.adapters.broker import NoopBrokerAdapter
from agent_pay_for_urself.api.dependencies import get_account_service
from agent_pay_for_urself.api.main import app
from agent_pay_for_urself.api.services.account import AccountService
from agent_pay_for_urself.repositories import JsonFileAccountConnectionRepository

client = TestClient(app)


def test_account_endpoint_returns_unavailable_snapshot_by_default() -> None:
    app.dependency_overrides[get_account_service] = lambda: AccountService(NoopBrokerAdapter())
    response = client.get("/account")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["available"] is False
    assert payload["broker"] == "noop"
    assert payload["connection"]["broker"] == "noop"
    assert payload["credential_status"]["broker_adapter"] == "noop"
    assert payload["credential_status"]["ready_for_account_lookup"] is False
    assert payload["summary"] is None
    assert payload["holdings"] == []
    assert "configured" in payload["message"]


def test_account_connection_endpoints_round_trip_persisted_kis_values(tmp_path) -> None:
    repository = JsonFileAccountConnectionRepository(tmp_path / "account-connection.json")
    app.dependency_overrides[get_account_service] = lambda: AccountService(
        NoopBrokerAdapter(), connection_repository=repository
    )
    try:
        update_response = client.put(
            "/account/connection",
            json={
                "alias": "실전 계좌",
                "broker": "kis_mock",
                "account_number": "12345678",
                "account_product_code": "03",
                "toss_account_id": "",
            },
        )
        get_response = client.get("/account/connection")
        account_response = client.get("/account")
    finally:
        app.dependency_overrides.clear()

    assert update_response.status_code == 200
    assert get_response.status_code == 200
    assert account_response.status_code == 200
    assert update_response.json()["alias"] == "실전 계좌"
    assert get_response.json()["account_number"] == "12345678"
    assert get_response.json()["toss_account_id"] == ""
    assert account_response.json()["connection"]["account_product_code"] == "03"


def test_account_connection_endpoints_round_trip_persisted_toss_values(tmp_path) -> None:
    repository = JsonFileAccountConnectionRepository(tmp_path / "account-connection.json")
    app.dependency_overrides[get_account_service] = lambda: AccountService(
        NoopBrokerAdapter(), connection_repository=repository
    )
    try:
        update_response = client.put(
            "/account/connection",
            json={
                "alias": "토스 계좌",
                "broker": "toss",
                "account_number": "12345678",
                "account_product_code": "03",
                "toss_account_id": "toss-account-01",
            },
        )
        get_response = client.get("/account/connection")
        account_response = client.get("/account")
    finally:
        app.dependency_overrides.clear()

    assert update_response.status_code == 200
    assert get_response.status_code == 200
    assert account_response.status_code == 200
    assert update_response.json()["broker"] == "toss"
    assert update_response.json()["account_number"] == ""
    assert update_response.json()["toss_account_id"] == "toss-account-01"
    assert get_response.json()["toss_account_id"] == "toss-account-01"
    assert account_response.json()["connection"]["broker"] == "toss"
    assert account_response.json()["credential_status"]["ready_for_account_lookup"] is False
