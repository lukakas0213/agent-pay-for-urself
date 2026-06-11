"""Application service for running and retrieving decision workflows."""

from agent_pay_for_urself.adapters import MarketDataProvider, StubMarketDataProvider
from agent_pay_for_urself.api.models.decisions import RuntimeSummaryItem
from agent_pay_for_urself.llm import AgentLLMClient, NoopAgentLLMClient
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories.workflow_runs import WorkflowRunRepository
from agent_pay_for_urself.schemas import InvestmentMandate, InvestmentRequest, WorkflowResult


class DecisionWorkflowService:
    """Runs the orchestrator and stores workflow results behind a repository."""

    def __init__(
        self,
        main_agent: MainAgent,
        workflow_run_repository: WorkflowRunRepository,
        market_data_provider: MarketDataProvider | None = None,
        llm_client: AgentLLMClient | None = None,
    ) -> None:
        self._main_agent = main_agent
        self._workflow_run_repository = workflow_run_repository
        self._market_data_provider = market_data_provider or StubMarketDataProvider()
        self._llm_client = llm_client or NoopAgentLLMClient()

    def run(
        self,
        symbols: list[str],
        max_position_weight: float,
        mandate: InvestmentMandate | None = None,
    ) -> tuple[str, WorkflowResult]:
        request = InvestmentRequest(
            symbols=tuple(symbols),
            max_position_weight=max_position_weight,
            mandate=mandate,
        )
        result = self._main_agent.run(request)
        run_id = self._workflow_run_repository.save(result)
        return run_id, result

    def get(self, run_id: str) -> WorkflowResult | None:
        return self._workflow_run_repository.get(run_id)

    def runtime_summary(self) -> RuntimeSummaryItem:
        """Expose the current workflow runtime mode for API responses."""

        return RuntimeSummaryItem(
            data_mode=getattr(self._market_data_provider, "mode_name", "configured"),
            llm_mode="model" if self._llm_client.enabled else "fallback",
            model_name=getattr(self._llm_client, "model_name", None),
            live_order_enabled=False,
        )
