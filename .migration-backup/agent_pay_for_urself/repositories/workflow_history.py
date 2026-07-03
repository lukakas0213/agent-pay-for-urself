"""Durable JSON history for workflow runs exposed to the frontend."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

WorkflowHistoryPayload = dict[str, Any]


class WorkflowHistoryRepository(ABC):
    @abstractmethod
    def save(self, payload: WorkflowHistoryPayload) -> WorkflowHistoryPayload:
        """Persist one workflow run payload and return it."""

    @abstractmethod
    def list(self) -> list[WorkflowHistoryPayload]:
        """Return stored workflow runs in newest-first order."""

    @abstractmethod
    def get(self, run_id: str) -> WorkflowHistoryPayload | None:
        """Return one stored workflow run payload."""


class JsonFileWorkflowHistoryRepository(WorkflowHistoryRepository):
    def __init__(self, path: Path | str) -> None:
        self._path = Path(path)

    def save(self, payload: WorkflowHistoryPayload) -> WorkflowHistoryPayload:
        history = [item for item in self._load_all() if item.get("run_id") != payload.get("run_id")]
        history.append(payload)
        self._write_all(history)
        return payload

    def list(self) -> list[WorkflowHistoryPayload]:
        return sorted(
            self._load_all(),
            key=lambda item: str(item.get("created_at", "")),
            reverse=True,
        )

    def get(self, run_id: str) -> WorkflowHistoryPayload | None:
        return next((item for item in self._load_all() if item.get("run_id") == run_id), None)

    def _load_all(self) -> list[WorkflowHistoryPayload]:
        if not self._path.exists():
            return []
        try:
            raw_payload = json.loads(self._path.read_text())
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Workflow history store is not valid JSON: {self._path}") from exc
        if not isinstance(raw_payload, list):
            raise RuntimeError(f"Workflow history store must contain a JSON list: {self._path}")
        return [item for item in raw_payload if isinstance(item, dict)]

    def _write_all(self, history: list[WorkflowHistoryPayload]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self._path.with_suffix(f"{self._path.suffix}.tmp")
        temp_path.write_text(json.dumps(history, ensure_ascii=True, indent=2))
        temp_path.replace(self._path)
