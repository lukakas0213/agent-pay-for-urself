"""Translate internal workflow schemas into public API responses."""

from agent_pay_for_urself.api.models import (
    AnalysisSignalItem,
    DecisionItem,
    DecisionResponse,
    EvaluationLogItem,
    MandateItem,
    MandateViolationItem,
    MarketDataItem,
    OrderItem,
    RiskAssessmentItem,
    RuntimeSummaryItem,
)
from agent_pay_for_urself.schemas import MarketData, WorkflowResult


def to_market_data_item(data: MarketData) -> MarketDataItem:
    """Convert one internal market data payload into the public API model."""

    return MarketDataItem(
        symbol=data.symbol,
        latest_price=data.latest_price,
        broker_exchange_code=data.broker_exchange_code,
        news_headlines=list(data.news_headlines),
        financial_metrics=data.financial_metrics,
    )


def to_decision_response(
    run_id: str,
    result: WorkflowResult,
    runtime: RuntimeSummaryItem | None = None,
) -> DecisionResponse:
    """Convert one workflow result into the public API response model."""

    return DecisionResponse(
        run_id=run_id,
        symbols=list(result.request.symbols),
        runtime=runtime,
        mandate=MandateItem(
            objective=result.mandate.objective,
            allowed_symbols=list(result.mandate.allowed_symbols),
            excluded_symbols=list(result.mandate.excluded_symbols),
            max_position_weight=result.mandate.max_position_weight,
            max_order_notional=result.mandate.max_order_notional,
            min_cash_weight=result.mandate.min_cash_weight,
            risk_tolerance=result.mandate.risk_tolerance,
            requires_approval_for_live_orders=result.mandate.requires_approval_for_live_orders,
            user_notes=result.mandate.user_notes,
        ),
        market_data=[to_market_data_item(data) for data in result.market_data],
        analysis_signals=[
            AnalysisSignalItem(
                symbol=signal.symbol,
                price_score=signal.price_score,
                news_score=signal.news_score,
                financial_score=signal.financial_score,
                total_score=round(signal.total_score, 4),
                rationale=signal.rationale,
            )
            for signal in result.analysis_signals
        ],
        risk_assessments=[
            RiskAssessmentItem(
                symbol=risk.symbol,
                approved=risk.approved,
                reasons=list(risk.reasons),
                max_position_weight=risk.max_position_weight,
            )
            for risk in result.risk_assessments
        ],
        decisions=[
            DecisionItem(
                symbol=decision.symbol,
                action=decision.action,
                confidence=decision.confidence,
                rationale=decision.rationale,
                risk_approved=decision.risk_approved,
            )
            for decision in result.trade_decisions
        ],
        orders=[
            OrderItem(
                symbol=order.symbol,
                action=order.action,
                quantity=order.quantity,
                broker_exchange_code=order.broker_exchange_code,
                limit_price=order.limit_price,
                should_submit=order.should_submit,
                reason=order.reason,
            )
            for order in result.order_plans
        ],
        evaluation_log=EvaluationLogItem(
            decision_count=result.evaluation_log.decision_count,
            order_count=result.evaluation_log.order_count,
            blocked_order_count=result.evaluation_log.blocked_order_count,
            notes=list(result.evaluation_log.notes),
        ),
        mandate_violations=[
            MandateViolationItem(
                symbol=violation.symbol,
                rule=violation.rule,
                message=violation.message,
            )
            for violation in result.mandate_violations
        ],
    )
