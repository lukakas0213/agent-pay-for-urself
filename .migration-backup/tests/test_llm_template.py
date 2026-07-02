from agent_pay_for_urself.adapters.market_data import StubMarketDataProvider
from agent_pay_for_urself.agents import (
    BuySellAgent,
    DataAnalysisAgent,
    DataCollectionAgent,
    LogEvaluationAgent,
    OrderExecutionAgent,
    ReportAgent,
)
from agent_pay_for_urself.llm.base import AgentLLMClient, AgentLLMRequest
from agent_pay_for_urself.llm.openai_client import AGENT_MODEL_ENV_VARS, OpenAIResponsesConfig
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.schemas import AgentPromptOverrides, InvestmentRequest


class StaticAgentLLMClient(AgentLLMClient):
    def __init__(self) -> None:
        self.requests: list[AgentLLMRequest] = []

    def complete(self, request: AgentLLMRequest) -> dict[str, object]:
        self.requests.append(request)
        if request.agent_name == "main_agent":
            return {
                "directive": {
                    "objective": "LLM supervisor objective",
                    "focus_symbols": ["AAPL"],
                    "watch_symbols": ["AAPL"],
                    "guidance": ["prefer AAPL timing"],
                    "summary": "llm supervisor summary",
                }
            }
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
        if request.agent_name == "report":
            return {
                "investment_reports": [
                    {
                        "symbol": "AAPL",
                        "summary": "LLM report summary",
                        "bull_points": ["LLM upside"],
                        "bear_points": ["LLM downside"],
                        "risk_flags": ["LLM risk approved"],
                        "risk_approved": True,
                        "max_position_weight": 0.2,
                        "recommended_action_bias": "BUY",
                        "signal_strength": 0.88,
                        "rationale": "LLM report result",
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
        if request.agent_name == "main_agent":
            return {"directive": "invalid"}
        return {"analysis_signals": "invalid"}


def test_main_agent_can_use_shared_llm_templates_for_all_agents() -> None:
    llm_client = StaticAgentLLMClient()
    agent = MainAgent(
        data_collection_agent=DataCollectionAgent(
            market_data_provider=StubMarketDataProvider(),
            llm_client=llm_client,
        ),
        data_analysis_agent=DataAnalysisAgent(llm_client=llm_client),
        report_agent=ReportAgent(llm_client=llm_client),
        buy_sell_agent=BuySellAgent(llm_client=llm_client),
        order_execution_agent=OrderExecutionAgent(llm_client=llm_client),
        log_evaluation_agent=LogEvaluationAgent(llm_client=llm_client),
        llm_client=llm_client,
    )

    result = agent.run(InvestmentRequest(symbols=("AAPL",), max_position_weight=0.2))

    assert result.supervisor_directive.summary == "llm supervisor summary"
    assert result.market_data[0].latest_price == 111.0
    assert result.analysis_signals[0].rationale == "LLM analysis result"
    assert result.investment_reports[0].risk_flags == ("LLM risk approved",)
    assert result.trade_decisions[0].action == "BUY"
    assert result.order_plans[0].quantity == 3
    assert result.evaluation_log.notes == ("AAPL: BUY via llm",)
    assert [request.agent_name for request in llm_client.requests] == [
        "main_agent",
        "data_collection",
        "data_analysis",
        "report",
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
        report_agent=ReportAgent(llm_client=llm_client),
        buy_sell_agent=BuySellAgent(llm_client=llm_client),
        order_execution_agent=OrderExecutionAgent(llm_client=llm_client),
        log_evaluation_agent=LogEvaluationAgent(llm_client=llm_client),
        llm_client=llm_client,
    )

    agent.run(
        InvestmentRequest(
            symbols=("AAPL",),
            max_position_weight=0.2,
            prompt_overrides=AgentPromptOverrides(
                main_agent="supervisor override",
                data_collection="collect override",
                data_analysis="analysis override",
                report="report override",
                buy_sell="decision override",
                order_execution="order override",
                log_evaluation="evaluation override",
            ),
        )
    )

    assert "supervisor override" in llm_client.requests[0].system_instruction
    assert "collect override" in llm_client.requests[1].system_instruction
    assert "analysis override" in llm_client.requests[2].system_instruction
    assert "report override" in llm_client.requests[3].system_instruction
    assert "decision override" in llm_client.requests[4].system_instruction
    assert "order override" in llm_client.requests[5].system_instruction
    assert "evaluation override" in llm_client.requests[6].system_instruction


def test_data_analysis_agent_falls_back_when_llm_payload_is_invalid() -> None:
    agent = DataAnalysisAgent(llm_client=InvalidAgentLLMClient())

    result = agent.analyze((StubMarketDataProvider().get_market_data("AAPL"),))

    assert result[0].symbol == "AAPL"
    assert result[0].rationale


def test_main_agent_falls_back_when_supervisor_payload_is_invalid() -> None:
    llm_client = InvalidAgentLLMClient()
    agent = MainAgent(llm_client=llm_client)

    result = agent.run(
        InvestmentRequest(
            symbols=("MSFT",),
            max_position_weight=0.2,
            chat_messages=("애플을 지켜봐",),
        )
    )

    assert result.supervisor_directive.watch_symbols == ("AAPL",)
    assert result.request.symbols == ("MSFT", "AAPL")


def test_openai_responses_config_uses_agent_specific_model_env_vars(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_TIMEOUT_SECONDS", raising=False)
    for env_var in AGENT_MODEL_ENV_VARS.values():
        monkeypatch.delenv(env_var, raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.5")
    monkeypatch.setenv("OPENAI_MAIN_AGENT_MODEL", "gpt-5.5")
    monkeypatch.setenv("OPENAI_DATA_COLLECTION_MODEL", "gpt-5.4-mini")
    monkeypatch.setenv("OPENAI_ORDER_EXECUTION_MODEL", "gpt-5.4-mini")

    config = OpenAIResponsesConfig.from_env()

    assert config is not None
    assert config.default_model == "gpt-5.5"
    assert config.model_for_agent("main_agent") == "gpt-5.5"
    assert config.model_for_agent("data_collection") == "gpt-5.4-mini"
    assert config.model_for_agent("data_analysis") == "gpt-5.5"
    assert config.model_for_agent("order_execution") == "gpt-5.4-mini"
    assert config.agent_models is not None
    assert config.agent_models["report"] == "gpt-5.5"


class RaisingAgentLLMClient(AgentLLMClient):
    def complete(self, request: AgentLLMRequest) -> dict[str, object]:
        raise RuntimeError("upstream llm unavailable")


def test_main_agent_falls_back_when_llm_request_raises_runtime_error() -> None:
    llm_client = RaisingAgentLLMClient()
    agent = MainAgent(
        data_collection_agent=DataCollectionAgent(
            market_data_provider=StubMarketDataProvider(),
            llm_client=llm_client,
        ),
        data_analysis_agent=DataAnalysisAgent(llm_client=llm_client),
        report_agent=ReportAgent(llm_client=llm_client),
        buy_sell_agent=BuySellAgent(llm_client=llm_client),
        order_execution_agent=OrderExecutionAgent(llm_client=llm_client),
        log_evaluation_agent=LogEvaluationAgent(llm_client=llm_client),
        llm_client=llm_client,
    )

    result = agent.run(
        InvestmentRequest(
            symbols=("AAPL", "MSFT"),
            max_position_weight=0.2,
            user_prompt="장기 수익 중심으로 운용하라",
        )
    )

    assert result.supervisor_directive.focus_symbols == ("AAPL", "MSFT")
    assert len(result.market_data) == 2
    assert len(result.trade_decisions) == 2
    assert len(result.order_plans) == 2
