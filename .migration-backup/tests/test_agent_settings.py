from fastapi.testclient import TestClient

from agent_pay_for_urself.api.main import app
from agent_pay_for_urself.api.models import AgentSettingsUpdateRequest
from agent_pay_for_urself.api.services.agent_settings import AgentSettingsService
from agent_pay_for_urself.repositories.agent_settings import JsonFileAgentSettingsRepository

client = TestClient(app)


def test_agent_settings_repository_exposes_default_main_agent_settings(tmp_path) -> None:
    repository = JsonFileAgentSettingsRepository(tmp_path / "agent-settings.json")

    payloads = repository.list()
    assert {item["agent_key"] for item in payloads} == {
        "main_agent",
        "data_collection",
        "data_analysis",
        "report",
        "buy_sell",
        "order_execution",
        "log_evaluation",
    }
    assert repository.get("main_agent")["specialized"]["followup_mode"] == "apply_with_confirmation"


def test_agent_settings_service_updates_one_record(tmp_path) -> None:
    service = AgentSettingsService(
        JsonFileAgentSettingsRepository(tmp_path / "agent-settings.json")
    )

    item = service.update(
        "main_agent",
        AgentSettingsUpdateRequest.model_validate(
            {
                "common": {"enabled": True, "use_llm": True, "llm_model": "gpt-5.5"},
                "specialized": {
                    "followup_mode": "auto_apply",
                    "max_watch_symbols": 7,
                    "allow_symbol_expansion": False,
                },
            }
        ),
    )

    assert item.agent_key == "main_agent"
    assert item.common.llm_model == "gpt-5.5"
    assert item.specialized.followup_mode == "auto_apply"
    assert service.get("main_agent").specialized.max_watch_symbols == 7


def test_agent_settings_api_lists_and_updates_settings(tmp_path) -> None:
    service = AgentSettingsService(
        JsonFileAgentSettingsRepository(tmp_path / "agent-settings.json")
    )
    from agent_pay_for_urself.api.dependencies import get_agent_settings_service

    app.dependency_overrides[get_agent_settings_service] = lambda: service
    try:
        list_response = client.get("/agent-settings")
        update_response = client.put(
            "/agent-settings/data_collection",
            json={
                "common": {"enabled": True, "use_llm": False, "llm_model": None},
                "specialized": {
                    "news_limit": 8,
                    "include_financials": True,
                    "include_exchange_code": False,
                },
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert list_response.status_code == 200
    payload = list_response.json()
    assert any(item["agent_key"] == "main_agent" for item in payload)
    assert update_response.status_code == 200
    updated = update_response.json()["item"]
    assert updated["agent_key"] == "data_collection"
    assert updated["common"]["use_llm"] is False
    assert updated["specialized"]["news_limit"] == 8
