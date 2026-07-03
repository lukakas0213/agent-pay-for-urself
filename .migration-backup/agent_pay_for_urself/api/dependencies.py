"""Application dependency wiring for the FastAPI layer."""

import os
from pathlib import Path

from dotenv import load_dotenv

from agent_pay_for_urself.adapters import (
    BrokerAdapter,
    KisMockBrokerAdapter,
    KisMockBrokerConfig,
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
    ReportAgent,
)
from agent_pay_for_urself.api.services.account import AccountService
from agent_pay_for_urself.api.services.agent_prompts import AgentPromptService
from agent_pay_for_urself.api.services.agent_settings import AgentSettingsService
from agent_pay_for_urself.api.services.console_assistant import ConsoleAssistantService
from agent_pay_for_urself.api.services.decision_workflow import DecisionWorkflowService
from agent_pay_for_urself.api.services.experiments import ExperimentService
from agent_pay_for_urself.api.services.history import WorkflowHistoryService
from agent_pay_for_urself.api.services.market_data import MarketDataService
from agent_pay_for_urself.api.services.order_submission import OrderSubmissionService
from agent_pay_for_urself.llm import build_default_agent_llm_client
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories import (
    InMemoryWorkflowRunRepository,
    JsonFileAccountConnectionRepository,
    JsonFileAgentPromptRepository,
    JsonFileAgentSettingsRepository,
    JsonFileExperimentRepository,
    JsonFileWorkflowHistoryRepository,
)

load_dotenv()


def _build_market_data_provider() -> MarketDataProvider:
    provider_name = os.getenv("MARKET_DATA_PROVIDER", "stub").strip().lower()
    if provider_name in {"", "stub"}:
        return StubMarketDataProvider()
    if provider_name in {"yahoo", "yfinance"}:
        return YahooFinanceMarketDataProvider()
    raise RuntimeError("Unsupported MARKET_DATA_PROVIDER. Expected one of: stub, yahoo, yfinance.")


def _build_broker_adapter() -> BrokerAdapter:
    adapter_name = os.getenv("BROKER_ADAPTER", "noop").strip().lower()
    if adapter_name in {"", "noop"}:
        return NoopBrokerAdapter()
    if adapter_name in {"kis_mock", "kis-paper", "koreainvestment_mock"}:
        return KisMockBrokerAdapter(
            KisMockBrokerConfig(
                app_key=os.getenv("KIS_MOCK_APP_KEY", "").strip(),
                app_secret=os.getenv("KIS_MOCK_APP_SECRET", "").strip(),
                account_number=os.getenv("KIS_MOCK_ACCOUNT_NUMBER", "").strip(),
                account_product_code=(
                    os.getenv("KIS_MOCK_ACCOUNT_PRODUCT_CODE", "01").strip() or "01"
                ),
                base_url=os.getenv("KIS_MOCK_BASE_URL", "").strip() or KisMockBrokerConfig.base_url,
                contact_phone=os.getenv("KIS_MOCK_CONTACT_PHONE", "").strip(),
                management_order_number=os.getenv("KIS_MOCK_MANAGEMENT_ORDER_NUMBER", "").strip(),
                order_server_division_code=(
                    os.getenv("KIS_MOCK_ORDER_SERVER_DIVISION_CODE", "0").strip() or "0"
                ),
                order_division_code=(
                    os.getenv("KIS_MOCK_ORDER_DIVISION_CODE", "00").strip() or "00"
                ),
                timeout_seconds=float(
                    os.getenv(
                        "KIS_MOCK_TIMEOUT_SECONDS", str(KisMockBrokerConfig.timeout_seconds)
                    ).strip()
                ),
            )
        )
    raise RuntimeError("Unsupported BROKER_ADAPTER. Expected one of: noop, kis_mock.")


_market_data_provider = _build_market_data_provider()
_broker_adapter = _build_broker_adapter()
_workflow_run_repository = InMemoryWorkflowRunRepository()
_workflow_history_repository = JsonFileWorkflowHistoryRepository(
    Path(os.getenv("WORKFLOW_HISTORY_STORE_PATH", "data/workflow-runs.json"))
)
_experiment_repository = JsonFileExperimentRepository(
    Path(os.getenv("EXPERIMENT_STORE_PATH", "data/experiments.json"))
)
_agent_prompt_repository = JsonFileAgentPromptRepository(
    Path(os.getenv("AGENT_PROMPT_STORE_PATH", "data/agent-prompts.json"))
)
_agent_settings_repository = JsonFileAgentSettingsRepository(
    Path(os.getenv("AGENT_SETTINGS_STORE_PATH", "data/agent-settings.json"))
)
_account_connection_repository = JsonFileAccountConnectionRepository(
    Path(os.getenv("ACCOUNT_CONNECTION_STORE_PATH", "data/account-connection.json"))
)
_agent_llm_client = build_default_agent_llm_client()
_main_agent = MainAgent(
    data_collection_agent=DataCollectionAgent(
        market_data_provider=_market_data_provider,
        llm_client=_agent_llm_client,
    ),
    data_analysis_agent=DataAnalysisAgent(llm_client=_agent_llm_client),
    report_agent=ReportAgent(llm_client=_agent_llm_client),
    buy_sell_agent=BuySellAgent(llm_client=_agent_llm_client),
    order_execution_agent=OrderExecutionAgent(
        broker_adapter=_broker_adapter,
        llm_client=_agent_llm_client,
    ),
    log_evaluation_agent=LogEvaluationAgent(llm_client=_agent_llm_client),
    llm_client=_agent_llm_client,
)
_agent_prompt_service = AgentPromptService(repository=_agent_prompt_repository)
_agent_settings_service = AgentSettingsService(repository=_agent_settings_repository)
_decision_workflow_service = DecisionWorkflowService(
    main_agent=_main_agent,
    workflow_run_repository=_workflow_run_repository,
    workflow_history_repository=_workflow_history_repository,
    market_data_provider=_market_data_provider,
    llm_client=_agent_llm_client,
    agent_prompt_service=_agent_prompt_service,
)
_order_submission_service = OrderSubmissionService(
    main_agent=_main_agent,
    workflow_run_repository=_workflow_run_repository,
)
_market_data_service = MarketDataService(market_data_provider=_market_data_provider)
_account_service = AccountService(
    broker_adapter=_broker_adapter,
    connection_repository=_account_connection_repository,
)
_workflow_history_service = WorkflowHistoryService(repository=_workflow_history_repository)
_experiment_service = ExperimentService(
    main_agent=_main_agent,
    workflow_run_repository=_workflow_run_repository,
    experiment_repository=_experiment_repository,
    market_data_provider=_market_data_provider,
    llm_client=_agent_llm_client,
    agent_prompt_service=_agent_prompt_service,
    live_order_enabled=os.getenv("EXPERIMENT_LIVE_ORDER_ENABLED", "").lower() == "true",
)
_console_assistant_service = ConsoleAssistantService()


def get_decision_workflow_service() -> DecisionWorkflowService:
    return _decision_workflow_service


def get_market_data_service() -> MarketDataService:
    return _market_data_service


def get_account_service() -> AccountService:
    return _account_service


def get_order_submission_service() -> OrderSubmissionService:
    return _order_submission_service


def get_experiment_service() -> ExperimentService:
    return _experiment_service


def get_agent_prompt_service() -> AgentPromptService:
    return _agent_prompt_service


def get_console_assistant_service() -> ConsoleAssistantService:
    return _console_assistant_service


def get_workflow_history_service() -> WorkflowHistoryService:
    return _workflow_history_service


def get_agent_settings_service() -> AgentSettingsService:
    return _agent_settings_service
