from fastapi.testclient import TestClient

from agent_pay_for_urself.adapters.broker import NoopBrokerAdapter
from agent_pay_for_urself.api.dependencies import get_account_service
from agent_pay_for_urself.api.main import app
from agent_pay_for_urself.api.services.account import AccountService

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
