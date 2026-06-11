"""Application service for running and storing experiments."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from uuid import uuid4

from agent_pay_for_urself.adapters import MarketDataProvider
from agent_pay_for_urself.api.mappers.workflow import to_decision_response
from agent_pay_for_urself.api.models import (
    AgentPromptOverridesRequest,
    ExperimentCreateRequest,
    ExperimentListItem,
    ExperimentResponse,
    RuntimeSummaryItem,
)
from agent_pay_for_urself.llm import AgentLLMClient
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories import ExperimentRepository, WorkflowRunRepository
from agent_pay_for_urself.schemas import (
    AgentPromptOverrides,
    EvaluationLog,
    InvestmentMandate,
    InvestmentRequest,
    OrderPlan,
    WorkflowResult,
)


class ExperimentService:
    """Runs saved experiments without changing the public decision endpoint."""

    def __init__(
        self,
        main_agent: MainAgent,
        workflow_run_repository: WorkflowRunRepository,
        experiment_repository: ExperimentRepository,
        market_data_provider: MarketDataProvider,
        llm_client: AgentLLMClient,
        live_order_enabled: bool = False,
    ) -> None:
        self._main_agent = main_agent
        self._workflow_run_repository = workflow_run_repository
        self._experiment_repository = experiment_repository
        self._market_data_provider = market_data_provider
        self._llm_client = llm_client
        self._live_order_enabled = live_order_enabled

    def create(self, request: ExperimentCreateRequest) -> ExperimentResponse:
        workflow_request = InvestmentRequest(
            symbols=tuple(request.decision.symbols),
            max_position_weight=request.decision.max_position_weight,
            mandate=self._to_investment_mandate(request),
            prompt_overrides=self._to_prompt_overrides(request.prompt_overrides),
        )
        result = self._main_agent.run(workflow_request)
        result = self._apply_experiment_safety(result)
        run_id = self._workflow_run_repository.save(result)
        response = self._build_response(request, run_id, result)
        self._experiment_repository.save(response.model_dump(mode="json"))
        return response

    def list(self) -> list[ExperimentListItem]:
        return [self._to_list_item(payload) for payload in self._experiment_repository.list()]

    def get(self, experiment_id: str) -> ExperimentResponse | None:
        payload = self._experiment_repository.get(experiment_id)
        if payload is None:
            return None
        return ExperimentResponse.model_validate(payload)

    def _build_response(
        self,
        request: ExperimentCreateRequest,
        run_id: str,
        result: WorkflowResult,
    ) -> ExperimentResponse:
        return ExperimentResponse(
            experiment_id=uuid4().hex,
            run_id=run_id,
            name=request.name,
            description=request.description,
            created_at=datetime.now(UTC).isoformat(),
            decision=request.decision,
            prompt_overrides=request.prompt_overrides,
            runtime=self._runtime_summary(),
            result=to_decision_response(run_id, result, self._runtime_summary()),
        )

    def _runtime_summary(self) -> RuntimeSummaryItem:
        return RuntimeSummaryItem(
            data_mode=getattr(self._market_data_provider, "mode_name", "configured"),
            llm_mode="model" if self._llm_client.enabled else "fallback",
            model_name=getattr(self._llm_client, "model_name", None),
            live_order_enabled=self._live_order_enabled,
        )

    def _apply_experiment_safety(self, result: WorkflowResult) -> WorkflowResult:
        if self._live_order_enabled:
            return result

        blocked_orders = tuple(self._block_order(order) for order in result.order_plans)
        blocked_order_count = sum(1 for order in blocked_orders if not order.should_submit)
        return replace(
            result,
            order_plans=blocked_orders,
            evaluation_log=EvaluationLog(
                decision_count=result.evaluation_log.decision_count,
                order_count=result.evaluation_log.order_count,
                blocked_order_count=blocked_order_count,
                notes=result.evaluation_log.notes,
            ),
        )

    def _block_order(self, order: OrderPlan) -> OrderPlan:
        if not order.should_submit:
            return order
        return OrderPlan(
            symbol=order.symbol,
            action=order.action,
            quantity=0,
            should_submit=False,
            reason=f"experiment live order disabled; original plan: {order.reason}",
        )

    def _to_investment_mandate(
        self,
        request: ExperimentCreateRequest,
    ) -> InvestmentMandate | None:
        mandate = request.decision.mandate
        if mandate is None:
            return None
        return InvestmentMandate(
            objective=mandate.objective,
            allowed_symbols=tuple(mandate.allowed_symbols),
            excluded_symbols=tuple(mandate.excluded_symbols),
            max_position_weight=request.decision.max_position_weight,
            max_order_notional=mandate.max_order_notional,
            min_cash_weight=mandate.min_cash_weight,
            risk_tolerance=mandate.risk_tolerance,
            requires_approval_for_live_orders=mandate.requires_approval_for_live_orders,
            user_notes=mandate.user_notes,
        )

    def _to_prompt_overrides(
        self,
        request: AgentPromptOverridesRequest,
    ) -> AgentPromptOverrides:
        return AgentPromptOverrides(
            data_collection=request.data_collection,
            data_analysis=request.data_analysis,
            risk_management=request.risk_management,
            buy_sell=request.buy_sell,
            order_execution=request.order_execution,
            log_evaluation=request.log_evaluation,
        )

    def _to_list_item(self, payload: dict[str, object]) -> ExperimentListItem:
        result = payload.get("result")
        decisions = result.get("decisions", []) if isinstance(result, dict) else []
        decision_actions = {
            str(decision.get("symbol")): decision.get("action")
            for decision in decisions
            if isinstance(decision, dict)
        }
        return ExperimentListItem.model_validate(
            {
                "experiment_id": payload.get("experiment_id"),
                "run_id": payload.get("run_id"),
                "name": payload.get("name"),
                "description": payload.get("description", ""),
                "created_at": payload.get("created_at"),
                "symbols": result.get("symbols", []) if isinstance(result, dict) else [],
                "decision_actions": decision_actions,
                "runtime": payload.get("runtime"),
            }
        )
