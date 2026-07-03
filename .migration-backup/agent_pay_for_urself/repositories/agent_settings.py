"""Persisted structured settings for the main agent and sub-agents."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

AgentSettingsPayload = dict[str, Any]

AGENT_SETTINGS_DEFAULTS: tuple[AgentSettingsPayload, ...] = (
    {
        "agent_key": "main_agent",
        "label": "메인 에이전트",
        "enabled": True,
        "use_llm": True,
        "llm_model": None,
        "specialized": {
            "followup_mode": "apply_with_confirmation",
            "max_watch_symbols": 5,
            "allow_symbol_expansion": True,
        },
        "updated_at": "default",
        "source": "default",
    },
    {
        "agent_key": "data_collection",
        "label": "데이터 수집",
        "enabled": True,
        "use_llm": True,
        "llm_model": None,
        "specialized": {
            "news_limit": 5,
            "include_financials": True,
            "include_exchange_code": True,
        },
        "updated_at": "default",
        "source": "default",
    },
    {
        "agent_key": "data_analysis",
        "label": "데이터 분석",
        "enabled": True,
        "use_llm": True,
        "llm_model": None,
        "specialized": {
            "score_bias": "balanced",
            "include_news_sentiment": True,
            "include_financial_score": True,
        },
        "updated_at": "default",
        "source": "default",
    },
    {
        "agent_key": "report",
        "label": "보고서 작성",
        "enabled": True,
        "use_llm": True,
        "llm_model": None,
        "specialized": {
            "max_bull_points": 3,
            "max_bear_points": 3,
            "include_risk_flags": True,
        },
        "updated_at": "default",
        "source": "default",
    },
    {
        "agent_key": "buy_sell",
        "label": "매수/매도 판단",
        "enabled": True,
        "use_llm": True,
        "llm_model": None,
        "specialized": {
            "hold_threshold": 0.55,
            "allow_sell_recommendations": True,
            "respect_report_risk_gate": True,
        },
        "updated_at": "default",
        "source": "default",
    },
    {
        "agent_key": "order_execution",
        "label": "주문 실행",
        "enabled": True,
        "use_llm": True,
        "llm_model": None,
        "specialized": {
            "default_order_type": "limit",
            "require_limit_price": False,
            "allow_live_submission": False,
        },
        "updated_at": "default",
        "source": "default",
    },
    {
        "agent_key": "log_evaluation",
        "label": "로그/평가",
        "enabled": True,
        "use_llm": True,
        "llm_model": None,
        "specialized": {
            "include_notes": True,
            "max_notes": 10,
            "include_blocked_order_summary": True,
        },
        "updated_at": "default",
        "source": "default",
    },
)


class AgentSettingsRepository(ABC):
    @abstractmethod
    def list(self) -> list[AgentSettingsPayload]:
        """Return all stored agent settings records."""

    @abstractmethod
    def get(self, agent_key: str) -> AgentSettingsPayload | None:
        """Return one stored agent settings record or None when missing."""

    @abstractmethod
    def save(self, payload: AgentSettingsPayload) -> AgentSettingsPayload:
        """Persist one agent settings record and return it."""


class JsonFileAgentSettingsRepository(AgentSettingsRepository):
    def __init__(self, path: Path | str) -> None:
        self._path = Path(path)

    def list(self) -> list[AgentSettingsPayload]:
        settings_by_key = {item["agent_key"]: dict(item) for item in AGENT_SETTINGS_DEFAULTS}
        for item in self._load_all():
            agent_key = item.get("agent_key")
            if isinstance(agent_key, str):
                settings_by_key[agent_key] = item
        return sorted(
            settings_by_key.values(),
            key=lambda item: str(item.get("label", item.get("agent_key", ""))),
        )

    def get(self, agent_key: str) -> AgentSettingsPayload | None:
        return next((item for item in self.list() if item.get("agent_key") == agent_key), None)

    def save(self, payload: AgentSettingsPayload) -> AgentSettingsPayload:
        settings_by_key = {item["agent_key"]: dict(item) for item in self.list()}
        agent_key = payload.get("agent_key")
        if isinstance(agent_key, str):
            settings_by_key[agent_key] = payload
        self._write_all(list(settings_by_key.values()))
        return payload

    def _load_all(self) -> list[AgentSettingsPayload]:
        if not self._path.exists():
            return []
        try:
            raw_payload = json.loads(self._path.read_text())
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Agent settings store is not valid JSON: {self._path}") from exc
        if not isinstance(raw_payload, list):
            raise RuntimeError(f"Agent settings store must contain a JSON list: {self._path}")
        return [item for item in raw_payload if isinstance(item, dict)]

    def _write_all(self, payload: list[AgentSettingsPayload]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self._path.with_suffix(f"{self._path.suffix}.tmp")
        temp_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2))
        temp_path.replace(self._path)
