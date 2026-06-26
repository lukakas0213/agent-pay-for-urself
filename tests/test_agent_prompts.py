from agent_pay_for_urself.api.models import AgentPromptUpdateRequest
from agent_pay_for_urself.api.services.agent_prompts import AgentPromptService
from agent_pay_for_urself.repositories.agent_prompts import JsonFileAgentPromptRepository
from agent_pay_for_urself.schemas import AgentPromptOverrides


def test_agent_prompt_repository_keeps_default_prompts_and_updates_one_item(tmp_path) -> None:
    repository = JsonFileAgentPromptRepository(tmp_path / "agent-prompts.json")

    prompts = repository.list()
    assert {item["agent_key"] for item in prompts} == {
        "data_collection",
        "data_analysis",
        "risk_management",
        "buy_sell",
        "order_execution",
        "log_evaluation",
    }

    repository.save(
        {
            "agent_key": "data_analysis",
            "label": "데이터 분석",
            "prompt": "Prefer short rationales.",
            "updated_at": "2026-01-01T00:00:00+00:00",
            "source": "custom",
        }
    )

    assert repository.get("data_analysis")["source"] == "custom"
    assert repository.get("data_collection")["source"] == "default"


def test_agent_prompt_service_updates_and_resolves_prompt_overrides(tmp_path) -> None:
    service = AgentPromptService(JsonFileAgentPromptRepository(tmp_path / "agent-prompts.json"))

    item = service.update(
        "buy_sell",
        AgentPromptUpdateRequest(prompt="Prefer HOLD when confidence is weak."),
    )

    assert item.agent_key == "buy_sell"
    assert item.source == "custom"
    assert service.get("buy_sell").prompt == "Prefer HOLD when confidence is weak."

    resolved = service.resolve_prompt_overrides(AgentPromptOverrides())
    assert "Prefer HOLD when confidence is weak." in resolved.buy_sell
    assert resolved.data_collection
