"""Application service for durable workflow run history."""

from __future__ import annotations

from agent_pay_for_urself.api.models import (
    AgentStatusItem,
    AnalysisSummaryItem,
    DecisionResponse,
    TimelineEventItem,
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
        return [self._to_list_item(payload) for payload in self._repository.list()]

    def get_run(self, run_id: str) -> WorkflowRunDetailResponse | None:
        payload = self._repository.get(run_id)
        if payload is None:
            return None
        return self._to_detail_response(payload)

    def _to_list_item(self, payload: WorkflowHistoryPayload) -> WorkflowRunListItem:
        result = self._to_decision_response(payload)
        approved_count = sum(1 for item in result.investment_reports if item.risk_approved)
        return WorkflowRunListItem(
            run_id=result.run_id,
            created_at=result.created_at,
            symbols=result.symbols,
            objective=result.supervisor_directive.objective,
            summary=result.supervisor_directive.summary or result.user_prompt,
            report_approved_count=approved_count,
            report_count=len(result.investment_reports),
            decision_actions={item.symbol: item.action for item in result.decisions},
        )

    def _to_detail_response(self, payload: WorkflowHistoryPayload) -> WorkflowRunDetailResponse:
        result = self._to_decision_response(payload)
        return WorkflowRunDetailResponse(
            run_id=result.run_id,
            created_at=result.created_at,
            agent_statuses=self._build_agent_statuses(result),
            timeline=self._build_timeline(result),
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

    def _build_timeline(self, result: DecisionResponse) -> list[TimelineEventItem]:
        event_specs = [
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

    def _to_decision_response(self, payload: WorkflowHistoryPayload) -> DecisionResponse:
        return DecisionResponse.model_validate(payload)
