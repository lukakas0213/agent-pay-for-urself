"""Application service for running and retrieving decision workflows."""

from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories.workflow_runs import WorkflowRunRepository
from agent_pay_for_urself.schemas import InvestmentRequest, WorkflowResult


class DecisionWorkflowService:
    """Runs the orchestrator and stores workflow results behind a repository."""

    def __init__(
        self,
        main_agent: MainAgent,
        workflow_run_repository: WorkflowRunRepository,
    ) -> None:
        self._main_agent = main_agent
        self._workflow_run_repository = workflow_run_repository

    def run(self, symbols: list[str], max_position_weight: float) -> tuple[str, WorkflowResult]:
        request = InvestmentRequest(
            symbols=tuple(symbols),
            max_position_weight=max_position_weight,
        )
        result = self._main_agent.run(request)
        run_id = self._workflow_run_repository.save(result)
        return run_id, result

    def get(self, run_id: str) -> WorkflowResult | None:
        return self._workflow_run_repository.get(run_id)
