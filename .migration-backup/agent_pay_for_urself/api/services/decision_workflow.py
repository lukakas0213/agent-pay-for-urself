"""Application service for running and retrieving decision workflows."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from agent_pay_for_urself.adapters import MarketDataProvider, StubMarketDataProvider
from agent_pay_for_urself.api.mappers.workflow import to_decision_response
from agent_pay_for_urself.api.models.decisions import RuntimeSummaryItem
from agent_pay_for_urself.api.services.agent_prompts import AgentPromptService
from agent_pay_for_urself.llm import AgentLLMClient, NoopAgentLLMClient
from agent_pay_for_urself.orchestrator import MainAgent
from agent_pay_for_urself.repositories import WorkflowHistoryRepository
from agent_pay_for_urself.repositories.workflow_runs import WorkflowRunRepository
from agent_pay_for_urself.schemas import (
    AgentPromptOverrides,
    InvestmentMandate,
    InvestmentRequest,
    WorkflowResult,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StoredWorkflowRun:
    """Stored workflow metadata returned to API routes after one run completes."""

    run_id: str
    created_at: str
    result: WorkflowResult


class DecisionWorkflowService:
    """Runs the orchestrator and stores workflow results behind a repository."""

    def __init__(
        self,
        main_agent: MainAgent,
        workflow_run_repository: WorkflowRunRepository,
        workflow_history_repository: WorkflowHistoryRepository | None = None,
        market_data_provider: MarketDataProvider | None = None,
        llm_client: AgentLLMClient | None = None,
        agent_prompt_service: AgentPromptService | None = None,
    ) -> None:
        self._main_agent = main_agent
        self._workflow_run_repository = workflow_run_repository
        self._workflow_history_repository = workflow_history_repository
        self._market_data_provider = market_data_provider or StubMarketDataProvider()
        self._llm_client = llm_client or NoopAgentLLMClient()
        self._agent_prompt_service = agent_prompt_service

    def run(
        self,
        symbols: list[str],
        max_position_weight: float,
        mandate: InvestmentMandate | None = None,
        user_prompt: str = "",
        chat_messages: list[str] | None = None,
    ) -> StoredWorkflowRun:
        request = self._build_request(
            symbols=symbols,
            max_position_weight=max_position_weight,
            mandate=mandate,
            user_prompt=user_prompt,
            chat_messages=chat_messages or [],
        )
        return self._run_request(request)

    def rerun_with_message(self, run_id: str, message: str) -> StoredWorkflowRun:
        previous_result = self.get(run_id)
        if previous_result is None:
            raise KeyError(run_id)
        request = self._build_request(
            symbols=list(previous_result.request.symbols),
            max_position_weight=previous_result.mandate.max_position_weight,
            mandate=previous_result.mandate,
            user_prompt=previous_result.request.user_prompt,
            chat_messages=[*previous_result.request.chat_messages, message],
        )
        return self._run_request(request)

    def get(self, run_id: str) -> WorkflowResult | None:
        return self._workflow_run_repository.get(run_id)

    def _build_request(
        self,
        symbols: list[str],
        max_position_weight: float,
        mandate: InvestmentMandate | None,
        user_prompt: str,
        chat_messages: list[str],
    ) -> InvestmentRequest:
        return InvestmentRequest(
            symbols=tuple(symbols),
            max_position_weight=max_position_weight,
            mandate=mandate,
            user_prompt=user_prompt,
            chat_messages=tuple(chat_messages),
            prompt_overrides=self._resolve_prompt_overrides(),
        )

    def _run_request(self, request: InvestmentRequest) -> StoredWorkflowRun:
        created_at = datetime.now(UTC).isoformat()
        result = self._main_agent.run(request)
        run_id = self._workflow_run_repository.save(result)
        self._save_history(run_id=run_id, result=result, created_at=created_at)
        logger.info(
            "workflow_completed run_id=%s symbols=%s decisions=%s orders=%s mandate_violations=%s",
            run_id,
            ",".join(result.request.symbols),
            len(result.trade_decisions),
            len(result.order_plans),
            len(result.mandate_violations),
        )
        return StoredWorkflowRun(run_id=run_id, created_at=created_at, result=result)

    def _resolve_prompt_overrides(self) -> AgentPromptOverrides:
        if self._agent_prompt_service is None:
            return AgentPromptOverrides()
        return self._agent_prompt_service.resolve_prompt_overrides(AgentPromptOverrides())

    def _save_history(self, *, run_id: str, result: WorkflowResult, created_at: str) -> None:
        if self._workflow_history_repository is None:
            return
        response = to_decision_response(
            run_id,
            result,
            self.runtime_summary(),
            created_at=created_at,
        )
        self._workflow_history_repository.save(response.model_dump(mode="json"))

    def runtime_summary(self) -> RuntimeSummaryItem:
        """Expose the current workflow runtime mode for API responses."""

        broker_adapter = getattr(
            getattr(self._main_agent, "order_execution_agent", None), "broker_adapter", None
        )
        return RuntimeSummaryItem(
            data_mode=getattr(self._market_data_provider, "mode_name", "configured"),
            llm_mode="model" if self._llm_client.enabled else "fallback",
            model_name=getattr(self._llm_client, "model_name", None),
            agent_models=getattr(self._llm_client, "agent_model_names", None),
            live_order_enabled=bool(getattr(broker_adapter, "supports_live_submission", False)),
        )
