"""Application service for persisted agent settings."""

from __future__ import annotations

from datetime import UTC, datetime

from agent_pay_for_urself.api.models import (
    AgentSettingsCommonItem,
    AgentSettingsItem,
    AgentSettingsUpdateRequest,
)
from agent_pay_for_urself.repositories.agent_prompts import current_timestamp
from agent_pay_for_urself.repositories.agent_settings import AgentSettingsRepository

AGENT_LABELS = {
    "main_agent": "메인 에이전트",
    "data_collection": "데이터 수집",
    "data_analysis": "데이터 분석",
    "report": "보고서 작성",
    "buy_sell": "매수/매도 판단",
    "order_execution": "주문 실행",
    "log_evaluation": "로그/평가",
}


class AgentSettingsService:
    """Read and persist structured settings for one agent."""

    def __init__(self, repository: AgentSettingsRepository) -> None:
        self._repository = repository

    def list(self) -> list[AgentSettingsItem]:
        return [self._to_item(payload) for payload in self._repository.list()]

    def get(self, agent_key: str) -> AgentSettingsItem | None:
        payload = self._repository.get(agent_key)
        if payload is None:
            return None
        return self._to_item(payload)

    def update(self, agent_key: str, request: AgentSettingsUpdateRequest) -> AgentSettingsItem:
        if agent_key not in AGENT_LABELS:
            raise KeyError(agent_key)
        payload = {
            "agent_key": agent_key,
            "label": AGENT_LABELS[agent_key],
            "enabled": request.common.enabled,
            "use_llm": request.common.use_llm,
            "llm_model": request.common.llm_model,
            "specialized": request.specialized.model_dump(mode="json"),
            "updated_at": current_timestamp(),
            "source": "custom",
        }
        return self._to_item(self._repository.save(payload))

    def _to_item(self, payload: dict[str, object]) -> AgentSettingsItem:
        return AgentSettingsItem.model_validate(
            {
                "agent_key": payload.get("agent_key"),
                "label": payload.get(
                    "label",
                    AGENT_LABELS.get(str(payload.get("agent_key")), ""),
                ),
                "updated_at": payload.get("updated_at", datetime.now(UTC).isoformat()),
                "source": payload.get("source", "custom"),
                "common": AgentSettingsCommonItem(
                    enabled=bool(payload.get("enabled", True)),
                    use_llm=bool(payload.get("use_llm", True)),
                    llm_model=(
                        None
                        if payload.get("llm_model") in {None, ""}
                        else str(payload.get("llm_model"))
                    ),
                ),
                "specialized": payload.get("specialized", {}),
            }
        )
