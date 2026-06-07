"""Application dependency wiring for the FastAPI layer."""

from agent_pay_for_urself.adapters import NoopBrokerAdapter, StubMarketDataProvider
from agent_pay_for_urself.agents import (
    BuySellAgent,
    DataAnalysisAgent,
    DataCollectionAgent,
    LogEvaluationAgent,
    OrderExecutionAgent,
    RiskManagementAgent,
)
from agent_pay_for_urself.api.services.console_assistant import ConsoleAssistantService
from agent_pay_for_urself.api.services.decision_workflow import DecisionWorkflowService
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories import InMemoryWorkflowRunRepository

_market_data_provider = StubMarketDataProvider()
_broker_adapter = NoopBrokerAdapter()
_workflow_run_repository = InMemoryWorkflowRunRepository()
_main_agent = MainAgent(
    data_collection_agent=DataCollectionAgent(market_data_provider=_market_data_provider),
    data_analysis_agent=DataAnalysisAgent(),
    risk_management_agent=RiskManagementAgent(),
    buy_sell_agent=BuySellAgent(),
    order_execution_agent=OrderExecutionAgent(broker_adapter=_broker_adapter),
    log_evaluation_agent=LogEvaluationAgent(),
)
_decision_workflow_service = DecisionWorkflowService(
    main_agent=_main_agent,
    workflow_run_repository=_workflow_run_repository,
)
_console_assistant_service = ConsoleAssistantService()


def get_decision_workflow_service() -> DecisionWorkflowService:
    """Return the API-scoped workflow service."""

    return _decision_workflow_service


def get_console_assistant_service() -> ConsoleAssistantService:
    """Return the API-scoped console assistant service."""

    return _console_assistant_service
