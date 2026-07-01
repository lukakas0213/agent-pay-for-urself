"""Shared agent protocol definitions and optional LLM template mixin."""

from __future__ import annotations

from typing import Protocol

from agent_pay_for_urself.llm import (
    AgentLLMClient,
    AgentLLMRequest,
    NoopAgentLLMClient,
    to_json_object,
)
from agent_pay_for_urself.llm.base import JSONObject


class Agent(Protocol):
    """Marker protocol for all single-responsibility agents."""

    name: str


class LLMEnabledAgent:
    """Small helper that lets each agent opt into a shared structured LLM template."""

    def __init__(self, llm_client: AgentLLMClient | None = None) -> None:
        self._llm_client = llm_client or NoopAgentLLMClient()

    def _resolve_llm_payload(
        self,
        *,
        operation_name: str,
        input_payload: JSONObject,
        fallback_payload: JSONObject,
        system_instruction: str,
        prompt_override: str = "",
    ) -> JSONObject:
        """Call the configured LLM client and fall back to deterministic output on error."""

        normalized_input = to_json_object(input_payload)
        normalized_fallback = to_json_object(fallback_payload)
        if not self._llm_client.enabled:
            return normalized_fallback

        request = AgentLLMRequest(
            agent_name=self.name,
            operation_name=operation_name,
            system_instruction=self._build_system_instruction(system_instruction, prompt_override),
            input_payload=normalized_input,
            fallback_payload=normalized_fallback,
        )
        try:
            return self._llm_client.complete(request)
        except Exception:
            return normalized_fallback

    def _build_system_instruction(self, system_instruction: str, prompt_override: str) -> str:
        """Append experiment instructions without weakening the schema contract."""

        override = prompt_override.strip()
        if not override:
            return system_instruction
        return (
            f"{system_instruction}\n\n"
            "Experiment prompt override: follow this run-specific guidance only when it "
            "does not conflict with the required JSON schema, fallback payload shape, or "
            f"investment safety constraints.\n{override}"
        )
