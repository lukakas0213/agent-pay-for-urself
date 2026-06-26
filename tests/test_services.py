from agent_pay_for_urself.adapters.broker import (
    BrokerAccountSnapshot,
    BrokerAdapter,
    BrokerSubmission,
)
from agent_pay_for_urself.agents import OrderExecutionAgent
from agent_pay_for_urself.api.services.decision_workflow import DecisionWorkflowService
from agent_pay_for_urself.llm import NoopAgentLLMClient
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories.workflow_runs import InMemoryWorkflowRunRepository
from agent_pay_for_urself.schemas import OrderPlan


class LiveBrokerAdapter(BrokerAdapter):
    @property
    def supports_live_submission(self) -> bool:
        return True

    def submit_order(self, order_plan: OrderPlan) -> BrokerSubmission:
        return BrokerSubmission(
            symbol=order_plan.symbol,
            accepted=True,
            broker_order_id="live-order",
            message="submitted",
        )

    def get_order_status(self, broker_order_id: str) -> str:
        return "filled"

    def get_account_snapshot(self) -> BrokerAccountSnapshot:
        return BrokerAccountSnapshot(
            available=True,
            broker="live",
            account_masked="****5678",
            summary=None,
            holdings=(),
            message="ok",
        )


class ConfiguredLLMClient(NoopAgentLLMClient):
    enabled = True

    def __init__(self) -> None:
        self.model_name = "gpt-5.5"
        self.agent_model_names = {
            "data_collection": "gpt-5.4-mini",
            "data_analysis": "gpt-5.5",
        }


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
        llm_client=ConfiguredLLMClient(),
    )

    runtime = service.runtime_summary()

    assert runtime.data_mode == "stub"
    assert runtime.llm_mode == "model"
    assert runtime.model_name == "gpt-5.5"
    assert runtime.agent_models == {
        "data_collection": "gpt-5.4-mini",
        "data_analysis": "gpt-5.5",
    }
    assert runtime.live_order_enabled is False


def test_decision_workflow_service_reports_live_order_capability_from_broker_adapter() -> None:
    service = DecisionWorkflowService(
        main_agent=MainAgent(
            order_execution_agent=OrderExecutionAgent(broker_adapter=LiveBrokerAdapter())
        ),
        workflow_run_repository=InMemoryWorkflowRunRepository(),
        llm_client=NoopAgentLLMClient(),
    )

    runtime = service.runtime_summary()

    assert runtime.live_order_enabled is True
