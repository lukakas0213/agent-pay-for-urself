"""Application service for durable workflow run history."""

from __future__ import annotations

from agent_pay_for_urself.api.models import (
    AgentStatusItem,
    AnalysisSummaryItem,
    DecisionResponse,
    TimelineEventItem,
    WorkflowBranchItem,
    WorkflowRunDetailResponse,
    WorkflowRunListItem,
)
from agent_pay_for_urself.repositories import WorkflowHistoryPayload, WorkflowHistoryRepository

AGENT_LABELS: tuple[tuple[str, str], ...] = (
    ("main_agent", "메인 에이전트"),
    ("data_collection", "데이터 수집"),
    ("data_analysis", "데이터 분석"),
    ("report", "보고서 작성"),
    ("buy_sell", "매수/매도 판단"),
    ("order_execution", "주문 실행"),
    ("log_evaluation", "로그/평가"),
)


class WorkflowHistoryService:
    """Build list and detail responses from persisted workflow payloads."""

    def __init__(self, repository: WorkflowHistoryRepository) -> None:
        self._repository = repository

    def list_runs(self) -> list[WorkflowRunListItem]:
        payloads = self._repository.list()
        child_map = self._build_child_map(payloads)
        return [self._to_list_item(payload, child_map) for payload in payloads]

    def get_run(self, run_id: str) -> WorkflowRunDetailResponse | None:
        payloads = self._repository.list()
        payload = next((item for item in payloads if item.get("run_id") == run_id), None)
        if payload is None:
            return None
        child_map = self._build_child_map(payloads)
        return self._to_detail_response(payload, child_map)

    def _to_list_item(
        self,
        payload: WorkflowHistoryPayload,
        child_map: dict[str, list[str]],
    ) -> WorkflowRunListItem:
        result = self._to_decision_response(payload)
        approved_count = sum(1 for item in result.investment_reports if item.risk_approved)
        return WorkflowRunListItem(
            run_id=result.run_id,
            created_at=result.created_at,
            symbols=result.symbols,
            objective=result.supervisor_directive.objective,
            summary=result.supervisor_directive.summary or result.user_prompt,
            branch=self._to_branch_item(payload, child_map),
            report_approved_count=approved_count,
            report_count=len(result.investment_reports),
            decision_actions={item.symbol: item.action for item in result.decisions},
        )

    def _to_detail_response(
        self,
        payload: WorkflowHistoryPayload,
        child_map: dict[str, list[str]],
    ) -> WorkflowRunDetailResponse:
        result = self._to_decision_response(payload)
        branch = self._to_branch_item(payload, child_map)
        return WorkflowRunDetailResponse(
            run_id=result.run_id,
            created_at=result.created_at,
            branch=branch,
            agent_statuses=self._build_agent_statuses(result),
            timeline=self._build_timeline(result, branch),
            analysis_summaries=self._build_analysis_summaries(result),
            result=result,
        )

    def _build_agent_statuses(self, result: DecisionResponse) -> list[AgentStatusItem]:
        status_by_key = {
            "main_agent": "connected",
            "data_collection": "connected" if result.market_data else "disconnected",
            "data_analysis": "connected" if result.analysis_signals else "disconnected",
            "report": "connected" if result.investment_reports else "disconnected",
            "buy_sell": "connected" if result.decisions else "disconnected",
            "order_execution": "connected" if result.orders else "disconnected",
            "log_evaluation": "connected"
            if result.evaluation_log.decision_count >= 0
            else "disconnected",
        }
        return [
            AgentStatusItem(agent_key=agent_key, label=label, status=status_by_key[agent_key])
            for agent_key, label in AGENT_LABELS
        ]

    def _build_timeline(
        self,
        result: DecisionResponse,
        branch: WorkflowBranchItem,
    ) -> list[TimelineEventItem]:
        event_specs: list[tuple[str | None, str, str, str]] = []
        if branch.branch_type != "initial":
            event_specs.append(
                (
                    "main_agent",
                    "후속 지시로 재실행",
                    (
                        f"parent run: {branch.parent_run_id}; "
                        f"message: {branch.trigger_message or 'n/a'}"
                    ),
                    "connected",
                )
            )
        event_specs.extend(
            [
                (
                    "main_agent",
                    "메인 에이전트 지시 확정",
                    result.supervisor_directive.summary or result.supervisor_directive.objective,
                    "connected",
                ),
                (
                    "data_collection",
                    "시장 데이터 수집",
                    f"{len(result.market_data)}개 종목 데이터 수집 완료",
                    "connected" if result.market_data else "disconnected",
                ),
                (
                    "data_analysis",
                    "분석 신호 생성",
                    f"{len(result.analysis_signals)}개 분석 신호 생성 완료",
                    "connected" if result.analysis_signals else "disconnected",
                ),
                (
                    "report",
                    "보고서 작성",
                    f"{len(result.investment_reports)}개 보고서 작성 완료",
                    "connected" if result.investment_reports else "disconnected",
                ),
                (
                    "buy_sell",
                    "매수/매도 판단",
                    f"{len(result.decisions)}개 최종 판단 생성 완료",
                    "connected" if result.decisions else "disconnected",
                ),
                (
                    "order_execution",
                    "주문 계획 생성",
                    f"{len(result.orders)}개 주문 계획 생성 완료",
                    "connected" if result.orders else "disconnected",
                ),
                (
                    "log_evaluation",
                    "실행 평가 기록",
                    f"blocked orders: {result.evaluation_log.blocked_order_count}",
                    "connected",
                ),
            ]
        )
        return [
            TimelineEventItem(
                event_id=f"{result.run_id}:{index}",
                agent_key=agent_key,
                title=title,
                detail=detail,
                status=status,
                created_at=result.created_at,
            )
            for index, (agent_key, title, detail, status) in enumerate(event_specs, start=1)
        ]

    def _build_analysis_summaries(self, result: DecisionResponse) -> list[AnalysisSummaryItem]:
        report_summary_by_symbol = {item.symbol: item.summary for item in result.investment_reports}
        return [
            AnalysisSummaryItem(
                symbol=item.symbol,
                total_score=item.total_score,
                summary=report_summary_by_symbol.get(item.symbol, item.rationale),
            )
            for item in result.analysis_signals
        ]

    def _to_branch_item(
        self,
        payload: WorkflowHistoryPayload,
        child_map: dict[str, list[str]],
    ) -> WorkflowBranchItem:
        run_id = str(payload.get("run_id", ""))
        parent_run_id = self._normalize_optional_string(payload.get("parent_run_id"))
        root_run_id = self._normalize_optional_string(payload.get("root_run_id")) or run_id
        branch_type = self._normalize_optional_string(payload.get("branch_type")) or "initial"
        trigger_message = self._normalize_optional_string(payload.get("trigger_message"))
        branch_depth = self._normalize_int(payload.get("branch_depth"))
        if branch_depth is None:
            branch_depth = 0 if branch_type == "initial" else 1
        return WorkflowBranchItem(
            branch_type=branch_type,
            parent_run_id=parent_run_id,
            root_run_id=root_run_id,
            branch_depth=branch_depth,
            trigger_message=trigger_message,
            child_run_ids=child_map.get(run_id, []),
        )

    def _build_child_map(
        self,
        payloads: list[WorkflowHistoryPayload],
    ) -> dict[str, list[str]]:
        child_map: dict[str, list[str]] = {}
        for payload in payloads:
            run_id = self._normalize_optional_string(payload.get("run_id"))
            parent_run_id = self._normalize_optional_string(payload.get("parent_run_id"))
            if run_id is None:
                continue
            child_map.setdefault(run_id, [])
            if parent_run_id is not None:
                child_map.setdefault(parent_run_id, []).append(run_id)
        return child_map

    def _normalize_optional_string(self, value: object) -> str | None:
        if not isinstance(value, str):
            return None
        stripped = value.strip()
        return stripped or None

    def _normalize_int(self, value: object) -> int | None:
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
        return None

    def _to_decision_response(self, payload: WorkflowHistoryPayload) -> DecisionResponse:
        return DecisionResponse.model_validate(payload)
