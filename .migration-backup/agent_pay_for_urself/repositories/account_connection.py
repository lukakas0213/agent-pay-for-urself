"""Persisted broker account connection settings."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class AccountConnectionSettings:
    """User-editable broker account identifiers stored outside secrets."""

    alias: str = "메인 계좌"
    broker: str = "kis_mock"
    account_number: str = ""
    account_product_code: str = "01"
    toss_account_id: str = ""


AccountConnectionPayload = dict[str, Any]


class AccountConnectionRepository(ABC):
    @abstractmethod
    def get(self) -> AccountConnectionSettings:
        """Return the stored connection settings or defaults."""

    @abstractmethod
    def save(self, settings: AccountConnectionSettings) -> AccountConnectionSettings:
        """Persist one connection settings record and return it."""


class JsonFileAccountConnectionRepository(AccountConnectionRepository):
    def __init__(self, path: Path | str) -> None:
        self._path = Path(path)

    def get(self) -> AccountConnectionSettings:
        payload = self._load_payload()
        if payload is None:
            return AccountConnectionSettings()
        return AccountConnectionSettings(
            alias=str(payload.get("alias", "메인 계좌")).strip() or "메인 계좌",
            broker=str(payload.get("broker", "kis_mock")).strip() or "kis_mock",
            account_number=str(payload.get("account_number", "")).strip(),
            account_product_code=(str(payload.get("account_product_code", "01")).strip() or "01"),
            toss_account_id=str(payload.get("toss_account_id", "")).strip(),
        )

    def save(self, settings: AccountConnectionSettings) -> AccountConnectionSettings:
        payload: AccountConnectionPayload = {
            "alias": settings.alias,
            "broker": settings.broker,
            "account_number": settings.account_number,
            "account_product_code": settings.account_product_code,
            "toss_account_id": settings.toss_account_id,
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self._path.with_suffix(f"{self._path.suffix}.tmp")
        temp_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2))
        temp_path.replace(self._path)
        return settings

    def _load_payload(self) -> AccountConnectionPayload | None:
        if not self._path.exists():
            return None
        try:
            raw_payload = json.loads(self._path.read_text())
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Account connection store is not valid JSON: {self._path}") from exc
        if not isinstance(raw_payload, dict):
            raise RuntimeError(f"Account connection store must contain a JSON object: {self._path}")
        return raw_payload
