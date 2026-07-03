"""Persisted base prompts for workflow agents."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from agent_pay_for_urself.schemas import AgentPromptOverrides

AgentPromptPayload = dict[str, Any]

AGENT_PROMPT_DEFAULTS: tuple[AgentPromptPayload, ...] = (
    {
        "agent_key": "main_agent",
        "label": "메인 에이전트",
        "prompt": (
            "Interpret the user objective conservatively, preserve mandate boundaries, "
            "and hand off only clear structured guidance to downstream agents."
        ),
        "updated_at": "default",
        "source": "default",
    },
    {
        "agent_key": "data_collection",
        "label": "데이터 수집",
        "prompt": (
            "Collect price, news, and financial data with concise output and keep the response "
            "close to the provider payload."
        ),
        "updated_at": "default",
        "source": "default",
    },
    {
        "agent_key": "data_analysis",
        "label": "데이터 분석",
        "prompt": (
            "Explain how price, news, and financial signals contribute to the final score and "
            "keep the rationale short and explicit."
        ),
        "updated_at": "default",
        "source": "default",
    },
    {
        "agent_key": "report",
        "label": "보고서 작성",
        "prompt": (
            "Write structured reports that summarize upside, downside, and risk approval "
            "without weakening mandate boundaries."
        ),
        "updated_at": "default",
        "source": "default",
    },
    {
        "agent_key": "buy_sell",
        "label": "매수/매도 판단",
        "prompt": (
            "Bias toward HOLD when the report risk review is weak, and make the decision "
            "rationale easy to inspect."
        ),
        "updated_at": "default",
        "source": "default",
    },
    {
        "agent_key": "order_execution",
        "label": "주문 실행",
        "prompt": (
            "Never weaken submission safety checks and keep order planning explainable even when "
            "a broker adapter is available."
        ),
        "updated_at": "default",
        "source": "default",
    },
    {
        "agent_key": "log_evaluation",
        "label": "로그/평가",
        "prompt": (
            "Summarize decision counts, order counts, and blocked orders in a compact evaluation "
            "note."
        ),
        "updated_at": "default",
        "source": "default",
    },
)


class AgentPromptRepository(ABC):
    @abstractmethod
    def list(self) -> list[AgentPromptPayload]:
        """Return all stored prompt records."""

    @abstractmethod
    def get(self, agent_key: str) -> AgentPromptPayload | None:
        """Return one stored prompt record or None when it is missing."""

    @abstractmethod
    def save(self, payload: AgentPromptPayload) -> AgentPromptPayload:
        """Persist one prompt record and return the stored value."""


class JsonFileAgentPromptRepository(AgentPromptRepository):
    def __init__(self, path: Path | str) -> None:
        self._path = Path(path)

    def list(self) -> list[AgentPromptPayload]:
        prompts_by_key = {item["agent_key"]: dict(item) for item in AGENT_PROMPT_DEFAULTS}
        for item in self._load_all():
            agent_key = item.get("agent_key")
            if isinstance(agent_key, str):
                prompts_by_key[agent_key] = item
        return sorted(
            prompts_by_key.values(),
            key=lambda item: str(item.get("label", item.get("agent_key", ""))),
        )

    def get(self, agent_key: str) -> AgentPromptPayload | None:
        return next((item for item in self.list() if item.get("agent_key") == agent_key), None)

    def save(self, payload: AgentPromptPayload) -> AgentPromptPayload:
        prompts_by_key = {item["agent_key"]: dict(item) for item in self.list()}
        agent_key = payload.get("agent_key")
        if isinstance(agent_key, str):
            prompts_by_key[agent_key] = payload
        prompts = list(prompts_by_key.values())
        self._write_all(prompts)
        return payload

    def _load_all(self) -> list[AgentPromptPayload]:
        if not self._path.exists():
            return []
        try:
            raw_payload = json.loads(self._path.read_text())
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Agent prompt store is not valid JSON: {self._path}") from exc
        if not isinstance(raw_payload, list):
            raise RuntimeError(f"Agent prompt store must contain a JSON list: {self._path}")
        return [item for item in raw_payload if isinstance(item, dict)]

    def _write_all(self, prompts: list[AgentPromptPayload]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self._path.with_suffix(f"{self._path.suffix}.tmp")
        temp_path.write_text(json.dumps(prompts, ensure_ascii=True, indent=2))
        temp_path.replace(self._path)


def merge_prompt_text(base_prompt: str, override_prompt: str) -> str:
    base = base_prompt.strip()
    override = override_prompt.strip()
    if not base:
        return override
    if not override:
        return base
    return f"{base}\n\n{override}"


def resolve_agent_prompt_overrides(
    base_prompts: dict[str, str],
    override_prompts: AgentPromptOverrides,
) -> AgentPromptOverrides:
    return AgentPromptOverrides(
        main_agent=merge_prompt_text(
            base_prompts.get("main_agent", ""),
            override_prompts.main_agent,
        ),
        data_collection=merge_prompt_text(
            base_prompts.get("data_collection", ""),
            override_prompts.data_collection,
        ),
        data_analysis=merge_prompt_text(
            base_prompts.get("data_analysis", ""),
            override_prompts.data_analysis,
        ),
        report=merge_prompt_text(
            base_prompts.get("report", ""),
            override_prompts.report,
        ),
        buy_sell=merge_prompt_text(
            base_prompts.get("buy_sell", ""),
            override_prompts.buy_sell,
        ),
        order_execution=merge_prompt_text(
            base_prompts.get("order_execution", ""),
            override_prompts.order_execution,
        ),
        log_evaluation=merge_prompt_text(
            base_prompts.get("log_evaluation", ""),
            override_prompts.log_evaluation,
        ),
    )


def current_timestamp() -> str:
    return datetime.now(UTC).isoformat()
