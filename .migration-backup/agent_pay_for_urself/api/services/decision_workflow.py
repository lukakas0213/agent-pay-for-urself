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
from agent_pay_for_urself.repositories import WorkflowHistoryPayload, WorkflowHistoryRepository
from agent_pay_for_urself.repositories.workflow_runs import WorkflowRunRepository
from agent_pay_for_urself.schemas import (
    AgentPromptOverrides,
    InvestmentMandate,
    InvestmentRequest,
    WorkflowResult,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class WorkflowBranchMetadata:
    """Internal lineage metadata attached to one stored workflow run."""

    branch_type: str
    parent_run_id: str | None
    root_run_id: str | None
    branch_depth: int
    trigger_message: str | None = None


@dataclass(frozen=True)
class StoredWorkflowRun:
    """Stored workflow metadata returned to API routes after one run completes."""

    run_id: str
    created_at: str
    result: WorkflowResult
    branch: WorkflowBranchMetadata


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
        return self._run_request(
            request,
            parent_run_id=run_id,
            trigger_message=message,
        )

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

    def _run_request(
        self,
        request: InvestmentRequest,
        *,
        parent_run_id: str | None = None,
        trigger_message: str | None = None,
    ) -> StoredWorkflowRun:
        created_at = datetime.now(UTC).isoformat()
        result = self._main_agent.run(request)
        run_id = self._workflow_run_repository.save(result)
        branch = self._build_branch_metadata(run_id, parent_run_id, trigger_message)
        self._save_history(
            run_id=run_id,
            result=result,
            created_at=created_at,
            branch=branch,
        )
        logger.info(
            "workflow_completed run_id=%s symbols=%s decisions=%s orders=%s mandate_violations=%s",
            run_id,
            ",".join(result.request.symbols),
            len(result.trade_decisions),
            len(result.order_plans),
            len(result.mandate_violations),
        )
        return StoredWorkflowRun(
            run_id=run_id,
            created_at=created_at,
            result=result,
            branch=branch,
        )

    def _build_branch_metadata(
        self,
        run_id: str,
        parent_run_id: str | None,
        trigger_message: str | None,
    ) -> WorkflowBranchMetadata:
        if parent_run_id is None:
            return WorkflowBranchMetadata(
                branch_type="initial",
                parent_run_id=None,
                root_run_id=run_id,
                branch_depth=0,
                trigger_message=None,
            )
        parent_branch = self._get_branch_metadata(parent_run_id)
        return WorkflowBranchMetadata(
            branch_type="followup_rerun",
            parent_run_id=parent_run_id,
            root_run_id=parent_branch.root_run_id or parent_run_id,
            branch_depth=parent_branch.branch_depth + 1,
            trigger_message=(trigger_message or "").strip() or None,
        )

    def _get_branch_metadata(self, run_id: str) -> WorkflowBranchMetadata:
        if self._workflow_history_repository is None:
            return WorkflowBranchMetadata(
                branch_type="initial",
                parent_run_id=None,
                root_run_id=run_id,
                branch_depth=0,
                trigger_message=None,
            )
        payload = self._workflow_history_repository.get(run_id)
        if payload is None:
            return WorkflowBranchMetadata(
                branch_type="initial",
                parent_run_id=None,
                root_run_id=run_id,
                branch_depth=0,
                trigger_message=None,
            )
        return WorkflowBranchMetadata(
            branch_type=self._normalize_string(payload.get("branch_type")) or "initial",
            parent_run_id=self._normalize_string(payload.get("parent_run_id")),
            root_run_id=self._normalize_string(payload.get("root_run_id")) or run_id,
            branch_depth=self._normalize_int(payload.get("branch_depth"), default=0),
            trigger_message=self._normalize_string(payload.get("trigger_message")),
        )

    def _resolve_prompt_overrides(self) -> AgentPromptOverrides:
        if self._agent_prompt_service is None:
            return AgentPromptOverrides()
        return self._agent_prompt_service.resolve_prompt_overrides(AgentPromptOverrides())

    def _save_history(
        self,
        *,
        run_id: str,
        result: WorkflowResult,
        created_at: str,
        branch: WorkflowBranchMetadata,
    ) -> None:
        if self._workflow_history_repository is None:
            return
        response = to_decision_response(
            run_id,
            result,
            self.runtime_summary(),
            created_at=created_at,
        )
        history_payload: WorkflowHistoryPayload = response.model_dump(mode="json")
        history_payload.update(
            {
                "branch_type": branch.branch_type,
                "parent_run_id": branch.parent_run_id,
                "root_run_id": branch.root_run_id,
                "branch_depth": branch.branch_depth,
                "trigger_message": branch.trigger_message,
            }
        )
        self._workflow_history_repository.save(history_payload)

    def _normalize_string(self, value: object) -> str | None:
        if not isinstance(value, str):
            return None
        stripped = value.strip()
        return stripped or None

    def _normalize_int(self, value: object, *, default: int) -> int:
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
        return default

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
