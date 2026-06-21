from agent_pay_for_urself.adapters.broker import BrokerAdapter, BrokerSubmission
from agent_pay_for_urself.agents import DataCollectionAgent, OrderExecutionAgent
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.schemas import (
    InvestmentMandate,
    InvestmentRequest,
    MarketData,
    OrderPlan,
    TradeDecision,
)


class RecordingMarketDataProvider:
    def __init__(self) -> None:
        self.requested_symbols: list[str] = []

    def get_market_data(self, symbol: str) -> MarketData:
        self.requested_symbols.append(symbol)
        return MarketData(
            symbol=symbol,
            latest_price=123.45,
            broker_exchange_code="NASD",
            news_headlines=(f"{symbol} custom update",),
            financial_metrics={"pe_ratio": 18.0},
        )


class RecordingBrokerAdapter(BrokerAdapter):
    @property
    def supports_live_submission(self) -> bool:
        return True

    def __init__(self) -> None:
        self.submitted_symbols: list[str] = []

    def submit_order(self, order_plan: OrderPlan) -> BrokerSubmission:
        self.submitted_symbols.append(order_plan.symbol)
        return BrokerSubmission(
            symbol=order_plan.symbol,
            accepted=True,
            broker_order_id=f"broker-{order_plan.symbol}",
            message="submitted",
        )

    def get_order_status(self, broker_order_id: str) -> str:
        return "filled"


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


def test_main_agent_uses_configured_market_data_provider() -> None:
    provider = RecordingMarketDataProvider()
    request = InvestmentRequest(symbols=("aapl",), max_position_weight=0.2)
    agent = MainAgent(data_collection_agent=DataCollectionAgent(market_data_provider=provider))

    result = agent.run(request)

    assert provider.requested_symbols == ["AAPL"]
    assert result.market_data[0].latest_price == 123.45
    assert result.market_data[0].broker_exchange_code == "NASD"
    assert result.market_data[0].financial_metrics["pe_ratio"] == 18.0


def test_order_execution_submits_only_executable_orders_through_broker_adapter() -> None:
    broker_adapter = RecordingBrokerAdapter()
    order_execution_agent = OrderExecutionAgent(broker_adapter=broker_adapter)
    orders = order_execution_agent.plan_orders(
        (
            TradeDecision(
                symbol="AAPL",
                action="BUY",
                confidence=0.9,
                rationale="buy signal",
                risk_approved=True,
            ),
            TradeDecision(
                symbol="MSFT",
                action="HOLD",
                confidence=0.4,
                rationale="hold signal",
                risk_approved=True,
            ),
        ),
        market_data=(
            MarketData(symbol="AAPL", latest_price=201.25, broker_exchange_code="NASD"),
            MarketData(symbol="MSFT", latest_price=301.5, broker_exchange_code="NYSE"),
        ),
    )

    submissions = order_execution_agent.submit_orders(orders)

    assert [submission.symbol for submission in submissions] == ["AAPL"]
    assert broker_adapter.submitted_symbols == ["AAPL"]
    assert orders[0].broker_exchange_code == "NASD"
    assert orders[0].limit_price == 201.25


def test_main_agent_blocks_symbols_outside_user_mandate() -> None:
    request = InvestmentRequest(
        symbols=("AAPL",),
        max_position_weight=0.2,
        mandate=InvestmentMandate(allowed_symbols=("MSFT",), max_position_weight=0.2),
    )

    result = MainAgent().run(request)

    assert result.mandate.allowed_symbols == ("MSFT",)
    assert result.mandate_violations[0].rule == "allowed_symbols"
    assert result.trade_decisions[0].action == "HOLD"
    assert result.trade_decisions[0].risk_approved is False
    assert result.order_plans[0].should_submit is False
