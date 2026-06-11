"""Shared LLM request/response primitives for agent templates."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, fields, is_dataclass
from typing import Any, TypeAlias

JSONScalar: TypeAlias = str | int | float | bool | None
JSONValue: TypeAlias = JSONScalar | list["JSONValue"] | dict[str, "JSONValue"]
JSONObject: TypeAlias = dict[str, JSONValue]


@dataclass(frozen=True)
class AgentLLMRequest:
    """Normalized prompt payload handed to an LLM-backed agent template."""

    agent_name: str
    operation_name: str
    system_instruction: str
    input_payload: JSONObject
    fallback_payload: JSONObject


class AgentLLMClient(ABC):
    """Common interface for agent-scoped LLM completions."""

    enabled = True

    @abstractmethod
    def complete(self, request: AgentLLMRequest) -> JSONObject:
        """Return a JSON object that matches the target agent output schema."""


class NoopAgentLLMClient(AgentLLMClient):
    """Fallback client used when no external LLM is configured."""

    enabled = False

    def complete(self, request: AgentLLMRequest) -> JSONObject:
        return request.fallback_payload


def to_json_object(value: Mapping[str, Any]) -> JSONObject:
    """Convert nested dataclasses, tuples, and mappings into JSON-like objects."""

    return _coerce_json_value(dict(value))


def _coerce_json_value(value: Any) -> JSONValue:
    if is_dataclass(value):
        return {
            field.name: _coerce_json_value(getattr(value, field.name)) for field in fields(value)
        }
    if isinstance(value, Mapping):
        return {str(key): _coerce_json_value(item) for key, item in value.items()}
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_coerce_json_value(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    raise TypeError(f"Unsupported JSON payload value: {type(value)!r}")
