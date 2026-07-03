from agent_pay_for_urself.api.models import AgentPromptUpdateRequest
from agent_pay_for_urself.api.services.agent_prompts import AgentPromptService
from agent_pay_for_urself.repositories.agent_prompts import JsonFileAgentPromptRepository
from agent_pay_for_urself.schemas import AgentPromptOverrides


def test_agent_prompt_repository_keeps_default_prompts_and_updates_one_item(tmp_path) -> None:
    repository = JsonFileAgentPromptRepository(tmp_path / "agent-prompts.json")

    prompts = repository.list()
    assert {item["agent_key"] for item in prompts} == {
        "main_agent",
        "data_collection",
        "data_analysis",
        "report",
        "buy_sell",
        "order_execution",
        "log_evaluation",
    }
    assert repository.get("main_agent")["source"] == "default"

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
        "main_agent",
        AgentPromptUpdateRequest(prompt="Keep the objective narrow and explicit."),
    )

    assert item.agent_key == "main_agent"
    assert item.source == "custom"
    assert service.get("main_agent").prompt == "Keep the objective narrow and explicit."

    resolved = service.resolve_prompt_overrides(AgentPromptOverrides())
    assert "Keep the objective narrow and explicit." in resolved.main_agent
    assert resolved.data_collection
