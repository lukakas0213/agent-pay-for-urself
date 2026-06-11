"""Saved experiment repository boundary."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

ExperimentPayload = dict[str, Any]


class ExperimentRepository(ABC):
    """Stores saved experiment payloads by experiment id."""

    @abstractmethod
    def save(self, payload: ExperimentPayload) -> ExperimentPayload:
        """Persist one experiment payload and return the saved value."""

    @abstractmethod
    def list(self) -> list[ExperimentPayload]:
        """Return saved experiment payloads in newest-first order."""

    @abstractmethod
    def get(self, experiment_id: str) -> ExperimentPayload | None:
        """Return one saved experiment payload or None when it is missing."""


class JsonFileExperimentRepository(ExperimentRepository):
    """JSON file repository for local single-user experiment history."""

    def __init__(self, path: Path | str) -> None:
        self._path = Path(path)

    def save(self, payload: ExperimentPayload) -> ExperimentPayload:
        experiments = [
            item
            for item in self._load_all()
            if item.get("experiment_id") != payload.get("experiment_id")
        ]
        experiments.append(payload)
        self._write_all(experiments)
        return payload

    def list(self) -> list[ExperimentPayload]:
        return sorted(
            self._load_all(),
            key=lambda item: str(item.get("created_at", "")),
            reverse=True,
        )

    def get(self, experiment_id: str) -> ExperimentPayload | None:
        return next(
            (item for item in self._load_all() if item.get("experiment_id") == experiment_id),
            None,
        )

    def _load_all(self) -> list[ExperimentPayload]:
        if not self._path.exists():
            return []
        try:
            raw_payload = json.loads(self._path.read_text())
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Experiment store is not valid JSON: {self._path}") from exc
        if not isinstance(raw_payload, list):
            raise RuntimeError(f"Experiment store must contain a JSON list: {self._path}")
        return [item for item in raw_payload if isinstance(item, dict)]

    def _write_all(self, experiments: list[ExperimentPayload]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self._path.with_suffix(f"{self._path.suffix}.tmp")
        temp_path.write_text(json.dumps(experiments, ensure_ascii=True, indent=2))
        temp_path.replace(self._path)
