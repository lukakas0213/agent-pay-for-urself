from agent_pay_for_urself.api.services.decision_workflow import DecisionWorkflowService
from agent_pay_for_urself.llm import NoopAgentLLMClient
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


def test_decision_workflow_service_reports_runtime_summary() -> None:
    service = DecisionWorkflowService(
        main_agent=MainAgent(),
        workflow_run_repository=InMemoryWorkflowRunRepository(),
        llm_client=NoopAgentLLMClient(),
    )

    runtime = service.runtime_summary()

    assert runtime.data_mode == "stub"
    assert runtime.llm_mode == "fallback"
    assert runtime.model_name is None
    assert runtime.live_order_enabled is False
