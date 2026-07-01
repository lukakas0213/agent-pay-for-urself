"""Factory helpers for optional agent-scoped LLM clients."""

from agent_pay_for_urself.llm.base import AgentLLMClient, NoopAgentLLMClient
from agent_pay_for_urself.llm.openai_client import OpenAIResponsesClient, OpenAIResponsesConfig


def build_default_agent_llm_client() -> AgentLLMClient:
    """Return an OpenAI-backed client when configured, else a no-op client."""

    config = OpenAIResponsesConfig.from_env()
    if config is None:
        return NoopAgentLLMClient()
    return OpenAIResponsesClient(config)
