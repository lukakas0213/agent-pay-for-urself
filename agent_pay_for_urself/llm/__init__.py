"""Optional LLM integration primitives for agent templates."""

from agent_pay_for_urself.llm.base import (
    AgentLLMClient,
    AgentLLMRequest,
    NoopAgentLLMClient,
    to_json_object,
)
from agent_pay_for_urself.llm.factory import build_default_agent_llm_client
from agent_pay_for_urself.llm.openai_client import OpenAIResponsesClient, OpenAIResponsesConfig

__all__ = [
    "AgentLLMClient",
    "AgentLLMRequest",
    "NoopAgentLLMClient",
    "OpenAIResponsesClient",
    "OpenAIResponsesConfig",
    "build_default_agent_llm_client",
    "to_json_object",
]
