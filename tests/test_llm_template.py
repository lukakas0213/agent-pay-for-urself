from agent_pay_for_urself.adapters.market_data import StubMarketDataProvider
from agent_pay_for_urself.agents import (
    BuySellAgent,
    DataAnalysisAgent,
    DataCollectionAgent,
    LogEvaluationAgent,
    OrderExecutionAgent,
    RiskManagementAgent,
)
from agent_pay_for_urself.llm.base import AgentLLMClient, AgentLLMRequest
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.schemas import AgentPromptOverrides, InvestmentRequest


class StaticAgentLLMClient(AgentLLMClient):
    def __init__(self) -> None:
        self.requests: list[AgentLLMRequest] = []

    def complete(self, request: AgentLLMRequest) -> dict[str, object]:
        self.requests.append(request)
        if request.agent_name == "data_collection":
            return {
                "market_data": [
                    {
                        "symbol": "AAPL",
                        "latest_price": 111.0,
                        "news_headlines": ["AAPL llm-collected"],
                        "financial_metrics": {"pe_ratio": 19.0},
                    }
                ]
            }
        if request.agent_name == "data_analysis":
            return {
                "analysis_signals": [
                    {
                        "symbol": "AAPL",
                        "price_score": 0.8,
                        "news_score": 0.9,
                        "financial_score": 0.85,
                        "rationale": "LLM analysis result",
                    }
                ]
            }
        if request.agent_name == "risk_management":
            return {
                "risk_assessments": [
                    {
                        "symbol": "AAPL",
                        "approved": True,
                        "reasons": ["LLM risk approved"],
                        "max_position_weight": 0.2,
                    }
                ]
            }
        if request.agent_name == "buy_sell":
            return {
                "trade_decisions": [
                    {
                        "symbol": "AAPL",
                        "action": "BUY",
                        "confidence": 0.88,
                        "rationale": "LLM buy decision",
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
                        "quantity": 3,
                        "should_submit": True,
                        "reason": "LLM order plan",
                    }
                ]
            }
        if request.agent_name == "log_evaluation":
            return {
                "evaluation_log": {
                    "decision_count": 1,
                    "order_count": 1,
                    "blocked_order_count": 0,
                    "notes": ["AAPL: BUY via llm"],
                }
            }
        raise AssertionError(f"Unexpected agent name: {request.agent_name}")


class InvalidAgentLLMClient(AgentLLMClient):
    def complete(self, request: AgentLLMRequest) -> dict[str, object]:
        return {"analysis_signals": "invalid"}


def test_main_agent_can_use_shared_llm_templates_for_all_agents() -> None:
    llm_client = StaticAgentLLMClient()
    agent = MainAgent(
        data_collection_agent=DataCollectionAgent(
            market_data_provider=StubMarketDataProvider(),
            llm_client=llm_client,
        ),
        data_analysis_agent=DataAnalysisAgent(llm_client=llm_client),
        risk_management_agent=RiskManagementAgent(llm_client=llm_client),
        buy_sell_agent=BuySellAgent(llm_client=llm_client),
        order_execution_agent=OrderExecutionAgent(llm_client=llm_client),
        log_evaluation_agent=LogEvaluationAgent(llm_client=llm_client),
    )

    result = agent.run(InvestmentRequest(symbols=("AAPL",), max_position_weight=0.2))

    assert result.market_data[0].latest_price == 111.0
    assert result.analysis_signals[0].rationale == "LLM analysis result"
    assert result.risk_assessments[0].reasons == ("LLM risk approved",)
    assert result.trade_decisions[0].action == "BUY"
    assert result.order_plans[0].quantity == 3
    assert result.evaluation_log.notes == ("AAPL: BUY via llm",)
    assert [request.agent_name for request in llm_client.requests] == [
        "data_collection",
        "data_analysis",
        "risk_management",
        "buy_sell",
        "order_execution",
        "log_evaluation",
    ]


def test_main_agent_appends_experiment_prompt_overrides_to_llm_requests() -> None:
    llm_client = StaticAgentLLMClient()
    agent = MainAgent(
        data_collection_agent=DataCollectionAgent(
            market_data_provider=StubMarketDataProvider(),
            llm_client=llm_client,
        ),
        data_analysis_agent=DataAnalysisAgent(llm_client=llm_client),
        risk_management_agent=RiskManagementAgent(llm_client=llm_client),
        buy_sell_agent=BuySellAgent(llm_client=llm_client),
        order_execution_agent=OrderExecutionAgent(llm_client=llm_client),
        log_evaluation_agent=LogEvaluationAgent(llm_client=llm_client),
    )

    agent.run(
        InvestmentRequest(
            symbols=("AAPL",),
            max_position_weight=0.2,
            prompt_overrides=AgentPromptOverrides(
                data_collection="collect override",
                data_analysis="analysis override",
                risk_management="risk override",
                buy_sell="decision override",
                order_execution="order override",
                log_evaluation="evaluation override",
            ),
        )
    )

    assert "collect override" in llm_client.requests[0].system_instruction
    assert "analysis override" in llm_client.requests[1].system_instruction
    assert "risk override" in llm_client.requests[2].system_instruction
    assert "decision override" in llm_client.requests[3].system_instruction
    assert "order override" in llm_client.requests[4].system_instruction
    assert "evaluation override" in llm_client.requests[5].system_instruction


def test_data_analysis_agent_falls_back_when_llm_payload_is_invalid() -> None:
    agent = DataAnalysisAgent(llm_client=InvalidAgentLLMClient())

    result = agent.analyze((StubMarketDataProvider().get_market_data("AAPL"),))

    assert result[0].symbol == "AAPL"
    assert result[0].rationale
