from agent_pay_for_urself.api.services.decision_workflow import DecisionWorkflowService
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories.workflow_runs import InMemoryWorkflowRunRepository


def test_decision_workflow_service_stores_and_retrieves_results() -> None:
    repository = InMemoryWorkflowRunRepository()
    service = DecisionWorkflowService(
        main_agent=MainAgent(),
        workflow_run_repository=repository,
    )

    run_id, result = service.run(symbols=["AAPL"], max_position_weight=0.2)
    stored = service.get(run_id)

    assert run_id
    assert stored == result
    assert stored is not None
    assert stored.request.symbols == ("AAPL",)
