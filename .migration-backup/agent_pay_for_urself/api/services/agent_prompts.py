"""Application service for persisted agent prompts."""

from __future__ import annotations

from datetime import UTC, datetime

from agent_pay_for_urself.api.models import AgentPromptItem, AgentPromptUpdateRequest
from agent_pay_for_urself.repositories.agent_prompts import (
    AgentPromptRepository,
    current_timestamp,
    resolve_agent_prompt_overrides,
)
from agent_pay_for_urself.schemas import AgentPromptOverrides

AGENT_LABELS = {
    "data_collection": "데이터 수집",
    "data_analysis": "데이터 분석",
    "report": "보고서 작성",
    "buy_sell": "매수/매도 판단",
    "order_execution": "주문 실행",
    "log_evaluation": "로그/평가",
}


class AgentPromptService:
    def __init__(self, repository: AgentPromptRepository) -> None:
        self._repository = repository

    def list(self) -> list[AgentPromptItem]:
        return [self._to_item(payload) for payload in self._repository.list()]

    def get(self, agent_key: str) -> AgentPromptItem | None:
        payload = self._repository.get(agent_key)
        if payload is None:
            return None
        return self._to_item(payload)

    def update(self, agent_key: str, request: AgentPromptUpdateRequest) -> AgentPromptItem:
        if agent_key not in AGENT_LABELS:
            raise KeyError(agent_key)
        payload = {
            "agent_key": agent_key,
            "label": AGENT_LABELS[agent_key],
            "prompt": request.prompt,
            "updated_at": current_timestamp(),
            "source": "custom",
        }
        return self._to_item(self._repository.save(payload))

    def resolve_prompt_overrides(
        self,
        prompt_overrides: AgentPromptOverrides,
    ) -> AgentPromptOverrides:
        base_prompts = {item.agent_key: item.prompt for item in self.list()}
        return resolve_agent_prompt_overrides(base_prompts, prompt_overrides)

    def _to_item(self, payload: dict[str, object]) -> AgentPromptItem:
        return AgentPromptItem.model_validate(
            {
                "agent_key": payload.get("agent_key"),
                "label": payload.get("label", AGENT_LABELS.get(str(payload.get("agent_key")), "")),
                "prompt": payload.get("prompt", ""),
                "updated_at": payload.get("updated_at", datetime.now(UTC).isoformat()),
                "source": payload.get("source", "custom"),
            }
        )
