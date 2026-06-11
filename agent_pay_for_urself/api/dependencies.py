"""Application dependency wiring for the FastAPI layer."""

import os
from pathlib import Path

from agent_pay_for_urself.adapters import (
    MarketDataProvider,
    NoopBrokerAdapter,
    StubMarketDataProvider,
    YahooFinanceMarketDataProvider,
)
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
from agent_pay_for_urself.api.services.experiments import ExperimentService
from agent_pay_for_urself.api.services.market_data import MarketDataService
from agent_pay_for_urself.llm import build_default_agent_llm_client
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories import (
    InMemoryWorkflowRunRepository,
    JsonFileExperimentRepository,
)


def _build_market_data_provider() -> MarketDataProvider:
    """Resolve the configured market data provider for API runtime composition."""

    provider_name = os.getenv("MARKET_DATA_PROVIDER", "stub").strip().lower()
    if provider_name in {"", "stub"}:
        return StubMarketDataProvider()
    if provider_name in {"yahoo", "yfinance"}:
        return YahooFinanceMarketDataProvider()
    raise RuntimeError("Unsupported MARKET_DATA_PROVIDER. Expected one of: stub, yahoo, yfinance.")


_market_data_provider = _build_market_data_provider()
_broker_adapter = NoopBrokerAdapter()
_workflow_run_repository = InMemoryWorkflowRunRepository()
_experiment_repository = JsonFileExperimentRepository(
    Path(os.getenv("EXPERIMENT_STORE_PATH", "data/experiments.json"))
)
_agent_llm_client = build_default_agent_llm_client()
_main_agent = MainAgent(
    data_collection_agent=DataCollectionAgent(
        market_data_provider=_market_data_provider,
        llm_client=_agent_llm_client,
    ),
    data_analysis_agent=DataAnalysisAgent(llm_client=_agent_llm_client),
    risk_management_agent=RiskManagementAgent(llm_client=_agent_llm_client),
    buy_sell_agent=BuySellAgent(llm_client=_agent_llm_client),
    order_execution_agent=OrderExecutionAgent(
        broker_adapter=_broker_adapter,
        llm_client=_agent_llm_client,
    ),
    log_evaluation_agent=LogEvaluationAgent(llm_client=_agent_llm_client),
)
_decision_workflow_service = DecisionWorkflowService(
    main_agent=_main_agent,
    workflow_run_repository=_workflow_run_repository,
    market_data_provider=_market_data_provider,
    llm_client=_agent_llm_client,
)
_market_data_service = MarketDataService(market_data_provider=_market_data_provider)
_experiment_service = ExperimentService(
    main_agent=_main_agent,
    workflow_run_repository=_workflow_run_repository,
    experiment_repository=_experiment_repository,
    market_data_provider=_market_data_provider,
    llm_client=_agent_llm_client,
    live_order_enabled=os.getenv("EXPERIMENT_LIVE_ORDER_ENABLED", "").lower() == "true",
)
_console_assistant_service = ConsoleAssistantService()


def get_decision_workflow_service() -> DecisionWorkflowService:
    """Return the API-scoped workflow service."""

    return _decision_workflow_service


def get_market_data_service() -> MarketDataService:
    """Return the API-scoped market data lookup service."""

    return _market_data_service


def get_experiment_service() -> ExperimentService:
    """Return the API-scoped experiment service."""

    return _experiment_service


def get_console_assistant_service() -> ConsoleAssistantService:
    """Return the API-scoped console assistant service."""

    return _console_assistant_service
