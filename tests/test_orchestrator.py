from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.schemas import InvestmentRequest


def test_main_agent_runs_minimum_workflow() -> None:
    request = InvestmentRequest(symbols=("AAPL", "MSFT"), max_position_weight=0.2)

    result = MainAgent().run(request)

    assert [data.symbol for data in result.market_data] == ["AAPL", "MSFT"]
    assert len(result.analysis_signals) == 2
    assert len(result.risk_assessments) == 2
    assert len(result.trade_decisions) == 2
    assert len(result.order_plans) == 2
    assert result.evaluation_log.decision_count == 2


def test_order_plan_requires_risk_approval() -> None:
    request = InvestmentRequest(symbols=("AAPL",), max_position_weight=0.0)

    result = MainAgent().run(request)

    decision = result.trade_decisions[0]
    order = result.order_plans[0]
    assert decision.action == "HOLD"
    assert decision.risk_approved is False
    assert order.should_submit is False
    assert order.quantity == 0
