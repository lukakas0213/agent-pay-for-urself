from fastapi.testclient import TestClient

from agent_pay_for_urself.adapters.broker import BrokerAdapter, BrokerSubmission
from agent_pay_for_urself.agents import OrderExecutionAgent
from agent_pay_for_urself.api.dependencies import (
    get_decision_workflow_service,
    get_order_submission_service,
)
from agent_pay_for_urself.api.main import app
from agent_pay_for_urself.api.services.decision_workflow import DecisionWorkflowService
from agent_pay_for_urself.api.services.order_submission import OrderSubmissionService
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories.workflow_runs import InMemoryWorkflowRunRepository
from agent_pay_for_urself.schemas import (
    AnalysisSignal,
    EvaluationLog,
    InvestmentMandate,
    InvestmentRequest,
    MarketData,
    OrderPlan,
    RiskAssessment,
    TradeDecision,
    WorkflowResult,
)


class LiveBrokerAdapter(BrokerAdapter):
    @property
    def supports_live_submission(self) -> bool:
        return True

    def submit_order(self, order_plan: OrderPlan) -> BrokerSubmission:
        return BrokerSubmission(
            symbol=order_plan.symbol,
            accepted=True,
            broker_order_id=f"broker-{order_plan.symbol}",
            message="submitted",
        )

    def get_order_status(self, broker_order_id: str) -> str:
        return "submitted"


class DisabledBrokerAdapter(BrokerAdapter):
    @property
    def supports_live_submission(self) -> bool:
        return False

    def submit_order(self, order_plan: OrderPlan) -> BrokerSubmission:
        return BrokerSubmission(
            symbol=order_plan.symbol,
            accepted=False,
            broker_order_id=None,
            message="disabled",
        )

    def get_order_status(self, broker_order_id: str) -> str:
        return "unavailable"


def _build_result() -> WorkflowResult:
    request = InvestmentRequest(symbols=("AAPL",), max_position_weight=0.2)
    mandate = InvestmentMandate(max_position_weight=0.2)
    market_data = (
        MarketData(
            symbol="AAPL",
            latest_price=201.25,
            broker_exchange_code="NASD",
            news_headlines=("AAPL headline",),
            financial_metrics={"pe_ratio": 18.0},
        ),
    )
    analysis_signals = (
        AnalysisSignal(
            symbol="AAPL",
            price_score=0.8,
            news_score=0.8,
            financial_score=0.8,
            rationale="positive signal",
        ),
    )
    risk_assessments = (
        RiskAssessment(
            symbol="AAPL",
            approved=True,
            reasons=("risk rules passed",),
            max_position_weight=0.2,
        ),
    )
    trade_decisions = (
        TradeDecision(
            symbol="AAPL",
            action="BUY",
            confidence=0.8,
            rationale="positive signal",
            risk_approved=True,
        ),
    )
    order_plans = (
        OrderPlan(
            symbol="AAPL",
            action="BUY",
            quantity=1,
            broker_exchange_code="NASD",
            limit_price=201.25,
            should_submit=True,
            reason="ready for broker adapter",
        ),
    )
    evaluation_log = EvaluationLog(
        decision_count=1,
        order_count=1,
        blocked_order_count=0,
        notes=("AAPL: BUY",),
    )
    return WorkflowResult(
        request=request,
        mandate=mandate,
        market_data=market_data,
        analysis_signals=analysis_signals,
        risk_assessments=risk_assessments,
        trade_decisions=trade_decisions,
        order_plans=order_plans,
        evaluation_log=evaluation_log,
    )


def _override_services(broker_adapter: BrokerAdapter):
    repository = InMemoryWorkflowRunRepository()
    main_agent = MainAgent(order_execution_agent=OrderExecutionAgent(broker_adapter=broker_adapter))
    decision_service = DecisionWorkflowService(
        main_agent=main_agent,
        workflow_run_repository=repository,
    )
    order_service = OrderSubmissionService(
        main_agent=main_agent,
        workflow_run_repository=repository,
    )
    run_id = repository.save(_build_result())
    return decision_service, order_service, run_id


