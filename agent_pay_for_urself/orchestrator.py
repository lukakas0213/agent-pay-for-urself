"""Main agent orchestrator.

Agents do not call each other directly. The orchestrator owns the workflow and
passes structured schemas between each single-responsibility agent.
"""

from agent_pay_for_urself.agents import (
    BuySellAgent,
    DataAnalysisAgent,
    DataCollectionAgent,
    LogEvaluationAgent,
    OrderExecutionAgent,
    RiskManagementAgent,
)
from agent_pay_for_urself.policies import PolicyGuardrail
from agent_pay_for_urself.schemas import InvestmentMandate, InvestmentRequest, WorkflowResult


class MainAgent:
    """Coordinates the end-to-end investment decision workflow."""

    def __init__(
        self,
        data_collection_agent: DataCollectionAgent | None = None,
        data_analysis_agent: DataAnalysisAgent | None = None,
        risk_management_agent: RiskManagementAgent | None = None,
        buy_sell_agent: BuySellAgent | None = None,
        order_execution_agent: OrderExecutionAgent | None = None,
        log_evaluation_agent: LogEvaluationAgent | None = None,
        policy_guardrail: PolicyGuardrail | None = None,
    ) -> None:
        self.data_collection_agent = data_collection_agent or DataCollectionAgent()
        self.data_analysis_agent = data_analysis_agent or DataAnalysisAgent()
        self.risk_management_agent = risk_management_agent or RiskManagementAgent()
        self.buy_sell_agent = buy_sell_agent or BuySellAgent()
        self.order_execution_agent = order_execution_agent or OrderExecutionAgent()
        self.log_evaluation_agent = log_evaluation_agent or LogEvaluationAgent()
        self.policy_guardrail = policy_guardrail or PolicyGuardrail()

    def run(self, request: InvestmentRequest) -> WorkflowResult:
        mandate = self._resolve_mandate(request)
        prompt_overrides = request.prompt_overrides
        market_data = self.data_collection_agent.collect(
            request,
            prompt_override=prompt_overrides.data_collection,
        )
        analysis_signals = self.data_analysis_agent.analyze(
            market_data,
            prompt_override=prompt_overrides.data_analysis,
        )
        risk_assessments = self.risk_management_agent.assess(
            request,
            analysis_signals,
            prompt_override=prompt_overrides.risk_management,
        )
        trade_decisions = self.buy_sell_agent.decide(
            analysis_signals,
            risk_assessments,
            prompt_override=prompt_overrides.buy_sell,
        )
        order_plans = self.order_execution_agent.plan_orders(
            trade_decisions,
            prompt_override=prompt_overrides.order_execution,
        )
        trade_decisions, order_plans, mandate_violations = self.policy_guardrail.apply(
            mandate,
            trade_decisions,
            order_plans,
        )
        evaluation_log = self.log_evaluation_agent.summarize(
            trade_decisions,
            order_plans,
            prompt_override=prompt_overrides.log_evaluation,
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
            mandate_violations=mandate_violations,
        )

    def _resolve_mandate(self, request: InvestmentRequest) -> InvestmentMandate:
        if request.mandate is not None:
            return request.mandate
        return InvestmentMandate(max_position_weight=request.max_position_weight)
