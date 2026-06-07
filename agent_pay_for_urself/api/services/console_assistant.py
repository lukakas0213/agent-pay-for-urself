"""Deterministic console assistant replies for workflow results."""

from agent_pay_for_urself.api.models import AgentInteractionResponse, DecisionResponse


class ConsoleAssistantService:
    """Generates explainable, deterministic console replies."""

    def reply(
        self,
        message: str,
        current_result: DecisionResponse | None,
    ) -> AgentInteractionResponse:
        normalized_message = message.strip().lower()

        if current_result is None:
            return AgentInteractionResponse(
                focus="analysis_required",
                reply=(
                    "아직 분석 결과가 없습니다. 먼저 종목과 최대 비중을 입력하고 분석을 실행하면, "
                    "그 결과를 기준으로 판단 근거와 리스크를 설명할 수 있습니다."
                ),
                suggested_actions=["종목 입력", "분석 실행", "리스크 기준 확인"],
            )

        if any(
            keyword in normalized_message for keyword in ("리스크", "risk", "위험", "거절", "승인")
        ):
            approved_count = sum(1 for risk in current_result.risk_assessments if risk.approved)
            rejected = [
                risk.symbol for risk in current_result.risk_assessments if not risk.approved
            ]
            rejected_text = ", ".join(rejected) if rejected else "없음"
            return AgentInteractionResponse(
                focus="risk",
                reply=(
                    f"리스크 관리 에이전트는 {len(current_result.risk_assessments)}개 종목 중 "
                    f"{approved_count}개를 승인했습니다. 거절된 종목은 {rejected_text}입니다. "
                    "현재 기준은 종목별 최대 비중과 분석 근거 유무를 중심으로 확인합니다."
                ),
                suggested_actions=["최대 비중 조정", "리스크 탭 확인", "분석 재실행"],
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
                    "판단은 분석 점수와 리스크 승인 여부를 함께 반영합니다. "
                    "리스크가 승인되지 않으면 HOLD로 제한됩니다."
                ),
                suggested_actions=["매수/매도 판단 탭 확인", "분석 점수 비교", "리스크 사유 확인"],
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
                    "데이터 수집 에이전트는 현재 stub provider에서 "
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
                f"{summary}입니다. 주문 계획은 {current_result.evaluation_log.order_count}개이며, "
                "차단된 주문 계획은 "
                f"{current_result.evaluation_log.blocked_order_count}개입니다."
            ),
            suggested_actions=["에이전트 모니터 확인", "리스크 기준 조정", "다른 종목 분석"],
        )