def test_submit_direct_order_endpoint_submits_one_broker_order() -> None:
    _, order_service, _ = _override_services(LiveBrokerAdapter())
    app.dependency_overrides[get_order_submission_service] = lambda: order_service
    client = TestClient(app)

    response = client.post(
        "/orders/submit",
        json={
            "symbol": "AAPL",
            "action": "BUY",
            "quantity": 2,
            "broker_exchange_code": "NASD",
            "limit_price": 201.25,
            "confirm_live_order": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["live_order_enabled"] is True
    assert payload["submission"]["symbol"] == "AAPL"
    assert payload["submission"]["action"] == "BUY"
    assert payload["submission"]["quantity"] == 2
    assert payload["submission"]["accepted"] is True
    assert payload["submission"]["broker_order_id"] == "broker-AAPL"
    app.dependency_overrides.clear()


def test_submit_direct_order_endpoint_requires_explicit_confirmation() -> None:
    _, order_service, _ = _override_services(LiveBrokerAdapter())
    app.dependency_overrides[get_order_submission_service] = lambda: order_service
    client = TestClient(app)

    response = client.post(
        "/orders/submit",
        json={
            "symbol": "AAPL",
            "action": "BUY",
            "quantity": 1,
            "broker_exchange_code": "NASD",
            "limit_price": 201.25,
            "confirm_live_order": False,
        },
    )

    assert response.status_code == 400
    assert "confirm_live_order" in response.json()["detail"]
    app.dependency_overrides.clear()


def test_submit_direct_order_endpoint_returns_503_when_broker_is_disabled() -> None:
    _, order_service, _ = _override_services(DisabledBrokerAdapter())
    app.dependency_overrides[get_order_submission_service] = lambda: order_service
    client = TestClient(app)

    response = client.post(
        "/orders/submit",
        json={
            "symbol": "AAPL",
            "action": "BUY",
            "quantity": 1,
            "broker_exchange_code": "NASD",
            "limit_price": 201.25,
            "confirm_live_order": True,
        },
    )

    assert response.status_code == 503
    assert "live broker submission is not enabled" in response.json()["detail"]
    app.dependency_overrides.clear()


def test_submit_live_orders_endpoint_submits_stored_executable_orders() -> None:
    decision_service, order_service, run_id = _override_services(LiveBrokerAdapter())
    app.dependency_overrides[get_decision_workflow_service] = lambda: decision_service
    app.dependency_overrides[get_order_submission_service] = lambda: order_service
    client = TestClient(app)

    response = client.post(
        "/orders/submissions",
        json={"run_id": run_id, "confirm_live_order": True},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted_order_count"] == 1
    assert payload["rejected_order_count"] == 0
    assert payload["submissions"][0]["symbol"] == "AAPL"
    assert payload["submissions"][0]["broker_order_id"] == "broker-AAPL"
    app.dependency_overrides.clear()


def test_submit_live_orders_endpoint_requires_explicit_confirmation() -> None:
    _, order_service, run_id = _override_services(LiveBrokerAdapter())
    app.dependency_overrides[get_order_submission_service] = lambda: order_service
    client = TestClient(app)

    response = client.post(
        "/orders/submissions",
        json={"run_id": run_id, "confirm_live_order": False},
    )

    assert response.status_code == 400
    assert "confirm_live_order" in response.json()["detail"]
    app.dependency_overrides.clear()


def test_submit_live_orders_endpoint_returns_404_for_unknown_run_id() -> None:
    _, order_service, _ = _override_services(LiveBrokerAdapter())
    app.dependency_overrides[get_order_submission_service] = lambda: order_service
    client = TestClient(app)

    response = client.post(
        "/orders/submissions",
        json={"run_id": "missing-run", "confirm_live_order": True},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "workflow run not found: missing-run"
    app.dependency_overrides.clear()


def test_submit_live_orders_endpoint_returns_503_when_broker_is_disabled() -> None:
    _, order_service, run_id = _override_services(DisabledBrokerAdapter())
    app.dependency_overrides[get_order_submission_service] = lambda: order_service
    client = TestClient(app)

    response = client.post(
        "/orders/submissions",
        json={"run_id": run_id, "confirm_live_order": True},
    )

    assert response.status_code == 503
    assert "live broker submission is not enabled" in response.json()["detail"]
    app.dependency_overrides.clear()
