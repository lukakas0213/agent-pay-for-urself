"""Deterministic console assistant replies for workflow results."""

from agent_pay_for_urself.api.models import AgentInteractionResponse, DecisionResponse


class ConsoleAssistantService:
    """Generates explainable, deterministic console replies."""

    def reply(
        self,
        message: str,
        current_result: DecisionResponse | None,
        *,
        applied_to_workflow: bool = False,
        updated_run_id: str | None = None,
    ) -> AgentInteractionResponse:
        normalized_message = message.strip().lower()

        if current_result is None:
            return AgentInteractionResponse(
                focus="analysis_required",
                reply=(
                    "아직 분석 결과가 없습니다. 먼저 종목과 최대 비중을 입력하고 분석을 실행하면, "
                    "그 결과를 기준으로 판단 근거와 보고서 리스크를 설명할 수 있습니다."
                ),
                suggested_actions=["종목 입력", "분석 실행", "보고서 기준 확인"],
                applied_to_workflow=applied_to_workflow,
                updated_run_id=updated_run_id,
                updated_result=current_result,
            )

        if applied_to_workflow:
            watch_text = ", ".join(current_result.supervisor_directive.watch_symbols) or "없음"
            return AgentInteractionResponse(
                focus="workflow_update",
                reply=(
                    f"메시지를 메인 에이전트 입력에 반영해 워크플로우를 다시 실행했습니다. "
                    f"현재 watch 심볼은 {watch_text}이고, "
                    f"주요 요약은 {current_result.supervisor_directive.summary or '없음'}입니다."
                ),
                suggested_actions=["업데이트된 판단 확인", "보고서 사유 확인", "추가 지시 입력"],
                applied_to_workflow=True,
                updated_run_id=updated_run_id,
                updated_result=current_result,
            )

        if any(
            keyword in normalized_message
            for keyword in ("리스크", "risk", "위험", "거절", "승인", "보고서")
        ):
            approved_count = sum(
                1 for report in current_result.investment_reports if report.risk_approved
            )
            rejected = [
                report.symbol
                for report in current_result.investment_reports
                if not report.risk_approved
            ]
            rejected_text = ", ".join(rejected) if rejected else "없음"
            return AgentInteractionResponse(
                focus="report",
                reply=(
                    f"보고서 에이전트는 {len(current_result.investment_reports)}개 종목 중 "
                    f"{approved_count}개를 리스크 승인했습니다. "
                    f"거절된 종목은 {rejected_text}입니다. "
                    "현재 기준은 종목별 최대 비중, 분석 근거, 데이터 결손 여부를 함께 요약합니다."
                ),
                suggested_actions=["보고서 탭 확인", "최대 비중 조정", "분석 재실행"],
            )

        if any(
            keyword in normalized_message for keyword in ("주문", "order", "실행", "수량", "제출")
        ):
            submittable = [order.symbol for order in current_result.orders if order.should_submit]
            blocked_count = len(current_result.orders) - len(submittable)
            submittable_text = ", ".join(submittable) if submittable else "없음"
            order_count = len(current_result.orders)
            return AgentInteractionResponse(
                focus="order",
                reply=(
                    f"주문 실행 에이전트는 주문 계획 {order_count}개를 만들었습니다. "
                    f"제출 가능 종목은 {submittable_text}이고, "
                    f"차단된 계획은 {blocked_count}개입니다. "
                    "현재 구현은 실제 브로커 주문을 전송하지 않습니다."
                ),
                suggested_actions=[
                    "주문 계획 탭 확인",
                    "실제 주문 전 승인 단계 설계",
                    "브로커 어댑터 보류",
                ],
            )

        if any(
            keyword in normalized_message
            for keyword in ("왜", "판단", "결정", "buy", "sell", "hold", "매수", "매도", "보류")
        ):
            decisions = ", ".join(
                f"{decision.symbol}: {decision.action}({decision.confidence:.2f})"
                for decision in current_result.decisions
            )
            return AgentInteractionResponse(
                focus="decision",
                reply=(
                    f"매수/매도 판단 에이전트의 현재 결론은 {decisions}입니다. "
                    "판단은 분석 결과를 요약한 보고서와 그 안의 리스크 승인 여부를 "
                    "함께 반영합니다. 보고서 리스크가 승인되지 않으면 HOLD로 제한됩니다."
                ),
                suggested_actions=[
                    "매수/매도 판단 탭 확인",
                    "보고서 근거 비교",
                    "리스크 사유 확인",
                ],
            )

        if any(
            keyword in normalized_message
            for keyword in ("데이터", "수집", "가격", "뉴스", "재무", "data")
        ):
            collected = ", ".join(
                f"{data.symbol}: price={data.latest_price}" for data in current_result.market_data
            )
            return AgentInteractionResponse(
                focus="collection",
                reply=(
                    "데이터 수집 에이전트는 현재 configured provider에서 "
                    f"{collected} 데이터를 받았습니다. "
                    "뉴스 헤드라인과 재무 지표는 데이터 수집 탭에서 종목별로 확인할 수 있습니다."
                ),
                suggested_actions=[
                    "데이터 수집 탭 확인",
                    "실제 데이터 provider 설계",
                    "분석 재실행",
                ],
            )

        summary = ", ".join(
            f"{decision.symbol}: {decision.action}" for decision in current_result.decisions
        )
        return AgentInteractionResponse(
            focus="summary",
            reply=(
                f"현재 워크플로우는 {len(current_result.symbols)}개 종목을 처리했고 결론은 "
                f"{summary}입니다. 메인 에이전트 요약은 "
                f"{current_result.supervisor_directive.summary or '없음'}입니다. "
                f"주문 계획은 {current_result.evaluation_log.order_count}개이며, "
                f"차단된 주문 계획은 "
                f"{current_result.evaluation_log.blocked_order_count}개입니다."
            ),
            suggested_actions=["에이전트 모니터 확인", "보고서 기준 조정", "다른 종목 분석"],
        )
