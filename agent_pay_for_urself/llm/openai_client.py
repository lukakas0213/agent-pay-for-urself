"""OpenAI-backed implementation of the shared agent LLM client."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

from agent_pay_for_urself.llm.base import AgentLLMClient, AgentLLMRequest, JSONObject

DEFAULT_OPENAI_MODEL = "gpt-5.1"
DEFAULT_TIMEOUT_SECONDS = 30.0


@dataclass(frozen=True)
class OpenAIResponsesConfig:
    """Minimal runtime configuration for the OpenAI Responses API wrapper."""

    api_key: str
    model: str = DEFAULT_OPENAI_MODEL
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS

    @classmethod
    def from_env(cls) -> OpenAIResponsesConfig | None:
        """Build config from environment variables when an API key is present."""

        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            return None

        model = os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL).strip() or DEFAULT_OPENAI_MODEL
        timeout_raw = os.getenv("OPENAI_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS)).strip()
        timeout_seconds = float(timeout_raw)
        return cls(api_key=api_key, model=model, timeout_seconds=timeout_seconds)


class OpenAIResponsesClient(AgentLLMClient):
    """Responses API wrapper that returns JSON payloads for agent templates."""

    def __init__(self, config: OpenAIResponsesConfig) -> None:
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError(
                "OpenAI agent templates require the 'openai' package to be installed."
            ) from exc

        self._client = OpenAI(api_key=config.api_key, timeout=config.timeout_seconds)
        self._config = config

    @property
    def model_name(self) -> str:
        """Return the configured model name for runtime summaries."""

        return self._config.model

    def complete(self, request: AgentLLMRequest) -> JSONObject:
        """Call the Responses API and parse the returned JSON object."""

        response = self._client.responses.create(
            model=self._config.model,
            instructions=request.system_instruction,
            input=self._build_input(request),
        )
        payload = json.loads(response.output_text)
        if not isinstance(payload, dict):
            raise ValueError("OpenAI agent template response must be a JSON object.")
        return payload

    def _build_input(self, request: AgentLLMRequest) -> str:
        """Provide stable prompt scaffolding until per-agent prompts are specified."""

        return json.dumps(
            {
                "agent_name": request.agent_name,
                "operation_name": request.operation_name,
                "task": (
                    "Return JSON only. Preserve the same top-level keys, field names, and "
                    "value types shown in fallback_payload. Stay conservative and never "
                    "invent unsupported schema fields."
                ),
                "input_payload": request.input_payload,
                "fallback_payload": request.fallback_payload,
            },
            ensure_ascii=True,
        )
