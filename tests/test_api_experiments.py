from fastapi.testclient import TestClient

from agent_pay_for_urself.adapters import StubMarketDataProvider
from agent_pay_for_urself.agents import (
    BuySellAgent,
    DataAnalysisAgent,
    DataCollectionAgent,
    LogEvaluationAgent,
    OrderExecutionAgent,
    RiskManagementAgent,
)
from agent_pay_for_urself.api.dependencies import get_experiment_service
from agent_pay_for_urself.api.main import app
from agent_pay_for_urself.api.services.experiments import ExperimentService
from agent_pay_for_urself.llm import AgentLLMClient, AgentLLMRequest, NoopAgentLLMClient
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories import (
    InMemoryWorkflowRunRepository,
    JsonFileExperimentRepository,
)


class PositiveAgentLLMClient(AgentLLMClient):
    def complete(self, request: AgentLLMRequest) -> dict[str, object]:
        if request.agent_name == "data_analysis":
            return {
                "analysis_signals": [
                    {
                        "symbol": "AAPL",
                        "price_score": 0.9,
                        "news_score": 0.9,
                        "financial_score": 0.9,
                        "rationale": "positive test signal",
                    }
                ]
            }
        if request.agent_name == "buy_sell":
            return {
                "trade_decisions": [
                    {
                        "symbol": "AAPL",
                        "action": "BUY",
                        "confidence": 0.9,
                        "rationale": "positive test decision",
                        "risk_approved": True,
                    }
                ]
            }
        if request.agent_name == "order_execution":
            return {
                "order_plans": [
                    {
                        "symbol": "AAPL",
                        "action": "BUY",
                        "quantity": 5,
                        "should_submit": True,
                        "reason": "positive test order",
                    }
                ]
            }
        return request.fallback_payload


def _main_agent_with_llm(llm_client: AgentLLMClient) -> MainAgent:
    provider = StubMarketDataProvider()
    return MainAgent(
        data_collection_agent=DataCollectionAgent(
            market_data_provider=provider,
            llm_client=llm_client,
        ),
        data_analysis_agent=DataAnalysisAgent(llm_client=llm_client),
        risk_management_agent=RiskManagementAgent(llm_client=llm_client),
        buy_sell_agent=BuySellAgent(llm_client=llm_client),
        order_execution_agent=OrderExecutionAgent(llm_client=llm_client),
        log_evaluation_agent=LogEvaluationAgent(llm_client=llm_client),
    )


def _override_experiment_service(
    store_path,
    live_order_enabled=False,
    llm_client: AgentLLMClient | None = None,
):
    provider = StubMarketDataProvider()
    selected_llm_client = llm_client or NoopAgentLLMClient()
    main_agent = (
        _main_agent_with_llm(selected_llm_client) if llm_client is not None else MainAgent()
    )
    return ExperimentService(
        main_agent=main_agent,
        workflow_run_repository=InMemoryWorkflowRunRepository(),
        experiment_repository=JsonFileExperimentRepository(store_path),
        market_data_provider=provider,
        llm_client=selected_llm_client,
        live_order_enabled=live_order_enabled,
    )


def test_create_experiment_runs_saves_and_lists_history(tmp_path) -> None:
    app.dependency_overrides[get_experiment_service] = lambda: _override_experiment_service(
        tmp_path / "experiments.json"
    )
    client = TestClient(app)

    response = client.post(
        "/experiments",
        json={
            "name": "Conservative prompt test",
            "description": "Check risk-first behavior.",
            "decision": {"symbols": ["AAPL"], "max_position_weight": 0.2},
            "prompt_overrides": {"risk_management": "Prefer explicit downside notes."},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["experiment_id"]
    assert payload["run_id"] == payload["result"]["run_id"]
    assert payload["name"] == "Conservative prompt test"
    assert payload["prompt_overrides"]["risk_management"] == "Prefer explicit downside notes."
    assert payload["runtime"]["data_mode"] == "stub"
    assert payload["runtime"]["llm_mode"] == "fallback"
    assert payload["runtime"]["live_order_enabled"] is False
    assert payload["result"]["symbols"] == ["AAPL"]
    assert payload["result"]["runtime"] == payload["runtime"]

    list_response = client.get("/experiments")

    assert list_response.status_code == 200
    history = list_response.json()
    assert len(history) == 1
    assert history[0]["experiment_id"] == payload["experiment_id"]
    assert history[0]["symbols"] == ["AAPL"]

    detail_response = client.get(f"/experiments/{payload['experiment_id']}")

    assert detail_response.status_code == 200
    assert detail_response.json() == payload
    app.dependency_overrides.clear()


def test_save_existing_run_creates_a_second_report_entry(tmp_path) -> None:
    service = _override_experiment_service(tmp_path / "experiments.json")
    app.dependency_overrides[get_experiment_service] = lambda: service
    client = TestClient(app)

    run_response = client.post(
        "/experiments",
        json={
            "name": "First run",
            "decision": {"symbols": ["AAPL"], "max_position_weight": 0.2},
            "prompt_overrides": {},
        },
    )
    assert run_response.status_code == 200
    run_id = run_response.json()["run_id"]

    save_response = client.post(
        "/experiments/from-run",
        json={"run_id": run_id, "name": "Saved run", "description": "Saved from main page."},
    )

    assert save_response.status_code == 200
    saved = save_response.json()
    assert saved["run_id"] == run_id
    assert saved["name"] == "Saved run"

    history = client.get("/experiments").json()
    assert len(history) == 2
    assert {item["name"] for item in history} == {"First run", "Saved run"}
    app.dependency_overrides.clear()


def test_experiment_blocks_submittable_orders_unless_live_order_env_is_enabled(tmp_path) -> None:
    app.dependency_overrides[get_experiment_service] = lambda: _override_experiment_service(
        tmp_path / "experiments.json",
        live_order_enabled=False,
        llm_client=PositiveAgentLLMClient(),
    )
    client = TestClient(app)

    response = client.post(
        "/experiments",
        json={
            "name": "Buy signal safety test",
            "decision": {"symbols": ["AAPL"], "max_position_weight": 0.2},
            "prompt_overrides": {
                "data_analysis": "Make the fallback-compatible signal strongly positive."
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert all(order["should_submit"] is False for order in payload["result"]["orders"])
    assert payload["result"]["evaluation_log"]["blocked_order_count"] == len(
        payload["result"]["orders"]
    )
    app.dependency_overrides.clear()


def test_get_experiment_returns_404_for_missing_id(tmp_path) -> None:
    app.dependency_overrides[get_experiment_service] = lambda: _override_experiment_service(
        tmp_path / "experiments.json"
    )
    client = TestClient(app)

    response = client.get("/experiments/missing")

    assert response.status_code == 404
    app.dependency_overrides.clear()
