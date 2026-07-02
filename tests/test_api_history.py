from pathlib import Path

from fastapi.testclient import TestClient

from agent_pay_for_urself.agents import (
    BuySellAgent,
    DataAnalysisAgent,
    DataCollectionAgent,
    LogEvaluationAgent,
    OrderExecutionAgent,
    ReportAgent,
)
from agent_pay_for_urself.api.dependencies import (
    get_decision_workflow_service,
    get_workflow_history_service,
)
from agent_pay_for_urself.api.main import app
from agent_pay_for_urself.api.services.decision_workflow import DecisionWorkflowService
from agent_pay_for_urself.api.services.history import WorkflowHistoryService
from agent_pay_for_urself.llm import NoopAgentLLMClient
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories import JsonFileWorkflowHistoryRepository
from agent_pay_for_urself.repositories.workflow_runs import InMemoryWorkflowRunRepository


def _build_client(tmp_path: Path) -> TestClient:
    llm_client = NoopAgentLLMClient()
    history_repository = JsonFileWorkflowHistoryRepository(tmp_path / "workflow-runs.json")
    workflow_service = DecisionWorkflowService(
        main_agent=MainAgent(
            data_collection_agent=DataCollectionAgent(llm_client=llm_client),
            data_analysis_agent=DataAnalysisAgent(llm_client=llm_client),
            report_agent=ReportAgent(llm_client=llm_client),
            buy_sell_agent=BuySellAgent(llm_client=llm_client),
            order_execution_agent=OrderExecutionAgent(llm_client=llm_client),
            log_evaluation_agent=LogEvaluationAgent(llm_client=llm_client),
            llm_client=llm_client,
        ),
        workflow_run_repository=InMemoryWorkflowRunRepository(),
        workflow_history_repository=history_repository,
        llm_client=llm_client,
    )
    history_service = WorkflowHistoryService(repository=history_repository)
    app.dependency_overrides[get_decision_workflow_service] = lambda: workflow_service
    app.dependency_overrides[get_workflow_history_service] = lambda: history_service
    return TestClient(app)


def test_run_history_lists_stored_workflow_runs(tmp_path: Path) -> None:
    client = _build_client(tmp_path)

    try:
        created = client.post(
            "/decisions",
            json={
                "symbols": ["AAPL", "MSFT"],
                "max_position_weight": 0.2,
                "user_prompt": "기본 전략을 점검해라",
            },
        )
        run_id = created.json()["run_id"]

        response = client.get("/runs")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload
    matching = next(item for item in payload if item["run_id"] == run_id)
    assert matching["symbols"] == ["AAPL", "MSFT"]
    assert matching["created_at"]
    assert matching["objective"]
    assert isinstance(matching["decision_actions"], dict)


def test_run_history_returns_detail_with_timeline(tmp_path: Path) -> None:
    client = _build_client(tmp_path)

    try:
        created = client.post(
            "/decisions",
            json={
                "symbols": ["AAPL"],
                "max_position_weight": 0.2,
                "user_prompt": "애플만 보수적으로 검토해라",
            },
        )
        run_id = created.json()["run_id"]

        response = client.get(f"/runs/{run_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["run_id"] == run_id
    assert payload["created_at"]
    assert len(payload["agent_statuses"]) == 7
    assert len(payload["timeline"]) == 7
    assert payload["analysis_summaries"][0]["symbol"] == "AAPL"
    assert payload["result"]["run_id"] == run_id
    assert payload["result"]["created_at"] == payload["created_at"]


def test_run_history_returns_not_found_for_missing_run(tmp_path: Path) -> None:
    client = _build_client(tmp_path)

    try:
        response = client.get("/runs/missing-run")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json()["detail"] == "workflow run not found: missing-run"
