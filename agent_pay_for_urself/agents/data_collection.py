"""Data collection agent.

The current implementation consumes a provider interface so the orchestrator
can stay stable while real data clients are introduced behind an adapter
boundary.
"""

from agent_pay_for_urself.adapters.market_data import MarketDataProvider, StubMarketDataProvider
from agent_pay_for_urself.agents.base import LLMEnabledAgent
from agent_pay_for_urself.llm import AgentLLMClient, to_json_object
from agent_pay_for_urself.llm.serde import parse_market_data_items
from agent_pay_for_urself.schemas import InvestmentRequest, MarketData

COLLECTION_LLM_INSTRUCTION = (
    "You are the data collection agent in an investment workflow. Return JSON only. "
    "Preserve the market_data schema and stay close to the provided provider output."
)


class DataCollectionAgent(LLMEnabledAgent):
    """Collects price, news, and financial data for requested symbols."""

    name = "data_collection"

    def __init__(
        self,
        market_data_provider: MarketDataProvider | None = None,
        llm_client: AgentLLMClient | None = None,
    ) -> None:
        super().__init__(llm_client=llm_client)
        self.market_data_provider = market_data_provider or StubMarketDataProvider()

    def collect(
        self,
        request: InvestmentRequest,
        prompt_override: str = "",
    ) -> tuple[MarketData, ...]:
        fallback = tuple(
            self.market_data_provider.get_market_data(symbol.upper()) for symbol in request.symbols
        )
        payload = self._resolve_llm_payload(
            operation_name="collect",
            input_payload={
                "request": {"symbols": request.symbols},
                "provider_market_data": to_json_object({"market_data": fallback})["market_data"],
            },
            fallback_payload={
                "market_data": to_json_object({"market_data": fallback})["market_data"]
            },
            system_instruction=COLLECTION_LLM_INSTRUCTION,
            prompt_override=prompt_override,
        )
        try:
            return parse_market_data_items(payload["market_data"])
        except (KeyError, TypeError, ValueError):
            return fallback
