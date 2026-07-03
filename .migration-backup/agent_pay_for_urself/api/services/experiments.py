"""Application service for running and storing experiments."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from uuid import uuid4

from agent_pay_for_urself.adapters import MarketDataProvider
from agent_pay_for_urself.api.mappers.workflow import to_decision_response
from agent_pay_for_urself.api.models import (
    AgentPromptOverridesRequest,
    DecisionRequest,
    ExperimentCreateRequest,
    ExperimentListItem,
    ExperimentResponse,
    ExperimentSaveRequest,
    MandateRequest,
    RuntimeSummaryItem,
)
from agent_pay_for_urself.api.services.agent_prompts import AgentPromptService
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
    def __init__(
        self,
        main_agent: MainAgent,
        workflow_run_repository: WorkflowRunRepository,
        experiment_repository: ExperimentRepository,
        market_data_provider: MarketDataProvider,
        llm_client: AgentLLMClient,
        agent_prompt_service: AgentPromptService | None = None,
        live_order_enabled: bool = False,
    ) -> None:
        self._main_agent = main_agent
        self._workflow_run_repository = workflow_run_repository
        self._experiment_repository = experiment_repository
        self._market_data_provider = market_data_provider
        self._llm_client = llm_client
        self._agent_prompt_service = agent_prompt_service
        self._live_order_enabled = live_order_enabled

    def create(self, request: ExperimentCreateRequest) -> ExperimentResponse:
        workflow_request = InvestmentRequest(
            symbols=tuple(request.decision.symbols),
            max_position_weight=request.decision.max_position_weight,
            mandate=self._to_investment_mandate(request.decision),
            prompt_overrides=self._resolve_prompt_overrides(request.prompt_overrides),
        )
        result = self._main_agent.run(workflow_request)
        result = self._apply_experiment_safety(result)
        run_id = self._workflow_run_repository.save(result)
        response = self._build_response(
            name=request.name,
            description=request.description,
            run_id=run_id,
            decision=request.decision,
            result=result,
        )
        self._experiment_repository.save(response.model_dump(mode="json"))
        return response

    def save_run(self, request: ExperimentSaveRequest) -> ExperimentResponse:
        result = self._workflow_run_repository.get(request.run_id)
        if result is None:
            raise LookupError(f"workflow run not found: {request.run_id}")
        result = self._apply_experiment_safety(result)
        response = self._build_response_from_result(
            request.name, request.description, request.run_id, result
        )
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
        *,
        name: str,
        description: str,
        run_id: str,
        decision: DecisionRequest,
        result: WorkflowResult,
    ) -> ExperimentResponse:
        runtime = self._runtime_summary()
        return ExperimentResponse(
            experiment_id=uuid4().hex,
            run_id=run_id,
            name=name,
            description=description,
            created_at=datetime.now(UTC).isoformat(),
            decision=decision,
            prompt_overrides=self._to_prompt_overrides_request(result.request.prompt_overrides),
            runtime=runtime,
            result=to_decision_response(run_id, result, runtime),
        )

    def _build_response_from_result(
        self,
        name: str,
        description: str,
        run_id: str,
        result: WorkflowResult,
    ) -> ExperimentResponse:
        decision = DecisionRequest(
            symbols=list(result.request.symbols),
            max_position_weight=result.request.max_position_weight,
            mandate=self._to_mandate_request(result.request.mandate),
        )
        return self._build_response(
            name=name,
            description=description,
            run_id=run_id,
            decision=decision,
            result=result,
        )

    def _runtime_summary(self) -> RuntimeSummaryItem:
        return RuntimeSummaryItem(
            data_mode=getattr(self._market_data_provider, "mode_name", "configured"),
            llm_mode="model" if self._llm_client.enabled else "fallback",
            model_name=getattr(self._llm_client, "model_name", None),
            agent_models=getattr(self._llm_client, "agent_model_names", None),
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

    def _to_investment_mandate(self, decision: DecisionRequest) -> InvestmentMandate | None:
        mandate = decision.mandate
        if mandate is None:
            return None
        return InvestmentMandate(
            objective=mandate.objective,
            allowed_symbols=tuple(mandate.allowed_symbols),
            excluded_symbols=tuple(mandate.excluded_symbols),
            max_position_weight=decision.max_position_weight,
            max_order_notional=mandate.max_order_notional,
            min_cash_weight=mandate.min_cash_weight,
            risk_tolerance=mandate.risk_tolerance,
            requires_approval_for_live_orders=mandate.requires_approval_for_live_orders,
            user_notes=mandate.user_notes,
        )

    def _to_mandate_request(self, mandate: InvestmentMandate | None) -> MandateRequest | None:
        if mandate is None:
            return None
        return MandateRequest(
            objective=mandate.objective,
            allowed_symbols=list(mandate.allowed_symbols),
            excluded_symbols=list(mandate.excluded_symbols),
            max_order_notional=mandate.max_order_notional,
            min_cash_weight=mandate.min_cash_weight,
            risk_tolerance=mandate.risk_tolerance,
            requires_approval_for_live_orders=mandate.requires_approval_for_live_orders,
            user_notes=mandate.user_notes,
        )

    def _to_prompt_overrides(
        self,
        request: AgentPromptOverridesRequest | AgentPromptOverrides,
    ) -> AgentPromptOverrides:
        if isinstance(request, AgentPromptOverrides):
            return request
        return AgentPromptOverrides(
            data_collection=request.data_collection,
            data_analysis=request.data_analysis,
            report=request.report,
            buy_sell=request.buy_sell,
            order_execution=request.order_execution,
            log_evaluation=request.log_evaluation,
        )

    def _to_prompt_overrides_request(
        self,
        request: AgentPromptOverridesRequest | AgentPromptOverrides,
    ) -> AgentPromptOverridesRequest:
        if isinstance(request, AgentPromptOverridesRequest):
            return request
        return AgentPromptOverridesRequest(
            data_collection=request.data_collection,
            data_analysis=request.data_analysis,
            report=request.report,
            buy_sell=request.buy_sell,
            order_execution=request.order_execution,
            log_evaluation=request.log_evaluation,
        )

    def _resolve_prompt_overrides(
        self,
        request_overrides: AgentPromptOverridesRequest,
    ) -> AgentPromptOverrides:
        if self._agent_prompt_service is None:
            return self._to_prompt_overrides(request_overrides)
        stored_overrides = self._agent_prompt_service.resolve_prompt_overrides(
            AgentPromptOverrides()
        )
        return AgentPromptOverrides(
            data_collection=request_overrides.data_collection or stored_overrides.data_collection,
            data_analysis=request_overrides.data_analysis or stored_overrides.data_analysis,
            report=request_overrides.report or stored_overrides.report,
            buy_sell=request_overrides.buy_sell or stored_overrides.buy_sell,
            order_execution=request_overrides.order_execution or stored_overrides.order_execution,
            log_evaluation=request_overrides.log_evaluation or stored_overrides.log_evaluation,
        )

    def _to_list_item(self, payload: dict[str, object]) -> ExperimentListItem:
        result = payload.get("result") if isinstance(payload, dict) else None
        if not isinstance(result, dict):
            raise ValueError("Experiment payload must include a result object.")
        decisions = result.get("decisions", [])
        decision_actions = {
            str(item.get("symbol")): str(item.get("action"))
            for item in decisions
            if isinstance(item, dict) and item.get("symbol") and item.get("action")
        }
        return ExperimentListItem.model_validate(
            {
                "experiment_id": payload.get("experiment_id"),
                "run_id": payload.get("run_id"),
                "name": payload.get("name"),
                "description": payload.get("description", ""),
                "created_at": payload.get("created_at"),
                "symbols": result.get("symbols", []),
                "decision_actions": decision_actions,
                "runtime": payload.get("runtime"),
            }
        )
